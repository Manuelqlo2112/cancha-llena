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

// Cuando el servidor se reseedea (dev), la sesión guardada en el celular
// (AsyncStorage) queda apuntando a un token que ya no existe — el servidor
// responde 401 con un cuerpo tipo {ok:false,error}, que NO tiene la forma
// que espera cada pantalla (p. ej. {reservas,rachas}). Antes eso se
// devolvía igual "como si" fuera la respuesta esperada y la pantalla
// explotaba tratando de leer campos que no estaban. Ahora se detecta acá y
// se avisa a la sesión para que se cierre sola — lib/session.tsx registra
// este handler.
export class SesionInvalidaError extends Error {}
let manejarSesionInvalida: (() => void) | null = null;
export function setSesionInvalidaHandler(fn: (() => void) | null) {
  manejarSesionInvalida = fn;
}

// Lleva el status HTTP para que la pantalla pueda distinguir "no existe"
// (404 — reintentar no sirve de nada) de una falla de red real (sí vale la
// pena reintentar).
export class RequestError extends Error {
  status: number;
  constructor(status: number, statusText: string) {
    super(`${status} ${statusText}`);
    this.status = status;
  }
}

// Token de sesión móvil (ver apps/web/lib/sesionesMovil.ts) — reemplaza el
// diseño anterior, donde el celular mandaba su propio usuarioId en un header
// y el servidor confiaba a ciegas (cualquiera que supiera el UUID de otro
// usuario podía actuar como él). lib/session.tsx llama a esto al loguearse
// y al cerrar sesión; el resto de este archivo nunca vuelve a tocarlo.
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
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

export type Liga = {
  id: string;
  nombre: string;
  diaSemana: number;
  horaInicio: string;
  cupoMaximo: number;
  cupoOcupado: number;
  cancha: { nombre: string; deporte: string };
  inscrito: boolean;
};

export type ComplejoDetalle = ComplejoResumen & { canchas: CanchaDetalle[]; ligas: Liga[]; descuentoActivo: boolean };

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
  puedeReportarResultado: boolean;
};

export type ParticipanteParaReportar = { usuarioId: string; nombre: string };

export type ReservaParaReportar = {
  id: string;
  fecha: string;
  horaInicio: string;
  cancha: { nombre: string; deporte: string };
  complejo: { nombre: string; slug: string };
  participantes: ParticipanteParaReportar[];
  yaReportado: boolean;
};

export type NivelJugador = { deporte: string; nivel: number };

export type RivalHistorial = { rivalId: string; rivalNombre: string; victorias: number; derrotas: number; empates: number };

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

// Endpoints cuya respuesta de éxito tiene SIEMPRE la misma forma fija (p. ej.
// {complejo}, {reservas,rachas}) — a diferencia de los de acción
// (reservar, cancelar, etc.) que devuelven {ok,error} tanto en éxito como en
// error, y cuyos llamadores ya chequean `r.ok` a mano. Para estos, CUALQUIER
// respuesta no-ok tiene una forma distinta a la esperada — antes eso se leía
// como si fuera válida (p. ej. `complejo` quedaba `undefined` en vez de
// avisar del error) y la pantalla se quedaba esperando datos que nunca iban
// a llegar.
type RequestOptions = { method?: string; body?: unknown; requiereSesion?: boolean; formaFija?: boolean };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (options.requiereSesion && res.status === 401) {
    manejarSesionInvalida?.();
    throw new SesionInvalidaError("Tu sesión ya no es válida");
  }
  if (options.formaFija && !res.ok) throw new RequestError(res.status, res.statusText);

  const data = await res.json().catch(() => null);
  if (!res.ok && !data) throw new RequestError(res.status, res.statusText);
  return data as T;
}

export const api = {
  // Login real, email + contraseña (mismo backend que "Crear cuenta" en la web).
  login: (email: string, password: string) =>
    request<{ ok: boolean; token?: string; usuario?: Jugador & { rol: string }; error?: string }>("/api/mobile-auth/login", {
      method: "POST",
      body: { email, password },
    }),
  registrarse: (nombre: string, email: string, password: string) =>
    request<{ ok: boolean; token?: string; usuario?: Jugador & { rol: string }; error?: string }>("/api/mobile-auth/registro", {
      method: "POST",
      body: { nombre, email, password },
    }),
  logout: () => request<{ ok: boolean }>("/api/mobile-auth/logout", { method: "POST" }),
  // Atajo de desarrollo, sin contraseña — /login/dev.
  listarJugadoresDev: () => request<{ jugadores: Jugador[] }>("/api/dev/login", { formaFija: true }),
  loginDev: (usuarioId: string) =>
    request<{ ok: boolean; token?: string; usuario?: Jugador & { rol: string } }>("/api/dev/login", { method: "POST", body: { usuarioId } }),
  listarComplejos: () => request<{ complejos: ComplejoResumen[] }>("/api/complejos", { formaFija: true }),
  obtenerComplejo: (slug: string) => request<{ complejo: ComplejoDetalle }>(`/api/complejos/${slug}`, { formaFija: true }),
  reservar: (canchaId: string, fecha: string, hora: string) =>
    request<{ ok: boolean; reservaId?: string; descuentoAplicado?: boolean; error?: string }>("/api/reservas", { method: "POST", body: { canchaId, fecha, hora } }),
  unirseSolicitud: (solicitudId: string) =>
    request<{ ok: boolean; error?: string }>(`/api/solicitudes/${solicitudId}/unirse`, { method: "POST" }),
  listarSolicitudes: () => request<{ solicitudes: SolicitudAbierta[] }>("/api/solicitudes", { formaFija: true }),
  misReservas: () =>
    request<{ reservas: MiReserva[]; rachas: MiRacha[]; niveles: NivelJugador[]; rivales: RivalHistorial[] }>("/api/reservas/mias", {
      requiereSesion: true,
      formaFija: true,
    }),
  cancelarReserva: (reservaId: string) => request<{ ok: boolean; error?: string }>(`/api/reservas/${reservaId}/cancelar`, { method: "POST" }),
  buscarRival: (reservaId: string) =>
    request<{ ok: boolean; solicitudId?: string; invitados?: number; error?: string }>(`/api/reservas/${reservaId}/buscar-rival`, { method: "POST" }),
  actualizarUbicacion: (lat: number, lng: number) => request<{ ok: boolean; error?: string }>("/api/ubicacion", { method: "POST", body: { lat, lng } }),
  listarInvitaciones: () => request<{ invitaciones: InvitacionPendiente[] }>("/api/invitaciones", { requiereSesion: true, formaFija: true }),
  responderInvitacion: (invitacionId: string, respuesta: "aceptada" | "rechazada") =>
    request<{ ok: boolean; unido?: boolean; error?: string }>(`/api/invitaciones/${invitacionId}/responder`, { method: "POST", body: { respuesta } }),
  inscribirseALiga: (ligaId: string) => request<{ ok: boolean; error?: string }>(`/api/ligas/${ligaId}/inscribirse`, { method: "POST" }),
  salirDeLiga: (ligaId: string) => request<{ ok: boolean; error?: string }>(`/api/ligas/${ligaId}/salir`, { method: "POST" }),
  obtenerParticipantesReserva: (reservaId: string) => request<{ reserva: ReservaParaReportar }>(`/api/reservas/${reservaId}/participantes`, { formaFija: true }),
  reportarResultado: (reservaId: string, equipoGanador: "A" | "B" | "empate", asignaciones: { usuarioId: string; equipo: "A" | "B" }[]) =>
    request<{ ok: boolean; error?: string }>(`/api/reservas/${reservaId}/resultado`, { method: "POST", body: { equipoGanador, asignaciones } }),
};
