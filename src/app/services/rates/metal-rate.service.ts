import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface MetalRate {
  _id: string;
  metalType: string;
  purity: string;
  ratePerGram: number;
  effectiveDate: string;
  isActive: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class MetalRateService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/metal-rates`;

  getAll(): Observable<MetalRate[]> {
    return this.http
      .get<ApiResponse<MetalRate[]>>(this.baseUrl)
      .pipe(map((r) => r.data));
  }

  getCurrent(
    purity: string,
    metalType: string = 'GOLD',
  ): Observable<MetalRate | null> {
    const params = `?purity=${encodeURIComponent(purity)}&metalType=${encodeURIComponent(metalType)}`;
    return this.http
      .get<ApiResponse<MetalRate>>(`${this.baseUrl}/current${params}`)
      .pipe(
        map((r) => r.data),
        catchError(() => of(null)),
      );
  }

  create(payload: Partial<MetalRate>): Observable<MetalRate> {
    return this.http
      .post<ApiResponse<MetalRate>>(this.baseUrl, payload)
      .pipe(map((r) => r.data));
  }
  update(id: string, payload: Partial<MetalRate>): Observable<MetalRate> {
    return this.http
      .put<ApiResponse<MetalRate>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((r) => r.data));
  }
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}
