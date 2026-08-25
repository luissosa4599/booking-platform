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

## Cómo correr cada parte localmente

### Backend (`/api`)

```bash
cd api
dotnet run
```

El servicio expone `GET /health` → `{ "status": "ok" }`.

### Frontend (`/app`)

```bash
cd app
npx expo start
```

Desde la terminal de Expo:

- `w` → abre la app en Web
- `a` → abre en Android (emulador o Expo Go)
- `i` → abre en iOS (simulador o Expo Go)

## Arquitectura

_Pendiente — se documentará conforme avance el proyecto._

## Decisiones técnicas

_Pendiente — se documentará conforme avance el proyecto._
