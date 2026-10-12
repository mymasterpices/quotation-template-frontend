import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';

/* ----- API types (match the order model) ----- */
interface StoredImage {
  name: string;
  filename: string;
  url: string;
  size?: number;
  mimeType?: string;
}

interface DiamondLine {
  shape: string;
  quality: string;
  weight: number;
  pieces: number;
  rate?: number; // per carat
  amount?: number;
}

interface StoneLine {
  type: string; // stone code, e.g. EM
  label?: string; // e.g. Emerald
  shape?: string;
  quality: string;
  weight: number;
  pieces: number;
  rate?: number; // per carat
  amount?: number;
}

interface QuotationDetail {
  _id: string;
  quotationNo?: string;
  category: string;
  basicInfo: {
    customerName: string;
    phoneNumber: string;
    email?: string;
    salesPerson: string;
  };
  metal: {
    purity: string;
    weight: number;
    rate?: number; // per gram
    amount?: number;
  };
  diamonds?: DiamondLine[];
  stones?: StoneLine[];
  images?: StoredImage[];
  estimate: {
    makingChargePerGram?: number;
    makingCharge?: number;
    diamondTotal?: number;
    stoneTotal?: number;
    country?: string;
    countryFactor?: number;
    baseCost?: number;
    total?: number;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrderResponse {
  success: boolean;
  data: QuotationDetail | QuotationDetail[];
}

@Component({
  selector: 'app-quotation-detail',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, RouterLink, DialogModule, SkeletonModule],
  templateUrl: './quotation-detail.component.html',
})
export class QuotationDetailComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // TODO: move to environment config / service
  private readonly API_BASE = 'http://localhost:5900';
  private readonly ORDERS_URL = `${this.API_BASE}/api/orders`;

  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly thumbStrip = viewChild<ElementRef<HTMLElement>>('thumbStrip');

  /* ----- state ----- */
  readonly quotation = signal<QuotationDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly selectedImage = signal(0);
  readonly lightboxOpen = signal(false);

  readonly editingNotes = signal(false);
  readonly notes = signal('');

  /* ----- derived ----- */
  readonly images = computed(() => this.quotation()?.images ?? []);
  readonly diamonds = computed(() => this.quotation()?.diamonds ?? []);
  readonly stones = computed(() => this.quotation()?.stones ?? []);
  readonly activeImage = computed(
    () => this.images()[this.selectedImage()] ?? null,
  );

  constructor() {
    combineLatest([this.route.paramMap, this.reload$])
      .pipe(
        map(([params]) => params.get('id')),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((id) =>
          this.http.get<OrderResponse>(`${this.ORDERS_URL}/${id}`).pipe(
            map((res) => {
              if (!res.success) return null;
              // supports both a single object and an array response
              return Array.isArray(res.data)
                ? (res.data.find((q) => q._id === id) ?? null)
                : res.data;
            }),
            catchError(() => {
              this.error.set(
                'We could not load this quotation. Check your connection and try again.',
              );
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => {
        if (!q && !this.error())
          this.error.set('This quotation could not be found.');
        this.quotation.set(q);
        this.notes.set(q?.notes ?? '');
        this.selectedImage.set(0);
        this.loading.set(false);
      });
  }

  /* ----- template helpers ----- */
  quotationNo(q: QuotationDetail): string {
    return q.quotationNo ?? `QT-${q._id.slice(-4).toUpperCase()}`;
  }

  fullUrl(path: string): string {
    return `${this.API_BASE}${path}`;
  }

  // Returns "—" for missing values (older quotations have no rate/amount).
  formatAmount(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatSize(bytes: number | undefined): string {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`;
  }

  // 'G-H_VS-SI' -> 'G-H / VS-SI', 'natural' -> 'Natural'
  formatQuality(key: string | undefined): string {
    if (!key) return '—';
    const spaced = key.replace(/_/g, ' / ');
    if (spaced === spaced.toUpperCase()) return spaced;
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  // 'restOfWorld' -> 'Rest of World'
  countryLabel(country: string | undefined): string {
    if (country === 'india') return 'India';
    if (country === 'restOfWorld') return 'Rest of World';
    return country ?? '—';
  }

  /* ----- events ----- */
  selectImage(index: number): void {
    this.selectedImage.set(index);
  }

  scrollThumbs(): void {
    this.thumbStrip()?.nativeElement.scrollBy({
      left: 200,
      behavior: 'smooth',
    });
  }

  startEditNotes(): void {
    this.editingNotes.set(true);
  }

  onNotesInput(event: Event): void {
    this.notes.set((event.target as HTMLTextAreaElement).value);
  }

  saveNotes(): void {
    const q = this.quotation();
    if (!q) return;
    this.editingNotes.set(false);
    // TODO: persist notes, e.g. PATCH /api/orders/:id { notes }
  }

  async share(): Promise<void> {
    const q = this.quotation();
    if (!q) return;
    const url = window.location.href;
    const title = `Quotation ${this.quotationNo(q)}`;

    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      // TODO: show a PrimeNG toast, "Link copied"
    }
  }

  downloadPdf(): void {
    const q = this.quotation();
    if (!q) return;
    // TODO: replace with your real PDF endpoint
    window.open(`${this.ORDERS_URL}/${q._id}/pdf`, '_blank');
  }

  createNew(): void {
    this.router.navigate(['/quotations/new']); // TODO: match your create route
  }

  retry(): void {
    this.reload$.next();
  }
}
