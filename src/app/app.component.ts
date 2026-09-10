import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly msal = inject(MsalService);
  private readonly broadcast = inject(MsalBroadcastService);
  private readonly router = inject(Router);

  autenticado = false;
  usuario = 'Patricio';
  esLogin = false;
  menuAbierto = false;
  busqueda = '';

  ngOnInit(): void {
    this.esLogin = this.router.url.startsWith('/login');
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const nav = event as NavigationEnd;
      this.esLogin = nav.urlAfterRedirects.startsWith('/login');
      this.menuAbierto = false;
    });

    this.msal.handleRedirectObservable().subscribe((result) => {
      if (result?.account) {
        this.msal.instance.setActiveAccount(result.account);
      }
      this.syncSession();
    });

    this.broadcast.inProgress$
      .pipe(filter((status) => status === InteractionStatus.None))
      .subscribe(() => this.syncSession());
  }

  logout(): void {
    this.msal.logoutRedirect();
  }

  buscar(): void {
    this.router.navigate(['/pedidos']);
  }

  get inicial(): string {
    return (this.usuario || 'P').charAt(0).toUpperCase();
  }

  private syncSession(): void {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (account) {
      this.msal.instance.setActiveAccount(account);
      this.autenticado = true;
      this.usuario = account.name ?? account.username ?? 'Patricio';
      return;
    }
    this.autenticado = false;
    this.usuario = 'Patricio';
  }
}
