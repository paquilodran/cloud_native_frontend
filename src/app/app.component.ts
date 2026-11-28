import { AsyncPipe } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { filter } from 'rxjs';
import { environment } from '../environments/environment';
import { CartasService } from './cartas/cartas.service';
import { MatrixRainComponent } from './shared/matrix-rain.component';
import { NotificationService } from './shared/notification.service';
import { TokenClaims, toTokenClaims } from './shared/token-claims';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AsyncPipe, MatrixRainComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly msal = inject(MsalService);
  private readonly broadcast = inject(MsalBroadcastService);
  private readonly router = inject(Router);
  private readonly cartasService = inject(CartasService);
  readonly notificationService = inject(NotificationService);

  formatCredits(amount: number): string {
    return '$ ' + amount.toLocaleString('es-CL');
  }

  // Estado visual global para lluvia Matrix y navegación
  activeBrokerIds: number[] = [1, 2, 3];
  balance = 185000;
  readonly tabs = ['inicio', 'taquilla', 'mensajeria', 'sistema'];
  currentTab = 'inicio';

  totalOrdenes = 3;
  autenticado = false;
  usuario = 'Patricio';
  email = 'patricio@duocuc.cl';
  tenantId = environment.azure.tenantId;
  clientId = environment.azure.apiClientId;
  esLogin = false;
  menuAbierto = false;
  busqueda = '';

  menuNotificacionesAbierto = false;
  menuPerfilAbierto = false;
  modalPerfilAbierto = false;
  tokenPreview = '';
  tokenClaims: TokenClaims | null = null;
  copiadoTenant = false;
  copiadoToken = false;

  get brokersOnlineCount(): number {
    return this.activeBrokerIds.length;
  }

  get inicial(): string {
    return (this.usuario || 'P').charAt(0).toUpperCase();
  }

  @HostListener('window:matrix:brokers', ['$event'])
  onBrokersChanged(event: Event): void {
    const custom = event as CustomEvent<number[]>;
    if (Array.isArray(custom.detail)) {
      this.activeBrokerIds = [...custom.detail];
    }
  }

  recargarBalance(): void {
    this.balance += 50000;
    this.notificationService.showToast('Crédito recargado: +$ 50.000 asignados al terminal.', 'success');
  }

  irATab(tab: string): void {
    this.currentTab = tab;
    if (tab === 'mensajeria' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matrix:reset-choice'));
    }
    this.router.navigate(['/'], { queryParams: { tab } });
  }

  prevTab(): void {
    const idx = this.tabs.indexOf(this.currentTab);
    const nextIdx = (idx - 1 + this.tabs.length) % this.tabs.length;
    this.irATab(this.tabs[nextIdx]);
  }

  nextTab(): void {
    const idx = this.tabs.indexOf(this.currentTab);
    const nextIdx = (idx + 1) % this.tabs.length;
    this.irATab(this.tabs[nextIdx]);
  }

  @HostListener('window:matrix:open-profile')
  abrirModalPerfil(): void {
    this.modalPerfilAbierto = true;
    this.menuPerfilAbierto = false;
    this.obtenerTokenPreview();
  }

  cerrarModalPerfil(): void {
    this.modalPerfilAbierto = false;
  }

  iniciarSesion(): void {
    this.modalPerfilAbierto = false;
    this.router.navigate(['/login']);
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    if (event.key === '1') this.irATab('inicio');
    if (event.key === '2') this.irATab('taquilla');
    if (event.key === '3') this.irATab('mensajeria');
    if (event.key === '4') this.irATab('sistema');
    if (event.key === 'l' || event.key === 'L') this.prevTab();
    if (event.key === 'r' || event.key === 'R') this.nextTab();

    if (event.key === 'Escape') {
      if (this.modalPerfilAbierto) {
        this.cerrarModalPerfil();
      } else if (this.menuPerfilAbierto) {
        this.menuPerfilAbierto = false;
      } else if (this.menuNotificacionesAbierto) {
        this.menuNotificacionesAbierto = false;
      }
    }
  }

  copiarTexto(texto: string, tipo: 'tenant' | 'token'): void {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
      if (tipo === 'tenant') {
        this.copiadoTenant = true;
        setTimeout(() => (this.copiadoTenant = false), 2500);
      } else {
        this.copiadoToken = true;
        setTimeout(() => (this.copiadoToken = false), 2500);
      }
      this.notificationService.showToast(`${tipo === 'tenant' ? 'Tenant ID' : 'Token JWT'} copiado al portapapeles`, 'info');
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-trigger') && !target.closest('.profile-dropdown')) {
      this.menuPerfilAbierto = false;
    }
    if (!target.closest('.notifications-trigger') && !target.closest('.notifications-dropdown')) {
      this.menuNotificacionesAbierto = false;
    }
  }

  ngOnInit(): void {
    this.esLogin = this.router.url.startsWith('/login');
    this.syncTabFromUrl(this.router.url);

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const nav = event as NavigationEnd;
      this.esLogin = nav.urlAfterRedirects.startsWith('/login');
      this.syncTabFromUrl(nav.urlAfterRedirects);
      this.menuAbierto = false;
      this.menuPerfilAbierto = false;
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

    this.cargarContadorOrdenes();
  }

  private syncTabFromUrl(url: string): void {
    const match = url.match(/[?&]tab=([^&]+)/);
    if (match) {
      const tab = decodeURIComponent(match[1]);
      if (tab === 'mochila') this.currentTab = 'taquilla';
      else if (tab === 'kafka' || tab === 'rabbitmq') this.currentTab = 'mensajeria';
      else if (tab === 'entrenador' || tab === 'dashboard') this.currentTab = 'sistema';
      else if (this.tabs.includes(tab)) this.currentTab = tab;
    } else if (url.startsWith('/cartas')) {
      this.currentTab = 'taquilla';
    } else {
      this.currentTab = 'inicio';
    }
  }

  cargarContadorOrdenes(): void {
    this.cartasService.listarOrdenes().subscribe({
      next: (res) => (this.totalOrdenes = res.length),
      error: () => (this.totalOrdenes = 0)
    });
  }

  logout(): void {
    this.modalPerfilAbierto = false;
    this.menuPerfilAbierto = false;
    this.msal.logoutRedirect();
  }

  private syncSession(): void {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (account) {
      this.msal.instance.setActiveAccount(account);
      this.autenticado = true;
      this.usuario = account.name ?? account.username ?? 'Patricio';
      this.email = account.username ?? 'patricio@duocuc.cl';
      return;
    }
    this.autenticado = false;
    this.usuario = 'Patricio';
    this.email = 'patricio@duocuc.cl';
  }

  private obtenerTokenPreview(): void {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (!account) {
      this.tokenPreview = 'Sin sesión Microsoft Entra ID activa (Modo Standalone / Demo)';
      this.tokenClaims = null;
      return;
    }

    this.msal.instance
      .acquireTokenSilent({
        account,
        scopes: environment.azure.apiScopes
      })
      .then((result) => {
        this.tokenPreview = result.accessToken;
        this.tokenClaims = toTokenClaims(result.accessToken);
      })
      .catch(() => {
        this.tokenPreview = 'Token silencioso no disponible (inicia sesión nuevamente)';
        this.tokenClaims = null;
      });
  }
}
