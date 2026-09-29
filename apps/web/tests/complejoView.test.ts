import { beforeEach, describe, expect, it } from "vitest";
import { crearReserva, crearSolicitudRival } from "@/lib/reservas";
import { getComplejoView } from "@/lib/complejoView";
import { crearCanchaFixture, crearComplejoFixture, crearUsuarioFixture, fechaRelativa, resetDb } from "./helpers";

beforeEach(resetDb);

describe("getComplejoView", () => {
  it("devuelve null para un slug que no existe", async () => {
    const r = await getComplejoView("no-existe-esto", null);
    expect(r).toBeNull();
  });

  it("marca todos los slots como libres cuando no hay reservas", async () => {
    const complejo = await crearComplejoFixture();
    await crearCanchaFixture(complejo.id);

    const r = await getComplejoView(complejo.slug, null);
    expect(r).not.toBeNull();
    expect(r!.canchas).toHaveLength(1);
    expect(r!.canchas[0]!.slots.length).toBeGreaterThan(0);
    expect(r!.canchas[0]!.slots.every((s) => s.estado === "libre")).toBe(true);
  });

  it("incluye ligas (vacío cuando el complejo no tiene ninguna)", async () => {
    const complejo = await crearComplejoFixture();
    await crearCanchaFixture(complejo.id);

    const r = await getComplejoView(complejo.slug, null);
    expect(r!.ligas).toEqual([]);
  });

  it("no incluye canchas inactivas", async () => {
    const complejo = await crearComplejoFixture();
    await crearCanchaFixture(complejo.id, { activo: false });

    const r = await getComplejoView(complejo.slug, null);
    expect(r!.canchas).toHaveLength(0);
  });

  it("refleja una reserva como ocupada, con reservaId", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const jugador = await crearUsuarioFixture();
    const fecha = fechaRelativa(1);

    const reserva = await crearReserva(jugador.id, cancha.id, fecha, "19:00");
    expect(reserva.ok).toBe(true);
    if (!reserva.ok) return;

    const r = await getComplejoView(complejo.slug, null);
    const slot = r!.canchas[0]!.slots.find((s) => s.fecha === fecha && s.hora === "19:00");
    expect(slot?.estado).toBe("confirmada");
    expect(slot?.reservaId).toBe(reserva.reservaId);
  });

  it("muestra faltanJugadores solo a quien no participa, y yaParticipa a quien ya está", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id, { capacidadJugadores: 6 });
    const organizador = await crearUsuarioFixture();
    const otro = await crearUsuarioFixture();
    const fecha = fechaRelativa(1);

    const reserva = await crearReserva(organizador.id, cancha.id, fecha, "19:00");
    if (!reserva.ok) throw new Error("fixture");
    const solicitud = await crearSolicitudRival(organizador.id, reserva.reservaId);
    if (!solicitud.ok) throw new Error("fixture");

    const vistaOrganizador = await getComplejoView(complejo.slug, organizador.id);
    const slotOrganizador = vistaOrganizador!.canchas[0]!.slots.find((s) => s.fecha === fecha && s.hora === "19:00");
    expect(slotOrganizador?.yaParticipa).toBe(true);
    expect(slotOrganizador?.faltanJugadores).toBeNull();
    expect(slotOrganizador?.solicitudId).toBeNull();

    const vistaOtro = await getComplejoView(complejo.slug, otro.id);
    const slotOtro = vistaOtro!.canchas[0]!.slots.find((s) => s.fecha === fecha && s.hora === "19:00");
    expect(slotOtro?.yaParticipa).toBe(false);
    expect(slotOtro?.faltanJugadores).toBe(5); // capacidad 6 - organizador
    expect(slotOtro?.solicitudId).toBe(solicitud.solicitudId);
  });
});
