import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface DiamondRate {
  _id: string;
  color: string;
  clarity: string;
  shape?: string;
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
export class DiamondRateService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/diamond-rates`;

  getAll(): Observable<DiamondRate[]> {
    return this.http
      .get<ApiResponse<DiamondRate[]>>(this.baseUrl)
      .pipe(map((r) => r.data));
  }

  getCurrent(
    color: string,
    clarity: string,
    shape?: string,
  ): Observable<DiamondRate | null> {
    let params = `?color=${encodeURIComponent(color)}&clarity=${encodeURIComponent(clarity)}`;
    if (shape) params += `&shape=${encodeURIComponent(shape)}`;
    return this.http
      .get<ApiResponse<DiamondRate>>(`${this.baseUrl}/current${params}`)
      .pipe(
        map((r) => r.data),
        catchError(() => of(null)),
      );
  }

  create(payload: Partial<DiamondRate>): Observable<DiamondRate> {
    return this.http
      .post<ApiResponse<DiamondRate>>(this.baseUrl, payload)
      .pipe(map((r) => r.data));
  }
  update(id: string, payload: Partial<DiamondRate>): Observable<DiamondRate> {
    return this.http
      .put<ApiResponse<DiamondRate>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((r) => r.data));
  }
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}
