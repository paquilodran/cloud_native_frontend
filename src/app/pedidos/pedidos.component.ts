import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { claseEstado, etiquetaEstado } from '../shared/estado-visual';
import { environment } from '../../environments/environment';
import { Pedido } from './pedido.model';
import { PedidosService } from './pedidos.service';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './pedidos.component.html',
  styleUrl: './pedidos.component.css'
})
export class PedidosComponent implements OnInit {
  private readonly pedidosService = inject(PedidosService);
  private readonly msal = inject(MsalService);
  private readonly router = inject(Router);

  readonly pedidos = signal<Pedido[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly eliminando = signal(false);
  readonly error = signal('');
  readonly errorModal = signal('');
  readonly tokenPreview = signal('');
  readonly usuario = signal('Invitado');
  readonly etiquetaEstado = etiquetaEstado;
  readonly claseEstado = claseEstado;

  // Acciones y modales adicionales
  readonly pedidoDetalle = signal<Pedido | null>(null);
  readonly pedidoEditando = signal<Pedido | null>(null);
  readonly pedidoEliminar = signal<Pedido | null>(null);
  readonly menuAbiertoId = signal<number | null>(null);

  modalAbierto = false;
  busqueda = '';
  filtro = '';
  pagina = 1;
  readonly pageSize = 6;
  cantidad = 1;

  nuevo: Pedido = {
    nombre: '',
    cliente: '',
    estado: 'CREADO',
    total: 0
  };

  get modoDemo(): boolean {
    return this.router.url.startsWith('/demo');
  }

  get filtrados(): Pedido[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.pedidos().filter((pedido) => {
      const matchTexto = !q
        || `${pedido.id}`.includes(q)
        || pedido.cliente.toLowerCase().includes(q)
        || pedido.nombre.toLowerCase().includes(q);
      const matchEstado = !this.filtro || pedido.estado === this.filtro;
      return matchTexto && matchEstado;
    });
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.filtrados.length / this.pageSize));
  }

  get paginaItems(): Pedido[] {
    const start = (this.pagina - 1) * this.pageSize;
    return this.filtrados.slice(start, start + this.pageSize);
  }

  ngOnInit(): void {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (account) {
      this.msal.instance.setActiveAccount(account);
      this.usuario.set(account.name ?? account.username ?? 'Usuario Azure');
    }
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    const activeAccount = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    console.log('[DEBUG Pedidos] Cuentas MSAL:', this.msal.instance.getAllAccounts());
    console.log('[DEBUG Pedidos] Cuenta activa:', activeAccount);

    if (activeAccount) {
      this.msal.acquireTokenSilent({
        scopes: environment.azure.apiScopes,
        account: activeAccount
      }).subscribe({
        next: (tokenRes) => {
          try {
            const payload = JSON.parse(atob(tokenRes.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            console.log('[DEBUG Token JWT] Payload decodificado:', payload);
            console.log('[DEBUG Token JWT] Token completo:', tokenRes.accessToken);
          } catch (e) {
            console.error('[DEBUG Token JWT] Error parseando payload:', e);
          }
        },
        error: (tokenErr) => console.error('[DEBUG Token JWT] Error silent:', tokenErr)
      });
    }

    const request = this.modoDemo ? this.pedidosService.listarDemo() : this.pedidosService.listar();
    request.subscribe({
      next: (data) => {
        console.log('[DEBUG Pedidos] Éxito:', data);
        this.pedidos.set(data);
        this.cargando.set(false);
        this.actualizarTokenPreview();
      },
      error: (err) => {
        console.error('[DEBUG Pedidos] Error completo HTTP:', err);
        console.error('[DEBUG Pedidos] Status:', err.status);
        console.error('[DEBUG Pedidos] Respuesta del servidor:', err.error);
        this.cargando.set(false);
        const mensajeServidor = err.error?.message || err.error?.error || '';
        this.error.set(err.status === 401
          ? `401 Unauthorized${mensajeServidor ? ': ' + mensajeServidor : ''}`
          : `Error ${err.status || ''} al cargar pedidos`);
      }
    });
  }

  abrirModal(): void {
    this.errorModal.set('');
    this.guardando.set(false);
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.guardando.set(false);
  }

  crear(): void {
    if (this.guardando()) return;
    this.errorModal.set('');

    const payload: Pedido = {
      ...this.nuevo,
      total: Number(this.nuevo.total)
    };

    if (this.modoDemo) {
      const creado: Pedido = {
        ...payload,
        id: this.pedidos().length + 1,
        fecha: new Date().toISOString()
      };
      this.pedidos.update((actual) => [creado, ...actual]);
      this.resetForm();
      this.cerrarModal();
      return;
    }

    this.guardando.set(true);
    this.pedidosService.crear(payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.resetForm();
        this.cerrarModal();
        this.cargar();
      },
      error: (err) => {
        console.error('[DEBUG Crear Pedido] Error completo:', err);
        this.guardando.set(false);
        const detalle = err.error?.message || (err.status === 404 ? 'Ruta POST no encontrada en API Gateway (falta ruta ANY o POST)' : `Error ${err.status}`);
        this.errorModal.set(`No se pudo crear: ${detalle}`);
        this.error.set(`Error al crear pedido (${err.status})`);
      }
    });
  }

  private resetForm(): void {
    this.nuevo = { nombre: '', cliente: '', estado: 'CREADO', total: 0 };
    this.cantidad = 1;
  }

  private actualizarTokenPreview(): void {
    if (this.modoDemo) {
      this.tokenPreview.set('Modo demo: no se envía JWT');
      return;
    }
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (account) {
      this.msal.acquireTokenSilent({
        scopes: environment.azure.apiScopes,
        account
      }).subscribe({
        next: (res) => {
          const raw = res.accessToken;
          this.tokenPreview.set(raw ? `${raw.slice(0, 24)}…${raw.slice(-10)}` : 'Token adjunto en el header');
        },
        error: () => this.tokenPreview.set('Token activo en sesión')
      });
    }
  }

  verDetalle(pedido: Pedido): void {
    this.pedidoDetalle.set(pedido);
    this.menuAbiertoId.set(null);
  }

  cerrarDetalle(): void {
    this.pedidoDetalle.set(null);
  }

  toggleMenu(id: number | undefined, event: MouseEvent): void {
    event.stopPropagation();
    if (id === undefined) return;
    this.menuAbiertoId.update((curr) => (curr === id ? null : id));
  }

  cerrarMenus(): void {
    this.menuAbiertoId.set(null);
  }

  iniciarEdicion(pedido: Pedido): void {
    this.pedidoEditando.set({ ...pedido });
    this.menuAbiertoId.set(null);
  }

  cerrarEdicion(): void {
    this.pedidoEditando.set(null);
  }

  guardarEdicion(): void {
    const edit = this.pedidoEditando();
    if (!edit || !edit.id) return;
    this.guardando.set(true);
    const payload = {
      ...edit,
      total: Number(edit.total)
    };
    this.pedidosService.actualizar(edit.id, payload).subscribe({
      next: (actualizado) => {
        this.pedidos.update((items) => items.map((p) => p.id === edit.id ? { ...p, ...actualizado, ...payload } : p));
        this.guardando.set(false);
        this.cerrarEdicion();
      },
      error: () => {
        this.pedidos.update((items) => items.map((p) => p.id === edit.id ? { ...p, ...payload } : p));
        this.guardando.set(false);
        this.cerrarEdicion();
      }
    });
  }

  iniciarEliminar(pedido: Pedido): void {
    this.pedidoEliminar.set(pedido);
    this.menuAbiertoId.set(null);
  }

  cancelarEliminar(): void {
    this.pedidoEliminar.set(null);
  }

  confirmarEliminar(): void {
    const p = this.pedidoEliminar();
    if (!p || !p.id) return;
    this.eliminando.set(true);
    this.pedidosService.eliminar(p.id).subscribe({
      next: () => {
        this.pedidos.update((items) => items.filter((item) => item.id !== p.id));
        this.eliminando.set(false);
        this.pedidoEliminar.set(null);
      },
      error: () => {
        this.pedidos.update((items) => items.filter((item) => item.id !== p.id));
        this.eliminando.set(false);
        this.pedidoEliminar.set(null);
      }
    });
  }
}
