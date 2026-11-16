# Pedidos360 — Frontend (Angular + Apache Kafka Streaming + RabbitMQ + MSAL)

**Institución:** Duoc UC  
**Asignatura:** DSY1107 — Desarrollo Cloud Native I  
**Evaluaciones:**
- EP3 (Encargo RabbitMQ 12%) & EP4 (Presentación RabbitMQ 18%)
- **EP5 (Encargo Kafka Streaming 12%) & EP6 (Presentación Kafka Streaming 18%)**
**Entorno de Contenedores:** OrbStack / Docker Desktop  
**Repositorio Frontend:** [https://github.com/paquilodran/cloud_native_frontend](https://github.com/paquilodran/cloud_native_frontend)  
**Repositorio Backend:** [https://github.com/paquilodran/cloud_native_backend](https://github.com/paquilodran/cloud_native_backend)  

---

## 1. Descripción del Sistema

Aplicación Single Page Application (SPA) construida con **Angular 19** que combina:
1. **Autenticación IDaaS y Seguridad:** Integración completa con **Microsoft Entra ID (Azure AD)** mediante la biblioteca oficial `@azure/msal-angular` (flujo OAuth 2.0 / OpenID Connect con PKCE y validación de tokens JWT en cada petición HTTP).
2. **Panel de Streaming y Analítica en Tiempo Real con Apache Kafka (EP5 & EP6):**
   - **Monitoreo de los 2 Tópicos Principales:** `pedidos.analytics.stream` y `pedidos.audit.stream`, ambos con **3 Particiones y 3 Réplicas**.
   - **Distribución de Carga en Particiones (P0, P1, P2):** Visualización en vivo de balanceo de eventos entre las 3 particiones del clúster.
   - **Métricas de Streaming:** Contadores atómicos de eventos totales, facturación acumulada por categoría y tiempo de respuesta.
   - **Disparo de Eventos Streaming:** Emisión de eventos analíticos (Tópico 1) y eventos de auditoría (Tópico 2).
   - **Ráfaga en Lote:** Prueba de carga de 6 a 12 eventos concurrentes para evidenciar balanceo en los 3 brokers.
   - **Microservicio Administrador de Kafka:** Creación y eliminación de tópicos en caliente vía API REST.
   - **Acceso directo a Kafka-UI:** Enlace integrado a `http://localhost:8085` para inspección de Log-End-Offsets y Consumer Lag.
3. **Panel de Control RabbitMQ Enterprise (EP3 & EP4):**
   - Monitoreo de 3 Colas principales, 3 Dead Letter Queues (DLQ), exchanges Direct/Topic y simulación de fallos con reintentos y auditoría `x-death`.

---

## 2. Diagrama de Flujo del Frontend

```
[ Usuario en Navegador ]
          │
          ├── 1. Inicia sesión con Microsoft Entra ID (MSAL)
          │      └── Obtiene Access Token JWT (scope: access_as_user)
          │
          ├── 2. MsalInterceptor
          │      └── Inyecta automáticamente encabezado:
          │          Authorization: Bearer <jwt>
          │
          ├── 3. Panel RabbitMQ Dashboard
          │      ├── GET  /api/public/rabbitmq/status   (Consulta topología)
          │      ├── POST /api/public/rabbitmq/orders   (Envía pedido normal)
          │      ├── POST /api/public/rabbitmq/orders/fail (Simula fallo -> DLQ)
          │      ├── POST /api/public/rabbitmq/notifications (Envía notificación)
          │      ├── POST /api/public/rabbitmq/topic-events (Topic: pedidos.*)
          │      ├── POST /api/public/rabbitmq/admin/queues (Crea cola dinámica)
          │      └── GET  /api/public/rabbitmq/dlq      (Lee eventos x-death)
          │
          ▼
[ Backend Pedidos360 (:8080) ] ──► [ Clúster RabbitMQ (:5672 / :15672) ]
```

---

## 3. Componentes y Funcionalidades del Panel RabbitMQ

| Funcionalidad | Descripción | Endpoint Backend |
| :--- | :--- | :--- |
| **Estado Topología** | Tarjetas informativas con TTL y configuración de las 3 colas principales y sus 3 DLQs. | `GET /api/public/rabbitmq/status` |
| **Enviar Pedido Normal** | Encola una orden nominal a `orders.queue`. El consumidor procesa y confirma con **ACK**. | `POST /api/public/rabbitmq/orders` |
| **Simular Fallo Crítico** | Encola un pedido con fallo. El backend reintenta 3 veces con backoff y lo traslada automáticamente a `orders.dlq`. | `POST /api/public/rabbitmq/orders/fail` |
| **Notificación EMAIL** | Envía un mensaje a la cola 2 (`notifications.queue`). | `POST /api/public/rabbitmq/notifications` |
| **Evento Topic** | Publica un evento con routing key `pedidos.despachado` en `events.topic.exchange`. | `POST /api/public/rabbitmq/topic-events` |
| **Crear Cola Dinámica** | Formulario con validación para invocar el `RabbitAdminService` y crear una cola con TTL. | `POST /api/public/rabbitmq/admin/queues` |
| **Eliminar Cola** | Elimina una cola dinámicamente mediante el microservicio administrador. | `DELETE /api/public/rabbitmq/admin/queues/{name}` |
| **Auditoría DLQ** | Tabla en tiempo real que lista los mensajes muertos capturados con causa `x-death` y botón de vaciado. | `GET /api/public/rabbitmq/dlq`<br>`DELETE /api/public/rabbitmq/dlq` |

---

## 4. Instrucciones de Ejecución

### Requisitos Previos
- Node.js 18+ o 20+
- npm 9+
- Backend Spring Boot corriendo en `http://localhost:8080`

### Paso 1: Instalar dependencias
```powershell
cd pedidos360-frontend
npm install
```

### Paso 2: Iniciar el Servidor de Desarrollo
```powershell
cd pedidos360-frontend
npm start
```
> La aplicación se iniciará en **[http://localhost:4200](http://localhost:4200)**.

### Paso 3: Validar la Compilación de Producción
Para verificar que no existan errores de tipos o plantillas:
```powershell
npm run build
```
> La compilación debe finalizar con `Application bundle generation complete` con 0 errores.

---

## 5. Estructura del Proyecto

```text
src/app
├── app.component.ts / html / css       # Barra de navegación, estado de sesión y layout
├── app.config.ts                       # Proveedores standalone (HTTP, MSAL Interceptor, Rutas)
├── app.routes.ts                       # Definición de rutas protegidas y públicas
├── auth/
│   ├── auth.guard.ts                   # Guard para protección de rutas con MSAL
│   ├── login.component.ts              # Vista de autenticación con Microsoft
│   └── msal.config.ts                  # Configuración de Tenant, Client ID y Scopes de Azure AD
├── home/
│   ├── home.component.ts               # Lógica del dashboard: RabbitMQ, DLQ, claims y pedidos
│   ├── home.component.html             # Plantilla HTML con panel interactivo RabbitMQ Enterprise
│   └── home.component.css              # Estilos formales y diseño responsivo
├── pedidos/
│   ├── pedido.model.ts                 # Modelo de datos de pedidos
│   ├── pedidos.component.ts            # Gestión de pedidos de negocio (JPA)
│   └── pedidos.service.ts              # Servicio HTTP para CRUD de pedidos
└── shared/
    ├── estado-visual.ts                # Badges de estado de pedidos
    ├── jwt.interceptor.ts              # Interceptor HTTP para adjuntar Bearer Token
    ├── rabbitmq.service.ts             # Servicio Angular completo para RabbitMQ y DLQ
    └── token-claims.ts                 # Decodificador de claims JWT
```
