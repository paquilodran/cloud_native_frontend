import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { LoginComponent } from './auth/login.component';
import { HomeComponent } from './home/home.component';
import { PedidosComponent } from './pedidos/pedidos.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'demo', component: PedidosComponent },
  { path: 'pedidos', component: PedidosComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
