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
  imports: [FormsModule],
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
  readonly ultimaOrden = signal<Orden | null>(null);
  readonly ultimaParticion = signal<number>(1);

  readonly colorTipo = colorTipo;
  readonly esHolo = esHolo;
  readonly etiquetaEstado = etiquetaEstado;
  readonly claseEstado = claseEstado;
  readonly getPokemonGbaSprite = getPokemonGbaSprite;
  readonly oakSprite = OAK_SPRITE;
  readonly formatPokedollars = formatPokedollars;

  /** Mapeo visual 100% Matrix para los registros del backend (sin tocar servicios ni API). */
  sectorMatrix(tipo: string | undefined | null): string {
    const map: Record<string, string> = {
      Fire: 'RED PILL',
      Water: 'ZION',
      Grass: 'CONSTRUCT',
      Lightning: 'NEBUCHADNEZZAR',
      Psychic: 'ORACLE',
      Fighting: 'SENTINEL',
      Colorless: 'MAINFRAME'
    };
    return (tipo && map[tipo]) || 'MAINFRAME';
  }

  codigoTicket(id: number): string {
    return `MTX-${String(id).padStart(4, '0')}`;
  }

  tituloTicket(carta: Carta): string {
    const sector = this.sectorMatrix(carta.tipo);
    return esHolo(carta.rareza) ? `VIP PASS // ${sector}` : `ACCESS PASS // ${sector}`;
  }

  formatPrecio(monto: number): string {
    return '$ ' + (monto || 0).toLocaleString('es-CL');
  }

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

  get entradasDestacadas(): Array<{ titulo: string; subtitulo: string; sector: string; tier: string; precio: number; carta: Carta }> {
    const lista = this.cartas();
    if (lista.length === 0) return [];
    const pick = (idx: number) => lista[idx % lista.length];
    return [
      { titulo: 'ENTRADA STANDARD', subtitulo: 'Acceso general sala principal · 1 ticket', sector: 'ZION // SALA 01', tier: 'STANDARD', precio: 8500, carta: pick(4) },
      { titulo: 'ENTRADA IMAX 3D', subtitulo: 'Proyección inmersiva 4K + audio Dolby', sector: 'NEBUCHADNEZZAR // IMAX', tier: 'IMAX', precio: 14000, carta: pick(1) },
      { titulo: 'PASE VIP CONSTRUCT', subtitulo: 'Butaca preferencial + acceso prioritario', sector: 'CONSTRUCT // VIP', tier: 'VIP ACCESS', precio: 25000, carta: pick(0) }
    ];
  }

  comprarRapido(carta: Carta): void {
    if (this.procesando()) return;
    this.procesando.set(true);
    this.cartasService.comprar(carta, 1, this.entrenador).subscribe({
      next: (orden) => {
        this.procesando.set(false);
        this.ultimaOrden.set(orden);
        this.ultimaParticion.set((orden.id ?? 1) % 3);
        this.notifications.notify(
          'Ticket emitido',
          `Orden #${orden.id} guardada en PostgreSQL y enviada a RabbitMQ + Kafka (P${(orden.id ?? 1) % 3}).`,
          'success',
          'CARTAS'
        );
        this.cargarOrdenes();
      },
      error: () => {
        this.procesando.set(false);
        this.notifications.notify('Error', 'No se pudo completar la compra.', 'error', 'CARTAS');
      }
    });
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
      this.ultimaOrden.set(res.orden);
      this.ultimaParticion.set((res.orden.id ?? 2) % 3);
      this.notifications.notify(
        'Pack x5 emitido',
        `Orden #${res.orden.id}: 5 tickets enviados a RabbitMQ y particionados en Kafka.`,
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
