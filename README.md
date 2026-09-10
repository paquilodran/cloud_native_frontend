# Pedidos360 — Frontend

Angular 19 + MSAL: login con Azure AD, interceptor JWT y tabla de pedidos.

## Stack

- Angular 19 (standalone)
- `@azure/msal-browser` + `@azure/msal-angular`
- Guard en `/pedidos`
- Interceptor que adjunta `Authorization: Bearer <jwt>`

## Requisitos

- Node 20+ (Node 24 también sirve)
- Backend corriendo en `http://localhost:8080`
- App registration **Pedidos360-Web** en Azure AD

## Setup local (copy-paste)

```bash
cd pedidos360-frontend
npm install
```

Editar `src/environments/environment.ts`:

```ts
tenantId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
clientId: 'CLIENT-ID-PEDIDOS360-WEB',
apiClientId: 'CLIENT-ID-PEDIDOS360-API',
apiScopes: ['api://CLIENT-ID-PEDIDOS360-API/access_as_user']
```

```bash
npm start
```

Abrir http://localhost:4200 → **Iniciar sesión con Microsoft**.

## Azure AD (frontend app)

1. App registration **Pedidos360-Web** (SPA)
2. Authentication → Single-page application
3. Redirect URI: `http://localhost:4200`
4. API permissions → Add permission → **Pedidos360-API** → `access_as_user` → Grant admin consent
5. Copiar Application (client) ID a `environment.ts`

## Evidencias para la demo

1. Botón login → redirect a Microsoft
2. Después del login: token en `localStorage` (Application → Local Storage)
3. Console: `Authorization: Bearer eyJ...`
4. Tabla con `GET /api/pedidos`

## Deploy

```bash
npm run build
# salida: dist/pedidos360-frontend/browser
```

Subir esa carpeta a Azure App Service / Static Web Apps.

En Azure Portal, agregar redirect URI de producción (`https://tu-front.azurewebsites.net`) y completar `environment.prod.ts` antes del build.

## Estructura

```
src/app
  auth/          login + MSAL + auth.guard
  pedidos/       tabla + POST
  shared/        jwt.interceptor.ts
src/environments
```
