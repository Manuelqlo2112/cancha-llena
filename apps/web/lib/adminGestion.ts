import { eq } from "drizzle-orm";
import { canchas, complejos, db } from "@cancha-llena/db";
import { puedeAdministrar } from "@/lib/permisos";
import type { getSessionUser } from "@/lib/session";

// A propósito, `comisionBasePct` / `comisionVallePct` / `feeMensualFijo` NO
// son editables acá: son el modelo de negocio de la plataforma (Sección 04
// del doc de producto), no algo que cada complejo deba poder tocarse solo.
// Lo que sí controla el complejo: sus datos de contacto/horario, si exige
// abono online y qué % (dato real: Miraflores 50%, Buenaventura 0%), y el
// precio/estado de sus propias canchas.

type Sesion = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export type ActualizarResult = { ok: true } | { ok: false; error: "sin_permiso" | "no_encontrada" };

export async function actualizarComplejo(
  usuario: Sesion | null,
  complejoId: string,
  datos: {
    telefono?: string;
    email?: string;
    horarioTexto?: string;
    amenidades: string[];
    requiereAbono: boolean;
    porcentajeAbono: number;
  },
): Promise<ActualizarResult> {
  if (!puedeAdministrar(usuario, complejoId)) return { ok: false, error: "sin_permiso" };

  await db
    .update(complejos)
    .set({
      telefono: datos.telefono || null,
      email: datos.email || null,
      horarioTexto: datos.horarioTexto || null,
      amenidades: datos.amenidades,
      requiereAbono: datos.requiereAbono,
      porcentajeAbono: String(datos.requiereAbono ? datos.porcentajeAbono : 0),
    })
    .where(eq(complejos.id, complejoId));

  return { ok: true };
}

export type ImpactoGamificacion = {
  solicitudesAbiertas: number;
  solicitudesTotales: number;
  cuposViaSolicitud: number;
  jugadoresConRachaActiva: number;
};

// El argumento comercial de la Sección 04 del doc de producto es "te
// cobramos sobre demanda que medimos, no sobre toda tu operación" — esto es
// lo que hace esa medición real en vez de una promesa.
export async function obtenerImpactoGamificacion(complejoId: string): Promise<ImpactoGamificacion> {
  const canchasDelComplejo = await db.query.canchas.findMany({ where: { complejoId }, columns: { id: true } });
  const canchaIds = canchasDelComplejo.map((c) => c.id);
  if (canchaIds.length === 0) {
    return { solicitudesAbiertas: 0, solicitudesTotales: 0, cuposViaSolicitud: 0, jugadoresConRachaActiva: 0 };
  }

  const reservasDelComplejo = await db.query.reservas.findMany({
    where: { canchaId: { in: canchaIds } },
    columns: { id: true },
    with: {
      solicitudRival: { columns: { estado: true } },
      participantes: { columns: { viaSolicitudRival: true } },
    },
  });

  let solicitudesAbiertas = 0;
  let solicitudesTotales = 0;
  let cuposViaSolicitud = 0;
  for (const r of reservasDelComplejo) {
    solicitudesTotales += r.solicitudRival.length;
    solicitudesAbiertas += r.solicitudRival.filter((s) => s.estado === "abierta").length;
    cuposViaSolicitud += r.participantes.filter((p) => p.viaSolicitudRival).length;
  }

  const rachasDelComplejo = await db.query.rachas.findMany({
    where: { complejoId },
    columns: { contadorActual: true, ultimaFechaValida: true },
  });
  const hoy = new Date();
  const jugadoresConRachaActiva = rachasDelComplejo.filter((r) => {
    if (r.contadorActual <= 0 || !r.ultimaFechaValida) return false;
    const dias = Math.round((hoy.getTime() - new Date(`${r.ultimaFechaValida}T00:00:00`).getTime()) / 86_400_000);
    return dias <= 8;
  }).length;

  return { solicitudesAbiertas, solicitudesTotales, cuposViaSolicitud, jugadoresConRachaActiva };
}

export async function actualizarCancha(
  usuario: Sesion | null,
  canchaId: string,
  datos: { precioBase: number; activo: boolean },
): Promise<ActualizarResult> {
  const cancha = await db.query.canchas.findFirst({ where: { id: canchaId } });
  if (!cancha) return { ok: false, error: "no_encontrada" };
  if (!puedeAdministrar(usuario, cancha.complejoId)) return { ok: false, error: "sin_permiso" };

  await db
    .update(canchas)
    .set({ precioBase: String(datos.precioBase), activo: datos.activo })
    .where(eq(canchas.id, canchaId));

  return { ok: true };
}
