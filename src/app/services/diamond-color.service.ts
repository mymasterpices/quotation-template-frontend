import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';

export interface DiamondColor {
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
export class DiamondColorService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/diamond-colors`;

  getAll(): Observable<DiamondColor[]> {
    return this.http
      .get<ApiResponse<DiamondColor[]>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }

  getById(id: string): Observable<DiamondColor> {
    return this.http
      .get<ApiResponse<DiamondColor>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  create(payload: Partial<DiamondColor>): Observable<DiamondColor> {
    return this.http
      .post<ApiResponse<DiamondColor>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: string, payload: Partial<DiamondColor>): Observable<DiamondColor> {
    return this.http
      .put<ApiResponse<DiamondColor>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}
