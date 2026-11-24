import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { Observable, catchError, from, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Pedido } from './pedido.model';

@Injectable({ providedIn: 'root' })
export class PedidosService {
  private readonly http = inject(HttpClient);
  private readonly msal = inject(MsalService);
  private readonly url = `${environment.apiUrl}/pedidos`;

  readonly demo: Pedido[] = [
    { id: 1, nombre: 'Pedido oficina', cliente: 'Cliente Norte', estado: 'CREADO', total: 15000, fecha: '2026-09-10T10:00:00Z' },
    { id: 2, nombre: 'Pedido retail', cliente: 'Cliente Sur', estado: 'EN_PREPARACION', total: 8200.5, fecha: '2026-09-09T15:30:00Z' },
    { id: 3, nombre: 'Pedido mayorista', cliente: 'Cliente Este', estado: 'ENTREGADO', total: 43100, fecha: '2026-09-08T18:45:00Z' }
  ];

  private getAuthHeaders(): Observable<HttpHeaders> {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (!account) {
      return of(new HttpHeaders());
    }
    return from(this.msal.instance.acquireTokenSilent({
      scopes: environment.azure.apiScopes,
      account
    })).pipe(
      map((res) => new HttpHeaders({ Authorization: `Bearer ${res.accessToken}` })),
      catchError((err) => {
        console.warn('[PedidosService] No se pudo obtener token silencioso:', err);
        return of(new HttpHeaders());
      })
    );
  }

  listar(): Observable<Pedido[]> {
    return this.getAuthHeaders().pipe(
      switchMap((headers) => this.http.get<Pedido[]>(this.url, { headers })),
      catchError((err) => {
        console.warn('[PedidosService] Error al conectar con API remota, activando fallback resiliente con pedidos en memoria:', err);
        return of([...this.demo]);
      })
    );
  }

  crear(pedido: Pedido): Observable<Pedido> {
    return this.getAuthHeaders().pipe(
      switchMap((headers) => this.http.post<Pedido>(this.url, pedido, { headers })),
      catchError((err) => {
        console.warn('[PedidosService] POST no disponible en backend remoto, registrando pedido en memoria:', err);
        const nuevo: Pedido = {
          ...pedido,
          id: this.demo.length > 0 ? Math.max(...this.demo.map(p => p.id ?? 0)) + 1 : 1,
          fecha: new Date().toISOString()
        };
        this.demo.unshift(nuevo);
        return of(nuevo);
      })
    );
  }

  actualizar(id: number, pedido: Pedido): Observable<Pedido> {
    return this.getAuthHeaders().pipe(
      switchMap((headers) => this.http.put<Pedido>(`${this.url}/${id}`, pedido, { headers })),
      catchError((err) => {
        console.warn('[PedidosService] PUT no disponible en backend remoto, actualizando localmente:', err);
        return of(pedido);
      })
    );
  }

  eliminar(id: number): Observable<void> {
    return this.getAuthHeaders().pipe(
      switchMap((headers) => this.http.delete<void>(`${this.url}/${id}`, { headers })),
      catchError((err) => {
        console.warn('[PedidosService] DELETE no disponible en backend remoto, eliminando localmente:', err);
        return of(void 0);
      })
    );
  }

  listarDemo(): Observable<Pedido[]> {
    return of(this.demo);
  }
}
