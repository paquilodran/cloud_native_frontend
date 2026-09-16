# Pedidos360 — Frontend (Angular + MSAL)

**Asignatura:** DSY1107 Desarrollo Cloud Native I  
**Evaluación:** Parcial N° 1 — Encargo 2025  
**Repositorio:** https://github.com/paquilodran/cloud_native_frontend  
**API:** https://github.com/paquilodran/cloud_native_backend

Informe del **componente frontend**: SPA Angular que autentica al usuario con Microsoft Entra ID (IDaaS) mediante MSAL, obtiene el access token y lo envía al backend en cada llamada protegida.

---

## 1. Objetivo

Implementar el flujo de usuario exigido por la pauta (60%):

- Integrar `@azure/msal-angular` y `@azure/msal-browser`
- Login y logout con Microsoft
- `MsalGuard` en rutas protegidas
- `MsalInterceptor` que adjunta el JWT
- Lectura de scopes y roles desde los claims del token

---

## 2. Arquitectura (lado cliente)

```
Navegador Angular
    → MSAL loginRedirect (Entra ID)
    → access token (scope access_as_user)
    → MsalInterceptor: Authorization: Bearer <jwt>
    → GET/POST http://localhost:8080/api/pedidos
```

No hay sesión de servidor en Angular. MSAL guarda la cuenta y los tokens en `localStorage`.

---

## 3. Stack y estructura

- Angular 19 (standalone)
- `@azure/msal-angular` + `@azure/msal-browser`
- Rutas: Inicio, Login, Pedidos (protegida)

```
src/app
  auth/           login, MSAL config, auth.guard
  home/           dashboard + claims del JWT
  pedidos/        tabla y alta (consume la API)
  shared/         token-claims.ts, jwt.interceptor.ts
  app.config.ts   MsalInterceptor + MsalGuard + MsalService
src/environments  tenant, client IDs y scopes
```

`.gitignore` excluye `node_modules/`, `dist/` y `.env`.

---

## 4. Flujo MSAL

1. El usuario pulsa **Iniciar sesión** / **Continuar con Microsoft**.
2. `MsalService.loginRedirect` abre `login.microsoftonline.com/<tenant>`.
3. Entra ID autentica (Authorization Code + PKCE) y vuelve a `http://localhost:4200`.
4. `handleRedirectObservable` deja la cuenta activa.
5. `MsalGuard` bloquea `/pedidos` si no hay sesión.
6. `MsalInterceptor` pide el token con `acquireTokenSilent` y el scope  
   `api://3609dffc-ca49-4133-a6e5-2dbf3ba2a120/access_as_user`.
7. El dashboard lee claims del access token: `scp`, `roles`, `aud`, `exp`.
8. **Cerrar sesión** ejecuta `logoutRedirect`.

App registration usada: **Pedidos360-Web**  
`clientId`: `6453ffd4-e484-4eff-acc6-8c4918f7f157`  
`tenantId`: `4531cbe0-83c7-406d-a972-e6302b1fb7d1`  
Redirect SPA: `http://localhost:4200`

---

## 5. Puesta en marcha

```bash
npm install
npm start
```

Abrir **http://localhost:4200** (no 127.0.0.1: el redirect de Entra es `localhost`).  
El backend debe estar en `http://localhost:8080`.

`src/environments/environment.ts` ya trae tenant y client IDs del proyecto.

```bash
npm run build
# dist/pedidos360-frontend/browser
```

### Ejecución con Docker

```bash
docker build -t pedidos360-frontend .
docker run -p 4200:80 pedidos360-frontend
```

O levantar la solución completa desde la raíz con:
```bash
docker compose up --build
```

---

## 6. Evidencias de este repositorio

- Login Microsoft y pantalla “JWT activo”
- Logout desde el header
- Entrar a `/pedidos` sin sesión → redirect a Entra (`MsalGuard`)
- Claims visibles en Inicio (`scp: access_as_user`)
- Llamadas a la API con header Bearer (interceptor)

La validación del JWT (401/200/403) se demuestra en el repositorio **backend**.
