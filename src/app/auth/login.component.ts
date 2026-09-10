import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly msal = inject(MsalService);
  private readonly router = inject(Router);

  readonly configurado = !environment.azure.tenantId.startsWith('TU-');

  login(): void {
    this.msal.loginRedirect({
      scopes: environment.azure.apiScopes
    });
  }

  irAPedidos(): void {
    this.router.navigate(['/pedidos']);
  }

  get yaAutenticado(): boolean {
    return this.msal.instance.getAllAccounts().length > 0;
  }
}
