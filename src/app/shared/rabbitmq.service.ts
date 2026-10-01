import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RabbitMQService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/messages';

  enviarMensaje(message: string): Observable<string> {
    return this.http.post(this.baseUrl, { message }, { responseType: 'text' });
  }

  enviarMensajeGet(message: string): Observable<string> {
    return this.http.get(`${this.baseUrl}/send`, { params: { message }, responseType: 'text' });
  }
}
