import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { Pedido } from './pedido.model';

@Injectable({ providedIn: 'root' })
export class PedidosService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/pedidos`;

  readonly demo: Pedido[] = [
    { id: 1, nombre: 'Pedido oficina', cliente: 'Cliente Norte', estado: 'CREADO', total: 15000, fecha: '2026-09-10T10:00:00Z' },
    { id: 2, nombre: 'Pedido retail', cliente: 'Cliente Sur', estado: 'EN_PREPARACION', total: 8200.5, fecha: '2026-09-09T15:30:00Z' },
    { id: 3, nombre: 'Pedido mayorista', cliente: 'Cliente Este', estado: 'ENTREGADO', total: 43100, fecha: '2026-09-08T18:45:00Z' }
  ];

  listar(): Observable<Pedido[]> {
    return this.http.get<Pedido[]>(this.url);
  }

  crear(pedido: Pedido): Observable<Pedido> {
    return this.http.post<Pedido>(this.url, pedido);
  }

  listarDemo(): Observable<Pedido[]> {
    return of(this.demo);
  }
}
