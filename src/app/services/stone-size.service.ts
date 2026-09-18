import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';

export interface StoneSize {
  _id: string;
  label: string;
  value: string;
  sortOrder: number;
  isActive: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class StoneSizeService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/stone-sizes`;

  getAll(): Observable<StoneSize[]> {
    return this.http
      .get<ApiResponse<StoneSize[]>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }
  getById(id: string): Observable<StoneSize> {
    return this.http
      .get<ApiResponse<StoneSize>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }
  create(payload: Partial<StoneSize>): Observable<StoneSize> {
    return this.http
      .post<ApiResponse<StoneSize>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }
  update(id: string, payload: Partial<StoneSize>): Observable<StoneSize> {
    return this.http
      .put<ApiResponse<StoneSize>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}
