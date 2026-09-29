import { eq } from "drizzle-orm";
import { canchas, complejos, db } from "@cancha-llena/db";
import { esErrorPostgres } from "@/lib/dbErrors";
import { puedeAdministrar } from "@/lib/permisos";
import type { getSessionUser } from "@/lib/session";

// A propósito, `comisionBasePct` / `comisionVallePct` / `feeMensualFijo` NO
// son editables acá: son el modelo de negocio de la plataforma (Sección 04
// del doc de producto), no algo que cada complejo deba poder tocarse solo.
// Lo que sí controla el complejo: sus datos de contacto/horario, si exige
// abono online y qué % (dato real: Miraflores 50%, Buenaventura 0%), y el
// precio/estado de sus propias canchas.

type Sesion = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export type ActualizarResult = { ok: true } | { ok: false; error: "sin_permiso" | "no_encontrada" | "datos_invalidos" };

// Sin tildes/ñ, en minúsculas, separado por guiones — mismo criterio que
// cualquier slug del resto de la app.
function slugificar(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type CrearComplejoResult = { ok: true; slug: string } | { ok: false; error: "sin_permiso" | "datos_invalidos" };

// Antes de esto, el ÚNICO lugar que insertaba un complejo era el script de
// seed — agregar un tercer complejo real (más allá del piloto) necesitaba
// que un desarrollador corriera algo a mano. Solo super_admin: la comisión
// es el modelo de negocio de la plataforma (mismo motivo que ya impide
// editarla en actualizarComplejo), así que se define acá, al dar de alta.
export async function crearComplejo(
  usuario: Sesion | null,
  datos: {
    nombre: string;
    comuna: string;
    direccion: string;
    telefono?: string;
    email?: string;
    horarioTexto?: string;
    comisionBasePct: number;
    comisionVallePct: number;
    requiereAbono: boolean;
    porcentajeAbono: number;
  },
): Promise<CrearComplejoResult> {
  if (usuario?.rol !== "super_admin") return { ok: false, error: "sin_permiso" };

  const nombreLimpio = datos.nombre.trim();
  const comunaLimpia = datos.comuna.trim();
  const direccionLimpia = datos.direccion.trim();
  const comisionValida = (pct: number) => Number.isFinite(pct) && pct >= 0 && pct <= 100;
  if (
    !nombreLimpio ||
    nombreLimpio.length > 150 ||
    !comunaLimpia ||
    comunaLimpia.length > 100 ||
    !direccionLimpia ||
    direccionLimpia.length > 200 ||
    !comisionValida(datos.comisionBasePct) ||
    !comisionValida(datos.comisionVallePct) ||
    (datos.requiereAbono && (!Number.isFinite(datos.porcentajeAbono) || datos.porcentajeAbono <= 0 || datos.porcentajeAbono > 100))
  ) {
    return { ok: false, error: "datos_invalidos" };
  }

  const slugBase = slugificar(nombreLimpio);
  if (!slugBase) return { ok: false, error: "datos_invalidos" };

  // Si el slug ya existe (dos complejos con nombre parecido), se le suma un
  // sufijo numérico en vez de chocar con el unique constraint sin más. El
  // chequeo previo no es atómico contra otra alta concurrente con el mismo
  // nombre, así que el insert también reintenta si igual choca (23505).
  let slug = slugBase;
  let intento = 1;
  while (await db.query.complejos.findFirst({ where: { slug } })) {
    intento += 1;
    slug = `${slugBase}-${intento}`;
  }

  for (;;) {
    try {
      await db.insert(complejos).values({
        nombre: nombreLimpio,
        slug,
        comuna: comunaLimpia,
        direccion: direccionLimpia,
        telefono: datos.telefono?.trim() || null,
        email: datos.email?.trim() || null,
        horarioTexto: datos.horarioTexto?.trim() || null,
        comisionBasePct: String(datos.comisionBasePct),
        comisionVallePct: String(datos.comisionVallePct),
        requiereAbono: datos.requiereAbono,
        porcentajeAbono: String(datos.requiereAbono ? datos.porcentajeAbono : 0),
      });
      return { ok: true, slug };
    } catch (err) {
      if (esErrorPostgres(err, "23505")) {
        intento += 1;
        slug = `${slugBase}-${intento}`;
        continue;
      }
      throw err;
    }
  }
}

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
  // El form manda un <input type="number"> sin min/max — el navegador ayuda,
  // pero un Server Action se puede invocar sin pasar por ese input para
  // nada, así que el rango real se exige acá, no solo en el HTML.
  if (datos.requiereAbono && (!Number.isFinite(datos.porcentajeAbono) || datos.porcentajeAbono <= 0 || datos.porcentajeAbono > 100)) {
    return { ok: false, error: "datos_invalidos" };
  }

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
  if (!Number.isFinite(datos.precioBase) || datos.precioBase <= 0) return { ok: false, error: "datos_invalidos" };

  await db
    .update(canchas)
    .set({ precioBase: String(datos.precioBase), activo: datos.activo })
    .where(eq(canchas.id, canchaId));

  return { ok: true };
}

const DEPORTES_VALIDOS = ["futbolito", "futbol", "padel", "tenis"] as const;
type DeporteValido = (typeof DEPORTES_VALIDOS)[number];

export type CrearCanchaResult = { ok: true } | { ok: false; error: "sin_permiso" | "no_encontrada" | "datos_invalidos" };

// Mismo hueco que crearComplejo: agregar una cancha a un complejo ya
// existente (piloto o nuevo) tampoco tenía ninguna pantalla, solo el seed.
export async function crearCancha(
  usuario: Sesion | null,
  complejoId: string,
  datos: { nombre: string; deporte: string; capacidadJugadores: number; precioBase: number },
): Promise<CrearCanchaResult> {
  if (!puedeAdministrar(usuario, complejoId)) return { ok: false, error: "sin_permiso" };

  const complejo = await db.query.complejos.findFirst({ where: { id: complejoId } });
  if (!complejo) return { ok: false, error: "no_encontrada" };

  const nombreLimpio = datos.nombre.trim();
  if (
    !nombreLimpio ||
    nombreLimpio.length > 100 ||
    !DEPORTES_VALIDOS.includes(datos.deporte as DeporteValido) ||
    !Number.isInteger(datos.capacidadJugadores) ||
    datos.capacidadJugadores < 2 ||
    datos.capacidadJugadores > 30 ||
    !Number.isFinite(datos.precioBase) ||
    datos.precioBase <= 0
  ) {
    return { ok: false, error: "datos_invalidos" };
  }

  await db.insert(canchas).values({
    complejoId,
    deporte: datos.deporte as DeporteValido,
    nombre: nombreLimpio,
    capacidadJugadores: datos.capacidadJugadores,
    precioBase: String(datos.precioBase),
    activo: true,
  });

  return { ok: true };
}
