import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';

export interface DiamondClarity {
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
export class DiamondClarityService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/diamond-clarities`;

  getAll(): Observable<DiamondClarity[]> {
    return this.http
      .get<ApiResponse<DiamondClarity[]>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }

  getById(id: string): Observable<DiamondClarity> {
    return this.http
      .get<ApiResponse<DiamondClarity>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  create(payload: Partial<DiamondClarity>): Observable<DiamondClarity> {
    return this.http
      .post<ApiResponse<DiamondClarity>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(
    id: string,
    payload: Partial<DiamondClarity>,
  ): Observable<DiamondClarity> {
    return this.http
      .put<ApiResponse<DiamondClarity>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}
