import Constants from "expo-constants";
import { Platform } from "react-native";

// La API vive en apps/web (Route Handlers bajo /api) — no hay backend aparte.
// En web (expo start --web) alcanza con localhost; en el emulador/teléfono con
// Expo Go hay que pegarle a la IP LAN de la máquina que corre "pnpm dev". Se
// infiere del hostUri que Metro ya usa (misma IP, puerto 3000 en vez de 8081)
// para no tener que hardcodearla ni pedirle a cada dev que la actualice a mano.
function inferApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === "web") return "http://localhost:3000";
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost;
  const host = typeof hostUri === "string" ? hostUri.split(":")[0] : null;
  return host ? `http://${host}:3000` : "http://localhost:3000";
}

export const API_BASE_URL = inferApiBaseUrl();

// Cuando el servidor se reseedea (dev) o a alguien lo borran, la sesión
// guardada en el celular (AsyncStorage) queda apuntando a un usuarioId que
// ya no existe — el servidor responde 401 con un cuerpo tipo
// {ok:false,error}, que NO tiene la forma que espera cada pantalla (p. ej.
// {reservas,rachas}). Antes eso se devolvía igual "como si" fuera la
// respuesta esperada y la pantalla explotaba tratando de leer campos que no
// estaban. Ahora se detecta acá y se avisa a la sesión para que se cierre
// sola — lib/session.tsx registra este handler.
export class SesionInvalidaError extends Error {}
let manejarSesionInvalida: (() => void) | null = null;
export function setSesionInvalidaHandler(fn: (() => void) | null) {
  manejarSesionInvalida = fn;
}

export type Jugador = { id: string; nombre: string; email: string };

export type ComplejoResumen = {
  id: string;
  nombre: string;
  slug: string;
  comuna: string;
  direccion: string;
  telefono: string | null;
  horarioTexto: string | null;
  amenidades: string[];
  requiereAbono: boolean;
  porcentajeAbono: number;
  deportes: string[];
  cantidadCanchas: number;
};

export type Slot = {
  fecha: string;
  hora: string;
  valle: boolean;
  estado: "libre" | string;
  reservaId?: string;
  faltanJugadores?: number | null;
  solicitudId?: string | null;
  yaParticipa?: boolean;
};

export type CanchaDetalle = {
  id: string;
  nombre: string;
  deporte: string;
  precioBase: number;
  slots: Slot[];
};

export type ComplejoDetalle = ComplejoResumen & { canchas: CanchaDetalle[] };

export type MiReserva = {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  esHorarioValle: boolean;
  montoTotal: number;
  montoAbono: number;
  esOrganizador: boolean;
  cancha: { id: string; nombre: string; deporte: string };
  complejo: { slug: string; nombre: string };
  solicitudAbiertaId: string | null;
  puedeBuscarRival: boolean;
};

export type SolicitudAbierta = {
  id: string;
  cuposFaltantes: number;
  nivelMinimo: number | null;
  nivelMaximo: number | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  esHorarioValle: boolean;
  cancha: { nombre: string; deporte: string; capacidadJugadores: number };
  complejo: { nombre: string; slug: string };
  organizadorNombre: string;
  yaParticipa: boolean;
};

export type InvitacionPendiente = {
  id: string;
  distanciaKm: number | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  esHorarioValle: boolean;
  cuposFaltantes: number;
  cancha: { nombre: string; deporte: string };
  complejo: { nombre: string; slug: string };
  organizadorNombre: string;
};

export type MiRacha = {
  complejoNombre: string;
  complejoSlug: string;
  contadorActual: number;
  mejorRacha: number;
  ultimaFechaValida: string | null;
  recompensaDesbloqueada: boolean;
  vigente: boolean;
};

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; usuarioId?: string | null; requiereSesion?: boolean } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.usuarioId ? { "x-user-id": options.usuarioId } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Solo para endpoints cuya respuesta de éxito NO tiene la forma {ok,error}
  // (misReservas, listarInvitaciones): ahí un 401 devuelve un cuerpo con una
  // forma distinta a la esperada, y antes se leía como si fuera válida. Los
  // endpoints de acción (reservar, cancelar, etc.) ya devuelven {ok,error}
  // tanto en éxito como en 401 — esos siguen su camino normal, sin excepción.
  if (options.requiereSesion && res.status === 401) {
    manejarSesionInvalida?.();
    throw new SesionInvalidaError("Tu sesión ya no es válida");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok && !data) throw new Error(`${res.status} ${res.statusText}`);
  return data as T;
}

export const api = {
  // Login real, email + contraseña (mismo backend que "Crear cuenta" en la web).
  login: (email: string, password: string) =>
    request<{ ok: boolean; usuario?: Jugador & { rol: string }; error?: string }>("/api/mobile-auth/login", { method: "POST", body: { email, password } }),
  registrarse: (nombre: string, email: string, password: string) =>
    request<{ ok: boolean; usuario?: Jugador & { rol: string }; error?: string }>("/api/mobile-auth/registro", { method: "POST", body: { nombre, email, password } }),
  // Atajo de desarrollo, sin contraseña — /login/dev.
  listarJugadoresDev: () => request<{ jugadores: Jugador[] }>("/api/dev/login"),
  loginDev: (usuarioId: string) => request<{ ok: boolean; usuario?: Jugador & { rol: string } }>("/api/dev/login", { method: "POST", body: { usuarioId } }),
  listarComplejos: () => request<{ complejos: ComplejoResumen[] }>("/api/complejos"),
  obtenerComplejo: (slug: string, usuarioId: string | null) =>
    request<{ complejo: ComplejoDetalle }>(`/api/complejos/${slug}`, { usuarioId }),
  reservar: (usuarioId: string, canchaId: string, fecha: string, hora: string) =>
    request<{ ok: boolean; reservaId?: string; error?: string }>("/api/reservas", {
      method: "POST",
      usuarioId,
      body: { canchaId, fecha, hora },
    }),
  unirseSolicitud: (usuarioId: string, solicitudId: string) =>
    request<{ ok: boolean; error?: string }>(`/api/solicitudes/${solicitudId}/unirse`, { method: "POST", usuarioId }),
  listarSolicitudes: (usuarioId: string | null) =>
    request<{ solicitudes: SolicitudAbierta[] }>("/api/solicitudes", { usuarioId }),
  misReservas: (usuarioId: string) => request<{ reservas: MiReserva[]; rachas: MiRacha[] }>("/api/reservas/mias", { usuarioId, requiereSesion: true }),
  cancelarReserva: (usuarioId: string, reservaId: string) =>
    request<{ ok: boolean; error?: string }>(`/api/reservas/${reservaId}/cancelar`, { method: "POST", usuarioId }),
  buscarRival: (usuarioId: string, reservaId: string) =>
    request<{ ok: boolean; solicitudId?: string; invitados?: number; error?: string }>(`/api/reservas/${reservaId}/buscar-rival`, { method: "POST", usuarioId }),
  actualizarUbicacion: (usuarioId: string, lat: number, lng: number) =>
    request<{ ok: boolean; error?: string }>("/api/ubicacion", { method: "POST", usuarioId, body: { lat, lng } }),
  listarInvitaciones: (usuarioId: string) => request<{ invitaciones: InvitacionPendiente[] }>("/api/invitaciones", { usuarioId, requiereSesion: true }),
  responderInvitacion: (usuarioId: string, invitacionId: string, respuesta: "aceptada" | "rechazada") =>
    request<{ ok: boolean; unido?: boolean; error?: string }>(`/api/invitaciones/${invitacionId}/responder`, {
      method: "POST",
      usuarioId,
      body: { respuesta },
    }),
};
