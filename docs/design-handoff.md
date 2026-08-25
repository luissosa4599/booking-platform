# Handoff: Cupo — flujo de usuario final (motor genérico de reservas)

## Overview

Cupo es la app de usuario final de un **motor genérico de reservas de recursos**. Un "recurso" es cualquier entidad con disponibilidad limitada en el tiempo: una sala, un escritorio, un equipo en renta, una cita médica, una mesa. El mockup usa un dominio concreto —espacios de la Biblioteca Central de un campus— para que la UI se lea como producto real, pero **ninguna pantalla escribe literales de dominio**: los sustantivos vienen de `resourceType.labels`.

Alcance de este handoff: **solo el flujo del usuario final**, 7 pantallas + una variante en modo oscuro. No incluye panel de administración.

Target: **Expo (React Native) + NativeWind**, un solo código para iOS, Android y Web. Backend .NET Core.

La promesa de producto es una sola frase: **apartar un espacio en un tap**. Todo lo demás está subordinado a eso.

## About the Design Files

Los archivos `.dc.html` de este bundle son **referencias de diseño creadas en HTML** — prototipos que muestran el aspecto y el comportamiento buscados. **No son código de producción para copiar.** El HTML usa flexbox y estilos inline precisamente para que cada bloque tenga un equivalente 1:1 en `View` / `Text` de React Native, pero la tarea es **recrear estos diseños en el entorno del proyecto destino** (Expo + NativeWind), usando sus patrones y librerías establecidas.

Concretamente: cada `<div style="display:flex…">` es un `<View className="flex…">`, cada `<span>` es un `<Text>`, y cada valor hex de este README debe entrar al `tailwind.config.js` como token con nombre antes de escribir la primera pantalla.

## Fidelity

**Alta fidelidad (hifi).** Colores, tipografía, espaciado, radios, alturas de control y copy están finales. Recrear pixel-perfect. Las únicas cosas deliberadamente abiertas:

- Los iconos aparecen como cuadrados/círculos neutros — usar el set de iconos del proyecto (SF Symbols vía `expo-symbols` en iOS, o `lucide-react-native` multiplataforma). Tamaño 22 px en tab bar, 20 px en línea.
- Las fotos de recursos aparecen como bloques `#EFEFF2` — placeholders reales pendientes de material del cliente.
- Barra de estado y home indicator del teléfono son parte del mockup, no de la app.

## Design language (leer antes de las pantallas)

Cinco reglas. Si algo en la implementación las rompe, está mal implementado:

1. **Una acción primaria por pantalla.** Un solo botón `filled` con el color de acento visible a la vez. Todo lo demás es `gray`, `dark` o `plain`.
2. **Listas agrupadas, no tarjetas.** El contenido vive en grupos de esquinas redondeadas (radius 22) sobre un lienzo gris, separados por hairlines de 1 px con inset izquierdo de 16 px. No hay tarjetas flotando.
3. **Sin sombras.** La única sombra del sistema es la hoja modal. La separación es por color de fondo. (Esto además es gratis en rendimiento de scroll en Android.)
4. **Tipografía del sistema, seis tamaños.** Cero fuentes que descargar, cero flash de texto sin estilo.
5. **Jerarquía por tamaño, peso y aire** — no por color. Los colores de estado son texto o puntos, nunca fondos grandes de color.

## Design Tokens

Todo esto va a `tailwind.config.js`. Ninguna pantalla debe contener un valor hex literal.

### Color — tema claro

| Token | Hex | Uso |
|---|---|---|
| `tint` | `#C2571F` | Acento único. Botón primario, links, valores de acción. Una vez por pantalla. |
| `tint-press` | `#A0451A` | Estado presionado del botón filled; texto sobre `tint-wash`. |
| `tint-soft` | `#E8A883` | Acento en modo oscuro. |
| `tint-wash` | `#FBEFE8` | Fondo de fila seleccionada, fondo de pastilla de acción secundaria. |
| `label-1` | `#0B0B0C` | Texto primario, títulos. |
| `label-2` | `#3C3C43` | Cuerpo de texto largo. |
| `label-3` | `#6C6C70` | Subtítulos, texto secundario. |
| `label-4` | `#8A8A8E` | Metadatos, headers de grupo, placeholders. |
| `card` | `#FFFFFF` | Fondo de grupos y de pantallas sin lista. |
| `canvas` | `#F7F7F8` | Lienzo de pantallas con listas; grupos anidados sobre blanco. |
| `fill` | `#EFEFF2` | Controles (segmented, stepper, campo de búsqueda), botón gray. |
| `hairline` | `#E5E5EA` | Separadores, bordes. |
| `chevron` | `#C7C7CC` | Glifo de chevron y bordes de placeholder. |
| `disabled-label` | `#B9B9BE` | Texto de botón deshabilitado. |

### Color — estado (siempre como texto o punto, jamás como fondo grande)

| Token | Hex claro | Hex oscuro | Uso |
|---|---|---|---|
| `state-free` | `#2C9160` | `#30B565` | Disponible. |
| `state-last` | `#C08A18` | `#D9A93F` | "Último lugar". |
| `state-error` | `#C0392B` | `#E0524A` | Error destructivo. |
| `state-waiting` | `#3A76C4` | `#5A96E0` | Lista de espera. |

### Color — tema oscuro

| Token | Hex | Notas |
|---|---|---|
| `canvas` | `#000000` | Negro puro (OLED). |
| `card` | `#1C1C1E` | Grupos. |
| `fill` | `#2C2C2E` | Controles, botón gray. |
| `hairline` | `#38383A` | Bordes de barra. Separadores internos: `#2C2C2E`. |
| `label-1` | `#FFFFFF` | |
| `label-3/4` | `#8A8A8E` | Igual en ambos temas. |
| `tint` | `#E8A883` | El acento se aclara; texto sobre él es `#40200B`. |
| `chevron` | `#48484A` | |

Implementación: `darkMode: 'class'` en NativeWind, un objeto de tema por modo, mismos nombres. Ninguna pantalla condiciona colores; usa `bg-card`, `text-label-1` y el tema resuelve.

### Escala de espaciado (múltiplos de 4)

| Token | px | Uso |
|---|---|---|
| `1` | 4 | Hairline, gap de línea dentro de un texto multilínea. |
| `2` | 8 | Texto ↔ texto, gap entre pastillas, gap entre botones. |
| `3` | 12 | Padding vertical de fila de lista, gap fila↔trailing. |
| `4` | 16 | Margen de pantalla, padding horizontal de fila, inset de separador. |
| `5` | 20 | Padding horizontal de hoja modal. |
| `6` | 24 | Entre grupos, padding horizontal de pantallas centradas. |
| `8` | 32 | Entre bloques mayores en pantallas centradas. |
| `10` | 40 | Respiro bajo un título grande. |

Prohibido cualquier valor fuera de esta escala. (En el mockup verás `padding:13px 16px` en algunas filas de historial — es una fila compacta; en implementación usar `py-3` = 12.)

### Tipografía

Una sola familia: **la del sistema** (SF Pro en iOS, Roboto en Android, `system-ui` en web). `letter-spacing: -0.01em` global; los títulos aprietan más.

| Nombre | Size / Line | Weight | Tracking | Uso |
|---|---|---|---|---|
| `title-lg` | 34 / 40 | 700 | -0.03em | Título de pantalla ("Ahora", "Reservas"). |
| `title-md` | 28 / 34 | 700 | -0.025em | Título de detalle, de hoja modal (24 en la hoja). |
| `title-sm` | 22 / 28 | 600 | -0.02em | Nombre de recurso destacado, título de estado vacío. |
| `body-emph` | 17 / 22 | 600 | -0.01em | Título de fila, label de botón. |
| `body` | 17 / 22 | 400 | -0.01em | Cuerpo, valor de fila. |
| `subhead` | 15 / 20 | 400 | -0.01em | Subtítulo de fila, texto secundario. |
| `footnote` | 13 / 18 | 400/600 | 0 | Header de grupo (600, mayúsculas), metadato, subtítulo de botón (12). |

**Todo número que exprese hora, fecha, cantidad o código lleva `font-variant-numeric: tabular-nums`.** En RN: `fontVariant: ['tabular-nums']`. Esto evita que "14:00 → 15:30" salte de ancho al re-renderizar.

### Radios

| Token | px | Uso |
|---|---|---|
| `control` | 8–10 | Botón interno de stepper (8), campo de búsqueda y stepper (10), segmented (9), pastilla interna de segmented (7). |
| `button` | 14 | Botón lg, pastilla de día. |
| `group` | 22 | Grupo de lista. |
| `sheet` | 30 | Hoja modal (solo esquinas superiores). |
| `logo` | 16 | Marca de la app. |
| `full` | 999 | Pastillas de filtro y de acción. |

### Elevación

Solo una: la hoja modal, sobre un overlay `rgba(11,11,12,0.38)`. La sombra que ves alrededor de los teléfonos en el lienzo es del mockup, no del producto.

### Alturas de control (todas ≥ 44 de área táctil)

| Elemento | Altura |
|---|---|
| Botón `lg` | 52 |
| Botón `plain` (área táctil) | 48 |
| Pastilla de acción / filtro | 38 / 34 |
| Fila de lista | 56 mín (72 típica con subtítulo) |
| Segmented / stepper | 34 (contenedor), 34 el botón interno con 44 de ancho |
| Campo de búsqueda | 38 |
| Tab bar | 82 + safe area inferior |
| Barra de acción inferior | 12 top + 52 botón + 34 inferior |

Nota: pastillas y steppers miden 34–38 px de alto pero su `hitSlop` los lleva a 44. En RN: `hitSlop={{top:5,bottom:5,left:8,right:8}}`.

## Components

Nueve piezas cubren las siete pantallas. Construirlas primero, en este orden — las pantallas después son composición.

### 1. `Group`

Contenedor de lista agrupada. **La pieza más usada del sistema.**

- `bg-card` (o `bg-canvas` cuando el grupo va sobre blanco), `rounded-[22px]`, `overflow-hidden`.
- Los hijos son `Row`. Entre cada par, un separador: `View` de `height:1`, `bg-hairline`, `marginLeft:16`.
- Props: `header?` (string → se renderiza fuera del grupo, arriba, `footnote` 600 mayúsculas `text-label-4`, `paddingLeft:4`, gap 8), `footer?`, `children`.
- El separador **nunca** va después del último hijo. Implementar con `React.Children.toArray().map()` e insertar entre elementos, no con `border-b` en cada fila.

### 2. `Row`

- Layout: `flex-row items-center`, `px-4 py-3`, `gap-3`, `minHeight:56`.
- Izquierda (flex-1, `flex-col gap-[3px]`): `title` (`body-emph`), `subtitle?` (`subhead text-label-3`), `meta?` (una tercera línea, usada para estado: "En espera · eres el 2.º" en `state-waiting`).
- `trailing`: una de cinco variantes —
  - `'text'` → `<Text className="body text-label-3 tabular-nums">` (ej. "15:30")
  - `'chevron'` → glifo 19 px `text-chevron`
  - `'action'` → `<Button variant="pill">`
  - `'check'` → ✓ 17 px `text-tint`
  - `'none'`
- `selected` → fondo `tint-wash`, título a `body-emph text-tint-press`, trailing `'check'`.
- `disabled` → `opacity-45`, título a `text-label-4`, sin `onPress`.
- **Press-in**: el fondo va a `fill` en 80 ms y vuelve al soltar. Sin `scale` — una fila no es un botón. Usar `Pressable` con `style={({pressed}) => ...}`.

### 3. `Button`

- Variantes: `filled` (bg `tint`, texto blanco), `dark` (bg `label-1`, texto blanco), `gray` (bg `fill`, texto `label-2`), `plain` (sin fondo, texto `tint`), `pill` (altura 38, `rounded-full`, `px-4`; `filled` o `wash` = bg `tint-wash` + texto `tint`).
- Tamaños: `lg` (h 52, `rounded-[14px]`, label `body-emph` 17) · `pill` (h 38, label 15/600).
- `subtitle?`: segunda línea 12 px dentro del botón, color `#F6D9C7` sobre filled. Usado en el CTA del detalle ("Apartar 14:00" / "3 personas · 90 min").
- `disabled`: bg `fill`, texto `disabled-label`, sin press.
- **Press**: `opacity 0.75` + `scale 0.98` en 90 ms, retorno con spring. `Haptics.selectionAsync()` en press-in.
- **Loading**: el ancho **no cambia**. El label baja a `opacity 0` y entra un spinner de 18 px en su lugar (crossfade 120 ms).

### 4. `FilterPills`

- `ScrollView horizontal` con `showsHorizontalScrollIndicator={false}`, `contentContainerStyle={{gap:8}}`.
- Pastilla: h 34, `px-[14px]`, `rounded-full`. Activa → bg `label-1`, texto blanco 15/500. Inactiva → bg `card` (sobre canvas) o `fill` (sobre card), texto `label-2`.
- Variante con quitar: `gap-2` interno y un glifo `×` 15 px `text-label-4` al final. Toca el `×` → quita el filtro; toca el resto → abre el editor de ese filtro.
- La primera pastilla del set es siempre el "todos" ("Cualquiera") y es la activa por defecto.

### 5. `SegmentedControl`

- Contenedor h 34, `rounded-[9px]`, `bg-fill`, `p-[2px]`, `flex-row gap-[2px]`.
- Segmento activo: `flex-1 rounded-[7px] bg-card`, label 15/600 `label-1`. Inactivo: label 15/500 `label-3`, sin fondo.
- **Animación**: la pastilla blanca **se desliza** 220 ms ease-out a la nueva posición; los labels no se mueven. Implementar con un `View` absoluto animado detrás de los labels (`translateX` interpolado), no cambiando el fondo de cada segmento.

### 6. `Stepper`

- Contenedor `flex-row items-center gap-[2px] bg-fill rounded-[10px] p-[2px]`.
- Botones: 44 × 34, `rounded-[8px]`, `bg-card`, glifos `−` / `+` 19 px `label-2`.
- Valor: ancho fijo 36, centrado, 17/600, `tabular-nums`.
- `max = slot.seatsLeft`, `min = 1`. Al topar el máximo: shake horizontal de 4 px (120 ms) en el botón `+` y `Haptics.notificationAsync(Warning)`. **No** se muestra mensaje de error.

### 7. `Skeleton`

- **No es una pantalla de carga: es una fila real dentro del grupo real.** La lista nunca cambia de forma entre estado de carga y estado con datos.
- Barras: `height 13` (título, ancho 44–52 %) y `height 11` (subtítulo, ancho 28–34 %), `rounded-[6px]`, `bg-hairline` (claro) / `#2C2C2E` (oscuro), `gap-2`.
- Pulso: opacidad 0.45 → 0.9 → 0.45, 1.4 s, `ease-in-out`, en loop.
- **Aparece solo si la respuesta tarda >150 ms.** Si los datos llegan antes, no se monta nunca. Sale con crossfade de 200 ms.
- Cantidad: 2–3 filas. Nunca más de las que caben en pantalla.
- **Prohibido el spinner de pantalla completa** en cualquier parte del producto.

### 8. `Placeholder` (estado vacío / error de pantalla completa)

- Centrado, `px-10`, `gap-[14px]`.
- Glifo: 64 × 64, `rounded-[18px]`, `bg-fill`, con un icono 26 px `text-chevron` dentro. `mb-[6px]`.
- Título `title-sm` centrado. Cuerpo `body text-label-3` centrado, máx 3 líneas.
- Acciones: `pt-[14px]`, un `Button filled lg` y un `Button plain`. **Nunca más de dos.**
- Props: `icon`, `title`, `body`, `primaryAction`, `secondaryAction?`, `reason` (`'noAvailability' | 'noResults' | 'filtered' | 'offline'`) para telemetría.
- Regla de copy: el título nombra **la causa concreta** ("Semana de parciales"), no la ausencia ("Sin resultados"). El cuerpo da el dato que resuelve ("Mañana a las 9:30 hay tres libres"). La acción primaria **ejecuta** ese dato.

### 9. `Sheet`

- `detents: ['medium']`, grabber 40 × 5 `rounded-full` `bg-[#D6D6DB]` centrado arriba.
- `rounded-t-[30px]`, `bg-card`, `px-5 pt-[10px] pb-[34px]`, `gap-[22px]`.
- Overlay `rgba(11,11,12,0.38)`. El contenido de fondo permanece visible al 40 % de opacidad.
- Descartable por gesto y por tap en el overlay. Usar `@gorhom/bottom-sheet` o `expo-router` modal presentation.

### `TabBar`

- 3 tabs: Explorar / Reservas / Tú. Altura 82 + safe area. `bg-card` al 92 % con blur, `borderTop 1px hairline`, `px-[30px] pt-3`.
- Icono 22 px, label 11 px. Activo `tint` 600, inactivo `label-4` 500.
- Solo tres tabs. No añadir un cuarto sin rediseñar.

## Screens

Todas a 390 × 844 (iPhone 14/15 base). Safe area inferior 34.

---

### 01 · SignInScreen — "Entrar"

**Propósito**: entrar sin fricción. Sin contraseña, sin registro en dos pasos, sin formulario.

**Layout**: `bg-card`, columna. Contenido centrado verticalmente (`justify-center`, `gap-10`, `px-6`), bloque de proveedores anclado abajo (`pb-[34px] gap-[10px]`).

**Contenido**:
- Marca: 60 × 60, `rounded-[16px]`, `bg-tint`, con un glifo blanco 22 px `rounded-[7px]` dentro.
- Título `title-lg` a dos líneas: "Aparta tu lugar / en la biblioteca."
- Cuerpo `body text-label-3`: "Salas, cabinas y escritorios. Un tap y es tuyo por 90 minutos."
- Campo de email: h 52, `rounded-[14px]`, `bg-fill`, `px-4`, texto 17. Sin label flotante, sin borde, sin icono. Placeholder: "Correo institucional".
- `Button filled lg`: "Continuar".
- Nota `footnote text-label-4` centrada: "Te enviamos un enlace. Sin contraseñas."
- Abajo: `Button dark lg` "Continuar con Apple" + `Button plain` "Continuar con Google".

**Notas de implementación**:
- No hay pantalla de "revisa tu correo": el deep link del enlace mágico (`expo-linking`) entra directo a Explorar. Si el usuario vuelve a la app sin abrir el enlace, el campo conserva el email y el botón dice "Reenviar enlace".
- Validación: solo se habilita "Continuar" cuando el email hace match con la regex del tenant. No se muestran errores en rojo mientras escribe — el botón simplemente está `disabled`.
- El botón de Apple es obligatorio en iOS si hay login social (App Store Review 4.8). En Android se oculta.

---

### 02 · ExploreScreen — "Ahora"

**Propósito**: **la pantalla más importante del producto.** Ver qué está libre y apartarlo en un tap, sin navegar a ningún sitio.

**Layout**: `bg-canvas`. Header estático (no colapsable — evitar `sticky` y headers animados complejos en RN), luego `FlatList`, luego `TabBar`. Padding `px-4`, `gap-5` entre bloques.

**Header**:
- Fila: `title-lg` "Ahora" (`items-end`) + `subhead text-label-4` "Jue 20 · 13:45" a la derecha.
- Búsqueda: h 38, `rounded-[10px]`, `bg-fill`, icono 13 px + "Buscar" `text-label-4`.
- `FilterPills`: Cualquiera (activa) · Salas · Cabinas · Escritorios.

**Cuerpo — dos grupos, y el orden importa**:

1. `Group header="LIBRE AHORA MISMO"` — `Row` con `trailing='action'`. La pastilla dice **"Apartar"**. La primera fila la lleva en `filled` (`bg-tint`, texto blanco); las siguientes en `wash` (`bg-tint-wash`, texto `tint`). Un solo acento fuerte por pantalla.
   - Fila 1: "Sala Boreal 204" / "Piso 2 · 8 personas · hasta 15:30"
   - Fila 2: "Cabina de audio 3" / "Piso 1 · 1 persona · hasta 15:15"
   - Fila 3: "Escritorio flex 12B" / subtítulo en `state-last`: "Último lugar · hasta 14:45"
2. `Group header="MÁS TARDE HOY"` — `Row` con `trailing='text'` (la hora, `tabular-nums`) **más** chevron. Estas filas navegan al detalle; no se pueden apartar desde aquí porque hay que elegir horario.
   - "Sala Austral 118" / "Piso 1 · 6 personas" → 15:30
   - "Sala Boreal 204" / "Piso 2 · 8 personas" → 17:00
   - Última fila: `Skeleton` (carga incremental de la cola de la lista).

**La interacción central — apartar en un tap**:

1. Tap en "Apartar" → `Haptics.selectionAsync()`, el botón entra en `loading` (ancho fijo).
2. `POST /bookings` con `Idempotency-Key`.
3. Éxito → la pastilla **se convierte en ✓ en el mismo lugar**: crossfade + `scale 0.9 → 1` en 240 ms. Pausa de 400 ms.
4. La fila sale del grupo "Libre ahora mismo" con `Layout.springify()` y el grupo se cierra sobre el hueco.
5. Toast inferior: "Sala Boreal 204 · hoy 14:00" con acción "Ver".
6. **No hay pantalla intermedia de confirmación en este camino.** La pantalla 04 es para el flujo largo (desde el detalle, con horario y personas elegidos).
7. Fallo 409 → la pastilla vuelve a su estado, `Haptics.notificationAsync(Error)` y se presenta la `ConflictSheet` (pantalla 07).

**Notas de implementación**:
- `FlatList` con `getItemLayout` (fila = 72 px) y `keyExtractor` por `resource.id`. Sin sombras en las filas → composición barata al hacer scroll en Android.
- Disponibilidad en caché con TTL de 60 s (TanStack Query `staleTime: 60_000`). Al volver a la pantalla se sirve caché y se revalida en fondo.
- **Pull-to-refresh sin spinner**: las filas existentes bajan a `opacity 0.6` y el subtítulo del header cambia a "Actualizando…". El `RefreshControl` nativo va con `tintColor` transparente.
- El agrupado "libre ahora / más tarde" lo calcula el cliente comparando `slot.startsAt` con `now`. El backend devuelve slots planos ordenados por hora.

---

### 03 · ResourceScreen — detalle y horario

**Propósito**: elegir **otro** horario o más personas. Es opcional, no un peaje: quien acepta el próximo hueco nunca pasa por aquí.

**Layout**: `bg-card`. Foto 196 px arriba, contenido `px-4 pt-6 gap-6`, barra de acción anclada abajo.

**Contenido**:
- Foto: 196 px, `bg-fill`. Botón atrás flotante 36 × 36 `rounded-full` `bg-white/86` con `←` 17 px, a 16 px del borde. (Shared element desde la fila de Explorar cuando hay imagen.)
- Título `title-md` "Sala Boreal 204" + `body text-label-3` "Piso 2 · hasta 8 personas · pizarrón y pantalla".
- **Fila "Personas" + `Stepper`** (`justify-between`, `px-1`). Va **antes** de los horarios: el número de personas filtra qué slots son elegibles, así que decidirlo primero es el orden correcto y además explica el subtítulo del CTA.
- Pastillas de día: 4 en fila, `flex-1`, h 52, `rounded-[14px]`, `bg-fill`, dos líneas (día 13 px `label-4` / número 17/600 `tabular-nums`). Primera dice "Hoy". Días sin disponibilidad a `opacity 0.4` y no presionables.
- `Group` de slots sobre `bg-canvas`, un `Row` por bloque de 90 min:
  - `08:00 – 09:30` → disabled, trailing text "Ocupada"
  - `09:30 – 11:00` → "6 lugares"
  - `14:00 – 15:30` → **selected** (`bg-tint-wash`, texto `tint-press` 600, trailing ✓)
  - `15:30 – 17:00` → "8 lugares"
  - `17:00 – 18:30` → "1 lugar" en `state-last`
  - `18:30 – 20:00` → "Anotarme" en `state-waiting` (slot lleno → lista de espera)
- La última fila queda parcialmente visible: es el indicador de que hay más al hacer scroll. Intencional.

**Barra de acción inferior**: `bg-card/94`, `borderTop 1px #EFEFF2`, `pt-3 px-4 pb-[34px]`. Un `Button filled lg` con subtítulo: **"Apartar 14:00"** / "3 personas · 90 min".

**Notas de implementación**:
- El CTA **nunca desaparece ni cambia de tamaño** al cambiar la selección: solo su label hace crossfade de 120 ms. Sin selección, está `disabled` con label "Elige un horario".
- Selección de slot: 150 ms interpolando fondo y color de texto. Sin `scale`.
- La pantalla se pinta **inmediatamente** con los datos que ya venían en la fila de Explorar (nombre, ubicación, capacidad) y revalida los slots en fondo. Cero pantalla de carga al entrar.
- `Stepper` máximo = `seatsLeft` del slot **seleccionado**. Si el usuario sube personas por encima de lo que permite el slot elegido, ese slot se deselecciona y su fila pasa a disabled — no se muestra un error.

---

### 04 · ConfirmedScreen — confirmación

**Propósito**: cerrar el flujo largo con una recompensa clara. Solo se muestra viniendo del detalle (pantalla 03).

**Layout**: `bg-card`, contenido centrado (`justify-center gap-8 px-6`), acciones abajo (`pb-[34px] gap-2`).

**Contenido**:
- **Microinteracción de éxito** — el detalle de este handoff:
  - Círculo 84 × 84, `rounded-full`, `bg-tint`, con ✓ blanco 40 px / 600.
  - Entrada: `scale 0.6 → 1.06 → 1`, **340 ms**, cubic-bezier `(0.22, 0.9, 0.28, 1.1)`, opacidad 0 → 1 en el primer 55 %.
  - Halo: círculo 104 × 104 `bg-tint-wash` detrás, `scale 0.9 → 1.6` y `opacity 0.5 → 0`, **2 s**, `ease-out`, en loop.
  - `Haptics.notificationAsync(Success)` en el primer frame.
  - **Nada más en la pantalla se mueve.** El texto y la tarjeta ya están ahí.
  - Reanimated: `withSequence(withTiming(1.06, {duration:190}), withSpring(1))` para el ✓; `withRepeat` para el halo.
- Título `title-md` centrado: **"Es tuya"**. Cuerpo `body text-label-3`: "Te avisamos 30 minutos antes."
- `Group` sobre `bg-canvas` con el resumen: cabecera con nombre (`title-sm`) y ubicación (`body text-label-3`), luego tres `Row trailing='text'`: Cuándo → "Hoy 14:00 – 15:30" · Personas → "3" · Código → "BRL-8241" (600, `tabular-nums`).
- Racha, en una línea `subhead text-label-4`, sin badge ni icono: "Octava semana seguida. Bien." Se muestra solo si `streak >= 3`; si no, la línea no existe.
- Acciones: `Button filled lg` "Añadir al calendario" + `Button plain` "Listo".

**Notas de implementación**:
- "Añadir al calendario" usa `expo-calendar`; si el permiso se deniega, el botón pasa a "Copiar detalles" sin mostrar alerta.
- Con `reduce-motion` activo: el ✓ aparece con crossfade de 200 ms y el halo no se monta.
- El recordatorio de 30 min se programa con `expo-notifications` en el momento de confirmar, con el `booking.id` como identificador (para poder cancelarlo si cancelan la reserva).

---

### 05 · BookingsScreen — "Reservas"

**Propósito**: ver lo que viene, cancelar, y repetir lo que ya funcionó.

**Layout**: `bg-canvas`, `px-4 pt-3 gap-[22px]`, `TabBar` abajo.

**Contenido**:
- `title-lg` "Reservas".
- `SegmentedControl`: Próximas / Anteriores.
- **Tarjeta de la próxima reserva** (no es un `Group`: es el único bloque destacado del producto). `bg-card rounded-[22px] p-4 py-[18px] gap-4`:
  - Cuenta atrás `subhead` 600 `text-tint`: "En 2 h 15 min". **Solo se muestra si falta menos de 24 h**; si no, la fecha ocupa su lugar.
  - Nombre `title-sm`, luego `body text-label-3 tabular-nums`: "Hoy 14:00 – 15:30 · 3 personas".
  - Dos botones al 50 %: `dark` "Ver pase" + `gray` "Cancelar".
- `Group` con la entrada en lista de espera: "Cabina de audio 3" / "Lun 24 · 17:00 – 18:30" / tercera línea `state-waiting`: "En espera · eres el 2.º", `trailing='chevron'`.
- `Group header="ESTE MES"` con el historial: tres `Row` compactas, subtítulo "14 ago · completada" / "9 ago · cancelada", `trailing='action'` con `Button plain` "Repetir".

**Interacciones**:
- **Cancelar** (optimista, reversible): tap → `Sheet` de confirmación ("¿Cancelar la reserva? Se libera para alguien de la lista de espera") → la tarjeta colapsa en **260 ms** con `Layout.springify()` → toast negro con "Reserva cancelada" y **"Deshacer" durante 5 s**. El `DELETE` se envía al expirar el toast, no antes. Si falla, la tarjeta vuelve con un shake de 6 px.
- **Repetir**: precarga el mismo recurso, mismo horario, mismas personas en la próxima fecha disponible y va directo al detalle con todo preseleccionado. Un tap más y está hecho.
- "Ver pase" abre una `Sheet` con el código en grande y un QR. (No diseñada aquí — mismo `Group`, código a 34 px `tabular-nums`.)

---

### 06 · EmptyState — nada disponible

**Propósito**: que un resultado vacío siga siendo útil. Es una variante de estado de ExploreScreen, no una pantalla aparte.

**Layout**: header de Explorar reducido (título + las pastillas de filtro activas, para que se vea **qué** está causando el vacío), `Placeholder` centrado, `TabBar`.

**Contenido**:
- Header: `title-lg` "Ahora" + una pastilla de filtro activa con `×`: "Salas · 8 personas".
- `Placeholder`:
  - Glifo 64 × 64 `bg-fill rounded-[18px]`.
  - Título: **"Semana de parciales"** — nombra la causa real, no la ausencia.
  - Cuerpo: "Las seis salas grandes están llenas hasta las 21:00. Mañana a las 9:30 hay tres libres."
  - `Button filled lg`: "Ver mañana 9:30" (**ejecuta** el dato del cuerpo: cambia la fecha del filtro).
  - `Button plain`: "Quitar el filtro de 8 personas" (relaja la restricción más restrictiva).

**Notas de implementación**:
- El copy es dinámico, no una cadena fija. El backend devuelve, junto a la lista vacía, un objeto `emptyContext { reason, nextAvailableAt, blockingFilter, occupancyNote }` y el cliente compone la frase con esa plantilla. Sin ese objeto, cae al genérico "Nada libre con estos filtros".
- La acción primaria siempre es la que el `emptyContext` marque como más probable de resolver. La secundaria siempre es quitar `blockingFilter`.
- Variantes de `reason` a cubrir: `noAvailability` (esta), `noResults` (búsqueda sin match), `filtered` (filtros demasiado estrechos), `offline` (título "Sin conexión", acción "Reintentar").

---

### 07 · ConflictSheet — se llenó primero

**Propósito**: el caso de carrera. Dos personas apartan el mismo bloque a la vez. Es el estado que más dice sobre la calidad del producto.

**Presentación**: `Sheet` sobre la pantalla anterior (detalle o Explorar) al 40 % de opacidad, tras el overlay. El usuario no pierde el contexto.

**Contenido**:
- Grabber.
- Título `title-md` (24 px) 700: **"Alguien se adelantó"**. Cuerpo `body text-label-3`: "Las 14:00 se llenaron mientras confirmabas. No guardamos nada."
- `Group header="CERCA DE LO QUE QUERÍAS"` sobre `bg-canvas`, dos `Row trailing='action'` con `Button plain` "Apartar":
  - "Misma sala, 15:30" / "8 lugares libres"
  - "Sala Austral 118, 14:00" / "Mismo piso, 40 m"
- `Button gray lg`: "Anotarme para las 14:00" (entra a la lista de espera del slot original).
- `Button plain`: "Volver".

**Reglas de copy para errores en todo el producto**:
1. Di **qué pasó** en lenguaje humano ("Alguien se adelantó"), no el código ("Error 409: conflicto de concurrencia").
2. Di **qué no pasó**, si tranquiliza ("No guardamos nada").
3. Ofrece **la siguiente mejor acción concreta**, no "Reintentar".
4. Cero códigos técnicos en el cuerpo. Si soporte los necesita, van en un `footnote` seleccionable al final de la hoja.

**Notas de implementación (esto es backend tanto como diseño)**:
- `POST /bookings` lleva `Idempotency-Key` (UUID generado en el cliente por intento) y el `rowVersion` del slot. Con esto, un doble tap o un reintento de red **nunca** crea dos reservas.
- Cuando el backend detecta el conflicto responde **409 con las dos mejores alternativas ya calculadas** en el body: `{ conflict: {...}, alternatives: [ {slotId, resourceName, startsAt, seatsLeft, distanceNote}, ... ] }`. La UI **no calcula nada** — solo renderiza. Esto es lo que hace que la hoja aparezca instantánea en vez de con un segundo spinner.
- Tap en una alternativa → `POST` con **nueva** `Idempotency-Key`. Si esa también falla, la hoja se actualiza en sitio con alternativas nuevas; no se apilan hojas.

---

### 08 · Modo oscuro (Explorar)

Misma estructura exacta, mismos nombres de token, otro mapeo. Se incluye para demostrar que el sistema de color aguanta sin condicionales en las pantallas.

Diferencias a notar: canvas negro puro, el acento se aclara a `tint-soft` `#E8A883` con texto `#40200B` encima, los separadores internos usan `#2C2C2E` (más suave que el `hairline` `#38383A` de las barras), y los colores de estado se aclaran (`state-last` → `#D9A93F`).

## Interactions & Behavior — resumen de movimiento

Toda la app se mueve entre **80 y 340 ms**. Nada rebota dos veces.

| Interacción | Duración | Curva / método | Detalle |
|---|---|---|---|
| Press de botón | 90 ms | spring al soltar | `opacity 0.75` + `scale 0.98` |
| Press de fila | 80 ms | linear | fondo → `fill`, sin scale |
| Selección de slot | 150 ms | ease-out | fondo y color de texto interpolados |
| Label del CTA | 120 ms | crossfade | el botón no cambia de tamaño |
| Apartar → ✓ | 240 ms | crossfade + `scale 0.9→1` | en el mismo lugar de la pastilla |
| Fila sale de la lista | 260 ms | `Layout.springify()` | el grupo se cierra sobre el hueco |
| Checkmark de confirmación | 340 ms | `(0.22, 0.9, 0.28, 1.1)` | `scale 0.6 → 1.06 → 1` |
| Halo del checkmark | 2 s, loop | ease-out | `scale 0.9 → 1.6`, `opacity 0.5 → 0` |
| Segmented control | 220 ms | ease-out | la pastilla se desliza; los labels no |
| Push a detalle | nativo | — | sin personalizar; shared element 280 ms en la foto |
| Skeleton (pulso) | 1.4 s, loop | ease-in-out | `opacity 0.45 → 0.9` |
| Skeleton (salida) | 200 ms | crossfade | misma altura → cero salto de layout |
| Shake de error | 120 ms | — | 4 px (stepper) / 6 px (fila que vuelve) |

**Háptica**: `selectionAsync()` en cada press de botón y de fila. `notificationAsync(Success)` al confirmar. `notificationAsync(Warning)` al topar el máximo del stepper. `notificationAsync(Error)` en el 409. Nada más — la háptica de más se vuelve ruido.

**Reduce-motion** (`AccessibilityInfo.isReduceMotionEnabled`): se apagan todos los `scale`, el halo y el shake. Se mantienen los crossfades y los cambios de color. La app sigue siendo legible y nada se pierde.

## State Management

Sugerencia: **TanStack Query** para todo lo remoto, `useState` local para lo efímero. Sin Redux — no hay estado global que lo justifique.

### Queries

| Query | Key | Notas |
|---|---|---|
| Recursos disponibles | `['availability', {date, filters}]` | `staleTime: 60_000`. Alimenta Explorar. |
| Detalle + slots | `['resource', id, date]` | `initialData` desde la fila de Explorar → pinta al instante. |
| Mis reservas | `['bookings', {scope}]` | `scope: 'upcoming' | 'past'`. Invalidar tras crear/cancelar. |

### Mutations

| Mutation | Optimista | Rollback |
|---|---|---|
| `createBooking` | Sí — la fila sale de "libre ahora" antes de la respuesta | La fila vuelve; se presenta `ConflictSheet` |
| `cancelBooking` | Sí — la tarjeta colapsa; el `DELETE` sale al expirar el toast de 5 s | La tarjeta vuelve con shake de 6 px |
| `joinWaitlist` | No — es rápido y raro | Toast de error con "Reintentar" |

### Estado local por pantalla

- Explorar: `query` (búsqueda), `activeFilters[]`, `pendingBookingIds[]` (para los botones en `loading`).
- Detalle: `selectedDate`, `selectedSlotId`, `partySize`.
- Reservas: `scope` del segmented.

### Notas

- **`Idempotency-Key` por intento de reserva**, generada en el cliente y conservada durante los reintentos de red del mismo intento (no en un reintento del usuario).
- Los recordatorios de `expo-notifications` se programan al confirmar y se cancelan por `booking.id` al cancelar la reserva.
- El deep link del enlace mágico entra por `expo-router` a `/(tabs)/explore`, no a una pantalla de bienvenida.

## Domain model — por qué esto es un motor y no una app de bibliotecas

La UI **nunca escribe un sustantivo de dominio**. Lee `resourceType.labels`:

```
ResourceType {
  id
  labels { singular, plural, capacityUnit, actionVerb }   // "sala","salas","personas","Apartar"
  slotDurationMinutes                                     // 90
  allowsMultipleSeats                                     // true
  allowsWaitlist                                          // true
}

Resource        { id, typeId, name, locationId, capacity, attributes[], imageUrl }
Location        { id, name, floor, parentId }              // "Biblioteca Central", "Piso 2"
AvailabilitySlot{ id, resourceId, startsAt, endsAt, seatsLeft, rowVersion }
Booking         { id, slotId, userId, seats, state, code, createdAt }
                // state: upcoming | waitlisted | completed | cancelled
WaitlistEntry   { id, slotId, userId, position }
```

Cambiar el tenant a consultorios médicos (`labels: {singular:"consulta", capacityUnit:"pacientes", actionVerb:"Agendar"}`, `slotDurationMinutes: 30`, `allowsMultipleSeats: false`) o a renta de equipo **no toca un solo componente**. El `Stepper` de personas simplemente no se monta cuando `allowsMultipleSeats` es falso; la fila "Anotarme" no aparece cuando `allowsWaitlist` es falso.

Es la parte del proyecto que hay que poder explicar en una entrevista: **la UI está parametrizada por tipo de recurso, no escrita para un negocio.**

## Cross-platform

- **Solo primitivas de RN**: `flex-row` / `flex-col` y `gap`. Nada de CSS grid, `position: sticky`, pseudo-elementos ni `background-image` con gradientes.
- Los grupos son un `View` con `overflow:hidden` y separadores como `View` de 1 px. Los headers de grupo van **fuera** del grupo.
- Las pastillas de filtro son un `ScrollView horizontal`. El header de Explorar es estático — no hay large-title colapsable (se rompe en Android y en web).
- **Web sin rediseñar**: `max-w-[420px] mx-auto` y el mismo árbol. A partir de 1024 px los grupos se reparten en dos columnas con `flexWrap` + `basis-1/2`. Nada más cambia. La barra de acción inferior del detalle pasa a `position: static` al final del contenido en web.
- Área táctil ≥ 44 en todo lo presionable (`hitSlop` donde el elemento visual es menor).
- Contraste: todos los pares definidos pasan AA. `tint` `#C2571F` sobre blanco = 4.6:1; texto blanco sobre `tint` = 4.6:1.
- `accessibilityLabel` en los slots incluye hora y cupo: "14:00 a 15:30, 4 lugares libres". El ✓ de fila seleccionada usa `accessibilityState={{selected:true}}`, no solo color.

## Assets

Nada propietario. Todo lo visible en los mockups es HTML/CSS.

- **Iconos**: pendientes. Usar el set del proyecto — `expo-symbols` (SF Symbols) en iOS con fallback a `lucide-react-native`. Los cuadrados y círculos neutros de los mockups son placeholders de posición y tamaño.
- **Fotos de recursos**: pendientes de material real. En los mockups son bloques `#EFEFF2`. Aspect ratio 390 × 196 (≈2:1) en el detalle. Usar `expo-image` con `placeholder` blurhash.
- **Tipografía**: ninguna que descargar — familia del sistema en las tres plataformas.
- **Marca**: el cuadrado `#C2571F` con radius 16 es un placeholder de logo.

## Files

| Archivo | Qué es |
|---|---|
| `Cupo - Flujo de Usuario v2.dc.html` | **La referencia canónica.** Sistema de diseño + 7 pantallas + variante oscura + fichas de componentes + notas de movimiento. Implementar contra este. |
| `Motor de Reservas - Flujo de Usuario.dc.html` | Primera exploración (v1), con más ornamento y densidad. Se conserva como contexto de por qué el v2 es como es. **No implementar.** |

Ambos abren en cualquier navegador.

## Orden de implementación sugerido

1. `tailwind.config.js` con todos los tokens de este README, en ambos temas.
2. `Group` + `Row` + `Button`. Con estas tres piezas ya se puede montar el 70 % del producto.
3. ExploreScreen con datos mock, incluyendo la interacción de apartar en un tap. **Es la pantalla que vende el proyecto** — que quede bien antes de seguir.
4. Detalle → confirmación, con la microinteracción del checkmark.
5. Reservas, con la cancelación optimista y el toast de deshacer.
6. Los estados: skeleton, `Placeholder`, `ConflictSheet`. No dejarlos para el final: son la mitad de la percepción de calidad.
7. Modo oscuro (debería ser casi gratis si el paso 1 se hizo bien).
