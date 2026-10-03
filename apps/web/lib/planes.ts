import { and, eq, sql } from "drizzle-orm";
import { db, planesMensuales, suscripcionesMensuales } from "@cancha-llena/db";
import { esDiaLaboral, SLOTS_PRIME } from "@cancha-llena/db/slots";
import { puedeAdministrar } from "@/lib/permisos";
import { esUuid } from "@/lib/validacion";
import type { getSessionUser } from "@/lib/session";

// Idea de Manuel (lidera pricing con modelos predictivos en seguros de
// auto): un bono mensual de cupos reutilizables, más barato que reservar
// cada vez suelto. Cubre a propósito solo el "horario normal entre semana"
// (SLOTS_PRIME en un día laboral) — ni horario valle (ya tiene su propio
// descuento por racha) ni fin de semana (el esquema todavía no guarda un
// precio de fin de semana distinto — gap conocido, no de este cambio).

type Sesion = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export type CrearPlanResult = { ok: true; planId: string } | { ok: false; error: "sin_permiso" | "datos_invalidos" };

export async function crearPlan(
  usuario: Sesion | null,
  complejoId: string,
  datos: { deporte: string; nombre: string; cuposPorMes: number; precioMensual: number },
): Promise<CrearPlanResult> {
  if (!puedeAdministrar(usuario, complejoId)) return { ok: false, error: "sin_permiso" };

  const nombreLimpio = datos.nombre.trim();
  const deportesValidos = ["futbolito", "futbol", "padel", "tenis"];
  if (
    !nombreLimpio ||
    nombreLimpio.length > 100 ||
    !deportesValidos.includes(datos.deporte) ||
    !Number.isInteger(datos.cuposPorMes) ||
    datos.cuposPorMes < 1 ||
    datos.cuposPorMes > 31 ||
    !Number.isFinite(datos.precioMensual) ||
    datos.precioMensual <= 0
  ) {
    return { ok: false, error: "datos_invalidos" };
  }

  const [plan] = await db
    .insert(planesMensuales)
    .values({
      complejoId,
      deporte: datos.deporte as "futbolito" | "futbol" | "padel" | "tenis",
      nombre: nombreLimpio,
      cuposPorMes: datos.cuposPorMes,
      precioMensual: String(datos.precioMensual),
    })
    .returning();

  return { ok: true, planId: plan!.id };
}

export type PlanConEstado = {
  id: string;
  nombre: string;
  deporte: string;
  cuposPorMes: number;
  precioMensual: number;
  suscrito: boolean;
  cuposUsadosMes: number;
};

const mesActualISO = () => new Date().toISOString().slice(0, 7);

// Para la ficha pública del complejo — incluye cuántos cupos ya usó ESTE
// mes quien está mirando, si está suscrito (sin el reset lazy de
// consumirCupoSiAplica: mostrar 0 cuando el mes guardado quedó viejo es
// más simple que forzar el reset solo para leer).
export async function listarPlanesDeComplejo(complejoId: string, usuarioId: string | null): Promise<PlanConEstado[]> {
  const planes = await db.query.planesMensuales.findMany({
    where: { complejoId, activo: true },
    with: {
      suscripciones: usuarioId ? { where: { usuarioId, estado: "activa" } } : undefined,
    },
  });

  const mes = mesActualISO();
  return planes.map((p) => {
    const suscripcion = p.suscripciones?.[0];
    return {
      id: p.id,
      nombre: p.nombre,
      deporte: p.deporte,
      cuposPorMes: p.cuposPorMes,
      precioMensual: Number(p.precioMensual),
      suscrito: !!suscripcion,
      cuposUsadosMes: suscripcion && suscripcion.mesVigente === mes ? suscripcion.cuposUsadosMes : 0,
    };
  });
}

export type SuscribirseResult = { ok: true } | { ok: false; error: "no_encontrada" | "ya_suscrito" };

// Nada de pasarela de pago real todavía (igual que el abono simulado de
// crearReserva) — suscribirse acá es lo mismo que "el complejo ya cobró
// esto por afuera y confía en que el jugador avisó". Mismo patrón
// exactly-once que inscribirseALiga: el ON CONFLICT con setWhere es lo que
// evita que dos clicks del mismo usuario reactiven la fila dos veces.
export async function suscribirse(usuarioId: string, planId: string): Promise<SuscribirseResult> {
  if (!esUuid(planId)) return { ok: false, error: "no_encontrada" };
  const plan = await db.query.planesMensuales.findFirst({ where: { id: planId, activo: true } });
  if (!plan) return { ok: false, error: "no_encontrada" };

  const [activada] = await db
    .insert(suscripcionesMensuales)
    .values({ planId, usuarioId, estado: "activa", mesVigente: mesActualISO(), cuposUsadosMes: 0 })
    .onConflictDoUpdate({
      target: [suscripcionesMensuales.planId, suscripcionesMensuales.usuarioId],
      set: { estado: "activa", mesVigente: mesActualISO(), cuposUsadosMes: 0 },
      setWhere: eq(suscripcionesMensuales.estado, "cancelada"),
    })
    .returning();

  if (!activada) return { ok: false, error: "ya_suscrito" };
  return { ok: true };
}

export type CancelarSuscripcionResult = { ok: true } | { ok: false; error: "no_suscrito" };

export async function cancelarSuscripcion(usuarioId: string, planId: string): Promise<CancelarSuscripcionResult> {
  if (!esUuid(planId)) return { ok: false, error: "no_suscrito" };

  const [cancelada] = await db
    .update(suscripcionesMensuales)
    .set({ estado: "cancelada" })
    .where(and(eq(suscripcionesMensuales.planId, planId), eq(suscripcionesMensuales.usuarioId, usuarioId), eq(suscripcionesMensuales.estado, "activa")))
    .returning();

  if (!cancelada) return { ok: false, error: "no_suscrito" };
  return { ok: true };
}

// Llamado desde crearReserva: si el usuario tiene un plan activo para este
// complejo+deporte y el slot es horario normal entre semana, consume un
// cupo de forma atómica (CASE para el reset lazy de mes + guarda de cupo
// disponible en el mismo UPDATE — mismo candado que cupoOcupado en ligas)
// y devuelve si se aplicó. cuposPorMes se lee antes y se pasa como
// parámetro: si un admin edita el plan justo en el medio, en el peor caso
// se desvía por un cupo — no vale la pena una sub-consulta correlacionada
// para cerrar una ventana tan chica.
export async function consumirCupoSiAplica(
  usuarioId: string,
  complejoId: string,
  deporte: "futbolito" | "futbol" | "padel" | "tenis",
  fecha: string,
  hora: string,
): Promise<boolean> {
  const esNormalEntreSemana = (SLOTS_PRIME as readonly string[]).includes(hora) && esDiaLaboral(new Date(`${fecha}T00:00:00`));
  if (!esNormalEntreSemana) return false;

  const plan = await db.query.planesMensuales.findFirst({ where: { complejoId, deporte, activo: true } });
  if (!plan) return false;

  const mes = fecha.slice(0, 7);
  const [consumida] = await db
    .update(suscripcionesMensuales)
    .set({
      cuposUsadosMes: sql`case when ${suscripcionesMensuales.mesVigente} = ${mes} then ${suscripcionesMensuales.cuposUsadosMes} + 1 else 1 end`,
      mesVigente: mes,
    })
    .where(
      and(
        eq(suscripcionesMensuales.planId, plan.id),
        eq(suscripcionesMensuales.usuarioId, usuarioId),
        eq(suscripcionesMensuales.estado, "activa"),
        sql`(${suscripcionesMensuales.mesVigente} <> ${mes} or ${suscripcionesMensuales.cuposUsadosMes} < ${plan.cuposPorMes})`,
      ),
    )
    .returning();

  return !!consumida;
}
