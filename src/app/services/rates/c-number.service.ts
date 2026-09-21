import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// GET /api/c-numbers returns this shape directly — no {success, data}
// wrapper like the other endpoints in this app.
export interface CNumberRates {
  _id: string;
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

  /** Call if the backend value might have changed and needs refetching. */
  invalidateCache(): void {
    this.rates$ = undefined;
  }
}
