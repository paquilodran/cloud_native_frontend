import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// MSAL: factories en app/auth/msal.config.ts, providers en app.config.ts

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
