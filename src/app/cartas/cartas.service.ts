import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { Observable, catchError, from, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Carta, Orden, SobreResultado } from './carta.model';

const img = (n: number) => `https://images.pokemontcg.io/base1/${n}.png`;

@Injectable({ providedIn: 'root' })
export class CartasService {
  private readonly http = inject(HttpClient);
  private readonly msal = inject(MsalService);

  /** Catalogo de respaldo si el backend no responde (la UI nunca queda vacia). */
  readonly demo: Carta[] = [
    { id: 1, nombre: 'Charizard', tipo: 'Fire', rareza: 'Rare Holo', hp: 120, imagenUrl: img(4), precio: 25000 },
    { id: 2, nombre: 'Blastoise', tipo: 'Water', rareza: 'Rare Holo', hp: 100, imagenUrl: img(2), precio: 25000 },
    { id: 3, nombre: 'Venusaur', tipo: 'Grass', rareza: 'Rare Holo', hp: 100, imagenUrl: img(15), precio: 25000 },
    { id: 4, nombre: 'Mewtwo', tipo: 'Psychic', rareza: 'Rare Holo', hp: 60, imagenUrl: img(10), precio: 25000 },
    { id: 5, nombre: 'Pikachu', tipo: 'Lightning', rareza: 'Common', hp: 40, imagenUrl: img(58), precio: 1500 },
    { id: 6, nombre: 'Bulbasaur', tipo: 'Grass', rareza: 'Common', hp: 40, imagenUrl: img(44), precio: 1500 },
    { id: 7, nombre: 'Charmander', tipo: 'Fire', rareza: 'Common', hp: 50, imagenUrl: img(46), precio: 1500 },
    { id: 8, nombre: 'Squirtle', tipo: 'Water', rareza: 'Common', hp: 40, imagenUrl: img(63), precio: 1500 }
  ];

  private ordenesLocales: Orden[] = [];

  private get base(): string {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return 'http://localhost:8080/api';
    }
    return environment.apiUrl.replace(/\/+$/, '');
  }

  private getAuthHeaders(): Observable<HttpHeaders> {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (!account) {
      return of(new HttpHeaders());
    }
    return from(this.msal.instance.acquireTokenSilent({ scopes: environment.azure.apiScopes, account })).pipe(
      map((res) => new HttpHeaders({ Authorization: `Bearer ${res.accessToken}` })),
      catchError(() => of(new HttpHeaders()))
    );
  }

  listarCatalogo(): Observable<Carta[]> {
    return this.http.get<Carta[]>(`${this.base}/public/cartas`).pipe(
      map((data) => (data && data.length > 0 ? data : this.demo)),
      catchError(() => of(this.demo))
    );
  }

  listarOrdenes(): Observable<Orden[]> {
    return this.getAuthHeaders().pipe(
      switchMap((headers) => this.http.get<Orden[]>(`${this.base}/ordenes`, { headers })),
      catchError(() => of([...this.ordenesLocales]))
    );
  }

  comprar(carta: Carta, cantidad: number, cliente: string): Observable<Orden> {
    return this.getAuthHeaders().pipe(
      switchMap((headers) =>
        this.http.post<Orden>(`${this.base}/ordenes`, { cartaId: carta.id, cantidad, cliente }, { headers })
      ),
      catchError(() => {
        const local: Orden = {
          id: this.ordenesLocales.length + 1,
          cartaId: carta.id,
          cartaNombre: carta.nombre,
          tipo: carta.tipo,
          imagenUrl: carta.imagenUrl,
          cliente,
          cantidad,
          total: carta.precio * cantidad,
          estado: 'CREADA',
          fecha: new Date().toISOString()
        };
        this.ordenesLocales.unshift(local);
        return of(local);
      })
    );
  }

  abrirSobre(cliente: string): Observable<SobreResultado> {
    return this.getAuthHeaders().pipe(
      switchMap((headers) =>
        this.http.post<SobreResultado>(`${this.base}/ordenes/sobre`, { cliente }, { headers })
      ),
      catchError(() => {
        const cartas = [...this.demo].sort(() => Math.random() - 0.5).slice(0, 5);
        const orden: Orden = {
          id: this.ordenesLocales.length + 1,
          cartaNombre: 'Sobre: ' + cartas.map((c) => c.nombre).join(', '),
          tipo: 'SOBRE',
          imagenUrl: cartas[0].imagenUrl,
          cliente,
          cantidad: cartas.length,
          total: 5000,
          estado: 'CREADA',
          fecha: new Date().toISOString()
        };
        this.ordenesLocales.unshift(orden);
        return of({ orden, cartas });
      })
    );
  }
}
