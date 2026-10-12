import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MenuItem } from 'primeng/api';
import { Menu, MenuModule } from 'primeng/menu';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';

/* ---------- Types ---------- */

export 
type SortKey = 'latest' | 'oldest' | 'amountDesc' | 'amountAsc';

interface QuotationImage {
  name: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface Quotation {
  _id: string;
  quotationNo?: string; // optional: falls back to an id derived from _id
  category: string;
  basicInfo: {
    customerName: string;
    phoneNumber: string;
    email: string;
    salesPerson: string;
  };
  metal: { purity: string; weight: number };
  estimate: {
    makingChargePerGram: number;
    country: string;
    countryFactor: number;
    baseCost: number;
    total: number;
  };
  diamonds: {
    shape: string;
    quality: string;
    weight: number;
    pieces: number;
  }[];
  stones: {
    type: string;
    shape: string;
    quality: string;
    weight: number;
    pieces: number;
  }[];
  images: QuotationImage[];
  createdAt: string;
  updatedAt: string;
}

interface OrdersResponse {
  success: boolean;
  data: Quotation[];
}

/* ---------- Component ---------- */

@Component({
  selector: 'app-quotation-list',
  standalone: true,
  imports: [
    DatePipe,
    TitleCasePipe,
    FormsModule,
    MenuModule,
    PaginatorModule,
    SelectModule,
    SkeletonModule,
  ],
  templateUrl: './quotations.component.html',
})
export class QuotationsComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // TODO: move to environment config / service
  private readonly API_BASE = 'http://localhost:5900';
  private readonly ORDERS_URL = `${this.API_BASE}/api/orders`;

  readonly menu = viewChild.required<Menu>('cardMenu');

  /* ----- static config ----- */
  readonly pageSize = 12;

  readonly categories = [
    { key: 'all', label: 'All' },
    { key: 'necklace', label: 'Necklace' },
    { key: 'ring', label: 'Ring' },
    { key: 'earrings', label: 'Earrings' },
    { key: 'bracelet', label: 'Bracelet' },
    { key: 'pendant', label: 'Pendant' },
    { key: 'bangle', label: 'Bangle' },
    { key: 'others', label: 'Others' },
  ];

  readonly sortOptions: { label: string; value: SortKey }[] = [
    { label: 'Latest', value: 'latest' },
    { label: 'Oldest', value: 'oldest' },
    { label: 'Amount: High to Low', value: 'amountDesc' },
    { label: 'Amount: Low to High', value: 'amountAsc' },
  ];

  private readonly namedCategories = this.categories
    .map((c) => c.key)
    .filter((k) => k !== 'all' && k !== 'others');

  readonly skeletons = Array.from({ length: 8 });

  /* ----- state ----- */
  readonly quotations = signal<Quotation[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly activeCategory = signal('all');
  readonly sortBy = signal<SortKey>('latest');
  readonly first = signal(0); // paginator offset
  readonly menuItems = signal<MenuItem[]>([]);

  /* ----- derived ----- */
  readonly filtered = computed(() => {
    const category = this.activeCategory();

    return this.quotations().filter((q) => {
      const cat = (q.category ?? '').toLowerCase();
      return (
        category === 'all' ||
        (category === 'others'
          ? !this.namedCategories.includes(cat)
          : cat === category)
      );
    });
  });

  readonly sorted = computed(() => {
    const list = [...this.filtered()];
    const time = (q: Quotation) => +new Date(q.createdAt);

    switch (this.sortBy()) {
      case 'oldest':
        return list.sort((a, b) => time(a) - time(b));
      case 'amountDesc':
        return list.sort((a, b) => b.estimate.total - a.estimate.total);
      case 'amountAsc':
        return list.sort((a, b) => a.estimate.total - b.estimate.total);
      default:
        return list.sort((a, b) => time(b) - time(a));
    }
  });

  readonly paged = computed(() =>
    this.sorted().slice(this.first(), this.first() + this.pageSize),
  );
  readonly total = computed(() => this.sorted().length);

  readonly rangeLabel = computed(() => {
    const total = this.total();
    if (!total) return 'No quotations';
    const start = this.first() + 1;
    const end = Math.min(this.first() + this.pageSize, total);
    return `Showing ${start} - ${end} of ${total} quotations`;
  });

  constructor() {
    this.loadQuotations();
  }

  /* ----- data ----- */
  loadQuotations(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<OrdersResponse>(this.ORDERS_URL)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.quotations.set(res.success ? res.data : []);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            'We could not load quotations. Check your connection and try again.',
          );
          this.loading.set(false);
        },
      });
  }

  /* ----- template helpers ----- */
  quotationNo(q: Quotation): string {
    return q.quotationNo ?? `QT-${q._id.slice(-4).toUpperCase()}`;
  }

  imageUrl(q: Quotation): string | null {
    const url = q.images?.[0]?.url;
    return url ? `${this.API_BASE}${url}` : null;
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  /* ----- events ----- */
  selectCategory(key: string): void {
    this.activeCategory.set(key);
    this.first.set(0);
  }

  onSortChange(value: SortKey): void {
    this.sortBy.set(value);
    this.first.set(0);
  }

  onPageChange(event: PaginatorState): void {
    this.first.set(event.first ?? 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openMenu(event: Event, q: Quotation): void {
    this.menuItems.set([
      {
        label: 'Edit',
        icon: 'pi pi-pencil',
        command: () => this.router.navigate(['/quotations', q._id, 'edit']),
      },
      {
        label: 'Duplicate',
        icon: 'pi pi-copy',
        command: () => this.duplicate(q),
      },
      { separator: true },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        styleClass: 'text-red-600',
        command: () => this.remove(q),
      },
    ]);
    this.menu().toggle(event);
  }

  view(q: Quotation): void {
    this.router.navigate(['/quotation-detail', q._id]);
  }

  downloadPdf(q: Quotation): void {
    // TODO: replace with your real PDF endpoint
    window.open(`${this.ORDERS_URL}/${q._id}/pdf`, '_blank');
  }

  async share(q: Quotation): Promise<void> {
    const url = `${window.location.origin}/quotations/${q._id}`;
    const title = `Quotation ${this.quotationNo(q)}`;

    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      // TODO: show a PrimeNG toast, "Link copied"
    }
  }

  private duplicate(_q: Quotation): void {
    // TODO: implement
  }

  private remove(_q: Quotation): void {
    // TODO: confirm dialog + DELETE /api/orders/:id
  }
}
