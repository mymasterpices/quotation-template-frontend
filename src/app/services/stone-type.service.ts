import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';

export interface StoneType {
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
export class StoneTypeService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/stone-types`;

  getAll(): Observable<StoneType[]> {
    return this.http
      .get<ApiResponse<StoneType[]>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }
  getById(id: string): Observable<StoneType> {
    return this.http
      .get<ApiResponse<StoneType>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }
  create(payload: Partial<StoneType>): Observable<StoneType> {
    return this.http
      .post<ApiResponse<StoneType>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }
  update(id: string, payload: Partial<StoneType>): Observable<StoneType> {
    return this.http
      .put<ApiResponse<StoneType>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}
