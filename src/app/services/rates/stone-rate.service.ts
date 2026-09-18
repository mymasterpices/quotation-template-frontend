import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface StoneRate {
  _id: string;
  stoneType: string;
  size: string;
  ratePerCarat: number;
  effectiveDate: string;
  isActive: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class StoneRateService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/stone-rates`;

  getAll(): Observable<StoneRate[]> {
    return this.http
      .get<ApiResponse<StoneRate[]>>(this.baseUrl)
      .pipe(map((r) => r.data));
  }

  getCurrent(stoneType: string, size: string): Observable<StoneRate | null> {
    const params = `?stoneType=${encodeURIComponent(stoneType)}&size=${encodeURIComponent(size)}`;
    return this.http
      .get<ApiResponse<StoneRate>>(`${this.baseUrl}/current${params}`)
      .pipe(
        map((r) => r.data),
        catchError(() => of(null)),
      );
  }

  create(payload: Partial<StoneRate>): Observable<StoneRate> {
    return this.http
      .post<ApiResponse<StoneRate>>(this.baseUrl, payload)
      .pipe(map((r) => r.data));
  }
  update(id: string, payload: Partial<StoneRate>): Observable<StoneRate> {
    return this.http
      .put<ApiResponse<StoneRate>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((r) => r.data));
  }
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}
