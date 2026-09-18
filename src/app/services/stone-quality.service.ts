import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';

export interface StoneQuality {
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
export class StoneQualityService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/stone-qualities`;

  getAll(): Observable<StoneQuality[]> {
    return this.http
      .get<ApiResponse<StoneQuality[]>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }
  getById(id: string): Observable<StoneQuality> {
    return this.http
      .get<ApiResponse<StoneQuality>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }
  create(payload: Partial<StoneQuality>): Observable<StoneQuality> {
    return this.http
      .post<ApiResponse<StoneQuality>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }
  update(id: string, payload: Partial<StoneQuality>): Observable<StoneQuality> {
    return this.http
      .put<ApiResponse<StoneQuality>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}
