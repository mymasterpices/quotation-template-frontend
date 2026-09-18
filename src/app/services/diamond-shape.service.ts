import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';

export interface DiamondShape {
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
export class DiamondShapeService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/diamond-shapes`;

  getAll(): Observable<DiamondShape[]> {
    return this.http
      .get<ApiResponse<DiamondShape[]>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }

  getById(id: string): Observable<DiamondShape> {
    return this.http
      .get<ApiResponse<DiamondShape>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  create(payload: Partial<DiamondShape>): Observable<DiamondShape> {
    return this.http
      .post<ApiResponse<DiamondShape>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: string, payload: Partial<DiamondShape>): Observable<DiamondShape> {
    return this.http
      .put<ApiResponse<DiamondShape>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}
