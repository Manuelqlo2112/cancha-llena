import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@cancha-llena/db";
import { crearReserva, crearSolicitudRival, responderInvitacion } from "@/lib/reservas";
import { crearCanchaFixture, crearComplejoFixture, crearUsuarioFixture, fechaRelativa, resetDb } from "./helpers";

beforeEach(resetDb);

// Complejo fijo en -33.45/-70.65 (ver helpers.ts) — un jugador a ~150m
// siempre cae invitado por crearSolicitudRival.
async function solicitudConInvitadoCercano(capacidad = 6) {
  const complejo = await crearComplejoFixture();
  const cancha = await crearCanchaFixture(complejo.id, { capacidadJugadores: capacidad });
  const organizador = await crearUsuarioFixture();
  const reserva = await crearReserva(organizador.id, cancha.id, fechaRelativa(1), "19:00");
  if (!reserva.ok) throw new Error("fixture");
  const cercano = await crearUsuarioFixture({ ultimaLat: "-33.451000", ultimaLng: "-70.651000" });

  const solicitud = await crearSolicitudRival(organizador.id, reserva.reservaId);
  if (!solicitud.ok) throw new Error("fixture");

  const invitacion = await db.query.solicitudInvitaciones.findFirst({ where: { solicitudId: solicitud.solicitudId, usuarioId: cercano.id } });
  if (!invitacion) throw new Error("fixture: no se generó la invitación esperada");

  return { organizador, cercano, solicitudId: solicitud.solicitudId, invitacionId: invitacion.id, cancha };
}

describe("responderInvitacion", () => {
  it("aceptar une al jugador como participante real de la reserva", async () => {
    const { cercano, invitacionId } = await solicitudConInvitadoCercano();
    const r = await responderInvitacion(cercano.id, invitacionId, "aceptada");
    expect(r).toEqual({ ok: true, unido: true });

    const invitacion = await db.query.solicitudInvitaciones.findFirst({ where: { id: invitacionId } });
    expect(invitacion?.estado).toBe("aceptada");
  });

  it("rechazar solo marca la invitación, no crea participante", async () => {
    const { cercano, invitacionId, solicitudId } = await solicitudConInvitadoCercano();
    const r = await responderInvitacion(cercano.id, invitacionId, "rechazada");
    expect(r).toEqual({ ok: true, unido: false });

    const yaEsParticipante = await db.query.participantesReserva.findFirst({ where: { usuarioId: cercano.id } });
    expect(yaEsParticipante).toBeUndefined();
    const solicitud = await db.query.solicitudesRival.findFirst({ where: { id: solicitudId } });
    expect(solicitud?.estado).toBe("abierta"); // sigue abierta para otros invitados
  });

  it("no deja responder la misma invitación dos veces", async () => {
    const { cercano, invitacionId } = await solicitudConInvitadoCercano();
    await responderInvitacion(cercano.id, invitacionId, "rechazada");
    const segunda = await responderInvitacion(cercano.id, invitacionId, "aceptada");
    expect(segunda).toEqual({ ok: false, error: "ya_respondida" });
  });

  it("no deja responder la invitación de otra persona", async () => {
    const { invitacionId } = await solicitudConInvitadoCercano();
    const otro = await crearUsuarioFixture();
    const r = await responderInvitacion(otro.id, invitacionId, "aceptada");
    expect(r).toEqual({ ok: false, error: "sin_permiso" });
  });

  it("al aceptar y completar el partido, cierra las demás invitaciones pendientes", async () => {
    // Capacidad 2: organizador + 1 más completa el partido. Los dos jugadores
    // cercanos tienen que existir ANTES de pedir la solicitud — las
    // invitaciones se generan una sola vez, al crearla, no retroactivamente.
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id, { capacidadJugadores: 2 });
    const organizador = await crearUsuarioFixture();
    const cercano1 = await crearUsuarioFixture({ ultimaLat: "-33.451000", ultimaLng: "-70.651000" });
    const cercano2 = await crearUsuarioFixture({ ultimaLat: "-33.452000", ultimaLng: "-70.652000" });

    const reserva = await crearReserva(organizador.id, cancha.id, fechaRelativa(1), "19:00");
    if (!reserva.ok) throw new Error("fixture");
    const solicitud = await crearSolicitudRival(organizador.id, reserva.reservaId);
    if (!solicitud.ok) throw new Error("fixture");
    expect(solicitud.invitados).toBe(2);

    const invitacion1 = await db.query.solicitudInvitaciones.findFirst({ where: { solicitudId: solicitud.solicitudId, usuarioId: cercano1.id } });
    const invitacion2 = await db.query.solicitudInvitaciones.findFirst({ where: { solicitudId: solicitud.solicitudId, usuarioId: cercano2.id } });
    if (!invitacion1 || !invitacion2) throw new Error("fixture: se esperaban 2 invitados cercanos");

    const aceptar = await responderInvitacion(cercano1.id, invitacion1.id, "aceptada");
    expect(aceptar).toEqual({ ok: true, unido: true });

    const solicitudCerrada = await db.query.solicitudesRival.findFirst({ where: { id: solicitud.solicitudId } });
    expect(solicitudCerrada?.estado).toBe("cerrada");

    const otraInvitacionAhora = await db.query.solicitudInvitaciones.findFirst({ where: { id: invitacion2.id } });
    expect(otraInvitacionAhora?.estado).toBe("rechazada");
  });
});
