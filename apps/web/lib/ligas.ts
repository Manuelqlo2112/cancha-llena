import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, ligaInscripciones, ligas, participantesReserva, reservas } from "@cancha-llena/db";
import { horaFinDe, SLOTS_VALLE } from "@cancha-llena/db/slots";
import { puedeAdministrar } from "@/lib/permisos";
import { actualizarRacha } from "@/lib/reservas";
import type { getSessionUser } from "@/lib/session";

// Fase 2 del roadmap (retención): a diferencia de "buscar rival" (puntual),
// una liga es un cupo semanal fijo en un horario valle con un grupo de
// jugadores que se anota una sola vez y vuelve cada semana — el hábito es la
// mecánica. Sin cron: la sesión de la semana se materializa on-demand (ver
// asegurarProximaSesion) la primera vez que alguien mira la ficha del complejo.

type Sesion = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

function proximaFechaParaDia(diaSemana: number): string {
  const hoy = new Date();
  const diff = (diaSemana - hoy.getDay() + 7) % 7;
  const fecha = new Date(hoy);
  fecha.setDate(hoy.getDate() + diff);
  return fecha.toISOString().slice(0, 10);
}

export type CrearLigaResult =
  | { ok: true; ligaId: string }
  | { ok: false; error: "sin_permiso" | "datos_invalidos" | "cancha_no_existe" };

export async function crearLiga(
  usuario: Sesion | null,
  complejoId: string,
  datos: { canchaId: string; nombre: string; diaSemana: number; horaInicio: string; cupoMaximo: number },
): Promise<CrearLigaResult> {
  if (!puedeAdministrar(usuario, complejoId)) return { ok: false, error: "sin_permiso" };

  const nombreLimpio = datos.nombre.trim();
  const horaValida = (SLOTS_VALLE as readonly string[]).includes(datos.horaInicio);
  // SLOTS_VALLE solo es horario valle de verdad lun-vie (mismo criterio que
  // esDiaLaboral en packages/db/src/slots.ts) — un fin de semana esos mismos
  // horarios son prime. Sin este chequeo se podía crear una liga de sábado
  // marcada esHorarioValle=true al materializarse, corrompiendo justo la
  // métrica de ocupación valle-vs-prime que sostiene el modelo de comisión
  // incremental.
  const diaValido = Number.isInteger(datos.diaSemana) && datos.diaSemana >= 1 && datos.diaSemana <= 5;
  if (!nombreLimpio || nombreLimpio.length > 100 || !diaValido || !horaValida || !Number.isInteger(datos.cupoMaximo) || datos.cupoMaximo < 1) {
    return { ok: false, error: "datos_invalidos" };
  }

  const cancha = await db.query.canchas.findFirst({ where: { id: datos.canchaId, complejoId } });
  if (!cancha) return { ok: false, error: "cancha_no_existe" };
  if (datos.cupoMaximo > cancha.capacidadJugadores) return { ok: false, error: "datos_invalidos" };

  const [liga] = await db
    .insert(ligas)
    .values({
      complejoId,
      canchaId: datos.canchaId,
      nombre: nombreLimpio,
      diaSemana: datos.diaSemana,
      horaInicio: datos.horaInicio,
      cupoMaximo: datos.cupoMaximo,
    })
    .returning();
  return { ok: true, ligaId: liga!.id };
}

export type LigaConEstado = {
  id: string;
  nombre: string;
  diaSemana: number;
  horaInicio: string;
  cupoMaximo: number;
  cupoOcupado: number;
  cancha: { nombre: string; deporte: string };
  inscrito: boolean;
};

// "Ligas" de un complejo, para la ficha pública — también dispara la
// materialización de la sesión de esta semana para cada una (ver abajo), así
// la reserva real ya existe cuando alguien la mira.
export async function listarLigasDeComplejo(complejoId: string, usuarioId: string | null): Promise<LigaConEstado[]> {
  const filas = await db.query.ligas.findMany({
    where: { complejoId, estado: "activa" },
    with: {
      cancha: { columns: { nombre: true, deporte: true } },
      inscripciones: usuarioId ? { where: { usuarioId, activo: true }, columns: { id: true } } : undefined,
    },
  });

  for (const liga of filas) {
    await asegurarProximaSesion(liga.id);
  }

  return filas.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    diaSemana: l.diaSemana,
    horaInicio: l.horaInicio,
    cupoMaximo: l.cupoMaximo,
    cupoOcupado: l.cupoOcupado,
    cancha: { nombre: l.cancha!.nombre, deporte: l.cancha!.deporte },
    inscrito: usuarioId ? (l.inscripciones?.length ?? 0) > 0 : false,
  }));
}

export type InscribirseLigaResult = { ok: true } | { ok: false; error: "no_encontrada" | "pausada" | "sin_cupo" | "ya_inscrito" };

export async function inscribirseALiga(usuarioId: string, ligaId: string): Promise<InscribirseLigaResult> {
  const existente = await db.query.ligaInscripciones.findFirst({ where: { ligaId, usuarioId } });
  if (existente?.activo) return { ok: false, error: "ya_inscrito" };

  // Decremento/incremento atómico y condicionado — mismo patrón que
  // unirseSolicitud (lib/reservas.ts): dos jugadores anotándose al mismo
  // tiempo con un solo cupo libre no pueden dejar cupoOcupado por encima de
  // cupoMaximo.
  const [actualizada] = await db
    .update(ligas)
    .set({ cupoOcupado: sql`${ligas.cupoOcupado} + 1` })
    .where(and(eq(ligas.id, ligaId), eq(ligas.estado, "activa"), lt(ligas.cupoOcupado, ligas.cupoMaximo)))
    .returning();

  if (!actualizada) {
    const liga = await db.query.ligas.findFirst({ where: { id: ligaId } });
    if (!liga) return { ok: false, error: "no_encontrada" };
    if (liga.estado !== "activa") return { ok: false, error: "pausada" };
    return { ok: false, error: "sin_cupo" };
  }

  await db
    .insert(ligaInscripciones)
    .values({ ligaId, usuarioId, activo: true })
    .onConflictDoUpdate({
      target: [ligaInscripciones.ligaId, ligaInscripciones.usuarioId],
      set: { activo: true, inscritoEn: new Date() },
    });

  return { ok: true };
}

export type SalirLigaResult = { ok: true } | { ok: false; error: "no_inscrito" };

export async function salirDeLiga(usuarioId: string, ligaId: string): Promise<SalirLigaResult> {
  const existente = await db.query.ligaInscripciones.findFirst({ where: { ligaId, usuarioId, activo: true } });
  if (!existente) return { ok: false, error: "no_inscrito" };

  await db.update(ligaInscripciones).set({ activo: false }).where(eq(ligaInscripciones.id, existente.id));
  await db
    .update(ligas)
    .set({ cupoOcupado: sql`${ligas.cupoOcupado} - 1` })
    .where(and(eq(ligas.id, ligaId), gt(ligas.cupoOcupado, 0)));

  return { ok: true };
}

// Idempotente: si la reserva de esta semana ya existe (materializada antes,
// o el slot lo ocupó una reserva normal) no hace nada — en ese segundo caso
// la liga simplemente no juega esa semana particular (edge case raro: alguien
// reservó ese horario a mano antes de que hubiera inscriptos en la liga).
async function asegurarProximaSesion(ligaId: string): Promise<void> {
  const liga = await db.query.ligas.findFirst({ where: { id: ligaId } });
  if (!liga || liga.estado !== "activa") return;

  const inscritos = await db.query.ligaInscripciones.findMany({ where: { ligaId, activo: true } });
  if (inscritos.length === 0) return;

  const fecha = proximaFechaParaDia(liga.diaSemana);
  const yaExiste = await db.query.reservas.findFirst({
    where: { canchaId: liga.canchaId, fecha, horaInicio: liga.horaInicio, estado: { ne: "cancelada" } },
  });
  if (yaExiste) return;

  const cancha = await db.query.canchas.findFirst({ where: { id: liga.canchaId } });
  if (!cancha) return;

  let reserva: typeof reservas.$inferSelect | undefined;
  try {
    [reserva] = await db
      .insert(reservas)
      .values({
        canchaId: liga.canchaId,
        usuarioId: inscritos[0]!.usuarioId,
        fecha,
        horaInicio: liga.horaInicio,
        horaFin: horaFinDe(liga.horaInicio),
        estado: "confirmada",
        esHorarioValle: true,
        montoTotal: String(Number(cancha.precioBase)),
        // Los miembros de una liga ya se comprometieron semana a semana —
        // sin abono online por ahora (a diferencia de una reserva puntual).
        montoAbono: "0",
      })
      .returning();
  } catch (err) {
    // reservas_slot_unico (schema.ts): alguien más materializó/reservó este
    // mismo slot justo antes — no hay nada más que hacer esta semana.
    if (err && typeof err === "object" && "code" in err && err.code === "23505") return;
    throw err;
  }

  await db.insert(participantesReserva).values(inscritos.map((i) => ({ reservaId: reserva!.id, usuarioId: i.usuarioId, confirmado: true })));
  for (const i of inscritos) {
    await actualizarRacha(i.usuarioId, liga.complejoId, fecha);
  }
}
