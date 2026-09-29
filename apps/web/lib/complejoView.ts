import { db } from "@cancha-llena/db";
import { slotsDelDia } from "@cancha-llena/db/slots";
import { listarLigasDeComplejo } from "@/lib/ligas";
import { tieneDescuentoValle } from "@/lib/reservas";

// Arma la grilla de horarios (libres + ocupados) de un complejo para los
// próximos DIAS_ADELANTE días — usado por la API que consume la app móvil.
// La página web de complejo hace el mismo merge en JSX porque necesita
// formularios/Server Actions ahí mismo; esta versión devuelve datos planos
// pensados para JSON. Duplicado a propósito por ahora — si diverge, unificar
// detrás de una sola función y que la página web la consuma también.
export const DIAS_ADELANTE = 5;

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getComplejoView(slug: string, usuarioId: string | null) {
  const hoy = new Date();
  const dias = Array.from({ length: DIAS_ADELANTE }, (_, i) => addDays(hoy, i));
  const hoyISO = fmtISO(hoy);
  const finISO = fmtISO(dias.at(-1)!);

  const complejo = await db.query.complejos.findFirst({
    where: { slug },
    with: {
      canchas: {
        where: { activo: true },
        // Mismo motivo que en la página web equivalente: sin orderBy
        // explícito Postgres no garantiza el orden entre requests.
        orderBy: { nombre: "asc" },
        with: {
          reservas: {
            where: { fecha: { gte: hoyISO, lte: finISO }, estado: { ne: "cancelada" } },
            with: { solicitudRival: true, participantes: true },
          },
        },
      },
    },
  });
  if (!complejo) return null;

  const ligas = await listarLigasDeComplejo(complejo.id, usuarioId);
  const descuentoActivo = usuarioId ? await tieneDescuentoValle(usuarioId, complejo.id) : false;

  const canchas = complejo.canchas.map((cancha) => {
    const reservaPorSlot = new Map(cancha.reservas.map((r) => [`${r.fecha}|${r.horaInicio.slice(0, 5)}`, r]));

    const slots = dias.flatMap((dia) => {
      const fechaISO = fmtISO(dia);
      return slotsDelDia(dia).map(({ hora, valle }) => {
        const r = reservaPorSlot.get(`${fechaISO}|${hora}`);
        if (!r) {
          return { fecha: fechaISO, hora, valle, estado: "libre" as const };
        }
        const solicitud = r.solicitudRival.find((s) => s.estado === "abierta");
        const yaParticipa = usuarioId
          ? r.usuarioId === usuarioId || r.participantes.some((p) => p.usuarioId === usuarioId)
          : false;
        return {
          fecha: fechaISO,
          hora,
          valle,
          estado: r.estado as string,
          reservaId: r.id,
          faltanJugadores: solicitud && !yaParticipa ? solicitud.cuposFaltantes : null,
          solicitudId: solicitud && !yaParticipa ? solicitud.id : null,
          yaParticipa,
        };
      });
    });

    return {
      id: cancha.id,
      nombre: cancha.nombre,
      deporte: cancha.deporte,
      precioBase: Number(cancha.precioBase),
      slots,
    };
  });

  return {
    id: complejo.id,
    nombre: complejo.nombre,
    slug: complejo.slug,
    comuna: complejo.comuna,
    direccion: complejo.direccion,
    telefono: complejo.telefono,
    horarioTexto: complejo.horarioTexto,
    amenidades: complejo.amenidades,
    requiereAbono: complejo.requiereAbono,
    porcentajeAbono: Number(complejo.porcentajeAbono),
    canchas,
    ligas,
    descuentoActivo,
  };
}
