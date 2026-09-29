import { and, eq, gt, ne, sql } from "drizzle-orm";
import { db, pagos, participantesReserva, rachas, reservas, solicitudesRival, solicitudInvitaciones, usuarios } from "@cancha-llena/db";
import { esDiaLaboral, horaFinDe, SLOTS_PRIME, SLOTS_VALLE } from "@cancha-llena/db/slots";
import { distanciaKm } from "@cancha-llena/db/geo";
import { esErrorPostgres } from "./dbErrors";
import { esFechaValida, esUuid } from "./validacion";

// Radio dentro del cual se considera a un jugador "cerca de la cancha" para
// avisarle que un partido busca gente — mismo valor que usa el seed.
const RADIO_INVITACION_KM = 8;

// Lógica de negocio compartida entre los Server Actions de la web
// (app/actions.ts, con cookie + redirect) y la API JSON que consume la app
// móvil (app/api/**, con header + JSON) — un solo lugar para no desalinear
// las dos superficies.

// Fase 2 (retención): descuento gamificado en horas valle. La racha ya
// mostraba un badge "Recompensa desbloqueada" a los 4+ semanas seguidas sin
// que eso tuviera ningún efecto real — esto le da sustancia: mientras la
// racha siga VIGENTE (no alcanza con haberla desbloqueado alguna vez, tiene
// que seguir sin cortarse — mismo criterio de "vigente" que ya usa
// obtenerMisRachas) cada reserva en horario valle de ESE complejo sale con
// descuento.
const DESCUENTO_RACHA_PCT = 15;

export async function tieneDescuentoValle(usuarioId: string, complejoId: string): Promise<boolean> {
  const racha = await db.query.rachas.findFirst({ where: { usuarioId, complejoId } });
  if (!racha || !racha.recompensaDesbloqueada || !racha.ultimaFechaValida) return false;
  const diasDesdeUltima = Math.round((Date.now() - new Date(`${racha.ultimaFechaValida}T00:00:00`).getTime()) / 86_400_000);
  return diasDesdeUltima <= 8;
}

export type CrearReservaResult =
  | { ok: true; reservaId: string; descuentoAplicado: boolean }
  | { ok: false; error: "cancha_no_existe" | "ocupado" | "fecha_pasada" | "datos_invalidos" };

export async function crearReserva(usuarioId: string, canchaId: string, fecha: string, hora: string): Promise<CrearReservaResult> {
  // La UI solo manda ids/horarios que ella misma generó, pero esto también lo
  // llama la API que consume el móvil — un cliente cualquiera puede mandar
  // cualquier string. Sin este chequeo, un canchaId o fecha con formato
  // inválido llegaba tal cual a Postgres y tiraba un error crudo de sintaxis
  // en vez de una respuesta prolija.
  const horaValida = (SLOTS_VALLE as readonly string[]).includes(hora) || (SLOTS_PRIME as readonly string[]).includes(hora);
  if (!esUuid(canchaId) || !esFechaValida(fecha) || !horaValida) return { ok: false, error: "datos_invalidos" };

  const cancha = await db.query.canchas.findFirst({ where: { id: canchaId }, with: { complejo: true } });
  if (!cancha || !cancha.complejo) return { ok: false, error: "cancha_no_existe" };
  const complejo = cancha.complejo;

  // La UI solo ofrece hoy + 4 días, pero esta función también la llama la
  // API directamente (móvil) — sin este chequeo nada impedía reservar una
  // fecha ya pasada.
  const hoyISO = new Date().toISOString().slice(0, 10);
  if (fecha < hoyISO) return { ok: false, error: "fecha_pasada" };

  // Re-chequeo del lado del servidor: el cliente (web o móvil) pudo quedar
  // desactualizado si alguien más reservó este mismo horario mientras tanto.
  const yaExiste = await db.query.reservas.findFirst({
    where: { canchaId, fecha, horaInicio: hora, estado: { ne: "cancelada" } },
  });
  if (yaExiste) return { ok: false, error: "ocupado" };

  const esHorarioValle = esDiaLaboral(new Date(`${fecha}T00:00:00`)) && (SLOTS_VALLE as readonly string[]).includes(hora);
  const descuentoAplicado = esHorarioValle && (await tieneDescuentoValle(usuarioId, cancha.complejoId));
  const precioBase = Number(cancha.precioBase);
  const montoTotal = descuentoAplicado ? Math.round((precioBase * (100 - DESCUENTO_RACHA_PCT)) / 100 / 1000) * 1000 : precioBase;
  const montoAbono = complejo.requiereAbono
    ? Math.round((montoTotal * (Number(complejo.porcentajeAbono) / 100)) / 1000) * 1000
    : 0;

  let reserva: typeof reservas.$inferSelect | undefined;
  try {
    // El chequeo "yaExiste" de arriba tiene una ventana de carrera entre el
    // SELECT y este INSERT — dos reservas concurrentes para el mismo horario
    // podían pasar ambas el chequeo. reservas_slot_unico (schema.ts) es el
    // backstop real a nivel DB; acá se traduce esa violación al mismo error
    // "ocupado" que ya maneja el resto del flujo.
    [reserva] = await db
      .insert(reservas)
      .values({
        canchaId,
        usuarioId,
        fecha,
        horaInicio: hora,
        horaFin: horaFinDe(hora),
        estado: "confirmada",
        esHorarioValle,
        montoTotal: String(montoTotal),
        montoAbono: String(montoAbono),
      })
      .returning();
  } catch (err) {
    if (esErrorPostgres(err, "23505")) {
      return { ok: false, error: "ocupado" };
    }
    throw err;
  }

  if (montoAbono > 0) {
    // No hay pasarela real todavía (Sección 3 del doc técnico): se simula el
    // abono pagado al instante para poder probar el flujo completo.
    await db.insert(pagos).values({
      reservaId: reserva!.id,
      proveedor: "mercadopago",
      monto: String(montoAbono),
      estado: "pagado",
      referenciaExterna: `dev_${reserva!.id.slice(0, 8)}`,
      comisionAplicadaPct: esHorarioValle ? complejo.comisionVallePct : complejo.comisionBasePct,
    });
  }

  await db.insert(participantesReserva).values({ reservaId: reserva!.id, usuarioId, confirmado: true });
  await actualizarRacha(usuarioId, cancha.complejoId, fecha);

  return { ok: true, reservaId: reserva!.id, descuentoAplicado };
}

export type UnirseResult = { ok: true } | { ok: false; error: "solicitud_cerrada" | "ya_unido" };

export async function unirseSolicitud(usuarioId: string, solicitudId: string): Promise<UnirseResult> {
  if (!esUuid(solicitudId)) return { ok: false, error: "solicitud_cerrada" };
  const solicitud = await db.query.solicitudesRival.findFirst({ where: { id: solicitudId }, with: { reserva: true } });
  if (!solicitud || solicitud.estado !== "abierta" || !solicitud.reserva) return { ok: false, error: "solicitud_cerrada" };

  const yaEsParticipante = await db.query.participantesReserva.findFirst({
    where: { reservaId: solicitud.reserva.id, usuarioId },
  });
  if (yaEsParticipante) return { ok: false, error: "ya_unido" };

  // Decremento atómico y condicional: la lectura de solicitud.cuposFaltantes
  // de arriba puede estar desactualizada si dos jugadores se suman al mismo
  // tiempo con un solo cupo libre. El WHERE (más el row lock que Postgres
  // toma durante el UPDATE) asegura que solo uno de los dos gane la carrera
  // en vez de que cuposFaltantes termine en negativo.
  const [actualizada] = await db
    .update(solicitudesRival)
    .set({ cuposFaltantes: sql`${solicitudesRival.cuposFaltantes} - 1` })
    .where(and(eq(solicitudesRival.id, solicitudId), eq(solicitudesRival.estado, "abierta"), gt(solicitudesRival.cuposFaltantes, 0)))
    .returning();
  if (!actualizada) return { ok: false, error: "solicitud_cerrada" };
  if (actualizada.cuposFaltantes <= 0) {
    await db.update(solicitudesRival).set({ estado: "cerrada" }).where(eq(solicitudesRival.id, solicitudId));
  }

  try {
    await db.insert(participantesReserva).values({ reservaId: solicitud.reserva.id, usuarioId, confirmado: true, viaSolicitudRival: true });
  } catch (err) {
    // participantes_reserva_unico (schema.ts): backstop contra un doble-click
    // que dispare esta misma request dos veces — el cupo ya se descontó
    // arriba, así que hay que devolverlo antes de reportar el error.
    if (esErrorPostgres(err, "23505")) {
      await db
        .update(solicitudesRival)
        .set({ cuposFaltantes: sql`${solicitudesRival.cuposFaltantes} + 1`, estado: "abierta" })
        .where(eq(solicitudesRival.id, solicitudId));
      return { ok: false, error: "ya_unido" };
    }
    throw err;
  }

  const canchaDeLaSolicitud = await db.query.canchas.findFirst({ where: { id: solicitud.reserva.canchaId } });
  await actualizarRacha(usuarioId, canchaDeLaSolicitud?.complejoId ?? null, solicitud.reserva.fecha);

  return { ok: true };
}

export type CancelarResult =
  | { ok: true }
  | { ok: false; error: "no_encontrada" | "sin_permiso" | "ya_paso" | "ya_cancelada" };

// Política de cancelación provisoria (Sección 3 del doc técnico la deja "a
// definir" real por complejo): el organizador puede cancelar hasta el mismo
// día, no después. Un abono pagado se marca reembolsado; una solicitud de
// rival abierta se cierra sola, ya no hay partido al que sumarse.
export async function cancelarReserva(usuarioId: string, reservaId: string): Promise<CancelarResult> {
  if (!esUuid(reservaId)) return { ok: false, error: "no_encontrada" };
  const reserva = await db.query.reservas.findFirst({ where: { id: reservaId }, with: { pagos: true, solicitudRival: true } });
  if (!reserva) return { ok: false, error: "no_encontrada" };
  if (reserva.usuarioId !== usuarioId) return { ok: false, error: "sin_permiso" };
  if (reserva.estado === "cancelada") return { ok: false, error: "ya_cancelada" };
  const hoyISO = new Date().toISOString().slice(0, 10);
  if (reserva.fecha < hoyISO) return { ok: false, error: "ya_paso" };

  await db.update(reservas).set({ estado: "cancelada" }).where(eq(reservas.id, reservaId));

  for (const pago of reserva.pagos) {
    if (pago.estado === "pagado") {
      await db.update(pagos).set({ estado: "reembolsado" }).where(eq(pagos.id, pago.id));
    }
  }
  for (const s of reserva.solicitudRival) {
    if (s.estado === "abierta") {
      await db.update(solicitudesRival).set({ estado: "expirada" }).where(eq(solicitudesRival.id, s.id));
    }
  }

  return { ok: true };
}

export type CrearSolicitudResult =
  | { ok: true; solicitudId: string; invitados: number }
  | { ok: false; error: "no_encontrada" | "sin_permiso" | "ya_paso" | "ya_existe" | "sin_cupos" };

// El organizador o cualquier participante ya confirmado puede avisar que
// faltan jugadores — hoy solo lo creaba el seed; esto le da un botón real.
export async function crearSolicitudRival(usuarioId: string, reservaId: string): Promise<CrearSolicitudResult> {
  if (!esUuid(reservaId)) return { ok: false, error: "no_encontrada" };
  const reserva = await db.query.reservas.findFirst({
    where: { id: reservaId },
    with: { cancha: { with: { complejo: true } }, participantes: true, solicitudRival: true },
  });
  if (!reserva || !reserva.cancha) return { ok: false, error: "no_encontrada" };

  const esParticipante = reserva.usuarioId === usuarioId || reserva.participantes.some((p) => p.usuarioId === usuarioId);
  if (!esParticipante) return { ok: false, error: "sin_permiso" };

  const hoyISO = new Date().toISOString().slice(0, 10);
  if (reserva.estado === "cancelada" || reserva.fecha < hoyISO) return { ok: false, error: "ya_paso" };
  if (reserva.solicitudRival.some((s) => s.estado === "abierta")) return { ok: false, error: "ya_existe" };

  // `participantes` ya incluye al organizador (crearReserva lo suma ahí
  // mismo) — restarlo de nuevo acá contaba un cupo ocupado de más.
  const cuposFaltantes = reserva.cancha.capacidadJugadores - reserva.participantes.length;
  if (cuposFaltantes <= 0) return { ok: false, error: "sin_cupos" };

  let solicitud: typeof solicitudesRival.$inferSelect;
  try {
    // El chequeo "ya_existe" de arriba tiene la misma ventana de carrera que
    // ya vimos en reservas/ligas: dos participantes pidiendo rival casi al
    // mismo tiempo podían pasar los dos. solicitudes_rival_reserva_abierta_unico
    // (schema.ts) es el candado real; esto traduce esa violación al mismo
    // error prolijo en vez de un 500 crudo.
    [solicitud] = await db.insert(solicitudesRival).values({ reservaId, cuposFaltantes, estado: "abierta" }).returning();
  } catch (err) {
    if (esErrorPostgres(err, "23505")) return { ok: false, error: "ya_existe" };
    throw err;
  }
  const invitados = reserva.cancha.complejo
    ? await invitarJugadoresCercanos(solicitud!.id, reserva.cancha.complejo, [
        reserva.usuarioId,
        ...reserva.participantes.map((p) => p.usuarioId).filter((id): id is string => !!id),
      ])
    : 0;

  return { ok: true, solicitudId: solicitud!.id, invitados };
}

// El equivalente a "avisarle a todos los que estén cerca de la cancha" del
// pedido original: sin push/geolocalización en vivo (necesitaría que cada
// celular registre un token — pieza aparte, ver notas de sesión), pero
// apenas se abre una solicitud, cualquier jugador con ubicación conocida
// (activada antes, en Perfil o al postear su ubicación) dentro del radio
// queda invitado — y lo ve enseguida en su pestaña de Partidos/Invitaciones.
async function invitarJugadoresCercanos(
  solicitudId: string,
  complejo: { lat: string | null; lng: string | null },
  excluirIds: string[],
): Promise<number> {
  if (complejo.lat === null || complejo.lng === null) return 0;
  const centroLat = Number(complejo.lat);
  const centroLng = Number(complejo.lng);
  const excluir = new Set(excluirIds);

  const candidatos = await db.query.usuarios.findMany({ where: { rol: "jugador" } });
  const cercanos = candidatos.filter(
    (u) => !excluir.has(u.id) && u.ultimaLat !== null && u.ultimaLng !== null && distanciaKm(centroLat, centroLng, Number(u.ultimaLat), Number(u.ultimaLng)) <= RADIO_INVITACION_KM,
  );
  if (cercanos.length === 0) return 0;

  await db
    .insert(solicitudInvitaciones)
    .values(
      cercanos.map((u) => ({
        solicitudId,
        usuarioId: u.id,
        distanciaKm: distanciaKm(centroLat, centroLng, Number(u.ultimaLat), Number(u.ultimaLng)).toFixed(2),
      })),
    )
    .onConflictDoNothing();

  return cercanos.length;
}

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

// Cuánto historial pasado se muestra — sin este límite, un jugador con
// meses (o, en el seed, semanas muy activas) de partidos termina con una
// respuesta de cientos de reservas y la pantalla de "Mis reservas" se cae
// en el celular. Lo próximo (futuro) nunca hace falta acotarlo así: la app
// solo deja reservar hasta 5 días adelante (ver DIAS_ADELANTE).
const DIAS_HISTORIAL = 60;

// "Mis reservas" = las que organicé + las que me sumé como participante
// (por ejemplo, uniéndome a una solicitud de rival de otra persona).
export async function obtenerMisReservas(usuarioId: string): Promise<MiReserva[]> {
  const corteISO = new Date(Date.now() - DIAS_HISTORIAL * 86_400_000).toISOString().slice(0, 10);

  const [organizadas, participaciones] = await Promise.all([
    db.query.reservas.findMany({
      where: { usuarioId, fecha: { gte: corteISO } },
      with: { cancha: { with: { complejo: true } }, solicitudRival: true, participantes: true },
    }),
    db.query.participantesReserva.findMany({
      where: { usuarioId, reserva: { fecha: { gte: corteISO } } },
      with: { reserva: { with: { cancha: { with: { complejo: true } }, solicitudRival: true, participantes: true } } },
    }),
  ]);

  const porId = new Map<string, { reserva: (typeof organizadas)[number]; esOrganizador: boolean }>();
  for (const r of organizadas) porId.set(r.id, { reserva: r, esOrganizador: true });
  for (const p of participaciones) {
    if (p.reserva && !porId.has(p.reserva.id)) porId.set(p.reserva.id, { reserva: p.reserva as (typeof organizadas)[number], esOrganizador: false });
  }

  const hoyISO = new Date().toISOString().slice(0, 10);
  return [...porId.values()]
    .filter(({ reserva }) => reserva.cancha && reserva.cancha.complejo)
    .map(({ reserva, esOrganizador }) => {
      // Mismo motivo que en crearSolicitudRival: participantes ya incluye al organizador.
      const cuposFaltantes = reserva.cancha!.capacidadJugadores - reserva.participantes.length;
      const tieneSolicitudAbierta = reserva.solicitudRival.some((s) => s.estado === "abierta");
      return {
        id: reserva.id,
        fecha: reserva.fecha,
        horaInicio: reserva.horaInicio,
        horaFin: reserva.horaFin,
        estado: reserva.estado,
        esHorarioValle: reserva.esHorarioValle,
        montoTotal: Number(reserva.montoTotal),
        montoAbono: Number(reserva.montoAbono),
        esOrganizador,
        cancha: { id: reserva.cancha!.id, nombre: reserva.cancha!.nombre, deporte: reserva.cancha!.deporte },
        complejo: { slug: reserva.cancha!.complejo!.slug, nombre: reserva.cancha!.complejo!.nombre },
        solicitudAbiertaId: reserva.solicitudRival.find((s) => s.estado === "abierta")?.id ?? null,
        puedeBuscarRival: reserva.estado !== "cancelada" && reserva.fecha >= hoyISO && !tieneSolicitudAbierta && cuposFaltantes > 0,
        puedeReportarResultado: reserva.estado !== "cancelada" && reserva.fecha <= hoyISO && !reserva.resultadoReportadoEn,
      };
    })
    .sort((a, b) => `${a.fecha}${a.horaInicio}`.localeCompare(`${b.fecha}${b.horaInicio}`));
}

export type MiRacha = {
  complejoNombre: string;
  complejoSlug: string;
  contadorActual: number;
  mejorRacha: number;
  ultimaFechaValida: string | null;
  recompensaDesbloqueada: boolean;
  // Si ya pasó más de 8 días desde la última vez que contó, la racha real es
  // 0 aunque el contador guardado no se actualice hasta que el jugador vuelva
  // a jugar ahí (actualizarRacha recién la resetea en el próximo partido).
  vigente: boolean;
};

// Para mostrarle al jugador su racha — hoy se calculaba y guardaba pero no
// se veía en ningún lado.
export async function obtenerMisRachas(usuarioId: string): Promise<MiRacha[]> {
  const propias = await db.query.rachas.findMany({
    where: { usuarioId },
    with: { complejo: true },
  });

  const hoy = new Date();
  return propias
    .filter((r) => r.complejo && r.contadorActual > 0)
    .map((r) => {
      const ultima = r.ultimaFechaValida ? new Date(`${r.ultimaFechaValida}T00:00:00`) : null;
      const diasDesdeUltima = ultima ? Math.round((hoy.getTime() - ultima.getTime()) / 86_400_000) : Infinity;
      return {
        complejoNombre: r.complejo!.nombre,
        complejoSlug: r.complejo!.slug,
        contadorActual: r.contadorActual,
        mejorRacha: r.mejorRacha,
        ultimaFechaValida: r.ultimaFechaValida,
        recompensaDesbloqueada: r.recompensaDesbloqueada,
        vigente: diasDesdeUltima <= 8,
      };
    })
    .sort((a, b) => b.contadorActual - a.contadorActual);
}

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

// "Partidos que faltan jugadores" — pantalla separada de reservar (Sección 05
// del doc de producto: "buscar rival" resuelve cupos a medio llenar, no tiene
// por qué mezclarse con el calendario de reserva). Por ahora es un listado que
// cualquiera ve al abrir la app (no hay push/geolocalización todavía — ver
// notas de la sesión 2026-09-25).
export async function obtenerSolicitudesAbiertas(usuarioId: string | null): Promise<SolicitudAbierta[]> {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const solicitudes = await db.query.solicitudesRival.findMany({
    where: { estado: "abierta" },
    with: {
      reserva: {
        with: {
          cancha: { with: { complejo: true } },
          usuario: true,
          participantes: true,
        },
      },
    },
  });

  return solicitudes
    .filter((s) => s.reserva && s.reserva.fecha >= hoyISO && s.reserva.cancha && s.reserva.cancha.complejo)
    .map((s) => {
      const reserva = s.reserva!;
      const cancha = reserva.cancha!;
      const complejo = cancha.complejo!;
      const yaParticipa = usuarioId
        ? reserva.usuarioId === usuarioId || reserva.participantes.some((p) => p.usuarioId === usuarioId)
        : false;
      return {
        id: s.id,
        cuposFaltantes: s.cuposFaltantes,
        nivelMinimo: s.nivelMinimo !== null ? Number(s.nivelMinimo) : null,
        nivelMaximo: s.nivelMaximo !== null ? Number(s.nivelMaximo) : null,
        fecha: reserva.fecha,
        horaInicio: reserva.horaInicio,
        horaFin: reserva.horaFin,
        esHorarioValle: reserva.esHorarioValle,
        cancha: { nombre: cancha.nombre, deporte: cancha.deporte, capacidadJugadores: cancha.capacidadJugadores },
        complejo: { nombre: complejo.nombre, slug: complejo.slug },
        organizadorNombre: reserva.usuario?.nombre ?? "Alguien",
        yaParticipa,
      };
    })
    .sort((a, b) => `${a.fecha}${a.horaInicio}`.localeCompare(`${b.fecha}${b.horaInicio}`));
}

// Coordenadas fuera de rango geográfico (o NaN) no deberían llegar nunca
// desde un navegador/GPS real, pero esto también lo llama la API que
// consume el móvil — un cliente cualquiera puede mandar lo que quiera. Sin
// este chequeo, un valor así se guardaba igual y después corrompía el
// cálculo de distancia (haversine) usado para invitar a jugadores cerca.
export async function actualizarUbicacion(usuarioId: string, lat: number, lng: number): Promise<{ ok: boolean }> {
  const valida = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!valida) return { ok: false };

  await db
    .update(usuarios)
    .set({ ultimaLat: lat.toFixed(6), ultimaLng: lng.toFixed(6), ultimaUbicacionEn: new Date() })
    .where(eq(usuarios.id, usuarioId));
  return { ok: true };
}

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

// Invitaciones puntuales por cercanía, para el jugador que las recibe —
// distinto de /partidos (ese es el listado abierto que ve cualquiera).
export async function listarInvitacionesPendientes(usuarioId: string): Promise<InvitacionPendiente[]> {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const invitaciones = await db.query.solicitudInvitaciones.findMany({
    where: { usuarioId, estado: "pendiente" },
    with: {
      solicitud: {
        with: { reserva: { with: { cancha: { with: { complejo: true } }, usuario: true } } },
      },
    },
  });

  return invitaciones
    .filter((i) => i.solicitud?.estado === "abierta" && i.solicitud.reserva && i.solicitud.reserva.fecha >= hoyISO && i.solicitud.reserva.cancha?.complejo)
    .map((i) => {
      const solicitud = i.solicitud!;
      const reserva = solicitud.reserva!;
      const cancha = reserva.cancha!;
      return {
        id: i.id,
        distanciaKm: i.distanciaKm !== null ? Number(i.distanciaKm) : null,
        fecha: reserva.fecha,
        horaInicio: reserva.horaInicio,
        horaFin: reserva.horaFin,
        esHorarioValle: reserva.esHorarioValle,
        cuposFaltantes: solicitud.cuposFaltantes,
        cancha: { nombre: cancha.nombre, deporte: cancha.deporte },
        complejo: { nombre: cancha.complejo!.nombre, slug: cancha.complejo!.slug },
        organizadorNombre: reserva.usuario?.nombre ?? "Alguien",
      };
    })
    .sort((a, b) => (a.distanciaKm ?? 999) - (b.distanciaKm ?? 999));
}

export type ResponderInvitacionResult =
  | { ok: true; unido: boolean }
  | { ok: false; error: "no_encontrada" | "sin_permiso" | "ya_respondida" | "solicitud_cerrada" };

export async function responderInvitacion(usuarioId: string, invitacionId: string, respuesta: "aceptada" | "rechazada"): Promise<ResponderInvitacionResult> {
  if (!esUuid(invitacionId)) return { ok: false, error: "no_encontrada" };
  const invitacion = await db.query.solicitudInvitaciones.findFirst({
    where: { id: invitacionId },
    with: { solicitud: { with: { reserva: true } } },
  });
  if (!invitacion) return { ok: false, error: "no_encontrada" };
  if (invitacion.usuarioId !== usuarioId) return { ok: false, error: "sin_permiso" };
  if (invitacion.estado !== "pendiente") return { ok: false, error: "ya_respondida" };
  if (!invitacion.solicitud || invitacion.solicitud.estado !== "abierta") return { ok: false, error: "solicitud_cerrada" };

  if (respuesta === "rechazada") {
    await db.update(solicitudInvitaciones).set({ estado: "rechazada", respondidoEn: new Date() }).where(eq(solicitudInvitaciones.id, invitacionId));
    return { ok: true, unido: false };
  }

  const resultado = await unirseSolicitud(usuarioId, invitacion.solicitudId);
  if (!resultado.ok) {
    // Alguien más se sumó justo antes — avisar en vez de dejarla pendiente
    // para siempre (evita el "ya se anotaron" duplicado).
    await db.update(solicitudInvitaciones).set({ estado: "rechazada", respondidoEn: new Date() }).where(eq(solicitudInvitaciones.id, invitacionId));
    return { ok: false, error: "solicitud_cerrada" };
  }

  await db.update(solicitudInvitaciones).set({ estado: "aceptada", respondidoEn: new Date() }).where(eq(solicitudInvitaciones.id, invitacionId));

  // Si con esto el partido quedó completo, las demás invitaciones pendientes
  // ya no aplican — se cierran para que a nadie más le aparezca un cupo que
  // ya no existe.
  const solicitudActualizada = await db.query.solicitudesRival.findFirst({ where: { id: invitacion.solicitudId } });
  if (solicitudActualizada && solicitudActualizada.estado !== "abierta") {
    await db
      .update(solicitudInvitaciones)
      .set({ estado: "rechazada", respondidoEn: new Date() })
      .where(and(eq(solicitudInvitaciones.solicitudId, invitacion.solicitudId), eq(solicitudInvitaciones.estado, "pendiente"), ne(solicitudInvitaciones.id, invitacionId)));
  }

  return { ok: true, unido: true };
}

// Racha semanal (Sección 5 del doc de producto): si el jugador ya tenía una
// racha en este complejo y la última vez que contó fue dentro de los últimos
// 8 días, suma uno; si pasó más tiempo, arranca de nuevo en 1.
// Exportada para que lib/ligas.ts (Fase 2: ligas recurrentes) actualice la
// racha de cada inscripto cuando se materializa la sesión semanal — misma
// mecánica que un jugador reservando o uniéndose a un partido normal.
export async function actualizarRacha(usuarioId: string, complejoId: string | null, fechaISO: string) {
  if (!complejoId) return;
  const existente = await db.query.rachas.findFirst({ where: { usuarioId, complejoId } });
  const fecha = new Date(`${fechaISO}T00:00:00`);

  if (!existente) {
    await db.insert(rachas).values({
      usuarioId,
      complejoId,
      contadorActual: 1,
      mejorRacha: 1,
      ultimaFechaValida: fechaISO,
      recompensaDesbloqueada: false,
    });
    return;
  }

  const ultima = existente.ultimaFechaValida ? new Date(`${existente.ultimaFechaValida}T00:00:00`) : null;
  const diasDesdeUltima = ultima ? Math.round((fecha.getTime() - ultima.getTime()) / 86_400_000) : Infinity;

  if (diasDesdeUltima === 0) return; // ya contaba para esta misma fecha

  const nuevoContador = diasDesdeUltima >= 1 && diasDesdeUltima <= 8 ? existente.contadorActual + 1 : 1;
  await db
    .update(rachas)
    .set({
      contadorActual: nuevoContador,
      mejorRacha: Math.max(existente.mejorRacha, nuevoContador),
      ultimaFechaValida: fechaISO,
      recompensaDesbloqueada: nuevoContador >= 4,
    })
    .where(eq(rachas.id, existente.id));
}
