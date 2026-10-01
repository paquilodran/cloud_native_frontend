import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { environment } from '../../environments/environment';
import { Pedido } from '../pedidos/pedido.model';
import { PedidosService } from '../pedidos/pedidos.service';
import { claseEstado, etiquetaEstado } from '../shared/estado-visual';
import { RabbitMQService } from '../shared/rabbitmq.service';
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

  mensajeRabbit = 'Pedido confirmado listo para encolar en RabbitMQ';
  enviandoRabbit = false;
  ultimoEnvioRabbit: string | null = null;
  errorRabbit: string | null = null;

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
      return;
    }

    this.pedidosService.listar().subscribe({
      next: (data) => this.pedidos = data,
      error: () => this.pedidos = this.pedidosService.demo
    });
    this.cargarClaims();
  }

  private cargarClaims(): void {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (!account) {
      return;
    }
    this.msal.instance.acquireTokenSilent({
      account,
      scopes: environment.azure.apiScopes
    }).then((result) => {
      this.claims = toTokenClaims(result.accessToken);
    }).catch(() => {
      this.claims = null;
    });
  }

  enviarARabbitMQ(): void {
    const texto = this.mensajeRabbit.trim();
    if (!texto) return;

    this.enviandoRabbit = true;
    this.errorRabbit = null;

    this.rabbitMQService.enviarMensaje(texto).subscribe({
      next: (resp) => {
        this.enviandoRabbit = false;
        this.ultimoEnvioRabbit = `✓ Mensaje enviado a la cola 'hello' a las ${new Date().toLocaleTimeString()}: "${texto}"`;
      },
      error: (err) => {
        this.enviandoRabbit = false;
        this.errorRabbit = `No se pudo conectar con RabbitMQ (localhost:8080). Asegúrate de tener la app corriendo.`;
      }
    });
  }

  async enviarLoteRabbit(cantidad: number = 5): Promise<void> {
    this.enviandoRabbit = true;
    this.errorRabbit = null;
    let enviados = 0;

    for (let i = 1; i <= cantidad; i++) {
      const msg = `Pedido #${100 + i} generado automáticamente - ${new Date().toLocaleTimeString()}`;
      try {
        await new Promise((resolve, reject) => {
          this.rabbitMQService.enviarMensaje(msg).subscribe({
            next: resolve,
            error: reject
          });
        });
        enviados++;
        this.ultimoEnvioRabbit = `✓ Lote en progreso: ${enviados}/${cantidad} enviados a la cola 'hello'`;
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        this.errorRabbit = `Fallo al enviar mensaje del lote #${i}`;
        break;
      }
    }
    this.enviandoRabbit = false;
  }
}
