import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Reserva / evidencia de interceptor JWT.
 * En runtime se usa MsalInterceptor (app.config.ts), que es lo que pide la pauta.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl) || req.headers.has('Authorization')) {
    return next(req);
  }

  const msal = inject(MsalService);
  const account = msal.instance.getActiveAccount() ?? msal.instance.getAllAccounts()[0];
  if (!account) {
    return next(req);
  }

  return from(
    msal.instance.acquireTokenSilent({
      account,
      scopes: environment.azure.apiScopes
    })
  ).pipe(
    switchMap((result) => next(req.clone({
      setHeaders: { Authorization: `Bearer ${result.accessToken}` }
    })))
  );
};
