import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface OrderPayload {
  category: string;
  basicInfo: {
    customerName: string;
    phoneNumber: string;
    email: string;
    salesPerson: string;
  };
  metal: { purity: string; weight: number };
  diamonds: Array<{
    shape: string;
    quality: string;
    weight: number;
    pieces: number;
  }>;
  stones: Array<{
    type: string;
    shape: string | null;
    quality: string;
    weight: number;
    pieces: number;
  }>;
  estimate?: {
    makingChargePerGram: number | null;
    country: string;
    countryFactor: number | null;
    baseCost: number;
    total: number;
  };
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private baseUrl = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {}

  // FormData: do NOT set Content-Type manually, the browser adds the
  // multipart boundary itself.
  createOrder(formData: FormData): Observable<any> {
    return this.http.post(this.baseUrl, formData);
  }
}
