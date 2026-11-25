import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { filter } from 'rxjs';
import { environment } from '../environments/environment';
import { CartasService } from './cartas/cartas.service';
import { NotificationService } from './shared/notification.service';
import { formatPokedollars } from './shared/pokemon-sprites';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, AsyncPipe, DatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly msal = inject(MsalService);
  private readonly broadcast = inject(MsalBroadcastService);
  private readonly router = inject(Router);
  private readonly cartasService = inject(CartasService);
  readonly notificationService = inject(NotificationService);

  readonly formatPokedollars = formatPokedollars;

  // GBA Console Shell State
  shellTheme: 'INDIGO' | 'DMG' = 'INDIGO';
  balance = 185000;
  vistaAmpliada = false;
  readonly tabs = ['mochila', 'kafka', 'rabbitmq', 'entrenador'];
  currentTab = 'mochila';

  toggleVistaAmpliada(): void {
    this.vistaAmpliada = !this.vistaAmpliada;
  }

  totalOrdenes = 3;
  autenticado = false;
  usuario = 'Patricio';
  email = 'patricio@duocuc.cl';
  tenantId = environment.azure.tenantId;
  clientId = environment.azure.apiClientId;
  esLogin = false;
  menuAbierto = false;
  busqueda = '';

  toggleShellTheme(): void {
    this.shellTheme = this.shellTheme === 'INDIGO' ? 'DMG' : 'INDIGO';
  }

  recargarBalance(): void {
    this.balance += 50000;
    this.notificationService.showToast('¡Has recibido ₽ 50.000 Poké-dólares de la Liga Pokémon!', 'success');
  }

  irATab(tab: string): void {
    this.currentTab = tab;
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

  // Control de agrupación / desagrupación en la barra lateral
  seccionMensajeriaAbierta = true;
  seccionTecnologiasAbierta = true;

  // Control de notificaciones
  menuNotificacionesAbierto = false;

  // Control de menú de perfil desplegable y ventana modal de usuario
  menuPerfilAbierto = false;
  modalPerfilAbierto = false;
  tokenPreview = '';
  copiadoTenant = false;
  copiadoToken = false;

  @HostListener('window:keydown', ['$event'])
  onGlobalKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    if (event.key === '1') this.irATab('mochila');
    if (event.key === '2') this.irATab('kafka');
    if (event.key === '3') this.irATab('rabbitmq');
    if (event.key === '4') this.irATab('entrenador');
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
        setTimeout(() => this.copiadoTenant = false, 2500);
      } else {
        this.copiadoToken = true;
        setTimeout(() => this.copiadoToken = false, 2500);
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
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const nav = event as NavigationEnd;
      this.esLogin = nav.urlAfterRedirects.startsWith('/login');
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

  cargarContadorOrdenes(): void {
    this.cartasService.listarOrdenes().subscribe({
      next: (res) => this.totalOrdenes = res.length,
      error: () => this.totalOrdenes = 0
    });
  }

  toggleMenuPerfil(event: Event): void {
    event.stopPropagation();
    this.menuPerfilAbierto = !this.menuPerfilAbierto;
    if (this.menuPerfilAbierto) {
      this.menuNotificacionesAbierto = false;
    }
  }

  toggleMenuNotificaciones(event: Event): void {
    event.stopPropagation();
    this.menuNotificacionesAbierto = !this.menuNotificacionesAbierto;
    if (this.menuNotificacionesAbierto) {
      this.menuPerfilAbierto = false;
    }
  }

  abrirModalPerfil(): void {
    this.modalPerfilAbierto = true;
    this.menuPerfilAbierto = false;
    this.obtenerTokenPreview();
  }

  cerrarModalPerfil(): void {
    this.modalPerfilAbierto = false;
  }

  toggleSeccionMensajeria(): void {
    this.seccionMensajeriaAbierta = !this.seccionMensajeriaAbierta;
  }

  toggleSeccionTecnologias(): void {
    this.seccionTecnologiasAbierta = !this.seccionTecnologiasAbierta;
  }

  logout(): void {
    this.menuPerfilAbierto = false;
    this.msal.logoutRedirect();
  }

  buscar(): void {
    this.router.navigate(['/cartas']);
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
      this.email = account.username ?? 'patricio@duocuc.cl';
      return;
    }
    this.autenticado = false;
    this.usuario = 'Patricio';
    this.email = 'patricio@duocuc.cl';
  }

  private obtenerTokenPreview(): void {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (!account) return;

    this.msal.instance.acquireTokenSilent({
      account,
      scopes: environment.azure.apiScopes
    }).then((result) => {
      this.tokenPreview = result.accessToken;
    }).catch(() => {
      this.tokenPreview = 'Token en memoria (Mock / Standalone)';
    });
  }
}
