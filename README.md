# Cancha Llena

Plataforma de reserva de canchas con gamificación (ver el documento de producto y el
documento técnico para el detalle). Piloto real: **Buenaventura Soccer Fit**
(Quilicura) y **Complejo Deportivo Miraflores** (Renca), solo futbolito. Monorepo pnpm
+ un paquete Expo aparte.

## Estructura

- `apps/web` — Next.js 16 (App Router) + TypeScript + Tailwind. Web pública (explorar
  complejos, reservar, unirse a un partido) y panel de admin de complejo. También
  expone una API JSON en `app/api/**` que consume la app móvil.
- `apps/mobile` — Expo + expo-router. Las mismas pantallas que la web (explorar,
  login/registro real con email+contraseña, detalle de complejo con
  reservar/unirse/mis reservas), hablando con `apps/web` por HTTP. Google/Microsoft
  no están en el móvil todavía (ver más abajo). **Fuera del workspace de pnpm a
  propósito** — ver `pnpm-workspace.yaml` — se instala y corre con `npm` desde
  `apps/mobile`.
- `packages/db` — Esquema Drizzle ORM (dialecto Postgres) + seed con los datos reales
  de los dos complejos piloto (dirección, horario, % de abono) + reservas dummy.
  Corre localmente sobre **PGlite** (Postgres embebido en WASM, sin Docker ni cuenta
  en la nube) para desarrollo; en producción apunta a Supabase con el mismo esquema.

## Primer arranque — web

```bash
pnpm install
pnpm db:push    # crea las tablas en packages/db/pgdata
pnpm db:seed    # inserta el piloto real + reservas dummy
pnpm dev        # http://localhost:3000
```

## Login real (Google / Microsoft / email+contraseña)

`apps/web/.env.local` ya trae un `AUTH_SECRET` generado (no necesita cuenta
externa). Para que los botones de Google y Microsoft funcionen, hace falta
crear las credenciales OAuth vos mismo — no es algo delegable:

1. **Google** — [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
   → crear un OAuth Client ID (tipo "Web application") → redirect URI
   `http://localhost:3000/api/auth/callback/google` → completar
   `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET` en `.env.local`.
2. **Microsoft** — [portal.azure.com](https://portal.azure.com) → Microsoft
   Entra ID → App registrations → New registration → redirect URI
   `http://localhost:3000/api/auth/callback/microsoft-entra-id` →
   completar `AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` / `_ISSUER` en
   `.env.local`.

Plantilla completa en `apps/web/.env.local.example`. Sin esas credenciales los
botones igual se ven y llevan hasta la pantalla real de Google/Microsoft —
ahí fallan con "invalid_client" hasta que las cargues.

El login con email+contraseña ("Crear cuenta" / `/registrarse`) **ya
funciona sin configuración extra**. Para probar rápido sin crear una cuenta
real, `/login/dev` sigue disponible (elegís cualquier jugador ya sembrado).

## Primer arranque — móvil

Con `apps/web` corriendo (la app móvil le pega por HTTP):

```bash
cd apps/mobile
npm install
npm run web       # prueba rápida en el navegador, sin emulador
npm run android    # emulador Android (necesita el SDK — ver Android Studio) o un teléfono con Expo Go
```

En un teléfono físico con Expo Go, la app detecta sola la IP de tu red local (usa el
mismo host que ya te muestra `expo start`); si estás en otra red o algo falla, fijá
`EXPO_PUBLIC_API_URL` a mano en `apps/mobile/.env`.

## Pendiente (no incluido en este scaffold)

- Integración real de pagos (Transbank / Mercado Pago / Stripe) — hoy los pagos son
  filas dummy en la tabla `pagos`, no hay llamadas a ninguna pasarela.
- OAuth real en el móvil (la app sigue usando el picker de desarrollo,
  `/api/dev/login` — necesita expo-auth-session + redirect por esquema propio).
- Migrar de PGlite a Supabase cuando exista el proyecto en la nube (mismo esquema,
  solo cambia el driver de conexión) — necesita que crees la cuenta, no algo que
  pueda hacer por mi cuenta.
- Confirmar tarifas reales con Buenaventura Soccer Fit y Complejo Deportivo
  Miraflores (hoy son precios estimados, ver memoria del proyecto).
