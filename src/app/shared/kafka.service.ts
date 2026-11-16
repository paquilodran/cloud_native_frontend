import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface KafkaTopicStatus {
  name: string;
  partitions: number;
  replicas: number;
  retention: string;
  cleanupPolicy: string;
  consumerGroup: string;
}

export interface StreamingMetrics {
  totalEventsConsumed: number;
  totalAnalyticsEvents: number;
  totalAuditEvents: number;
  totalRevenueStreamed: number;
  partitionDistribution: { [key: string]: number };
  revenueByCategory: { [key: string]: number };
  countByCategory: { [key: string]: number };
  recentEventsCount: number;
  recentAuditCount: number;
  systemTime: string;
}

export interface StreamEventRecord {
  eventId: string;
  orderId: string;
  cliente: string;
  producto: string;
  monto: number;
  categoria: string;
  canalVenta: string;
  estado: string;
  timestamp: string;
  partition: number;
  offset: number;
  key: string;
  processedAt: string;
}

export interface AuditEventRecord {
  auditId: string;
  orderId: string;
  accion: string;
  estadoAnterior: string;
  nuevoEstado: string;
  usuarioOperador: string;
  origen: string;
  timestamp: string;
  detalles: string;
  partition: number;
  offset: number;
  key: string;
  processedAt: string;
}

export interface CreateKafkaTopicRequest {
  name: string;
  partitions: number;
  replicationFactor: number;
  retentionMs?: number;
  cleanupPolicy?: string;
}

@Injectable({ providedIn: 'root' })
export class KafkaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/public/kafka';

  getStatus(): Observable<{ system: string; status: string; topics: KafkaTopicStatus[]; metrics: StreamingMetrics }> {
    return this.http.get<any>(`${this.baseUrl}/status`);
  }

  getMetrics(): Observable<StreamingMetrics> {
    return this.http.get<StreamingMetrics>(`${this.baseUrl}/metrics`);
  }

  getRecentEvents(): Observable<StreamEventRecord[]> {
    return this.http.get<StreamEventRecord[]>(`${this.baseUrl}/events/recent`);
  }

  getRecentAudit(): Observable<AuditEventRecord[]> {
    return this.http.get<AuditEventRecord[]>(`${this.baseUrl}/audit/recent`);
  }

  publishAnalytics(event: {
    orderId?: string;
    cliente: string;
    producto: string;
    monto: number;
    categoria: string;
    canalVenta: string;
    estado: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/publish/analytics`, event);
  }

  publishAudit(event: {
    orderId?: string;
    accion: string;
    estadoAnterior: string;
    nuevoEstado: string;
    usuarioOperador: string;
    detalles: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/publish/audit`, event);
  }

  publishBatchDemo(count: number = 6): Observable<any> {
    return this.http.post(`${this.baseUrl}/publish/batch-demo?count=${count}`, {});
  }

  resetMetrics(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/metrics`);
  }

  getClusterOverview(): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/cluster`);
  }

  listTopics(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/topics`);
  }

  createTopic(dto: CreateKafkaTopicRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/topics`, dto);
  }

  deleteTopic(topicName: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/topics/${encodeURIComponent(topicName)}`);
  }

  listConsumerGroups(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/consumer-groups`);
  }
}
