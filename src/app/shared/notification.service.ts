import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AppNotification {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: 'success' | 'error' | 'info' | 'warning';
  fecha: Date;
  leida: boolean;
  categoria?: 'KAFKA' | 'RABBITMQ' | 'SISTEMA' | 'PEDIDOS';
}

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private seq = 0;

  private notificationsSubject = new BehaviorSubject<AppNotification[]>([
    {
      id: 1,
      titulo: 'Apache Kafka Conectado',
      mensaje: 'Clúster de 3 brokers online con tópicos pedidos.analytics.stream y pedidos.audit.stream.',
      tipo: 'success',
      fecha: new Date(),
      leida: false,
      categoria: 'KAFKA'
    },
    {
      id: 2,
      titulo: 'RabbitMQ Clúster Operativo',
      mensaje: '3 colas configuradas con Dead Letter Queue (DLQ) y reintentos automáticos.',
      tipo: 'info',
      fecha: new Date(Date.now() - 1000 * 60 * 5),
      leida: false,
      categoria: 'RABBITMQ'
    },
    {
      id: 3,
      titulo: 'Seguridad Entra ID',
      mensaje: 'Autenticación federada JWT y control de acceso por roles activa.',
      tipo: 'info',
      fecha: new Date(Date.now() - 1000 * 60 * 15),
      leida: false,
      categoria: 'SISTEMA'
    }
  ]);

  private toastsSubject = new BehaviorSubject<ToastItem[]>([]);

  readonly notifications$ = this.notificationsSubject.asObservable();
  readonly toasts$ = this.toastsSubject.asObservable();

  get notifications(): AppNotification[] {
    return this.notificationsSubject.value;
  }

  get unreadCount(): number {
    return this.notificationsSubject.value.filter((n) => !n.leida).length;
  }

  notify(titulo: string, mensaje: string, tipo: 'success' | 'error' | 'info' = 'success', categoria: 'KAFKA' | 'RABBITMQ' | 'SISTEMA' | 'PEDIDOS' = 'SISTEMA'): void {
    const id = ++this.seq + 10;
    const nueva: AppNotification = {
      id,
      titulo,
      mensaje,
      tipo,
      fecha: new Date(),
      leida: false,
      categoria
    };

    this.notificationsSubject.next([nueva, ...this.notificationsSubject.value]);
    this.showToast(mensaje, tipo);
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    const id = ++this.seq + 100;
    const actual = this.toastsSubject.value;
    this.toastsSubject.next([...actual, { id, message, type }]);

    setTimeout(() => {
      this.dismissToast(id);
    }, 4200);
  }

  dismissToast(id: number): void {
    this.toastsSubject.next(this.toastsSubject.value.filter((t) => t.id !== id));
  }

  markAllAsRead(): void {
    const actualizadas = this.notificationsSubject.value.map((n) => ({ ...n, leida: true }));
    this.notificationsSubject.next(actualizadas);
  }

  markAsRead(id: number): void {
    const actualizadas = this.notificationsSubject.value.map((n) => n.id === id ? { ...n, leida: true } : n);
    this.notificationsSubject.next(actualizadas);
  }

  clearAll(): void {
    this.notificationsSubject.next([]);
  }
}
