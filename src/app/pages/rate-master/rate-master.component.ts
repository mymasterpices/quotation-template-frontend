import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  MetalRateService,
  MetalRate,
} from '../../services/rates/metal-rate.service';
import {
  StonePriceChartService,
  StonePriceChart,
  StoneTypeOption,
  ShapeOption,
} from '../../services/rates/stone-price-chart.service';

import {
  MetalPurityService,
  MetalPurity,
} from '../../services/metal-purity.service';
import {
  CNumberService,
  CNumberRates,
} from '../../services/rates/c-number.service';

import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

type RateKind = 'metal' | 'diamond' | 'stone';

// A normalized shape used for every "type" dropdown (diamond types AND gemstone types)
// so the select markup and the mapping logic can be identical for both.
interface TypeOption {
  name: string;
  value: string;
}

// stoneCode reserved for diamonds — everything else in StonePriceChart is a gemstone
const DIAMOND_CODES = ['DW'];

// Preset keys offered as quick-fill buttons in the band editor
const DIAMOND_GRADE_KEYS = [
  'G-H_SI',
  'G-H_VS-SI',
  'I-J_SI',
  'G-H_VS',
  'I-J_VS-SI',
];
const STONE_GRADE_KEYS = ['natural', 'enhanced'];

@Component({
  selector: 'app-rate-master',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TabsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    ToggleSwitchModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './rate-master.component.html',
  styleUrl: './rate-master.component.css',
})
export class RateMasterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  // --- Metal (unchanged) ---
  private metalRateService = inject(MetalRateService);
  private metalPurityService = inject(MetalPurityService);
  metalRates: MetalRate[] = [];
  metalPurityOptions: MetalPurity[] = [];
  metalTypeOptions = [
    { label: 'Gold', value: 'GOLD' },
    { label: 'Silver', value: 'SILVER' },
    { label: 'Platinum', value: 'PLATINUM' },
  ];
  metalForm: FormGroup = this.fb.group({
    metalType: ['GOLD', Validators.required],
    purity: [null, Validators.required],
    ratePerGram: [null, [Validators.required, Validators.min(0.01)]],
    isActive: [true],
  });

  // --- Diamond / Gemstone (now backed by StonePriceChart) ---
  private stonePriceChartService = inject(StonePriceChartService);

  diamondCharts: StonePriceChart[] = [];
  gemstoneCharts: StonePriceChart[] = [];

  // FIX: no separate master-data services — options are derived from the
  // stone-type/shape pairs that already exist across all price charts.
  private allStoneTypeOptions: StoneTypeOption[] = [];
  diamondTypeOptions: StoneTypeOption[] = []; // stoneCode in DIAMOND_CODES
  stoneTypeOptions: StoneTypeOption[] = []; // everything else (gemstones)
  shapeOptions: ShapeOption[] = []; // shared shape list for both diamond & stone charts

  // A brand-new stone type / shape (never used on any chart yet) obviously
  // won't be in the derived lists above, so the dialog offers a manual-entry
  // fallback toggled by these flags.
  useCustomStoneType = false;
  useCustomShape = false;

  diamondGradeKeys = DIAMOND_GRADE_KEYS;
  stoneGradeKeys = STONE_GRADE_KEYS;

  pricingModelOptions = [
    {
      label: 'Grade Banded (diamonds — 5 quality tiers)',
      value: 'GRADE_BANDED',
    },
    {
      label: 'Size Banded Flat (natural/enhanced by carat range)',
      value: 'SIZE_BANDED_FLAT',
    },
    { label: 'Single Flat (one rate, no banding)', value: 'SINGLE_FLAT' },
  ];

  chartForm: FormGroup = this.fb.group({
    stoneType: [null, Validators.required],
    stoneCode: [null, Validators.required],
    pricingModel: ['GRADE_BANDED', Validators.required],
    shape: [null],
    shapeCode: [null],
    isActive: [true],
    bands: this.fb.array([this.createBandGroup()]),
  });

  get bandsArray(): FormArray {
    return this.chartForm.get('bands') as FormArray;
  }

  // FIX: the dropdown for "Stone Type" must switch its source list depending on
  // whether we're adding/editing a diamond chart or a gemstone chart.
  get typeOptionsForActiveKind(): StoneTypeOption[] {
    return this.activeKind === 'diamond'
      ? this.diamondTypeOptions
      : this.stoneTypeOptions;
  }

  // FIX: SINGLE_FLAT pricing has no size bands at all — the dialog should show a
  // single rate field instead of the full band editor.
  get isSingleFlat(): boolean {
    return this.chartForm.get('pricingModel')?.value === 'SINGLE_FLAT';
  }

  // Bound to the (object-valued) type/shape selects in the dialog so that choosing
  // an option can populate BOTH the display name and the code field on chartForm.
  selectedStoneTypeObj: StoneTypeOption | null = null;
  selectedShapeObj: ShapeOption | null = null;

  // --- C-Number (country markup) ---
  private cNumberService = inject(CNumberService);
  cNumberRecord: CNumberRates | null = null;
  cNumberLoading = true;
  cNumberSaving = false;
  cNumberForm: FormGroup = this.fb.group({
    india: [null, [Validators.required, Validators.min(0)]],
    restOfWorld: [null, [Validators.required, Validators.min(0)]],
  });

  // --- Shared dialog/table state ---
  dialogVisible = false;
  dialogMode: 'add' | 'edit' = 'add';
  activeKind: RateKind = 'metal';
  editingId: string | null = null;

  ngOnInit(): void {
    this.loadLookups();
    this.loadAllRates();
    this.loadCNumber();
  }

  private loadLookups(): void {
    this.metalPurityService
      .getAll()
      .subscribe(
        (d) => (this.metalPurityOptions = d.filter((o) => o.isActive)),
      );

    this.stonePriceChartService.getDistinctStoneTypes().subscribe((all) => {
      this.allStoneTypeOptions = all;
      this.diamondTypeOptions = all.filter((t) =>
        DIAMOND_CODES.includes(t.stoneCode.toUpperCase()),
      );
      this.stoneTypeOptions = all.filter(
        (t) => !DIAMOND_CODES.includes(t.stoneCode.toUpperCase()),
      );
    });

    this.stonePriceChartService
      .getDistinctShapes()
      .subscribe((d) => (this.shapeOptions = d));
  }

  loadAllRates(): void {
    this.metalRateService.getAll().subscribe((d) => (this.metalRates = d));

    this.stonePriceChartService.getCharts().subscribe((all) => {
      this.diamondCharts = all.filter((c) =>
        DIAMOND_CODES.includes(c.stoneCode.toUpperCase()),
      );
      this.gemstoneCharts = all.filter(
        (c) => !DIAMOND_CODES.includes(c.stoneCode.toUpperCase()),
      );
    });
  }

  private loadCNumber(): void {
    this.cNumberLoading = true;
    this.cNumberService.getCurrent().subscribe({
      next: (rec) => {
        this.cNumberRecord = rec;
        this.cNumberForm.patchValue({
          india: rec.india,
          restOfWorld: rec.restOfWorld,
        });
        this.cNumberLoading = false;
      },
      error: (err: any) => {
        console.error(err);
        this.cNumberLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Failed to load country markup',
        });
      },
    });
  }

  saveCNumber(): void {
    if (this.cNumberForm.invalid || !this.cNumberRecord) {
      this.cNumberForm.markAllAsTouched();
      return;
    }
    this.cNumberSaving = true;
    this.cNumberService.update(this.cNumberForm.value).subscribe({
      next: (rec) => {
        this.cNumberRecord = rec;
        this.cNumberSaving = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Country markup updated',
          life: 2500,
        });
      },
      error: (err: any) => {
        console.error(err);
        this.cNumberSaving = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Save failed',
          detail: err.error?.message ?? 'Server error',
        });
      },
    });
  }

  // --- Band FormArray helpers ---
  private createBandGroup(): FormGroup {
    return this.fb.group({
      sizeMin: [null, [Validators.required, Validators.min(0)]],
      sizeMax: [null, [Validators.required, Validators.min(0)]],
      rates: this.fb.array([this.createRateEntry()]),
    });
  }

  private createRateEntry(key = ''): FormGroup {
    return this.fb.group({
      key: [key, Validators.required],
      value: [null, [Validators.required, Validators.min(0)]],
    });
  }

  ratesArrayFor(bandIndex: number): FormArray {
    return this.bandsArray.at(bandIndex).get('rates') as FormArray;
  }

  addBandRow(): void {
    this.bandsArray.push(this.createBandGroup());
  }

  removeBandRow(index: number): void {
    if (this.bandsArray.length > 1) this.bandsArray.removeAt(index);
  }

  addRateEntry(bandIndex: number, presetKey = ''): void {
    const rates = this.ratesArrayFor(bandIndex);
    // avoid duplicate preset keys within the same band
    const exists = rates.value.some((r: any) => r.key === presetKey);
    if (presetKey && exists) return;
    rates.push(this.createRateEntry(presetKey));
  }

  removeRateEntry(bandIndex: number, rateIndex: number): void {
    const rates = this.ratesArrayFor(bandIndex);
    if (rates.length > 1) rates.removeAt(rateIndex);
  }

  presetKeysFor(pricingModel: string): string[] {
    return pricingModel === 'GRADE_BANDED'
      ? this.diamondGradeKeys
      : this.stoneGradeKeys;
  }

  // FIX: previously nothing reset the bands array when the pricing model changed,
  // so leftover grade keys from one model (e.g. GRADE_BANDED's "G-H_SI") could be
  // saved against a chart using a different model. Now the band structure is
  // rebuilt to match whatever model is currently selected.
  onPricingModelChange(): void {
    const model = this.chartForm.get('pricingModel')!.value;
    this.bandsArray.clear();

    if (model === 'SINGLE_FLAT') {
      const band = this.createBandGroup();
      const rates = band.get('rates') as FormArray;
      rates.clear();
      rates.push(this.createRateEntry('flat'));
      band.patchValue({ sizeMin: 0, sizeMax: 0 });
      this.bandsArray.push(band);
    } else {
      this.bandsArray.push(this.createBandGroup());
    }
  }

  // FIX: the select is bound to the whole option object (not just a string), so on
  // selection we explicitly copy BOTH the human name and the code onto chartForm.
  // This is what actually fixes the "rate mapping" — stoneType/stoneCode (and
  // shape/shapeCode below) can no longer end up out of sync.
  onStoneTypeSelect(item: StoneTypeOption | null): void {
    this.selectedStoneTypeObj = item;
    this.chartForm.patchValue({
      stoneType: item?.stoneType ?? null,
      stoneCode: item?.stoneCode ?? null,
    });
  }

  onShapeSelect(item: ShapeOption | null): void {
    this.selectedShapeObj = item;
    this.chartForm.patchValue({
      shape: item?.shape ?? null,
      shapeCode: item?.shapeCode ?? null,
    });
  }

  // Toggle between picking an existing stone type and typing a brand-new one
  // that has never appeared on a chart yet (so it can't be in the derived list).
  toggleCustomStoneType(useCustom: boolean): void {
    this.useCustomStoneType = useCustom;
    this.selectedStoneTypeObj = null;
    this.chartForm.patchValue({ stoneType: null, stoneCode: null });
  }

  toggleCustomShape(useCustom: boolean): void {
    this.useCustomShape = useCustom;
    this.selectedShapeObj = null;
    this.chartForm.patchValue({ shape: null, shapeCode: null });
  }

  // Converts the chartForm's bands (array of {key,value} pairs) into the
  // gradeRates object shape the API expects: { sizeMin, sizeMax, gradeRates: {...} }
  private serializeBands(bands: any[]): any[] {
    return bands.map((b) => {
      const gradeRates: Record<string, number> = {};
      (b.rates || []).forEach((r: any) => {
        if (r.key) gradeRates[r.key] = r.value;
      });
      return { sizeMin: b.sizeMin, sizeMax: b.sizeMax, gradeRates };
    });
  }

  // Converts an API chart's bands (gradeRates object) back into the
  // form's {key,value} pair array shape for editing.
  private deserializeBands(bands: any[]): any[] {
    return bands.map((b) => ({
      sizeMin: b.sizeMin,
      sizeMax: b.sizeMax,
      rates: Object.entries(b.gradeRates || {}).map(([key, value]) => ({
        key,
        value,
      })),
    }));
  }

  // --- Dialog open helpers ---
  openAdd(kind: RateKind): void {
    this.activeKind = kind;
    this.dialogMode = 'add';
    this.editingId = null;
    this.selectedStoneTypeObj = null;
    this.selectedShapeObj = null;
    this.useCustomStoneType = false;
    this.useCustomShape = false;
    this.resetForm(kind);
    this.dialogVisible = true;
  }

  openEdit(kind: RateKind, row: MetalRate | StonePriceChart): void {
    this.activeKind = kind;
    this.dialogMode = 'edit';
    this.editingId = (row as any)._id;

    if (kind === 'metal') {
      this.metalForm.patchValue(row as MetalRate);
    } else {
      const chart = row as StonePriceChart;
      this.chartForm.patchValue({
        stoneType: chart.stoneType,
        stoneCode: chart.stoneCode,
        pricingModel: chart.pricingModel,
        shape: chart.shape ?? null,
        shapeCode: chart.shapeCode ?? null,
        isActive: chart.isActive,
      });

      // FIX: rehydrate the object-bound selects so the dropdowns show the correct
      // selection (not just the underlying string fields on the form). If the
      // chart's code isn't in the derived list for some reason, fall back to
      // custom-entry mode so the raw values are still shown and editable.
      const typeList = this.typeOptionsForActiveKind;
      const matchedType = typeList.find(
        (t) => t.stoneCode.toUpperCase() === chart.stoneCode?.toUpperCase(),
      );
      this.useCustomStoneType = !matchedType;
      this.selectedStoneTypeObj = matchedType ?? null;

      const matchedShape = chart.shapeCode
        ? this.shapeOptions.find(
            (s) => s.shapeCode.toUpperCase() === chart.shapeCode?.toUpperCase(),
          )
        : undefined;
      this.useCustomShape = !!chart.shapeCode && !matchedShape;
      this.selectedShapeObj = matchedShape ?? null;

      const bandsArray = this.bandsArray;
      bandsArray.clear();
      this.deserializeBands(chart.bands).forEach((b) => {
        const bandGroup = this.createBandGroup();
        bandGroup.patchValue({ sizeMin: b.sizeMin, sizeMax: b.sizeMax });
        const ratesArray = bandGroup.get('rates') as FormArray;
        ratesArray.clear();
        b.rates.forEach((r: any) => {
          ratesArray.push(this.createRateEntry(r.key));
        });
        b.rates.forEach((r: any, i: number) => ratesArray.at(i).patchValue(r));
        bandsArray.push(bandGroup);
      });
    }

    this.dialogVisible = true;
  }

  private resetForm(kind: RateKind): void {
    if (kind === 'metal') {
      this.metalForm.reset({ metalType: 'GOLD', isActive: true });
    } else {
      // FIX: default pricing model now matches the tab it was opened from,
      // instead of always defaulting to GRADE_BANDED even for gemstones.
      const defaultModel =
        kind === 'diamond' ? 'GRADE_BANDED' : 'SIZE_BANDED_FLAT';
      this.chartForm.reset({
        pricingModel: defaultModel,
        isActive: true,
      });
      this.onPricingModelChange();
    }
  }

  // --- Save (create or update) ---
  save(): void {
    if (this.activeKind === 'metal') {
      this.saveMetal();
    } else {
      this.saveChart();
    }
  }

  private saveMetal(): void {
    if (this.metalForm.invalid) {
      this.metalForm.markAllAsTouched();
      return;
    }
    const payload = this.metalForm.value;
    const request$: Observable<any> =
      this.dialogMode === 'add'
        ? this.metalRateService.create(payload)
        : this.metalRateService.update(this.editingId!, payload);

    request$.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.dialogMode === 'add' ? 'Rate added' : 'Rate updated',
          life: 2500,
        });
        this.dialogVisible = false;
        this.loadAllRates();
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: 'Save failed',
          detail: err.error?.message ?? 'Server error',
        });
      },
    });
  }

  private saveChart(): void {
    if (this.chartForm.invalid) {
      this.chartForm.markAllAsTouched();
      return;
    }
    const raw = this.chartForm.value;
    const payload = {
      stoneType: raw.stoneType,
      stoneCode: raw.stoneCode,
      pricingModel: raw.pricingModel,
      shape: raw.shape || undefined,
      shapeCode: raw.shapeCode || undefined,
      isActive: raw.isActive,
      bands: this.serializeBands(raw.bands),
    };

    const request$: Observable<any> =
      this.dialogMode === 'add'
        ? this.stonePriceChartService.create(payload)
        : this.stonePriceChartService.update(this.editingId!, payload);

    request$.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary:
            this.dialogMode === 'add'
              ? 'Price chart added'
              : 'Price chart updated',
          life: 2500,
        });
        this.dialogVisible = false;
        this.loadAllRates();
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: 'Save failed',
          detail: err.error?.message ?? 'Server error',
        });
      },
    });
  }

  // --- Delete with confirm ---
  confirmDelete(kind: RateKind, row: MetalRate | StonePriceChart): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this entry?',
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { severity: 'danger', label: 'Delete' },
      rejectButtonProps: {
        severity: 'secondary',
        label: 'Cancel',
        outlined: true,
      },
      accept: () => {
        const request$: Observable<any> =
          kind === 'metal'
            ? this.metalRateService.delete((row as MetalRate)._id)
            : this.stonePriceChartService.delete((row as StonePriceChart)._id);

        request$.subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Deleted',
              life: 2000,
            });
            this.loadAllRates();
          },
          error: (err: any) => {
            console.error(err);
            this.messageService.add({
              severity: 'error',
              summary: 'Delete failed',
            });
          },
        });
      },
    });
  }

  // --- Quick toggle active/inactive directly from the table ---
  toggleActive(kind: RateKind, row: MetalRate | StonePriceChart): void {
    const request$: Observable<any> =
      kind === 'metal'
        ? this.metalRateService.update((row as MetalRate)._id, {
            isActive: !row.isActive,
          })
        : this.stonePriceChartService.update((row as StonePriceChart)._id, {
            isActive: !row.isActive,
          });

    request$.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Status updated',
          life: 1500,
        });
        this.loadAllRates();
      },
      error: (err: any) => console.error(err),
    });
  }

  labelFor(
    options: { label: string; value: string }[],
    value?: string,
  ): string {
    return options.find((o) => o.value === value)?.label ?? value ?? '—';
  }

  bandSummary(chart: StonePriceChart): string {
    return `${chart.bands.length} band${chart.bands.length !== 1 ? 's' : ''}`;
  }
}