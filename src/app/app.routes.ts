import { Routes } from '@angular/router';
import { QuotationCreateComponent } from './pages/quotation-create/quotation-create.component';
import { RateMasterComponent } from './pages/rate-master/rate-master.component';

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
    path: '**',
    redirectTo: '',
  },
];