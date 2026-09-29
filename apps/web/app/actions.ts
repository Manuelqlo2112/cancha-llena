"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actualizarUbicacion, cancelarReserva, crearReserva, crearSolicitudRival, responderInvitacion, unirseSolicitud } from "@/lib/reservas";
import { inscribirseALiga, salirDeLiga } from "@/lib/ligas";
import { obtenerReservaParaReportar, reportarResultado } from "@/lib/resultados";
import { getSessionUser } from "@/lib/session";

export async function reservarCancha(formData: FormData) {
  const canchaId = String(formData.get("canchaId") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");

  const session = await getSessionUser();
  if (!session) redirect(`/login?next=/complejos/${returnTo}`);

  const resultado = await crearReserva(session.id, canchaId, fecha, hora);
  if (!resultado.ok) redirect(`/complejos/${returnTo}?error=${resultado.error}`);

  revalidatePath(`/complejos/${returnTo}`);
  revalidatePath(`/admin/${returnTo}`);
  // Se manda el id de la reserva (no solo "1") para poder ofrecer, ahí mismo,
  // "¿te faltan jugadores?" con esa reserva puntual.
  redirect(`/complejos/${returnTo}?reservado=${resultado.reservaId}`);
}

export async function unirseComoRival(formData: FormData) {
  const solicitudId = String(formData.get("solicitudId") ?? "");
  // "partidos" (o vacío) significa: viene de la pantalla /partidos, no de un
  // complejo puntual — se vuelve ahí en vez de a /complejos/[slug].
  const returnTo = String(formData.get("returnTo") ?? "");
  const destinoBase = returnTo && returnTo !== "partidos" ? `/complejos/${returnTo}` : "/partidos";

  const session = await getSessionUser();
  if (!session) redirect(`/login?next=${destinoBase}`);

  const resultado = await unirseSolicitud(session.id, solicitudId);
  if (!resultado.ok) redirect(`${destinoBase}?error=${resultado.error}`);

  revalidatePath(destinoBase);
  redirect(`${destinoBase}?unido=1`);
}

export async function cancelarReservaAction(formData: FormData) {
  const reservaId = String(formData.get("reservaId") ?? "");

  const session = await getSessionUser();
  if (!session) redirect("/login?next=/mis-reservas");

  const resultado = await cancelarReserva(session.id, reservaId);

  revalidatePath("/mis-reservas");
  redirect(resultado.ok ? "/mis-reservas?cancelado=1" : `/mis-reservas?error=${resultado.error}`);
}

export async function buscarRivalAction(formData: FormData) {
  const reservaId = String(formData.get("reservaId") ?? "");
  // Cuando viene desde el prompt post-reserva en /complejos/[slug], queremos
  // volver ahí (no a /mis-reservas) para que el flujo se sienta continuo.
  const returnTo = formData.get("returnTo") ? String(formData.get("returnTo")) : null;
  const destinoOk = returnTo ? `/complejos/${returnTo}?solicitud=1` : "/mis-reservas?solicitud=1";
  const destinoBase = returnTo ? `/complejos/${returnTo}` : "/mis-reservas";

  const session = await getSessionUser();
  if (!session) redirect(`/login?next=${destinoBase}`);

  const resultado = await crearSolicitudRival(session.id, reservaId);

  revalidatePath("/mis-reservas");
  if (returnTo) revalidatePath(`/complejos/${returnTo}`);
  redirect(resultado.ok ? destinoOk : `${destinoBase}?error=${resultado.error}`);
}

export async function responderInvitacionAction(formData: FormData) {
  const invitacionId = String(formData.get("invitacionId") ?? "");
  const respuesta = formData.get("respuesta") === "aceptada" ? "aceptada" : "rechazada";

  const session = await getSessionUser();
  if (!session) redirect("/login?next=/partidos");

  const resultado = await responderInvitacion(session.id, invitacionId, respuesta);
  revalidatePath("/partidos");
  redirect(resultado.ok ? `/partidos?${respuesta === "aceptada" ? "unido=1" : "rechazado=1"}` : `/partidos?error=${resultado.error}`);
}

// El navegador manda su ubicación (navigator.geolocation, con permiso del
// usuario) a esta action — mismo propósito que /api/ubicacion en móvil.
export async function actualizarUbicacionAction(formData: FormData) {
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));

  const session = await getSessionUser();
  if (!session) redirect("/partidos");

  // actualizarUbicacion valida el rango geográfico (y NaN) por su cuenta.
  const resultado = await actualizarUbicacion(session.id, lat, lng);
  if (!resultado.ok) redirect("/partidos?error=coordenadas_invalidas");

  revalidatePath("/partidos");
  redirect("/partidos?ubicacion=1");
}

export async function inscribirseALigaAction(formData: FormData) {
  const ligaId = String(formData.get("ligaId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const session = await getSessionUser();
  if (!session) redirect(`/login?next=/complejos/${slug}`);

  const resultado = await inscribirseALiga(session.id, ligaId);
  revalidatePath(`/complejos/${slug}`);
  redirect(`/complejos/${slug}${resultado.ok ? "?liga=1" : `?error=${resultado.error}`}`);
}

export async function salirDeLigaAction(formData: FormData) {
  const ligaId = String(formData.get("ligaId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const session = await getSessionUser();
  if (!session) redirect(`/login?next=/complejos/${slug}`);

  const resultado = await salirDeLiga(session.id, ligaId);
  revalidatePath(`/complejos/${slug}`);
  redirect(`/complejos/${slug}${resultado.ok ? "?liga=salida" : `?error=${resultado.error}`}`);
}

export async function reportarResultadoAction(formData: FormData) {
  const reservaId = String(formData.get("reservaId") ?? "");
  const equipoGanadorRaw = String(formData.get("equipoGanador") ?? "");
  const equipoGanador = equipoGanadorRaw === "A" || equipoGanadorRaw === "B" || equipoGanadorRaw === "empate" ? equipoGanadorRaw : null;

  const session = await getSessionUser();
  if (!session) redirect("/login?next=/mis-reservas");

  // Se vuelve a pedir la lista de participantes acá (no se confía en una
  // lista de ids que hubiera mandado el formulario) para saber qué campos
  // "equipo_<id>" leer del formData.
  const reserva = await obtenerReservaParaReportar(session.id, reservaId);
  if (!reserva || !equipoGanador) redirect(`/mis-reservas/${reservaId}/resultado?error=datos_invalidos`);

  const asignaciones = reserva.participantes.map((p) => {
    const equipo = formData.get(`equipo_${p.usuarioId}`);
    return { usuarioId: p.usuarioId, equipo: equipo === "B" ? ("B" as const) : ("A" as const) };
  });

  const resultado = await reportarResultado(session.id, reservaId, equipoGanador, asignaciones);
  revalidatePath("/mis-reservas");
  redirect(resultado.ok ? "/mis-reservas?resultado=1" : `/mis-reservas/${reservaId}/resultado?error=${resultado.error}`);
}
