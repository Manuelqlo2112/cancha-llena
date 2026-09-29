import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@cancha-llena/db";
import { cancelarReserva, crearReserva, crearSolicitudRival, invitarRivalDirecto, unirseSolicitud } from "@/lib/reservas";
import { crearCanchaFixture, crearComplejoFixture, crearUsuarioFixture, fechaRelativa, resetDb } from "./helpers";

beforeEach(resetDb);

async function reservarFixture(capacidad = 4) {
  const complejo = await crearComplejoFixture();
  const cancha = await crearCanchaFixture(complejo.id, { capacidadJugadores: capacidad });
  const organizador = await crearUsuarioFixture();
  const reserva = await crearReserva(organizador.id, cancha.id, fechaRelativa(1), "19:00");
  if (!reserva.ok) throw new Error("fixture: no se pudo reservar");
  return { complejo, cancha, organizador, reservaId: reserva.reservaId };
}

describe("crearSolicitudRival", () => {
  it("la crea cuando faltan cupos y el organizador la pide", async () => {
    const { organizador, reservaId } = await reservarFixture(4);
    const r = await crearSolicitudRival(organizador.id, reservaId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const solicitud = await db.query.solicitudesRival.findFirst({ where: { id: r.solicitudId } });
    expect(solicitud?.estado).toBe("abierta");
    expect(solicitud?.cuposFaltantes).toBe(3); // capacidad 4 - organizador
  });

  it("la rechaza si ya hay una abierta para la misma reserva", async () => {
    const { organizador, reservaId } = await reservarFixture(4);
    await crearSolicitudRival(organizador.id, reservaId);
    const segunda = await crearSolicitudRival(organizador.id, reservaId);
    expect(segunda).toMatchObject({ ok: false, error: "ya_existe" });
  });

  it("dos pedidos concurrentes para la misma reserva: solo uno crea la solicitud", async () => {
    const { organizador, reservaId } = await reservarFixture(4);
    const [a, b] = await Promise.all([crearSolicitudRival(organizador.id, reservaId), crearSolicitudRival(organizador.id, reservaId)]);

    const resultados = [a, b];
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    expect(resultados.filter((r) => !r.ok && r.error === "ya_existe")).toHaveLength(1);

    const abiertas = await db.query.solicitudesRival.findMany({ where: { reservaId, estado: "abierta" } });
    expect(abiertas).toHaveLength(1);
  });

  it("la rechaza si no quedan cupos (cancha llena)", async () => {
    const { cancha, organizador, reservaId } = await reservarFixture(1); // capacidad 1 = ya está llena con el organizador
    expect(cancha.capacidadJugadores).toBe(1);
    const r = await crearSolicitudRival(organizador.id, reservaId);
    expect(r).toMatchObject({ ok: false, error: "sin_cupos" });
  });

  it("la rechaza si quien la pide no es organizador ni participante", async () => {
    const { reservaId } = await reservarFixture(4);
    const ajeno = await crearUsuarioFixture();
    const r = await crearSolicitudRival(ajeno.id, reservaId);
    expect(r).toMatchObject({ ok: false, error: "sin_permiso" });
  });

  it("invita a jugadores cercanos con ubicación conocida y no a los lejanos o sin ubicación", async () => {
    const { organizador, reservaId } = await reservarFixture(6);
    // El complejo fixture queda en lat -33.45 / lng -70.65.
    const cerca = await crearUsuarioFixture({ ultimaLat: "-33.451000", ultimaLng: "-70.651000" }); // ~150m
    const lejos = await crearUsuarioFixture({ ultimaLat: "-34.600000", ultimaLng: "-71.500000" }); // muy lejos
    const sinUbicacion = await crearUsuarioFixture();

    const r = await crearSolicitudRival(organizador.id, reservaId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.invitados).toBe(1);

    const invitaciones = await db.query.solicitudInvitaciones.findMany({ where: { solicitudId: r.solicitudId } });
    const invitados = invitaciones.map((i) => i.usuarioId);
    expect(invitados).toContain(cerca.id);
    expect(invitados).not.toContain(lejos.id);
    expect(invitados).not.toContain(sinUbicacion.id);
  });
});

describe("invitarRivalDirecto", () => {
  it("crea la invitación directa aunque el rival esté lejos o sin ubicación", async () => {
    const { organizador, reservaId } = await reservarFixture(4);
    const solicitud = await crearSolicitudRival(organizador.id, reservaId);
    if (!solicitud.ok) throw new Error("fixture");
    const rival = await crearUsuarioFixture({ ultimaLat: "-34.600000", ultimaLng: "-71.500000" }); // lejos a propósito

    const r = await invitarRivalDirecto(organizador.id, solicitud.solicitudId, rival.id);
    expect(r).toEqual({ ok: true });

    const invitacion = await db.query.solicitudInvitaciones.findFirst({ where: { solicitudId: solicitud.solicitudId, usuarioId: rival.id } });
    expect(invitacion?.estado).toBe("pendiente");
    expect(invitacion?.distanciaKm).toBeNull();
  });

  it("un participante (no solo el organizador) también puede invitar", async () => {
    const { organizador, reservaId } = await reservarFixture(4);
    const solicitud = await crearSolicitudRival(organizador.id, reservaId);
    if (!solicitud.ok) throw new Error("fixture");
    const participante = await crearUsuarioFixture();
    await unirseSolicitud(participante.id, solicitud.solicitudId);
    const rival = await crearUsuarioFixture();

    const r = await invitarRivalDirecto(participante.id, solicitud.solicitudId, rival.id);
    expect(r).toEqual({ ok: true });
  });

  it("rechaza a alguien ajeno a la reserva", async () => {
    const { organizador, reservaId } = await reservarFixture(4);
    const solicitud = await crearSolicitudRival(organizador.id, reservaId);
    if (!solicitud.ok) throw new Error("fixture");
    const ajeno = await crearUsuarioFixture();
    const rival = await crearUsuarioFixture();

    const r = await invitarRivalDirecto(ajeno.id, solicitud.solicitudId, rival.id);
    expect(r).toEqual({ ok: false, error: "sin_permiso" });
  });

  it("rechaza invitar a alguien que ya es participante", async () => {
    const { organizador, reservaId } = await reservarFixture(4);
    const solicitud = await crearSolicitudRival(organizador.id, reservaId);
    if (!solicitud.ok) throw new Error("fixture");
    const yaParticipa = await crearUsuarioFixture();
    await unirseSolicitud(yaParticipa.id, solicitud.solicitudId);

    const r = await invitarRivalDirecto(organizador.id, solicitud.solicitudId, yaParticipa.id);
    expect(r).toEqual({ ok: false, error: "rival_invalido" });
  });

  it("invitar dos veces a la misma persona no falla, solo no hace nada de nuevo", async () => {
    const { organizador, reservaId } = await reservarFixture(4);
    const solicitud = await crearSolicitudRival(organizador.id, reservaId);
    if (!solicitud.ok) throw new Error("fixture");
    const rival = await crearUsuarioFixture();

    await invitarRivalDirecto(organizador.id, solicitud.solicitudId, rival.id);
    const segunda = await invitarRivalDirecto(organizador.id, solicitud.solicitudId, rival.id);
    expect(segunda).toEqual({ ok: true });

    const invitaciones = await db.query.solicitudInvitaciones.findMany({ where: { solicitudId: solicitud.solicitudId, usuarioId: rival.id } });
    expect(invitaciones).toHaveLength(1);
  });

  it("rechaza si la solicitud ya no está abierta", async () => {
    const { organizador, reservaId } = await reservarFixture(2); // 1 cupo libre tras el organizador
    const solicitud = await crearSolicitudRival(organizador.id, reservaId);
    if (!solicitud.ok) throw new Error("fixture");
    const rival = await crearUsuarioFixture();
    await unirseSolicitud(rival.id, solicitud.solicitudId); // llena el único cupo → la cierra

    const otro = await crearUsuarioFixture();
    const r = await invitarRivalDirecto(organizador.id, solicitud.solicitudId, otro.id);
    expect(r).toEqual({ ok: false, error: "solicitud_cerrada" });
  });
});

describe("unirseSolicitud", () => {
  it("suma un participante y descuenta cupos", async () => {
    const { organizador, reservaId } = await reservarFixture(4);
    const solicitud = await crearSolicitudRival(organizador.id, reservaId);
    if (!solicitud.ok) throw new Error("fixture");

    const rival = await crearUsuarioFixture();
    const r = await unirseSolicitud(rival.id, solicitud.solicitudId);
    expect(r).toEqual({ ok: true });

    const actualizada = await db.query.solicitudesRival.findFirst({ where: { id: solicitud.solicitudId } });
    expect(actualizada?.cuposFaltantes).toBe(2);
    expect(actualizada?.estado).toBe("abierta");
  });

  it("cierra la solicitud cuando el último cupo se llena", async () => {
    const { organizador, reservaId } = await reservarFixture(2); // 1 cupo libre tras el organizador
    const solicitud = await crearSolicitudRival(organizador.id, reservaId);
    if (!solicitud.ok) throw new Error("fixture");

    const rival = await crearUsuarioFixture();
    await unirseSolicitud(rival.id, solicitud.solicitudId);

    const actualizada = await db.query.solicitudesRival.findFirst({ where: { id: solicitud.solicitudId } });
    expect(actualizada?.estado).toBe("cerrada");
    expect(actualizada?.cuposFaltantes).toBe(0);
  });

  it("rechaza unirse dos veces a la misma solicitud", async () => {
    const { organizador, reservaId } = await reservarFixture(4);
    const solicitud = await crearSolicitudRival(organizador.id, reservaId);
    if (!solicitud.ok) throw new Error("fixture");

    const rival = await crearUsuarioFixture();
    await unirseSolicitud(rival.id, solicitud.solicitudId);
    const segundo = await unirseSolicitud(rival.id, solicitud.solicitudId);
    expect(segundo).toEqual({ ok: false, error: "ya_unido" });
  });

  it("rechaza unirse a una solicitud que ya no existe o está cerrada", async () => {
    const rival = await crearUsuarioFixture();
    const r = await unirseSolicitud(rival.id, "00000000-0000-0000-0000-000000000000");
    expect(r).toEqual({ ok: false, error: "solicitud_cerrada" });
  });
});

describe("cancelarReserva cierra solicitudes abiertas", () => {
  it("marca la reserva cancelada y expira la solicitud de rival abierta", async () => {
    const { organizador, reservaId } = await reservarFixture(4);
    const solicitud = await crearSolicitudRival(organizador.id, reservaId);
    if (!solicitud.ok) throw new Error("fixture");

    const r = await cancelarReserva(organizador.id, reservaId);
    expect(r).toEqual({ ok: true });

    const solicitudActualizada = await db.query.solicitudesRival.findFirst({ where: { id: solicitud.solicitudId } });
    expect(solicitudActualizada?.estado).toBe("expirada");
  });
});
