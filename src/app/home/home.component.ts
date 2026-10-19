import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { environment } from '../../environments/environment';
import { Pedido } from '../pedidos/pedido.model';
import { PedidosService } from '../pedidos/pedidos.service';
import { claseEstado, etiquetaEstado } from '../shared/estado-visual';
import { DlqEntry, RabbitMQService, TopologyStatus } from '../shared/rabbitmq.service';
import { TokenClaims, toTokenClaims } from '../shared/token-claims';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  private readonly msal = inject(MsalService);
  private readonly pedidosService = inject(PedidosService);
  private readonly rabbitMQService = inject(RabbitMQService);

  // RabbitMQ Controls & State
  enviandoRabbit = false;
  ultimoEnvioRabbit: string | null = null;
  errorRabbit: string | null = null;
  topology: TopologyStatus | null = null;
  dlqMessages: DlqEntry[] = [];

  // Formulario de cola dinamica (EP3)
  nuevaColaNombre = 'cola.auditoria.demo';
  nuevaColaTtl = 60000;
  colaEliminarNombre = 'cola.auditoria.demo';

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

  ngOnInit(): void {
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
        this.ultimoEnvioRabbit = '✓ Historial de Dead Letter Queue (DLQ) vaciado.';
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
        this.ultimoEnvioRabbit = `✓ [DirectExchange] Orden #${res.order?.orderId} encolada en 'orders.queue'. Procesada con ACK.`;
      },
      error: (err) => {
        this.enviandoRabbit = false;
        this.errorRabbit = 'Error conectando con el backend de RabbitMQ en localhost:8080';
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
        this.ultimoEnvioRabbit = `⚠️ [Resiliencia] Orden #${res.order?.orderId} enviada con fallo. Reintentando 3 veces con backoff antes de transferir a DLQ...`;
        setTimeout(() => this.cargarDlq(), 5500);
      },
      error: () => {
        this.enviandoRabbit = false;
        this.errorRabbit = 'Error al simular orden fallida.';
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
      next: (res) => {
        this.enviandoRabbit = false;
        this.ultimoEnvioRabbit = `✓ [Cola 2 - Notificaciones] Mensaje despachado a 'notifications.queue' via EMAIL.`;
      },
      error: () => {
        this.enviandoRabbit = false;
        this.errorRabbit = 'Error al enviar notificacion.';
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
      next: (res) => {
        this.enviandoRabbit = false;
        this.ultimoEnvioRabbit = `✓ [TopicExchange] Evento publicado con routingKey 'pedidos.despachado' hacia 'events.topic.queue'.`;
      },
      error: () => {
        this.enviandoRabbit = false;
        this.errorRabbit = 'Error al publicar evento en Topic Exchange.';
      }
    });
  }

  crearColaDinamica(): void {
    const nombre = this.nuevaColaNombre.trim();
    if (!nombre) {
      this.errorRabbit = 'El nombre de la cola no puede estar vacio.';
      return;
    }
    this.enviandoRabbit = true;
    this.errorRabbit = null;
    this.rabbitMQService.createQueue({
      name: nombre,
      durable: true,
      messageTtl: this.nuevaColaTtl
    }).subscribe({
      next: (res) => {
        this.enviandoRabbit = false;
        this.ultimoEnvioRabbit = `✓ [RabbitAdmin API] Cola '${nombre}' creada exitosamente via POST /api/public/rabbitmq/admin/queues`;
        this.cargarTopologia();
      },
      error: (err) => {
        this.enviandoRabbit = false;
        this.errorRabbit = `Error validando parámetros de cola: ${err.error?.message || 'Configuración inválida'}`;
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
        this.ultimoEnvioRabbit = `✓ [RabbitAdmin API] Cola '${nombre}' eliminada via DELETE /api/public/rabbitmq/admin/queues/${nombre}`;
        this.cargarTopologia();
      },
      error: () => {
        this.enviandoRabbit = false;
        this.errorRabbit = `No se pudo eliminar la cola '${nombre}'`;
      }
    });
  }
}
