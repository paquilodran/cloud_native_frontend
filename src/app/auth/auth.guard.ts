import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';

/** Guard auxiliar. La ruta /pedidos usa MsalGuard oficial (pauta). */
export const authGuard: CanActivateFn = () => {
  const msal = inject(MsalService);
  const router = inject(Router);

  const active = msal.instance.getActiveAccount();
  const fallback = msal.instance.getAllAccounts()[0];
  const account = active ?? fallback ?? null;

  if (account) {
    msal.instance.setActiveAccount(account);
    return true;
  }

  return router.createUrlTree(['/login']);
};
