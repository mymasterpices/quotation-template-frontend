// order.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.development';

export interface OrderPayload {
  basicInfo: {
    customerName: string;
    phoneNumber: string;
    email: string;
    salesPerson: string;
  };
  metal: {
    purity: string;
    weight: number;
  };
  diamonds: Array<{
    shape: string;
    quality: string;
    weight: number;
    pieces: number;
  }>;
  stones: Array<{
    type: string;
    shape: string;
    quality: string;
    weight: number;
    pieces: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private baseUrl = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {}

  createOrder(payload: OrderPayload): Observable<any> {
    return this.http.post(this.baseUrl, payload);
  }
}
