import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
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
    switchMap((result) => {
      console.log('Authorization: Bearer', result.accessToken);
      const authorized = req.clone({
        setHeaders: {
          Authorization: `Bearer ${result.accessToken}`
        }
      });
      return next(authorized);
    }),
    catchError((error) => {
      console.error('No se pudo obtener el JWT', error);
      return throwError(() => error);
    })
  );
};
