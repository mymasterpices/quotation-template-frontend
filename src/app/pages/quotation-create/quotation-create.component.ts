import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin, merge, of } from 'rxjs';
import { catchError, debounceTime, map } from 'rxjs/operators';

import {
  MetalPurityService,
  MetalPurity,
} from '../../services/metal-purity.service';

import { MetalRateService } from '../../services/rates/metal-rate.service';
import {
  StonePriceChartService,
  StonePriceChart,
  StonePriceChartResult,
} from '../../services/rates/stone-price-chart.service';
import {
  CNumberService,
  CNumberRates,
} from '../../services/rates/c-number.service';

import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { OrderService } from '../../services/order.service';
import { MessageService } from 'primeng/api';

// Must match the DIAMOND_CODE constant in stone-price-charts.controller.js
const DIAMOND_CODE = 'DW';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

type Country = 'india' | 'restOfWorld';
type MakingChargeMode = 'flat';

interface SelectOption {
  label: string;
  value: string;
}

interface CategoryOption {
  value: string;
  label: string;
  image?: string;
  icon?: string;
}

interface ProductImage {
  name: string;
  url: string; // object URL used for the preview thumbnail
  file: File; // the real file, kept so it can be uploaded later
}

interface DiamondLine {
  shape: string;
  quality: string;
  weight: number;
  pieces: number;
  rate: number;
  amount: number;
}

interface StoneLine {
  code: string;
  label: string;
  shape: string;
  quality: string;
  weight: number;
  pieces: number;
  rate: number;
  amount: number;
}

interface PriceResult {
  metal: {
    purity: string;
    weight: number;
    rate: number;
    amount: number;
  } | null;
  diamonds: DiamondLine[];
  stones: StoneLine[];
  makingCharge: {
    value: number;
    amount: number;
  } | null;
  rawSum: number;
  cNo: number;
  country: Country;
  countryFactor: number | null;
  total: number;
  missingRates: string[];
}

@Component({
  selector: 'app-quotation-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FloatLabelModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    ButtonModule,
    CardModule,
    DividerModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './quotation-create.component.html',
})
export class QuotationCreateComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);

  private metalPurityService = inject(MetalPurityService);

  private metalRateService = inject(MetalRateService);
  private stonePriceChartService = inject(StonePriceChartService);
  private cNumberService = inject(CNumberService);
  private orderService = inject(OrderService);
  private messageService = inject(MessageService);

  metalPurityOptions: MetalPurity[] = [];

  // Shared shape list — diamonds and gemstones pick from the same set of
  // shapes, built from the price-chart data itself (no separate hardcoded
  // shape mapping / service).
  shapeOptions: SelectOption[] = [];

  // Quality/grade options, derived from each chart's gradeRates keys
  // instead of a hardcoded FG/EF/HI or Fine/Good list.
  diamondQualityOptions: SelectOption[] = [];
  private stoneQualityOptionsByCode: Record<string, SelectOption[]> = {};

  // NOTE: DW is reserved for the Diamond section — derived stone types
  // exclude it so the same code can't be picked in both places. Built from
  // the price-chart data in buildOptionsFromCharts(), same source as
  // shapeOptions/diamondQualityOptions — no separate stone-type master.
  stoneTypeOptions: SelectOption[] = [];

  salesPersonOptions = [
    { label: 'Raj Patel', value: 'Raj Patel' },
    { label: 'Anita Shah', value: 'Anita Shah' },
    { label: 'Vikram Mehta', value: 'Vikram Mehta' },
  ];

  // Product categories shown as selectable tiles. Images live in
  // public/product_category/ (served from /product_category/...).
  categories: CategoryOption[] = [
    {
      value: 'necklace',
      label: 'Necklace',
      image: '/product_category/necklace.png',
    },
    { value: 'ring', label: 'Ring', image: '/product_category/ring.png' },
    {
      value: 'earrings',
      label: 'Earrings',
      image: '/product_category/earrings.png',
    },
    {
      value: 'bracelet',
      label: 'Bracelet',
      image: '/product_category/bracelet.png',
    },
    {
      value: 'bangles',
      label: 'Bangles',
      image: '/product_category/bangles.png',
    },
    { value: 'other', label: 'Other', icon: 'pi pi-ellipsis-h' },
  ];

  // Uploaded product images (previews + the original File objects).
  productImages: ProductImage[] = [];

  // Country selector shown beside the page title. Drives which c-number
  // (India 130% / Rest of World 150%, from GET /api/c-numbers) is applied
  // as the final markup.
  countryOptions: SelectOption[] = [
    { label: 'India', value: 'india' },
    { label: 'Rest of World', value: 'restOfWorld' },
  ];
  countryControl = new FormControl<Country>('india', { nonNullable: true });

  // Making charge, entered by the user in the Estimated Price panel — a
  // flat rate (₹ per gram of metal weight). Kept as a standalone control
  // (outside quotationForm) since it lives in the price panel rather than
  // the main form.
  makingChargeValueControl = new FormControl<number | null>(null, [
    Validators.required,
  ]);

  cNumberRates: CNumberRates | null = null;

  loadingOptions = true;
  loadError = false;
  calculating = false;
  priceResult: PriceResult | null = null;

  quotationForm: FormGroup = this.fb.group({
    category: ['necklace'],
    basicInfo: this.fb.group({
      customerName: ['', Validators.required],
      phoneNumber: [
        '',
        [Validators.required, Validators.pattern(/^[0-9]{10}$/)],
      ],
      email: ['', Validators.email],
      salesPerson: [null, Validators.required],
    }),
    metal: this.fb.group({
      purity: [null, Validators.required],
      weight: [null, [Validators.required, Validators.min(0.01)]],
    }),
    diamonds: this.fb.array([this.createDiamondRow()]),
    stones: this.fb.array([this.createStoneRow()]),
  });

  get basicInfo() {
    return this.quotationForm.get('basicInfo') as FormGroup;
  }
  get metal() {
    return this.quotationForm.get('metal') as FormGroup;
  }
  get diamonds() {
    return this.quotationForm.get('diamonds') as FormArray;
  }
  get stones() {
    return this.quotationForm.get('stones') as FormArray;
  }
  get selectedCategory(): string {
    return this.quotationForm.get('category')?.value;
  }

  ngOnInit(): void {
    this.loadAllOptions();
  }

  ngOnDestroy(): void {
    // Release the object URLs created for image previews.
    this.productImages.forEach((img) => URL.revokeObjectURL(img.url));
  }

  // ---------- Category ----------

  selectCategory(value: string): void {
    this.quotationForm.get('category')?.setValue(value);
  }

  // ---------- Product images ----------

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.size > MAX_IMAGE_SIZE) {
        this.messageService.add({
          severity: 'warn',
          summary: 'File too large',
          detail: `${file.name} is over 5MB and was skipped.`,
        });
        return;
      }
      this.productImages.push({
        name: file.name,
        url: URL.createObjectURL(file),
        file,
      });
    });

    // Lets the user pick the same file again after removing it.
    input.value = '';
  }

  removeImage(index: number): void {
    URL.revokeObjectURL(this.productImages[index].url);
    this.productImages.splice(index, 1);
  }

  // ---------- Form rows ----------

  private createDiamondRow(): FormGroup {
    return this.fb.group({
      shape: [null],
      quality: [null],
      weight: [null, [Validators.min(0)]], // avg size in carats
      pieces: [null, [Validators.min(0)]],
    });
  }

  private createStoneRow(): FormGroup {
    const group = this.fb.group({
      type: [null], // stone code, e.g. RY / EM / BS (never DW)
      shape: [null],
      quality: [null],
      weight: [null, [Validators.min(0)]], // avg size in carats
      pieces: [null, [Validators.min(0)]],
    });

    // The quality options depend on which stone type is picked, so clear
    // any stale quality selection whenever the type changes.
    group.get('type')?.valueChanges.subscribe(() => {
      group.get('quality')?.setValue(null, { emitEvent: false });
    });

    return group;
  }

  addDiamond(): void {
    this.diamonds.push(this.createDiamondRow());
  }

  removeDiamond(index: number): void {
    this.diamonds.removeAt(index);
    this.computeEstimate();
  }

  addStone(): void {
    this.stones.push(this.createStoneRow());
  }

  removeStone(index: number): void {
    this.stones.removeAt(index);
    this.computeEstimate();
  }

  // ---------- Options loading ----------

  private loadAllOptions(): void {
    this.loadingOptions = true;

    forkJoin({
      metalPurities: this.metalPurityService.getAll(),
      priceCharts: this.stonePriceChartService.getCharts(),
      cNumbers: this.cNumberService.getCurrent(),
    }).subscribe({
      next: (r) => {
        this.metalPurityOptions = r.metalPurities.filter((o) => o.isActive);
        this.buildOptionsFromCharts(r.priceCharts || []);

        // We already have the full chart list from the forkJoin above —
        // seed the service's calculate() cache with it so pressing
        // "Calculate Price" doesn't trigger a second, duplicate
        // GET /stone-price-charts call.
        this.stonePriceChartService.primeChartsCache(r.priceCharts || []);

        this.cNumberRates = r.cNumbers;

        this.loadingOptions = false;

        // Recalculate live as the user fills the main form, changes the
        // country, or edits the making charge.
        merge(
          this.quotationForm.valueChanges,
          this.countryControl.valueChanges,
          this.makingChargeValueControl.valueChanges,
        )
          .pipe(debounceTime(400))
          .subscribe(() => this.computeEstimate());
      },
      error: (err) => {
        console.error('Failed to load form options:', err);
        this.loadingOptions = false;
        this.loadError = true;
      },
    });
  }

  // Builds the shared shape options and the per-stone-code quality/grade
  // options directly from the price-chart data.
  private buildOptionsFromCharts(charts: StonePriceChart[]): void {
    const shapeSet = new Set<string>();
    const diamondGradeSet = new Set<string>();
    const stoneGradesByCode = new Map<string, Set<string>>();
    const stoneTypeByCode = new Map<string, string>();

    for (const chart of charts) {
      if (!chart.isActive) continue;

      if (chart.shape) {
        shapeSet.add(chart.shape);
      }

      const gradeKeys = new Set<string>();
      for (const band of chart.bands || []) {
        Object.keys(band.gradeRates || {}).forEach((key) => gradeKeys.add(key));
      }

      if (chart.stoneCode === DIAMOND_CODE) {
        gradeKeys.forEach((key) => diamondGradeSet.add(key));
      } else {
        const existing =
          stoneGradesByCode.get(chart.stoneCode) ?? new Set<string>();
        gradeKeys.forEach((key) => existing.add(key));
        stoneGradesByCode.set(chart.stoneCode, existing);

        // DW is reserved for the Diamond section, so every non-DW chart
        // contributes to the Stone Type dropdown instead.
        if (!stoneTypeByCode.has(chart.stoneCode)) {
          stoneTypeByCode.set(chart.stoneCode, chart.stoneType);
        }
      }
    }

    this.shapeOptions = Array.from(shapeSet)
      .sort()
      .map((shape) => ({ label: shape, value: shape }));

    this.stoneTypeOptions = Array.from(stoneTypeByCode.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([code, label]) => ({ label, value: code }));

    this.diamondQualityOptions = Array.from(diamondGradeSet)
      .sort()
      .map((key) => ({ label: this.formatGradeLabel(key), value: key }));

    this.stoneQualityOptionsByCode = {};
    stoneGradesByCode.forEach((keys, code) => {
      this.stoneQualityOptionsByCode[code] = Array.from(keys)
        .sort()
        .map((key) => ({ label: this.formatGradeLabel(key), value: key }));
    });
  }

  // e.g. 'G-H_SI' -> 'G-H / SI', 'natural' -> 'Natural'
  private formatGradeLabel(key: string): string {
    const spaced = key.replace(/_/g, ' / ');
    if (spaced === spaced.toUpperCase()) return spaced;
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  // Template helper — each stone row can have a different code, so its
  // quality options are looked up dynamically.
  getStoneQualityOptions(code: string | null | undefined): SelectOption[] {
    if (!code) return [];
    return this.stoneQualityOptionsByCode[code] ?? [];
  }

  // ---------- Submit ----------
  // Button click — validate, then save (data + images) as multipart.
  calculatePrice(): void {
    if (this.quotationForm.invalid) {
      console.log(
        'Form errors by control',
        this.collectFormErrors(this.quotationForm),
      );
      this.quotationForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Incomplete form',
        detail: 'Please fill all required fields.',
      });
      return; // don't save an invalid form
    }

    this.computeEstimate();
    this.onSubmit();
  }

  onSubmit() {
    const raw = this.quotationForm.getRawValue();

    // Drop untouched/empty rows so they don't fail backend validation,
    // and default pieces to 1 (same as the price calculation does).
    const diamonds = (raw.diamonds as any[])
      .filter((d) => d.shape && d.quality && d.weight)
      .map((d) => ({ ...d, pieces: d.pieces || 1 }));

    const stones = (raw.stones as any[])
      .filter((s) => s.type && s.quality && s.weight)
      .map((s) => ({ ...s, pieces: s.pieces || 1 }));

    const payload = {
      category: raw.category, // category name now included
      basicInfo: raw.basicInfo,
      metal: raw.metal,
      diamonds,
      stones,
      estimate: this.priceResult
        ? {
            makingChargePerGram: this.makingChargeValueControl.value,
            country: this.priceResult.country,
            countryFactor: this.priceResult.countryFactor,
            baseCost: this.priceResult.rawSum,
            total: this.priceResult.total,
          }
        : undefined,
    };

    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    this.productImages.forEach(
      (img) => fd.append('images', img.file, img.name), // field name matches upload.array('images')
    );

    this.orderService.createOrder(fd).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'Order created successfully',
        });
      },
      error: (err) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message || 'Could not save order',
        });
      },
    });
  }

  // Debug helper — walks every control in the form tree and reports which
  // ones actually have validation errors. quotationForm.invalid alone only
  // tells you *that* something failed, not *which* control.
  private collectFormErrors(
    group: FormGroup | FormArray,
    path = '',
  ): Record<string, any> {
    const result: Record<string, any> = {};
    const controls = (group as any).controls;
    Object.keys(controls).forEach((key) => {
      const control = controls[key];
      const controlPath = path ? `${path}.${key}` : key;
      if (control instanceof FormGroup || control instanceof FormArray) {
        Object.assign(result, this.collectFormErrors(control, controlPath));
      } else if (control.errors) {
        result[controlPath] = control.errors;
      }
    });
    return result;
  }

  // ---------- Price estimate ----------

  // Runs every diamond & stone row through StonePriceChartService.calculate()
  // — each row's amount is the matched gradeRates value directly (no
  // multiplication by weight or pieces; see stone-price-chart.service.ts).
  // Adds the user-entered making charge (flat ₹/g, applied against metal
  // weight), sums everything into a base cost, divides by 100 to get the
  // "c-number" (get_cNo), then multiplies by the selected country's markup
  // (India 130% / Rest of World 150%, from GET /api/c-numbers).
  private computeEstimate(): void {
    const { metal } = this.quotationForm.value;
    const diamondRows: Array<{
      shape: string | null;
      quality: string | null;
      weight: number | null;
      pieces: number | null;
    }> = this.diamonds.value;
    const stoneRows: Array<{
      type: string | null;
      shape: string | null;
      quality: string | null;
      weight: number | null;
      pieces: number | null;
    }> = this.stones.value;

    const metalReady = !!(metal.purity && metal.weight);
    const diamondReadyFlags = diamondRows.map(
      (row) => !!(row.shape && row.quality && row.weight),
    );
    const stoneReadyFlags = stoneRows.map(
      (row) => !!(row.type && row.quality && row.weight),
    );

    const anyReady =
      metalReady ||
      diamondReadyFlags.some(Boolean) ||
      stoneReadyFlags.some(Boolean);

    if (!anyReady) {
      this.priceResult = null;
      return;
    }

    type RowResult = {
      index: number;
      ready: boolean;
      result: StonePriceChartResult | null;
    };

    const diamondCalls = diamondRows.map((row, index) => {
      if (!diamondReadyFlags[index]) {
        return of<RowResult>({ index, ready: false, result: null });
      }
      return this.stonePriceChartService
        .calculate({
          code: DIAMOND_CODE,
          shape: row.shape!,
          quality: row.quality!,
          weight: row.weight!,
          pieces: row.pieces || 1,
        })
        .pipe(
          map((result) => ({ index, ready: true, result }) as RowResult),
          catchError(() => of<RowResult>({ index, ready: true, result: null })),
        );
    });

    const stoneCalls = stoneRows.map((row, index) => {
      if (!stoneReadyFlags[index]) {
        return of<RowResult>({ index, ready: false, result: null });
      }
      return this.stonePriceChartService
        .calculate({
          code: row.type!,
          shape: row.shape,
          quality: row.quality!,
          weight: row.weight!,
          pieces: row.pieces || 1,
        })
        .pipe(
          map((result) => ({ index, ready: true, result }) as RowResult),
          catchError(() => of<RowResult>({ index, ready: true, result: null })),
        );
    });

    this.calculating = true;

    forkJoin({
      metalRate: metalReady
        ? this.metalRateService.getCurrent(metal.purity)
        : of(null),
      diamondResults: diamondCalls.length
        ? forkJoin(diamondCalls)
        : of([] as RowResult[]),
      stoneResults: stoneCalls.length
        ? forkJoin(stoneCalls)
        : of([] as RowResult[]),
    }).subscribe({
      next: ({ metalRate, diamondResults, stoneResults }) => {
        const missingRates: string[] = [];

        // ---- Metal ----
        let metalAmount = 0;
        let metalLine: PriceResult['metal'] = null;
        if (metalReady) {
          if (metalRate) {
            metalAmount = Math.round(metal.weight * metalRate.ratePerGram);
            metalLine = {
              purity: metal.purity,
              weight: metal.weight,
              rate: metalRate.ratePerGram,
              amount: metalAmount,
            };
          } else {
            missingRates.push('Metal');
          }
        }

        // ---- Diamonds ----
        const diamondLines: DiamondLine[] = [];
        diamondResults.forEach(({ index, ready, result }) => {
          if (!ready) return;
          if (!result) {
            missingRates.push(`Diamond #${index + 1}`);
            return;
          }

          diamondLines.push({
            shape: result.shape ?? '',
            quality: result.quality ?? '',
            weight: result.weight,
            pieces: result.pieces,
            rate: result.ratePerCarat,
            amount: result.amount,
          });

          this.diamonds.at(index).patchValue(
            {
              shape: result.shape,
              quality: result.quality,
              weight: result.weight,
              pieces: result.pieces,
            },
            { emitEvent: false },
          );
        });

        // ---- Stones (anything whose code isn't DW) ----
        const stoneLines: StoneLine[] = [];
        stoneResults.forEach(({ index, ready, result }) => {
          if (!ready) return;
          if (!result) {
            missingRates.push(`Stone #${index + 1}`);
            return;
          }

          stoneLines.push({
            code: result.code,
            label: result.label,
            shape: result.shape ?? '',
            quality: result.quality ?? '',
            weight: result.weight,
            pieces: result.pieces,
            rate: result.ratePerCarat,
            amount: result.amount,
          });

          this.stones.at(index).patchValue(
            {
              type: result.code,
              shape: result.shape,
              quality: result.quality,
              weight: result.weight,
              pieces: result.pieces,
            },
            { emitEvent: false },
          );
        });

        const diamondTotal = diamondLines.reduce((sum, l) => sum + l.amount, 0);
        const stoneTotal = stoneLines.reduce((sum, l) => sum + l.amount, 0);

        // ---- Making charge ----
        // Flat: value is a ₹-per-gram rate → value × metal weight.
        const makingChargeValueRaw = this.makingChargeValueControl.value;
        let makingChargeAmount = 0;
        let makingChargeLine: PriceResult['makingCharge'] = null;
        if (makingChargeValueRaw != null && metal?.weight) {
          makingChargeAmount = makingChargeValueRaw * metal.weight;
          makingChargeLine = {
            value: makingChargeValueRaw,
            amount: makingChargeAmount,
          };
        }
        const rawSum =
          metalAmount + diamondTotal + stoneTotal + makingChargeAmount;
        const cNo = rawSum / 100;

        const country = this.countryControl.value;
        const countryFactor = this.cNumberRates
          ? this.cNumberRates[country]
          : null;
        if (countryFactor == null) {
          missingRates.push('Country markup rate');
        }

        const total = Math.round(cNo * (countryFactor ?? 0));

        this.priceResult = {
          metal: metalLine,
          diamonds: diamondLines,
          stones: stoneLines,
          makingCharge: makingChargeLine,
          rawSum,
          cNo,
          country,
          countryFactor,
          total,
          missingRates,
        };
        this.calculating = false;
      },
      error: (err) => {
        console.error('Failed to fetch rates:', err);
        this.calculating = false;
      },
    });
  }

  labelFor(
    options: { label: string; value: string }[],
    value: string | null,
  ): string {
    return options.find((o) => o.value === value)?.label ?? value ?? '—';
  }
}
