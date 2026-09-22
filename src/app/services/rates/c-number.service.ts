import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// GET /api/c-numbers returns this shape directly — no {success, data}
// wrapper like the other endpoints in this app.
export interface CNumberRates {
  india: number;
  restOfWorld: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class CNumberService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/c-numbers`;

  private rates$?: Observable<CNumberRates>;

  /** Cached for the session — the markup doc rarely changes mid-session. */
  getCurrent(): Observable<CNumberRates> {
    if (!this.rates$) {
      this.rates$ = this.http
        .get<CNumberRates>(this.baseUrl)
        .pipe(shareReplay(1));
    }
    return this.rates$;
  }

  /**
   * ASSUMPTION: PUT /api/c-numbers/:id, following the same REST convention
   * as MetalRateService/StonePriceChartService.update() elsewhere in this
   * app — confirm/adjust if the real route or method (PATCH?) differs.
   * Response is assumed to be the raw updated document, same as GET.
   */
  update(payload: {
    india: number;
    restOfWorld: number;
  }): Observable<CNumberRates> {
    return this.http
      .put<CNumberRates>(`${this.baseUrl}`, payload)
      .pipe(tap(() => this.invalidateCache()));
  }

  /** Call if the backend value might have changed and needs refetching. */
  invalidateCache(): void {
    this.rates$ = undefined;
  }
}
