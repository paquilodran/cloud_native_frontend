import { DecimalPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MsalService } from '@azure/msal-angular';
import { claseEstado, etiquetaEstado } from '../shared/estado-visual';
import { NotificationService } from '../shared/notification.service';
import { getPokemonGbaSprite, OAK_SPRITE, formatPokedollars } from '../shared/pokemon-sprites';
import { Carta, Orden, colorTipo, esHolo } from './carta.model';
import { CartasService } from './cartas.service';

@Component({
  selector: 'app-cartas',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],
  templateUrl: './cartas.component.html',
  styleUrl: './cartas.component.css'
})
export class CartasComponent implements OnInit {
  private readonly cartasService = inject(CartasService);
  private readonly msal = inject(MsalService);
  private readonly notifications = inject(NotificationService);

  readonly cartas = signal<Carta[]>([]);
  readonly ordenes = signal<Orden[]>([]);
  readonly cargando = signal(false);
  readonly procesando = signal(false);
  readonly sobreAbierto = signal<Carta[] | null>(null);
  readonly cartaDetalle = signal<Carta | null>(null);
  readonly cantidad = signal(1);
  readonly historialAbierto = signal(false);

  readonly colorTipo = colorTipo;
  readonly esHolo = esHolo;
  readonly etiquetaEstado = etiquetaEstado;
  readonly claseEstado = claseEstado;
  readonly getPokemonGbaSprite = getPokemonGbaSprite;
  readonly oakSprite = OAK_SPRITE;
  readonly formatPokedollars = formatPokedollars;

  busqueda = '';
  tipoFiltro = '';
  rarezaFiltro = '';
  soloHolo = false;
  pagina = 1;
  readonly pageSize = 12;

  get autenticado(): boolean {
    return this.msal.instance.getAllAccounts().length > 0;
  }

  get entrenador(): string {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    return account?.name ?? account?.username ?? 'Entrenador';
  }

  get tipos(): string[] {
    return [...new Set(this.cartas().map((c) => c.tipo))].sort();
  }

  get rarezas(): string[] {
    return [...new Set(this.cartas().map((c) => c.rareza))].sort();
  }

  get filtradas(): Carta[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.cartas().filter((c) =>
      (!q || c.nombre.toLowerCase().includes(q)) &&
      (!this.tipoFiltro || c.tipo.toLowerCase() === this.tipoFiltro.toLowerCase()) &&
      (!this.rarezaFiltro || c.rareza === this.rarezaFiltro) &&
      (!this.soloHolo || esHolo(c.rareza))
    );
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.filtradas.length / this.pageSize));
  }

  get paginaItems(): Carta[] {
    const start = (this.pagina - 1) * this.pageSize;
    return this.filtradas.slice(start, start + this.pageSize);
  }

  ngOnInit(): void {
    this.cargando.set(true);
    this.cartasService.listarCatalogo().subscribe((data) => {
      this.cartas.set(data);
      this.cargando.set(false);
    });
    this.cargarOrdenes();
  }

  cargarOrdenes(): void {
    this.cartasService.listarOrdenes().subscribe((data) => this.ordenes.set(data.slice(0, 8)));
  }

  filtrar(): void {
    this.pagina = 1;
  }

  filtrarElemento(elemento: string): void {
    this.tipoFiltro = this.tipoFiltro === elemento ? '' : elemento;
    this.pagina = 1;
  }

  toggleSoloHolo(): void {
    this.soloHolo = !this.soloHolo;
    this.pagina = 1;
  }

  toggleHistorial(): void {
    this.historialAbierto.set(!this.historialAbierto());
  }

  cambiarPagina(delta: number): void {
    this.pagina = Math.min(this.totalPaginas, Math.max(1, this.pagina + delta));
  }

  comprar(carta: Carta): void {
    if (this.procesando()) return;
    this.procesando.set(true);
    const cantidad = Math.max(1, Number(this.cantidad()) || 1);
    this.cartasService.comprar(carta, cantidad, this.entrenador).subscribe((orden) => {
      this.procesando.set(false);
      this.cartaDetalle.set(null);
      this.notifications.notify(
        'Compra registrada',
        `${cantidad} x ${carta.nombre} (orden #${orden.id}) publicada en RabbitMQ y Kafka.`,
        'success',
        'CARTAS'
      );
      this.cargarOrdenes();
    });
  }

  abrirSobre(): void {
    if (this.procesando()) return;
    this.procesando.set(true);
    this.cartasService.abrirSobre(this.entrenador).subscribe((res) => {
      this.procesando.set(false);
      this.sobreAbierto.set(res.cartas);
      this.notifications.notify(
        'Sobre abierto',
        `Orden #${res.orden.id}: ${res.cartas.length} cartas emitidas a Kafka (analitica por tipo).`,
        'success',
        'CARTAS'
      );
      this.cargarOrdenes();
    });
  }

  verDetalle(carta: Carta): void {
    this.cantidad.set(1);
    this.cartaDetalle.set(carta);
  }

  cerrarModales(): void {
    this.cartaDetalle.set(null);
    this.sobreAbierto.set(null);
  }

  ocultarImagen(event: Event): void {
    (event.target as HTMLImageElement).style.visibility = 'hidden';
  }
}
