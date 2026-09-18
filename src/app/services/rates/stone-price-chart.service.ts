import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface StonePriceChartRequest {
  code: string;
  shape?: string | null;
  quality?: string | null;
  weight: number;
  pieces: number;
}

export interface StonePriceChartResult {
  isDiamond: boolean;
  code: string;
  label: string;
  shape: string | null;
  quality: string | null;
  weight: number;
  pieces: number;
  ratePerCarat: number; // kept for display/label purposes only — see note below
  amount: number;
}

export interface StonePriceBand {
  sizeMin: number;
  sizeMax: number;
  gradeRates: Record<string, number>;
}

export interface StonePriceChart {
  _id: string;
  stoneType: string;
  stoneCode: string;
  pricingModel: 'GRADE_BANDED' | 'SIZE_BANDED_FLAT' | 'SINGLE_FLAT';
  shape?: string;
  shapeCode?: string;
  bands: StonePriceBand[];
  isActive: boolean;
}

// Derived "type" / "shape" option shapes for the Add/Edit dropdowns — built
// directly from existing StonePriceChart records instead of a separate
// master-data lookup service. Every stoneType/stoneCode and shape/shapeCode
// pair that has ever been used on a chart is available for reuse here.
export interface StoneTypeOption {
  stoneType: string;
  stoneCode: string;
}

export interface ShapeOption {
  shape: string;
  shapeCode: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Must match the DIAMOND_CODE constant used elsewhere (e.g.
// stone-price-charts.controller.js) — kept local so this service has no
// hidden dependency on that value being passed in correctly by callers.
const DIAMOND_CODE = 'DW';

@Injectable({ providedIn: 'root' })
export class StonePriceChartService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/stone-price-charts`;

  // Charts are fetched once and reused for every calculate() call instead of
  // hitting the backend per diamond/stone row. shareReplay(1) means the
  // first subscriber triggers the HTTP call and every subsequent
  // subscriber (each row's calculate()) reuses that same response.
  private charts$?: Observable<StonePriceChart[]>;

  getCharts(filter?: {
    stoneCode?: string;
    shape?: string;
  }): Observable<StonePriceChart[]> {
    let params = new HttpParams();
    if (filter?.stoneCode) params = params.set('stoneCode', filter.stoneCode);
    if (filter?.shape) params = params.set('shape', filter.shape);

    return this.http
      .get<ApiResponse<StonePriceChart[]>>(this.baseUrl, { params })
      .pipe(map((res) => res.data));
  }

  // Cached, unfiltered fetch used internally by calculate(). Call
  // invalidateChartsCache() after create/update/delete so the next
  // calculate() picks up fresh data.
  private getChartsCached(): Observable<StonePriceChart[]> {
    if (!this.charts$) {
      this.charts$ = this.getCharts().pipe(shareReplay(1));
    }
    return this.charts$;
  }

  /** Call after create/update/delete so calculate() stops using stale data. */
  invalidateChartsCache(): void {
    this.charts$ = undefined;
  }

  /**
   * Seed the internal charts cache with data the caller already fetched
   * (e.g. the same forkJoin that loads this page's shape/quality dropdown
   * options), so the next calculate() reuses it instead of firing a second,
   * duplicate GET /stone-price-charts request.
   */
  primeChartsCache(charts: StonePriceChart[]): void {
    this.charts$ = of(charts).pipe(shareReplay(1));
  }

  getById(id: string): Observable<StonePriceChart> {
    return this.http
      .get<ApiResponse<StonePriceChart>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  create(payload: Partial<StonePriceChart>): Observable<StonePriceChart> {
    return this.http
      .post<ApiResponse<StonePriceChart>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(
    id: string,
    payload: Partial<StonePriceChart>,
  ): Observable<StonePriceChart> {
    return this.http
      .put<ApiResponse<StonePriceChart>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Computes the price for one diamond/stone row entirely client-side using
   * the already-fetched chart data (no per-row HTTP call).
   *
   * Matching rules:
   *  1. Find chart(s) with the same stoneCode, and — if a shape was given —
   *     the same shape.
   *  2. Within that chart, find the band where sizeMin <= weight <= sizeMax.
   *  3. Look up gradeRates[quality] in that band.
   *  4. That value IS the amount — it is NOT multiplied by weight and NOT
   *     multiplied by pieces. `pieces` is only carried through on the result
   *     for display purposes.
   *
   * Returns null (rather than throwing) when nothing matches — the caller
   * (quotation-create.component) already treats a null result as a missing
   * rate and lists it under "missingRates".
   */
  calculate(
    req: StonePriceChartRequest,
  ): Observable<StonePriceChartResult | null> {
    return this.getChartsCached().pipe(
      map((charts) => this.matchAndPrice(charts, req)),
    );
  }

  private matchAndPrice(
    charts: StonePriceChart[],
    req: StonePriceChartRequest,
  ): StonePriceChartResult | null {
    if (!req.code || req.weight == null || !req.quality) return null;

    const codeUpper = req.code.toUpperCase();
    const shapeUpper = req.shape ? req.shape.toUpperCase() : null;

    const candidateCharts = charts.filter((chart) => {
      if (!chart.isActive) return false;
      if (chart.stoneCode?.toUpperCase() !== codeUpper) return false;
      // If the row didn't specify a shape, don't filter on it. If it did,
      // the chart's shape must match.
      if (shapeUpper && chart.shape?.toUpperCase() !== shapeUpper) return false;
      return true;
    });

    for (const chart of candidateCharts) {
      const band = chart.bands.find(
        (b) => req.weight >= b.sizeMin && req.weight <= b.sizeMax,
      );
      if (!band) continue;

      const rate = band.gradeRates[req.quality];
      if (rate === undefined || rate === null) continue;

      return {
        isDiamond: chart.stoneCode.toUpperCase() === DIAMOND_CODE,
        code: chart.stoneCode,
        label: chart.stoneType,
        shape: chart.shape ?? null,
        quality: req.quality,
        weight: req.weight,
        pieces: req.pieces,
        ratePerCarat: rate, // not actually "per carat" — it's the matched flat amount, kept here for the breakdown UI
        amount: rate, // gradeRate IS the final amount — no multiplication by weight or pieces
      };
    }

    // No chart / band / quality combination matched.
    return null;
  }

  // --- Derived lookup lists (no separate master-data service required) ---

  /**
   * Every distinct {stoneType, stoneCode} pair seen across all charts,
   * deduped case-insensitively by code, sorted by name.
   */
  getDistinctStoneTypes(): Observable<StoneTypeOption[]> {
    return this.getCharts().pipe(
      map((charts) => {
        const byCode = new Map<string, StoneTypeOption>();
        charts.forEach((c) => {
          if (!c.stoneCode) return;
          const key = c.stoneCode.toUpperCase();
          if (!byCode.has(key)) {
            byCode.set(key, { stoneType: c.stoneType, stoneCode: c.stoneCode });
          }
        });
        return Array.from(byCode.values()).sort((a, b) =>
          a.stoneType.localeCompare(b.stoneType),
        );
      }),
    );
  }

  /**
   * Every distinct {shape, shapeCode} pair seen across all charts,
   * deduped case-insensitively by code (source data has inconsistent casing,
   * e.g. "Ov" vs "OV" for Oval), sorted by name.
   */
  getDistinctShapes(): Observable<ShapeOption[]> {
    return this.getCharts().pipe(
      map((charts) => {
        const byCode = new Map<string, ShapeOption>();
        charts.forEach((c) => {
          if (!c.shapeCode || !c.shape) return;
          const key = c.shapeCode.toUpperCase();
          if (!byCode.has(key)) {
            byCode.set(key, { shape: c.shape, shapeCode: c.shapeCode });
          }
        });
        return Array.from(byCode.values()).sort((a, b) =>
          a.shape.localeCompare(b.shape),
        );
      }),
    );
  }
}
