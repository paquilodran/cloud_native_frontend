import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { environment } from '../../environments/environment';
import { Pedido } from '../pedidos/pedido.model';
import { PedidosService } from '../pedidos/pedidos.service';
import { claseEstado, etiquetaEstado } from '../shared/estado-visual';
import { DlqEntry, RabbitMQService, TopologyStatus } from '../shared/rabbitmq.service';
import {
  KafkaService,
  KafkaTopicStatus,
  StreamingMetrics,
  StreamEventRecord,
  AuditEventRecord
} from '../shared/kafka.service';
import { TokenClaims, toTokenClaims } from '../shared/token-claims';
import { NotificationService } from '../shared/notification.service';

export type HomeTab = 'inicio' | 'dashboard' | 'rabbitmq' | 'kafka';

export interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly msal = inject(MsalService);
  private readonly pedidosService = inject(PedidosService);
  private readonly rabbitMQService = inject(RabbitMQService);
  private readonly kafkaService = inject(KafkaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  // Navegación por pestañas intuitiva (Inicio portal, Dashboard, RabbitMQ, Kafka)
  tabActiva: HomeTab = 'inicio';

  // RabbitMQ Controls & State
  enviandoRabbit = false;
  ultimoEnvioRabbit: string | null = null;
  errorRabbit: string | null = null;
  topology: TopologyStatus | null = null;
  dlqMessages: DlqEntry[] = [];

  // Formulario de cola dinamica (RabbitMQ EP3)
  nuevaColaNombre = 'cola.auditoria.demo';
  nuevaColaTtl = 60000;
  colaEliminarNombre = 'cola.auditoria.demo';

  // Apache Kafka Controls & State (EP5 & EP6)
  enviandoKafka = false;
  ultimoEnvioKafka: string | null = null;
  errorKafka: string | null = null;
  kafkaTopics: KafkaTopicStatus[] = [];
  kafkaMetrics: StreamingMetrics | null = null;
  recentKafkaEvents: StreamEventRecord[] = [];
  recentKafkaAudit: AuditEventRecord[] = [];

  // Filtros visuales, stream en vivo y consola de streaming
  filtroParticion: number | 'TODAS' = 'TODAS';
  mostrarConsolaTerminal = true;
  streamEnVivo = false;
  private streamInterval: any = null;

  // Simulador de Caos y Tolerancia a Fallos
  simulandoCaos = false;
  brokerCaidoId: number | null = null;
  brokersOnlineCount = 3;
  activeBrokerIds: number[] = [1, 2, 3];

  // Modales interactivos
  pedidoSeleccionadoParaTimeline: Pedido | null = null;
  idCopiado: string | null = null;

  copiarId(id: string, event: Event): void {
    event.stopPropagation();
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
      this.idCopiado = id;
      setTimeout(() => this.idCopiado = null, 1500);
      this.notificationService.showToast(`${id} copiado al portapapeles`, 'info');
    });
  }

  // Formulario creacion dinamica de topico Kafka (Microservicio Administrador EP5)
  nuevoTopicoNombre = 'pedidos.promociones.stream';
  nuevoTopicoParticiones = 3;
  nuevoTopicoReplicas = 3;
  nuevoTopicoRetencion = 86400000;
  topicoEliminarNombre = 'pedidos.promociones.stream';

  pedidos: Pedido[] = [];
  claims: TokenClaims | null = null;
  readonly etiquetaEstado = etiquetaEstado;
  readonly claseEstado = claseEstado;
  readonly actividad = [
    { mes: 'Mar', valor: 1 },
    { mes: 'Abr', valor: 2 },
    { mes: 'May', valor: 2 },
    { mes: 'Jun', valor: 3 },
    { mes: 'Jul', valor: 2 },
    { mes: 'Ago', valor: 4 },
    { mes: 'Sep', valor: 3 }
  ];

  get autenticado(): boolean {
    return this.msal.instance.getAllAccounts().length > 0;
  }

  get creadosHoy(): number {
    const hoy = new Date().toISOString().slice(0, 10);
    return this.pedidos.filter((pedido) => pedido.fecha?.startsWith(hoy)).length;
  }

  get chartPoints(): string {
    const max = Math.max(...this.actividad.map((item) => item.valor), 1);
    return this.actividad
      .map((item, index) => {
        const x = 28 + index * 72;
        const y = 132 - (item.valor / max) * 96;
        return `${x},${y}`;
      })
      .join(' ');
  }

  // Getters para Distribución de Particiones y Data Bars
  get totalEventosParticiones(): number {
    const p0 = this.kafkaMetrics?.partitionDistribution?.['partition_0'] || 0;
    const p1 = this.kafkaMetrics?.partitionDistribution?.['partition_1'] || 0;
    const p2 = this.kafkaMetrics?.partitionDistribution?.['partition_2'] || 0;
    return p0 + p1 + p2;
  }

  getPorcentajeParticion(key: 'partition_0' | 'partition_1' | 'partition_2'): number {
    const total = this.totalEventosParticiones;
    if (total === 0) return 0;
    const count = this.kafkaMetrics?.partitionDistribution?.[key] || 0;
    return Math.round((count / total) * 100);
  }

  // Getters y Métodos para Filtros Rápidos de Streaming
  get eventosKafkaFiltrados(): StreamEventRecord[] {
    if (this.filtroParticion === 'TODAS') {
      return this.recentKafkaEvents;
    }
    return this.recentKafkaEvents.filter((ev) => ev.partition === this.filtroParticion);
  }

  // Paginación dinámica para Streaming y Auditoría
  tamanoPaginaStream = 5;
  paginaActualStream = 1;
  tamanoPaginaAudit = 5;
  paginaActualAudit = 1;

  get totalPaginasStream(): number {
    return Math.max(1, Math.ceil(this.eventosKafkaFiltrados.length / this.tamanoPaginaStream));
  }

  get eventosKafkaPaginados(): StreamEventRecord[] {
    const inicio = (this.paginaActualStream - 1) * this.tamanoPaginaStream;
    return this.eventosKafkaFiltrados.slice(inicio, inicio + this.tamanoPaginaStream);
  }

  cambiarPaginaStream(delta: number): void {
    this.paginaActualStream = Math.max(1, Math.min(this.totalPaginasStream, this.paginaActualStream + delta));
  }

  cambiarTamanoPaginaStream(tamano: number): void {
    this.tamanoPaginaStream = tamano;
    this.paginaActualStream = 1;
  }

  get totalPaginasAudit(): number {
    return Math.max(1, Math.ceil(this.recentKafkaAudit.length / this.tamanoPaginaAudit));
  }

  get eventosAuditPaginados(): AuditEventRecord[] {
    const inicio = (this.paginaActualAudit - 1) * this.tamanoPaginaAudit;
    return this.recentKafkaAudit.slice(inicio, inicio + this.tamanoPaginaAudit);
  }

  cambiarPaginaAudit(delta: number): void {
    this.paginaActualAudit = Math.max(1, Math.min(this.totalPaginasAudit, this.paginaActualAudit + delta));
  }

  cambiarTamanoPaginaAudit(tamano: number): void {
    this.tamanoPaginaAudit = tamano;
    this.paginaActualAudit = 1;
  }

  // Estimación de latencia de ingestión de eventos
  calcularLatenciaMs(index: number): number {
    const bases = [14, 18, 22, 16, 25, 12, 19, 21];
    return bases[index % bases.length];
  }

  seleccionarFiltroParticion(f: number | 'TODAS'): void {
    this.filtroParticion = f;
    this.paginaActualStream = 1;
  }

  toggleConsolaTerminal(): void {
    this.mostrarConsolaTerminal = !this.mostrarConsolaTerminal;
  }

  toggleStreamEnVivo(): void {
    this.streamEnVivo = !this.streamEnVivo;
    if (this.streamEnVivo) {
      this.notificationService.notify(
        'Stream en Vivo Activado',
        'Sondeo de eventos continuo cada 2.5s habilitado.',
        'info',
        'KAFKA'
      );
      this.streamInterval = setInterval(() => {
        this.cargarEventosKafka();
      }, 2500);
    } else {
      if (this.streamInterval) {
        clearInterval(this.streamInterval);
        this.streamInterval = null;
      }
      this.notificationService.notify(
        'Stream en Vivo Pausado',
        'Sondeo en tiempo real detenido.',
        'info',
        'KAFKA'
      );
    }
  }

  exportarEventos(formato: 'json' | 'csv'): void {
    const data = this.recentKafkaEvents;
    if (!data || data.length === 0) {
      this.mostrarToast('No hay eventos en el stream para exportar', 'info');
      return;
    }

    let contenido = '';
    let mimeType = '';
    let extension = '';

    if (formato === 'json') {
      contenido = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else {
      const cabeceras = ['eventId', 'orderId', 'cliente', 'producto', 'monto', 'categoria', 'canalVenta', 'estado', 'partition', 'offset', 'processedAt'];
      const filas = data.map((ev) =>
        [ev.eventId, ev.orderId, ev.cliente, ev.producto, ev.monto, ev.categoria, ev.canalVenta, ev.estado, ev.partition, ev.offset, ev.processedAt]
          .map((v) => `"${v}"`)
          .join(',')
      );
      contenido = [cabeceras.join(','), ...filas].join('\n');
      mimeType = 'text/csv';
      extension = 'csv';
    }

    const blob = new Blob([contenido], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos360_kafka_stream_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);

    this.notificationService.notify(
      'Exportación Exitosa',
      `Descargados ${data.length} eventos en formato .${extension}`,
      'success',
      'KAFKA'
    );
  }

  simularCaosBroker(brokerId: number): void {
    if (this.simulandoCaos) return;
    this.simulandoCaos = true;
    this.brokerCaidoId = brokerId;

    this.notificationService.notify(
      'Prueba de Resiliencia Iniciada',
      `Simulando desconexión de Broker ${brokerId} (Alta Disponibilidad).`,
      'info',
      'KAFKA'
    );

    // Simula failover: los líderes de partición se reasignan a los brokers restantes
    setTimeout(() => {
      this.notificationService.notify(
        'Failover Exitoso (ISR Activo)',
        `Particiones rebalanceadas en Broker ${brokerId === 1 ? 2 : 1} sin pérdida de mensajes (min.insync.replicas=2 nominal).`,
        'success',
        'KAFKA'
      );
    }, 2800);

    setTimeout(() => {
      this.brokerCaidoId = null;
      this.simulandoCaos = false;
      this.notificationService.notify(
        'Broker Recuperado',
        `Broker ${brokerId} sincronizado nuevamente con el ensemble de Zookeeper.`,
        'info',
        'KAFKA'
      );
    }, 6000);
  }

  abrirTimelinePedido(p: Pedido): void {
    this.pedidoSeleccionadoParaTimeline = p;
  }

  cerrarTimelinePedido(): void {
    this.pedidoSeleccionadoParaTimeline = null;
  }

  ngOnDestroy(): void {
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const tab = params['tab'];
      if (tab === 'inicio' || tab === 'dashboard' || tab === 'rabbitmq' || tab === 'kafka') {
        this.tabActiva = tab;
      }
    });

    if (!this.autenticado) {
      this.pedidos = this.pedidosService.demo;
    } else {
      this.pedidosService.listar().subscribe({
        next: (data) => this.pedidos = data,
        error: () => this.pedidos = this.pedidosService.demo
      });
      this.cargarClaims();
    }

    this.cargarTopologia();
    this.cargarDlq();
    this.cargarKafka();
  }

  seleccionarTab(tab: HomeTab): void {
    this.tabActiva = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  mostrarToast(message: string, type: 'success' | 'error' | 'info' = 'success', titulo?: string): void {
    const t = titulo || (type === 'error' ? 'Alerta de Error' : type === 'info' ? 'Información' : 'Operación Exitosa');
    this.notificationService.notify(t, message, type);
  }

  cerrarToast(id: number): void {
    this.notificationService.dismissToast(id);
  }

  private cargarClaims(): void {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (!account) return;

    this.msal.instance.acquireTokenSilent({
      account,
      scopes: environment.azure.apiScopes
    }).then((result) => {
      this.claims = toTokenClaims(result.accessToken);
    }).catch(() => {
      this.claims = null;
    });
  }

  // =========================================================================
  // METODOS RABBITMQ (EP3 / EP4)
  // =========================================================================

  cargarTopologia(): void {
    this.rabbitMQService.getStatus().subscribe({
      next: (status) => this.topology = status,
      error: () => this.topology = null
    });
  }

  cargarDlq(): void {
    this.rabbitMQService.getDlqMessages().subscribe({
      next: (data) => this.dlqMessages = data,
      error: () => this.dlqMessages = []
    });
  }

  vaciarDlq(): void {
    this.rabbitMQService.clearDlq().subscribe({
      next: () => {
        this.dlqMessages = [];
        this.ultimoEnvioRabbit = 'Historial de Dead Letter Queue (DLQ) vaciado.';
        this.mostrarToast('Historial de Dead Letter Queue vaciado', 'info');
      }
    });
  }

  enviarOrdenNominal(): void {
    this.enviandoRabbit = true;
    this.errorRabbit = null;
    this.rabbitMQService.enviarOrden({
      cliente: 'Empresa Cloud Native SA',
      producto: 'Licencia Microservicios Enterprise',
      total: 350000
    }).subscribe({
      next: (res) => {
        this.enviandoRabbit = false;
        this.ultimoEnvioRabbit = `[DirectExchange] Orden #${res.order?.orderId} encolada en 'orders.queue'. Procesada con ACK.`;
        this.mostrarToast(`Orden #${res.order?.orderId} encolada en orders.queue con ACK nominal`, 'success');
      },
      error: () => {
        this.enviandoRabbit = false;
        this.errorRabbit = 'Error conectando con el backend de RabbitMQ en localhost:8080';
        this.mostrarToast('Error de comunicación con RabbitMQ (:8080)', 'error');
      }
    });
  }

  enviarOrdenConFallo(): void {
    this.enviandoRabbit = true;
    this.errorRabbit = null;
    this.rabbitMQService.enviarOrdenConFallo({
      cliente: 'Cliente Error Simulado',
      producto: 'Transaccion Rechazada',
      total: 75000,
      motivoFallo: 'Fondo insuficiente o pasarela inestable (Demostracion DLQ)'
    }).subscribe({
      next: (res) => {
        this.enviandoRabbit = false;
        this.ultimoEnvioRabbit = `[Resiliencia] Orden #${res.order?.orderId} enviada con fallo. Reintentando 3 veces con backoff antes de transferir a DLQ...`;
        this.mostrarToast(`Orden #${res.order?.orderId} enviada con fallo: 3 reintentos activados hacia DLQ`, 'info');
        setTimeout(() => this.cargarDlq(), 5500);
      },
      error: () => {
        this.enviandoRabbit = false;
        this.errorRabbit = 'Error al simular orden fallida.';
        this.mostrarToast('No se pudo simular la orden fallida', 'error');
      }
    });
  }

  enviarNotificacionDemo(): void {
    this.enviandoRabbit = true;
    this.errorRabbit = null;
    this.rabbitMQService.enviarNotificacion({
      destinatario: 'contacto@duocuc.cl',
      mensaje: 'Notificacion asincrona de despacho generada exitosamente.',
      tipoCanal: 'EMAIL'
    }).subscribe({
      next: () => {
        this.enviandoRabbit = false;
        this.ultimoEnvioRabbit = `[Cola 2 - Notificaciones] Mensaje despachado a 'notifications.queue' via EMAIL.`;
        this.mostrarToast('Mensaje despachado a notifications.queue (EMAIL)', 'success');
      },
      error: () => {
        this.enviandoRabbit = false;
        this.errorRabbit = 'Error al enviar notificacion.';
        this.mostrarToast('Error al despachar notificación', 'error');
      }
    });
  }

  enviarEventoTopicDemo(): void {
    this.enviandoRabbit = true;
    this.errorRabbit = null;
    this.rabbitMQService.enviarEventoTopic('pedidos.despachado', {
      entidad: 'PEDIDO',
      accion: 'DESPACHADO',
      payload: '{"guia": "GD-2026-X", "transportista": "Chilexpress"}'
    }).subscribe({
      next: () => {
        this.enviandoRabbit = false;
        this.ultimoEnvioRabbit = `[TopicExchange] Evento publicado con routingKey 'pedidos.despachado' hacia 'events.topic.queue'.`;
        this.mostrarToast('Evento publicado con routingKey pedidos.despachado', 'success');
      },
      error: () => {
        this.enviandoRabbit = false;
        this.errorRabbit = 'Error al publicar evento en Topic Exchange.';
        this.mostrarToast('Error al publicar evento topic', 'error');
      }
    });
  }

  crearColaDinamica(): void {
    const nombre = this.nuevaColaNombre.trim();
    if (!nombre) {
      this.errorRabbit = 'El nombre de la cola no puede estar vacio.';
      this.mostrarToast('El nombre de la cola es obligatorio', 'error');
      return;
    }
    this.enviandoRabbit = true;
    this.errorRabbit = null;
    this.rabbitMQService.createQueue({
      name: nombre,
      durable: true,
      messageTtl: this.nuevaColaTtl
    }).subscribe({
      next: () => {
        this.enviandoRabbit = false;
        this.ultimoEnvioRabbit = `[RabbitAdmin API] Cola '${nombre}' creada exitosamente via POST /api/public/rabbitmq/admin/queues`;
        this.mostrarToast(`Cola '${nombre}' creada exitosamente (RabbitAdmin)`, 'success');
        this.cargarTopologia();
      },
      error: (err) => {
        this.enviandoRabbit = false;
        this.errorRabbit = `Error validando parámetros de cola: ${err.error?.message || 'Configuración inválida'}`;
        this.mostrarToast(`Error al crear cola: ${err.error?.message || 'Inválido'}`, 'error');
      }
    });
  }

  eliminarColaDinamica(): void {
    const nombre = this.colaEliminarNombre.trim();
    if (!nombre) return;
    this.enviandoRabbit = true;
    this.rabbitMQService.deleteQueue(nombre).subscribe({
      next: () => {
        this.enviandoRabbit = false;
        this.ultimoEnvioRabbit = `[RabbitAdmin API] Cola '${nombre}' eliminada via DELETE /api/public/rabbitmq/admin/queues/${nombre}`;
        this.mostrarToast(`Cola '${nombre}' eliminada del clúster`, 'info');
        this.cargarTopologia();
      },
      error: () => {
        this.enviandoRabbit = false;
        this.errorRabbit = `No se pudo eliminar la cola '${nombre}'`;
        this.mostrarToast(`No se pudo eliminar la cola '${nombre}'`, 'error');
      }
    });
  }

  // =========================================================================
  // METODOS APACHE KAFKA STREAMING & ANALYTICS (EP5 / EP6)
  // =========================================================================

  cargarKafka(): void {
    this.kafkaService.getStatus().subscribe({
      next: (data) => {
        this.kafkaTopics = data.topics || [];
        this.kafkaMetrics = data.metrics || null;
      },
      error: () => {
        this.kafkaTopics = [];
      }
    });

    this.kafkaService.getClusterOverview().subscribe({
      next: (res) => {
        if (res && res.brokersCount !== undefined) {
          this.brokersOnlineCount = res.brokersCount;
          if (Array.isArray(res.nodes)) {
            this.activeBrokerIds = res.nodes.map((n: any) => n.id);
          }
        }
      },
      error: () => {}
    });

    this.cargarEventosKafka();
  }

  cargarEventosKafka(): void {
    this.kafkaService.getRecentEvents().subscribe({
      next: (events) => this.recentKafkaEvents = events || [],
      error: () => this.recentKafkaEvents = []
    });

    this.kafkaService.getRecentAudit().subscribe({
      next: (audit) => this.recentKafkaAudit = audit || [],
      error: () => this.recentKafkaAudit = []
    });

    this.kafkaService.getMetrics().subscribe({
      next: (metrics) => this.kafkaMetrics = metrics,
      error: () => {}
    });
  }

  enviarEventoAnalitico(): void {
    this.enviandoKafka = true;
    this.errorKafka = null;
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const monto = 45000 + Math.floor(Math.random() * 120000);

    this.kafkaService.publishAnalytics({
      orderId: `ORD-${rnd}`,
      cliente: 'Cliente Streaming Web',
      producto: 'Servidor Dedicado Cloud Native',
      monto: monto,
      categoria: 'TECNOLOGIA',
      canalVenta: 'WEB',
      estado: 'PROCESADO'
    }).subscribe({
      next: (res) => {
        this.enviandoKafka = false;
        this.ultimoEnvioKafka = `[Kafka Tópico 1] Evento emitido a '${res.topic}' [Key: ORD-${rnd}, Monto: $${monto}]. Replicado en 3 brokers.`;
        this.mostrarToast(`Evento analítico emitido: ORD-${rnd} ($${monto.toLocaleString()})`, 'success');
        setTimeout(() => this.cargarEventosKafka(), 800);
      },
      error: () => {
        this.enviandoKafka = false;
        this.errorKafka = 'Error conectando con el cluster Kafka via backend en localhost:8080';
        this.mostrarToast('Error de conexión con clúster Kafka', 'error');
      }
    });
  }

  enviarEventoAuditoria(): void {
    this.enviandoKafka = true;
    this.errorKafka = null;
    const rnd = Math.floor(1000 + Math.random() * 9000);

    this.kafkaService.publishAudit({
      orderId: `ORD-${rnd}`,
      accion: 'AUDITORIA_PAGO',
      estadoAnterior: 'PENDIENTE',
      nuevoEstado: 'PAGADO',
      usuarioOperador: 'supervisor.cloud',
      detalles: 'Validacion de firma criptografica y conciliacion bancaria'
    }).subscribe({
      next: (res) => {
        this.enviandoKafka = false;
        this.ultimoEnvioKafka = `[Kafka Tópico 2] Evento emitido a '${res.topic}' [Key: ORD-${rnd}, Accion: AUDITORIA_PAGO]. Consumer Group: pedidos-audit-group.`;
        this.mostrarToast(`Evento auditoría emitido: ORD-${rnd} [AUDITORIA_PAGO]`, 'info');
        setTimeout(() => this.cargarEventosKafka(), 800);
      },
      error: () => {
        this.enviandoKafka = false;
        this.errorKafka = 'Error al publicar evento de auditoria en Kafka';
        this.mostrarToast('Error al publicar auditoría en Kafka', 'error');
      }
    });
  }

  enviarRafagaBatch(count: number = 6): void {
    this.enviandoKafka = true;
    this.errorKafka = null;
    this.kafkaService.publishBatchDemo(count).subscribe({
      next: (res) => {
        this.enviandoKafka = false;
        this.ultimoEnvioKafka = `[Streaming en Lote] ${res.count} eventos generados y distribuidos entre las 3 Particiones de Kafka simultáneamente.`;
        this.mostrarToast(`Ráfaga completada: ${res.count} eventos balanceados en P0, P1 y P2`, 'success');
        setTimeout(() => this.cargarEventosKafka(), 1200);
      },
      error: () => {
        this.enviandoKafka = false;
        this.errorKafka = 'Error al ejecutar ráfaga streaming en Kafka';
        this.mostrarToast('Error en ráfaga de eventos Kafka', 'error');
      }
    });
  }

  reiniciarMetricasKafka(): void {
    this.kafkaService.resetMetrics().subscribe({
      next: () => {
        this.ultimoEnvioKafka = 'Contadores y métricas de streaming reiniciados.';
        this.mostrarToast('Métricas de streaming reiniciadas a cero', 'info');
        this.cargarKafka();
      }
    });
  }

  crearTopicoDinamico(): void {
    const nombre = this.nuevoTopicoNombre.trim();
    if (!nombre) {
      this.errorKafka = 'El nombre del tópico no puede estar vacío.';
      this.mostrarToast('El nombre del tópico es obligatorio', 'error');
      return;
    }
    this.enviandoKafka = true;
    this.errorKafka = null;

    this.kafkaService.createTopic({
      name: nombre,
      partitions: this.nuevoTopicoParticiones,
      replicationFactor: this.nuevoTopicoReplicas,
      retentionMs: this.nuevoTopicoRetencion,
      cleanupPolicy: 'delete'
    }).subscribe({
      next: (res) => {
        this.enviandoKafka = false;
        this.ultimoEnvioKafka = `[KafkaAdmin API] Tópico '${nombre}' creado con ${res.partitions} particiones y factor de replicación ${res.replicationFactor}.`;
        this.mostrarToast(`Tópico '${nombre}' creado (${res.partitions}P / ${res.replicationFactor}R)`, 'success');
        this.cargarKafka();
      },
      error: (err) => {
        this.enviandoKafka = false;
        this.errorKafka = `Error al crear tópico: ${err.error?.message || 'Verifique la conexión al cluster Kafka'}`;
        this.mostrarToast(`Error al crear tópico: ${err.error?.message || 'Error de clúster'}`, 'error');
      }
    });
  }

  eliminarTopicoDinamico(): void {
    const nombre = this.topicoEliminarNombre.trim();
    if (!nombre) return;
    this.enviandoKafka = true;
    this.kafkaService.deleteTopic(nombre).subscribe({
      next: () => {
        this.enviandoKafka = false;
        this.ultimoEnvioKafka = `[KafkaAdmin API] Tópico '${nombre}' eliminado del cluster.`;
        this.mostrarToast(`Tópico '${nombre}' eliminado del clúster`, 'info');
        this.cargarKafka();
      },
      error: () => {
        this.enviandoKafka = false;
        this.errorKafka = `No se pudo eliminar el tópico '${nombre}'`;
        this.mostrarToast(`No se pudo eliminar el tópico '${nombre}'`, 'error');
      }
    });
  }
}
