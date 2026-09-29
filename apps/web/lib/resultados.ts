import { and, eq, inArray, sql } from "drizzle-orm";
import { db, participantesReserva, reservas, usuarios } from "@cancha-llena/db";
import { esUuid } from "@/lib/validacion";

// Fase 2 del roadmap (retención): ranking ELO por deporte. Autoreportado por
// cualquier participante, sin verificación del rival (piloto chico, la
// confianza no es un problema todavía) — una vez reportado queda fijo, no
// se permite corregir. usuarios.nivelPorDeporte (jsonb, { futbolito: 1000,
// ... }) ya existía como placeholder desde el modelo de datos original.

const NIVEL_INICIAL = 1000;
const K_FACTOR = 32;

function nivelDe(nivelPorDeporte: unknown, deporte: string): number {
  if (nivelPorDeporte && typeof nivelPorDeporte === "object") {
    const v = (nivelPorDeporte as Record<string, unknown>)[deporte];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return NIVEL_INICIAL;
}

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

// Para armar el formulario de "reportar resultado" — participantes con
// cuenta (los invitados sin cuenta no tienen nivel que actualizar, así que
// no entran a la asignación de equipos).
export async function obtenerReservaParaReportar(usuarioId: string, reservaId: string): Promise<ReservaParaReportar | null> {
  if (!esUuid(reservaId)) return null;

  const reserva = await db.query.reservas.findFirst({
    where: { id: reservaId },
    with: {
      cancha: { with: { complejo: true } },
      participantes: { with: { usuario: { columns: { id: true, nombre: true } } } },
    },
  });
  if (!reserva || !reserva.cancha || !reserva.cancha.complejo) return null;

  const esParticipante = reserva.usuarioId === usuarioId || reserva.participantes.some((p) => p.usuarioId === usuarioId);
  if (!esParticipante) return null;

  const participantes = reserva.participantes
    .filter((p): p is typeof p & { usuario: { id: string; nombre: string } } => !!p.usuario)
    .map((p) => ({ usuarioId: p.usuario.id, nombre: p.usuario.nombre }));

  return {
    id: reserva.id,
    fecha: reserva.fecha,
    horaInicio: reserva.horaInicio,
    cancha: { nombre: reserva.cancha.nombre, deporte: reserva.cancha.deporte },
    complejo: { nombre: reserva.cancha.complejo.nombre, slug: reserva.cancha.complejo.slug },
    participantes,
    yaReportado: !!reserva.resultadoReportadoEn,
  };
}

export type ReportarResultadoResult =
  | { ok: true }
  | { ok: false; error: "no_encontrada" | "sin_permiso" | "partido_no_jugado" | "ya_reportado" | "datos_invalidos" };

export async function reportarResultado(
  usuarioId: string,
  reservaId: string,
  equipoGanador: "A" | "B" | "empate",
  asignaciones: { usuarioId: string; equipo: "A" | "B" }[],
): Promise<ReportarResultadoResult> {
  if (!esUuid(reservaId)) return { ok: false, error: "no_encontrada" };

  const reserva = await db.query.reservas.findFirst({
    where: { id: reservaId },
    with: { cancha: true, participantes: true },
  });
  if (!reserva || !reserva.cancha) return { ok: false, error: "no_encontrada" };

  const esParticipante = reserva.usuarioId === usuarioId || reserva.participantes.some((p) => p.usuarioId === usuarioId);
  if (!esParticipante) return { ok: false, error: "sin_permiso" };

  if (reserva.resultadoReportadoEn) return { ok: false, error: "ya_reportado" };

  const hoyISO = new Date().toISOString().slice(0, 10);
  if (reserva.estado === "cancelada" || reserva.fecha > hoyISO) return { ok: false, error: "partido_no_jugado" };

  // Cada participante CON cuenta (invitados sin cuenta no tienen nivel que
  // actualizar y no entran acá) debe aparecer exactamente una vez, y cada
  // equipo necesita al menos un jugador para que el promedio tenga sentido.
  const idsEsperados = new Set(reserva.participantes.filter((p) => p.usuarioId).map((p) => p.usuarioId as string));
  const idsAsignados = asignaciones.map((a) => a.usuarioId);
  const equipoA = asignaciones.filter((a) => a.equipo === "A").map((a) => a.usuarioId);
  const equipoB = asignaciones.filter((a) => a.equipo === "B").map((a) => a.usuarioId);
  const sinDuplicados = new Set(idsAsignados).size === idsAsignados.length;
  const asignacionValida =
    idsAsignados.length === idsEsperados.size && idsAsignados.every((id) => idsEsperados.has(id)) && sinDuplicados && equipoA.length > 0 && equipoB.length > 0;
  if (!asignacionValida) return { ok: false, error: "datos_invalidos" };

  const deporte = reserva.cancha.deporte;
  const [jugadoresA, jugadoresB] = await Promise.all([
    db.query.usuarios.findMany({ where: { id: { in: equipoA } }, columns: { id: true, nivelPorDeporte: true } }),
    db.query.usuarios.findMany({ where: { id: { in: equipoB } }, columns: { id: true, nivelPorDeporte: true } }),
  ]);

  const ratingA = jugadoresA.reduce((acc, u) => acc + nivelDe(u.nivelPorDeporte, deporte), 0) / jugadoresA.length;
  const ratingB = jugadoresB.reduce((acc, u) => acc + nivelDe(u.nivelPorDeporte, deporte), 0) / jugadoresB.length;

  const esperadoA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const realA = equipoGanador === "A" ? 1 : equipoGanador === "B" ? 0 : 0.5;
  const deltaA = Math.round(K_FACTOR * (realA - esperadoA));

  // El delta se aplica con aritmética hecha en el UPDATE mismo (no
  // "leer rating actual en JS, sumar, escribir el total") — igual que el
  // cupoOcupado de ligas: dos resultados reportados casi al mismo tiempo que
  // tocan al mismo jugador no se pueden pisar entre sí.
  await aplicarDeltaNivel(equipoA, deporte, deltaA);
  await aplicarDeltaNivel(equipoB, deporte, -deltaA);

  for (const a of asignaciones) {
    await db
      .update(participantesReserva)
      .set({ equipo: a.equipo })
      .where(and(eq(participantesReserva.reservaId, reservaId), eq(participantesReserva.usuarioId, a.usuarioId)));
  }

  await db.update(reservas).set({ equipoGanador, resultadoReportadoPorId: usuarioId, resultadoReportadoEn: new Date() }).where(eq(reservas.id, reservaId));

  return { ok: true };
}

export type NivelJugador = { deporte: string; nivel: number };

// Para mostrar "tu nivel" en Perfil — solo devuelve deportes en los que el
// jugador ya jugó (nivelPorDeporte arranca en {} vacío, así que no hay nada
// que inventar para deportes que nunca tocó).
export function nivelesDeJugador(nivelPorDeporte: unknown): NivelJugador[] {
  if (!nivelPorDeporte || typeof nivelPorDeporte !== "object") return [];
  return Object.entries(nivelPorDeporte as Record<string, unknown>)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
    .map(([deporte, nivel]) => ({ deporte, nivel }));
}

async function aplicarDeltaNivel(usuarioIds: string[], deporte: string, delta: number): Promise<void> {
  if (usuarioIds.length === 0) return;
  await db
    .update(usuarios)
    .set({
      nivelPorDeporte: sql`jsonb_set(${usuarios.nivelPorDeporte}, ARRAY[${deporte}]::text[], to_jsonb(COALESCE((${usuarios.nivelPorDeporte}->>${deporte})::numeric, ${NIVEL_INICIAL}) + ${delta}))`,
    })
    .where(inArray(usuarios.id, usuarioIds));
}
