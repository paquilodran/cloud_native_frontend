import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login.component';
import { CartasComponent } from './cartas/cartas.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'cartas', component: CartasComponent },
  { path: 'pedidos', redirectTo: 'cartas' },
  { path: '**', redirectTo: '' }
];
