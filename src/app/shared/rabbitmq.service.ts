import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface TopologyStatus {
  system: string;
  status: string;
  exchanges: Array<{ name: string; type: string }>;
  queues: Array<{ name: string; ttl: string; dlq: string }>;
}

export interface DlqEntry {
  id: string;
  payload: string;
  razon: string;
  reintentos: number;
  colaOrigen: string;
  timestamp: string;
}

export interface CreateQueueRequest {
  name: string;
  durable?: boolean;
  messageTtl?: number;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
}

@Injectable({ providedIn: 'root' })
export class RabbitMQService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/public/rabbitmq';

  getStatus(): Observable<TopologyStatus> {
    return this.http.get<TopologyStatus>(`${this.baseUrl}/status`);
  }

  enviarOrden(order: { orderId?: string; cliente: string; producto: string; total: number }): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders`, order);
  }

  enviarOrdenConFallo(order: { orderId?: string; cliente: string; producto: string; total: number; motivoFallo?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/fail`, order);
  }

  enviarNotificacion(notif: { destinatario: string; mensaje: string; tipoCanal: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/notifications`, notif);
  }

  enviarEventoTopic(routingKey: string, event: { entidad: string; accion: string; payload: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/topic-events`, event, { params: { routingKey } });
  }

  getDlqMessages(): Observable<DlqEntry[]> {
    return this.http.get<DlqEntry[]>(`${this.baseUrl}/dlq`);
  }

  clearDlq(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/dlq`);
  }

  createQueue(queue: CreateQueueRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/queues`, queue);
  }

  deleteQueue(queueName: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/queues/${encodeURIComponent(queueName)}`);
  }

  purgeQueue(queueName: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/queues/${encodeURIComponent(queueName)}/purge`, {});
  }
}
