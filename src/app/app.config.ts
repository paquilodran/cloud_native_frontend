import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  MSAL_GUARD_CONFIG,
  MSAL_INSTANCE,
  MsalBroadcastService,
  MsalGuard,
  MsalService
} from '@azure/msal-angular';
import { IPublicClientApplication } from '@azure/msal-browser';
import { routes } from './app.routes';
import { MSALGuardConfigFactory, MSALInstanceFactory } from './auth/msal.config';
import { jwtInterceptor } from './shared/jwt.interceptor';

const msalInstance = MSALInstanceFactory();

function initializeMsal(instance: IPublicClientApplication): () => Promise<void> {
  return () => instance.initialize();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    { provide: MSAL_INSTANCE, useValue: msalInstance },
    { provide: MSAL_GUARD_CONFIG, useFactory: MSALGuardConfigFactory },
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
