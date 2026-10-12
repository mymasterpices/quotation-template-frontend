import { Routes } from '@angular/router';
import { QuotationCreateComponent } from './pages/quotation-create/quotation-create.component';
import { RateMasterComponent } from './pages/rate-master/rate-master.component';
import { QuotationsComponent } from './pages/quotations/quotations.component';
import { QuotationDetailComponent } from './pages/quotation-detail/quotation-detail.component';

export const routes: Routes = [
  {
    path: '',
    // loadComponent: () =>
    //   import('./pages/quotation-create/quotation-create.component').then(
    //     (m) => m.QuotationCreateComponent,
    //   ),
    component: QuotationCreateComponent,
  },
  {
    path: 'admin/rates',
    // loadComponent: () =>
    //   import('./pages/rate-master/rate-master.component').then(
    //     (m) => m.RateMasterComponent,
    //   ),
    component: RateMasterComponent,
  },
  {
    path: 'quotations',
    // loadComponent: () =>
    //   import('./pages/rate-master/rate-master.component').then(
    //     (m) => m.RateMasterComponent,
    //   ),
    component: QuotationsComponent,
  },
  {
    path: 'quotation-detail/:id',
    // loadComponent: () =>
    //   import('./pages/rate-master/rate-master.component').then(
    //     (m) => m.RateMasterComponent,
    //   ),
    component: QuotationDetailComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];