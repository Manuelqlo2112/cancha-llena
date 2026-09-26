import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@cancha-llena/db";
import { crearReserva } from "@/lib/reservas";
import { crearCanchaFixture, crearComplejoFixture, crearUsuarioFixture, fechaRelativa, resetDb } from "./helpers";

beforeEach(resetDb);

describe("crearReserva", () => {
  it("crea la reserva y el participante organizador", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const jugador = await crearUsuarioFixture();

    const r = await crearReserva(jugador.id, cancha.id, fechaRelativa(1), "19:00");

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const reserva = await db.query.reservas.findFirst({ where: { id: r.reservaId }, with: { participantes: true } });
    expect(reserva?.estado).toBe("confirmada");
    expect(reserva?.participantes).toHaveLength(1);
    expect(reserva?.participantes[0]?.usuarioId).toBe(jugador.id);
  });

  it("rechaza un horario ya ocupado", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const j1 = await crearUsuarioFixture();
    const j2 = await crearUsuarioFixture();
    const fecha = fechaRelativa(1);

    const primero = await crearReserva(j1.id, cancha.id, fecha, "19:00");
    expect(primero.ok).toBe(true);

    const segundo = await crearReserva(j2.id, cancha.id, fecha, "19:00");
    expect(segundo).toEqual({ ok: false, error: "ocupado" });
  });

  it("rechaza una cancha inexistente", async () => {
    const jugador = await crearUsuarioFixture();
    const r = await crearReserva(jugador.id, "00000000-0000-0000-0000-000000000000", fechaRelativa(1), "19:00");
    expect(r).toEqual({ ok: false, error: "cancha_no_existe" });
  });

  it("rechaza una fecha ya pasada", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const jugador = await crearUsuarioFixture();

    const r = await crearReserva(jugador.id, cancha.id, fechaRelativa(-1), "19:00");
    expect(r).toEqual({ ok: false, error: "fecha_pasada" });
  });

  it("genera un pago pendiente-a-pagado cuando el complejo exige abono", async () => {
    const complejo = await crearComplejoFixture({ requiereAbono: true, porcentajeAbono: "50.00" });
    const cancha = await crearCanchaFixture(complejo.id, { precioBase: "40000" });
    const jugador = await crearUsuarioFixture();

    const r = await crearReserva(jugador.id, cancha.id, fechaRelativa(1), "19:00");
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const pagoDeLaReserva = await db.query.pagos.findFirst({ where: { reservaId: r.reservaId } });
    expect(pagoDeLaReserva?.estado).toBe("pagado");
    expect(Number(pagoDeLaReserva?.monto)).toBe(20000);
  });

  it("no genera pago cuando el complejo no exige abono", async () => {
    const complejo = await crearComplejoFixture({ requiereAbono: false });
    const cancha = await crearCanchaFixture(complejo.id);
    const jugador = await crearUsuarioFixture();

    const r = await crearReserva(jugador.id, cancha.id, fechaRelativa(1), "19:00");
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const pago = await db.query.pagos.findFirst({ where: { reservaId: r.reservaId } });
    expect(pago).toBeUndefined();
  });
});
