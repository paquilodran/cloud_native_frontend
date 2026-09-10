import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { claseEstado, etiquetaEstado } from '../shared/estado-visual';
import { Pedido } from './pedido.model';
import { PedidosService } from './pedidos.service';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './pedidos.component.html',
  styleUrl: './pedidos.component.css'
})
export class PedidosComponent implements OnInit {
  private readonly pedidosService = inject(PedidosService);
  private readonly msal = inject(MsalService);
  private readonly router = inject(Router);

  readonly pedidos = signal<Pedido[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly tokenPreview = signal('');
  readonly usuario = signal('Invitado');
  readonly etiquetaEstado = etiquetaEstado;
  readonly claseEstado = claseEstado;

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
      this.usuario.set(account.name ?? account.username ?? 'Usuario Azure');
    }
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    const request = this.modoDemo ? this.pedidosService.listarDemo() : this.pedidosService.listar();
    request.subscribe({
      next: (data) => {
        this.pedidos.set(data);
        this.cargando.set(false);
        this.actualizarTokenPreview();
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err.status === 401
          ? '401 Unauthorized'
          : `Error ${err.status || ''} al cargar pedidos`);
      }
    });
  }

  abrirModal(): void {
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  crear(): void {
    if (this.modoDemo) {
      const creado: Pedido = {
        ...this.nuevo,
        id: this.pedidos().length + 1,
        fecha: new Date().toISOString()
      };
      this.pedidos.update((actual) => [creado, ...actual]);
      this.resetForm();
      this.cerrarModal();
      return;
    }

    this.pedidosService.crear(this.nuevo).subscribe({
      next: () => {
        this.resetForm();
        this.cerrarModal();
        this.cargar();
      },
      error: (err) => this.error.set(`No se pudo crear el pedido (${err.status})`)
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
    const keys = Object.keys(localStorage).filter((key) => key.toLowerCase().includes('accesstoken'));
    const raw = keys.map((key) => localStorage.getItem(key)).find((value) => !!value);
    this.tokenPreview.set(raw ? `${raw.slice(0, 28)}…${raw.slice(-12)}` : 'Token adjunto en el header (ver consola)');
  }
}
