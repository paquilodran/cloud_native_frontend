import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { environment } from '../../environments/environment';
import { Pedido } from '../pedidos/pedido.model';
import { PedidosService } from '../pedidos/pedidos.service';
import { claseEstado, etiquetaEstado } from '../shared/estado-visual';
import { TokenClaims, toTokenClaims } from '../shared/token-claims';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  private readonly msal = inject(MsalService);
  private readonly pedidosService = inject(PedidosService);

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
}
