import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';

export interface MetalPurity {
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
export class MetalPurityService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/metal-purities`;

  getAll(): Observable<MetalPurity[]> {
    return this.http
      .get<ApiResponse<MetalPurity[]>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }

  getById(id: string): Observable<MetalPurity> {
    return this.http
      .get<ApiResponse<MetalPurity>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  create(payload: Partial<MetalPurity>): Observable<MetalPurity> {
    return this.http
      .post<ApiResponse<MetalPurity>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: string, payload: Partial<MetalPurity>): Observable<MetalPurity> {
    return this.http
      .put<ApiResponse<MetalPurity>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}
