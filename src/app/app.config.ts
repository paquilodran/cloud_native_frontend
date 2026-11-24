import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  MSAL_GUARD_CONFIG,
  MSAL_INSTANCE,
  MSAL_INTERCEPTOR_CONFIG,
  MsalBroadcastService,
  MsalGuard,
  MsalInterceptor,
  MsalService
} from '@azure/msal-angular';
import { IPublicClientApplication } from '@azure/msal-browser';
import { routes } from './app.routes';
import { MSALGuardConfigFactory, MSALInstanceFactory, MSALInterceptorConfigFactory } from './auth/msal.config';

let msalInstance: IPublicClientApplication;
try {
  msalInstance = MSALInstanceFactory();
} catch (e) {
  console.warn('[MSAL] Contexto no seguro detectado, usando fallback resiliente:', e);
  msalInstance = {
    initialize: () => Promise.resolve(),
    getAllAccounts: () => [],
    getActiveAccount: () => null,
    setActiveAccount: () => {},
    acquireTokenSilent: () => Promise.reject(new Error('MSAL no disponible en HTTP')),
    acquireTokenRedirect: () => Promise.resolve(),
    loginRedirect: () => Promise.resolve(),
    logoutRedirect: () => Promise.resolve(),
    handleRedirectPromise: () => Promise.resolve(null),
    addEventCallback: () => null,
    removeEventCallback: () => {},
    enableAccountStorageEvents: () => {},
    disableAccountStorageEvents: () => {}
  } as unknown as IPublicClientApplication;
}

function initializeMsal(instance: IPublicClientApplication): () => Promise<void> {
  return () => {
    try {
      return instance.initialize();
    } catch {
      return Promise.resolve();
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: MsalInterceptor, multi: true },
    { provide: MSAL_INSTANCE, useValue: msalInstance },
    { provide: MSAL_GUARD_CONFIG, useFactory: MSALGuardConfigFactory },
    { provide: MSAL_INTERCEPTOR_CONFIG, useFactory: MSALInterceptorConfigFactory },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeMsal,
      deps: [MSAL_INSTANCE],
      multi: true
    },
    MsalService,
    MsalGuard,
    MsalBroadcastService
  ]
};
