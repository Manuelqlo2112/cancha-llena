import { beforeEach, describe, expect, it } from "vitest";
import { db, rachas } from "@cancha-llena/db";
import { crearPlan, suscribirse } from "@/lib/planes";
import { actualizarUbicacion, crearReserva, tieneDescuentoValle } from "@/lib/reservas";
import { crearCanchaFixture, crearComplejoFixture, crearUsuarioFixture, fechaRelativa, proximoDiaLaboral, resetDb } from "./helpers";

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

  it("con un plan mensual activo, un horario normal entre semana sale en 0 y consume un cupo", async () => {
    const complejo = await crearComplejoFixture({ requiereAbono: true, porcentajeAbono: "50.00" });
    const cancha = await crearCanchaFixture(complejo.id, { precioBase: "39500" });
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const jugador = await crearUsuarioFixture();
    const plan = await crearPlan(admin, complejo.id, { deporte: "futbolito", nombre: "Plan mensual", cuposPorMes: 4, precioMensual: 140000 });
    if (!plan.ok) throw new Error("fixture");
    await suscribirse(jugador.id, plan.planId);

    const r = await crearReserva(jugador.id, cancha.id, proximoDiaLaboral(), "19:00");
    expect(r).toMatchObject({ ok: true, cubiertoPorPlan: true });
    if (!r.ok) return;

    const reserva = await db.query.reservas.findFirst({ where: { id: r.reservaId }, with: { pagos: true } });
    expect(Number(reserva?.montoTotal)).toBe(0);
    expect(Number(reserva?.montoAbono)).toBe(0);
    expect(reserva?.pagos).toHaveLength(0); // sin abono simulado: el plan ya "pagó"
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

  it("dos reservas concurrentes para el mismo horario: solo una gana, la otra recibe 'ocupado' (no un error crudo)", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const j1 = await crearUsuarioFixture();
    const j2 = await crearUsuarioFixture();
    const fecha = fechaRelativa(1);

    // Promise.all (no await secuencial) para que ambas lleguen al INSERT sin
    // que el chequeo "yaExiste" de la primera ya haya visto a la segunda —
    // esto es lo que realmente ejercita el catch de la constraint unique.
    const [a, b] = await Promise.all([
      crearReserva(j1.id, cancha.id, fecha, "19:00"),
      crearReserva(j2.id, cancha.id, fecha, "19:00"),
    ]);

    const resultados = [a, b];
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    expect(resultados.filter((r) => !r.ok && r.error === "ocupado")).toHaveLength(1);
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

  it("rechaza canchaId, fecha u hora con formato inválido antes de tocar la base", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const jugador = await crearUsuarioFixture();
    const fechaOk = fechaRelativa(1);

    await expect(crearReserva(jugador.id, "no-es-un-uuid", fechaOk, "19:00")).resolves.toEqual({ ok: false, error: "datos_invalidos" });
    await expect(crearReserva(jugador.id, cancha.id, "no-es-una-fecha", "19:00")).resolves.toEqual({ ok: false, error: "datos_invalidos" });
    await expect(crearReserva(jugador.id, cancha.id, "2026-13-45", "19:00")).resolves.toEqual({ ok: false, error: "datos_invalidos" });
    await expect(crearReserva(jugador.id, cancha.id, fechaOk, "19:30")).resolves.toEqual({ ok: false, error: "datos_invalidos" });
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

// Fecha futura garantizada lun-vie — SLOTS_VALLE (10:00/13:00) solo es
// horario valle de verdad esos días (esDiaLaboral en slots.ts).
function fechaValleFutura(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe("tieneDescuentoValle / descuento gamificado en horas valle", () => {
  it("false sin racha", async () => {
    const complejo = await crearComplejoFixture();
    const jugador = await crearUsuarioFixture();
    expect(await tieneDescuentoValle(jugador.id, complejo.id)).toBe(false);
  });

  it("false con racha activa pero sin recompensa desbloqueada (menos de 4 semanas)", async () => {
    const complejo = await crearComplejoFixture();
    const jugador = await crearUsuarioFixture();
    await db.insert(rachas).values({ usuarioId: jugador.id, complejoId: complejo.id, contadorActual: 2, mejorRacha: 2, ultimaFechaValida: fechaRelativa(0), recompensaDesbloqueada: false });
    expect(await tieneDescuentoValle(jugador.id, complejo.id)).toBe(false);
  });

  it("true con recompensa desbloqueada y racha vigente (jugó hace poco)", async () => {
    const complejo = await crearComplejoFixture();
    const jugador = await crearUsuarioFixture();
    await db.insert(rachas).values({ usuarioId: jugador.id, complejoId: complejo.id, contadorActual: 5, mejorRacha: 5, ultimaFechaValida: fechaRelativa(-2), recompensaDesbloqueada: true });
    expect(await tieneDescuentoValle(jugador.id, complejo.id)).toBe(true);
  });

  it("false con recompensa desbloqueada pero racha ya cortada (más de 8 días sin jugar)", async () => {
    const complejo = await crearComplejoFixture();
    const jugador = await crearUsuarioFixture();
    await db.insert(rachas).values({ usuarioId: jugador.id, complejoId: complejo.id, contadorActual: 5, mejorRacha: 5, ultimaFechaValida: fechaRelativa(-15), recompensaDesbloqueada: true });
    expect(await tieneDescuentoValle(jugador.id, complejo.id)).toBe(false);
  });

  it("crearReserva aplica 15% de descuento en un slot valle cuando el descuento está activo", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id, { precioBase: "40000" });
    const jugador = await crearUsuarioFixture();
    await db.insert(rachas).values({ usuarioId: jugador.id, complejoId: complejo.id, contadorActual: 5, mejorRacha: 5, ultimaFechaValida: fechaRelativa(-2), recompensaDesbloqueada: true });

    const r = await crearReserva(jugador.id, cancha.id, fechaValleFutura(), "10:00");
    expect(r).toMatchObject({ ok: true, descuentoAplicado: true });
    if (!r.ok) return;

    const reserva = await db.query.reservas.findFirst({ where: { id: r.reservaId } });
    expect(Number(reserva?.montoTotal)).toBe(34000); // 40000 - 15%
  });

  it("crearReserva NO aplica el descuento en un slot prime aunque esté activo", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id, { precioBase: "40000" });
    const jugador = await crearUsuarioFixture();
    await db.insert(rachas).values({ usuarioId: jugador.id, complejoId: complejo.id, contadorActual: 5, mejorRacha: 5, ultimaFechaValida: fechaRelativa(-2), recompensaDesbloqueada: true });

    const r = await crearReserva(jugador.id, cancha.id, fechaRelativa(1), "19:00");
    expect(r).toMatchObject({ ok: true, descuentoAplicado: false });
    if (!r.ok) return;

    const reserva = await db.query.reservas.findFirst({ where: { id: r.reservaId } });
    expect(Number(reserva?.montoTotal)).toBe(40000);
  });
});

describe("actualizarUbicacion", () => {
  it("guarda coordenadas válidas", async () => {
    const jugador = await crearUsuarioFixture();
    const r = await actualizarUbicacion(jugador.id, -33.45, -70.66);
    expect(r).toEqual({ ok: true });

    const actualizado = await db.query.usuarios.findFirst({ where: { id: jugador.id } });
    expect(Number(actualizado?.ultimaLat)).toBeCloseTo(-33.45);
    expect(Number(actualizado?.ultimaLng)).toBeCloseTo(-70.66);
  });

  it("rechaza coordenadas fuera de rango o NaN sin guardar nada", async () => {
    const jugador = await crearUsuarioFixture();

    for (const [lat, lng] of [[999, -70.66], [-33.45, 999], [NaN, -70.66], [-33.45, NaN]] as const) {
      const r = await actualizarUbicacion(jugador.id, lat, lng);
      expect(r).toEqual({ ok: false });
    }

    const sinCambios = await db.query.usuarios.findFirst({ where: { id: jugador.id } });
    expect(sinCambios?.ultimaLat).toBeNull();
  });
});
