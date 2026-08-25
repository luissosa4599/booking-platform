# booking-engine

Motor genérico de reservas de recursos.

## Estructura del repo

```
booking-engine/
├── api/          → ASP.NET Core (backend)
├── app/          → Expo (React Native + NativeWind) — iOS / Android / Web
├── docs/         → Handoff de diseño (tokens, componentes, pantallas)
└── README.md     → Overview del proyecto completo
```

## Cómo correrlo local

### Variables de entorno

Cada parte trae un `.env.example` — cópialo a `.env` y llena los valores reales antes de correr:

```bash
cp api/.env.example api/.env
cp app/.env.example app/.env
```

- `api/.env` — `ConnectionStrings__Default` (Postgres/Neon) y `FRONTEND_WEB_URL` (origen CORS de
  producción, vacío en local).
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
cd api && dotnet test     # xUnit + WebApplicationFactory
cd app && npm test        # Jest + jest-expo
```

CI (`.github/workflows/ci.yml`) corre ambos en paralelo en cada push/PR a `main`: para `/api`
restore + build + test, para `/app` install + type check (`tsc --noEmit`) + test.

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
