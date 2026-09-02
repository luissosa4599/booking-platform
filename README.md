# booking-engine

Motor genérico de reservas de recursos.

## Estructura del repo

```
booking-engine/
├── api/
│   ├── BookingEngine.Domain/          → entidades, sin dependencias
│   ├── BookingEngine.Infrastructure/  → EF Core: DbContext, configs, migraciones
│   ├── BookingEngine.Api.csproj       → API HTTP (Minimal APIs)
│   ├── BookingEngine.Worker/          → microservicio de notificaciones (push)
│   └── BookingEngine.Api.Tests/       → xUnit
├── app/          → Expo (React Native + NativeWind) — iOS / Android / Web
├── docs/         → Handoff de diseño (tokens, componentes, pantallas)
├── docker-compose.yml → stack local completo (Postgres + api + worker)
└── README.md     → Overview del proyecto completo
```

`api/BookingEngine.Api.csproj` y `api/BookingEngine.Worker/` comparten la misma base de datos vía
`BookingEngine.Domain`/`BookingEngine.Infrastructure` (referenciadas como class libraries) — la API
es la única que corre migraciones (`dotnet ef`, ver abajo); el worker solo lee/escribe con el mismo
`DbContext`.

## Cómo correrlo local

### Variables de entorno

Cada parte trae un `.env.example` — cópialo a `.env` y llena los valores reales antes de correr:

```bash
cp api/.env.example api/.env
cp app/.env.example app/.env
```

- `api/.env` — `ConnectionStrings__Default` (Postgres/Neon) y `FRONTEND_WEB_URL` (origen CORS de
  producción, vacío en local). Se carga solo al arrancar (`DotNetEnv` en `Program.cs`, solo si el
  archivo existe — no afecta CI/producción). Ojo: Neon te da la connection string en formato URI
  (`postgresql://...`), pero Npgsql necesita `Host=...;Database=...;Username=...;Password=...` —
  ver el comentario en `api/.env.example`.
- `app/.env` — `EXPO_PUBLIC_API_URL`, solo necesaria para builds de producción; en desarrollo la URL
  del API se resuelve sola por plataforma (ver más abajo).

**Neon**: usa una rama de desarrollo (`dev`) separada de `main` para trabajo local, para no
arriesgar los datos de la rama principal. Esto se configura manualmente en el dashboard de Neon
(no hay nada que instalar ni correr aquí) — `api/.env`'s `ConnectionStrings__Default` debe apuntar
a esa rama `dev`, nunca a `main`.

### Backend (`/api`)

```bash
cd api
dotnet run
```

El servicio expone `GET /health` → `{ "status": "ok" }`.

CORS está configurado con una política nombrada `AllowWeb` que permite `http://localhost:8081`
(Expo web dev server) y, en producción, el origen que se defina en la variable de entorno
`FRONTEND_WEB_URL` (vacía por ahora — se llena cuando exista el dominio de Vercel).

### Worker de notificaciones (`api/BookingEngine.Worker`)

Microservicio aparte (mismo repo, DB compartida vía `BookingEngine.Infrastructure`) que manda push
notifications: recordatorios 30 min antes de una reserva confirmada, y aviso a la siguiente persona
en lista de espera cuando alguien cancela (patrón outbox transaccional —
`NotificationOutbox`, escrito por la API en el mismo `SaveChanges` que la cancelación). Sin API HTTP
propia, dos `BackgroundService` con polling (`ReminderService` cada 60s, `WaitlistPromotionService`
cada 15s), habla con la Expo Push API directo por HTTP.

```bash
cd api
dotnet run --project BookingEngine.Worker
```

Necesita la misma `ConnectionStrings__Default` que la API (usa el mismo `.env` si corres desde
`api/`). No requiere `dotnet-ef` ni corre migraciones — asume que la API ya las aplicó.

### Stack completo con Docker Compose

Para probar API + worker + una Postgres local (no Neon) juntos:

```bash
docker compose up --build
curl -X POST http://localhost:5190/dev/seed
```

El contenedor de la API aplica las migraciones solo al arrancar (`RUN_MIGRATIONS_ON_STARTUP=true`,
ver `docker-compose.yml` — nunca se activa contra Neon, es exclusivo de este stack local). No hay
despliegue real todavía; esto es solo para verificar la arquitectura de microservicio localmente.

### Frontend (`/app`)

```bash
cd app
npx expo start
```

Desde la terminal de Expo:

- `w` → abre la app en Web
- `a` → abre en Android (emulador o Expo Go)
- `i` → abre en iOS (simulador o Expo Go)

En desarrollo, la URL del API se resuelve automáticamente por plataforma (ver
[`src/lib/config.ts`](app/src/lib/config.ts)) — no requiere configuración. Para builds de
producción, define `EXPO_PUBLIC_API_URL` en `app/.env`.

### Tests

```bash
cd api && dotnet test     # xUnit + WebApplicationFactory (sin --project: corre toda la .slnx)
cd app && npm test        # Jest + jest-expo
```

`dotnet test` sin argumento explícito descubre `api/BookingEngine.Api.slnx` (los 5 proyectos:
Domain, Infrastructure, Api, Api.Tests, Worker) — solo `Api.Tests` tiene pruebas reales, los demás
simplemente se compilan como parte del mismo build.

CI (`.github/workflows/ci.yml`) corre tres jobs en paralelo en cada push/PR a `main`: `api`
(restore + build + test de toda la solución), `app` (install + type check + test), y `docker`
(`docker build` de las dos imágenes — validación de que los Dockerfiles compilan, sin push a
ningún registry).

## Cross-platform notes

Puntos de fricción entre mobile (iOS/Android) y web resueltos antes de construir pantallas reales,
para que el resto del código no tenga que volver a decidirlos:

- **`src/lib/config.ts`** — centraliza la URL del API. En desarrollo resuelve por plataforma
  (`10.0.2.2:5190` en el emulador de Android, porque el emulador no comparte el `localhost` del
  host; `localhost:5190` en iOS/web — puerto de `api/Properties/launchSettings.json`). En
  producción exige `EXPO_PUBLIC_API_URL` y falla rápido si
  falta, en vez de apuntar silenciosamente a la URL equivocada. Esta lógica vive en tiempo de
  ejecución (no en `app.config.ts`), porque `app.config.ts` corre en Node durante el build y no
  tiene acceso al `Platform.OS` real del dispositivo — solo el código que corre en la app lo sabe.

- **`src/lib/haptics.ts`** — `expo-haptics` no tiene implementación real en web. El wrapper
  envuelve cada llamada con un check de `Platform.OS`, así que el resto del código nunca importa
  `expo-haptics` directamente ni necesita acordarse de la plataforma.

- **`src/components/Sheet.{native,web}.tsx`** — el handoff de diseño pide `@gorhom/bottom-sheet` para el
  componente Sheet. La librería declara soporte web desde su v5, pero hay issues abiertos/recientes
  en su repo sobre crashes en web (p. ej. `findNodeHandle` no soportado) y soporte fragmentado fuera
  de Expo, así que no se consideró suficientemente sólido para depender de él en las tres
  plataformas. Se resolvió con un wrapper de misma API (`isOpen`, `onClose`, `children`) dividido en
  `Sheet.native.tsx` (usa `@gorhom/bottom-sheet`, con gestos vía `GestureHandlerRootView` en
  `_layout.tsx`) y `Sheet.web.tsx` (`Modal` centrado con el overlay `rgba(11,11,12,0.38)` del
  handoff). Al ser archivos separados por plataforma (no un solo componente con un `if`), Metro
  excluye `@gorhom/bottom-sheet` del bundle de web por completo — confirmado inspeccionando el
  bundle exportado, no aparece ninguna referencia a la librería. El resto del código solo importa
  `@/components/Sheet`; la resolución de cuál archivo usar es automática (vía `moduleSuffixes` en
  `tsconfig.json` para el tipado, y la convención de Metro en tiempo de build).

## Arquitectura

_Pendiente — se documentará conforme avance el proyecto._

## Decisiones técnicas

_Pendiente — se documentará conforme avance el proyecto._
