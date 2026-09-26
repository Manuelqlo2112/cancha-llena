import { beforeEach, describe, expect, it } from "vitest";
import { crearReserva, obtenerMisRachas } from "@/lib/reservas";
import { crearCanchaFixture, crearComplejoFixture, crearUsuarioFixture, fechaRelativa, resetDb } from "./helpers";

beforeEach(resetDb);

describe("racha semanal", () => {
  it("arranca en 1 con la primera reserva en un complejo", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const jugador = await crearUsuarioFixture();

    await crearReserva(jugador.id, cancha.id, fechaRelativa(1), "19:00");

    const rachas = await obtenerMisRachas(jugador.id);
    expect(rachas).toHaveLength(1);
    expect(rachas[0]).toMatchObject({ contadorActual: 1, mejorRacha: 1, complejoSlug: complejo.slug });
  });

  it("suma un contador cuando la siguiente reserva cae dentro de 8 días", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const jugador = await crearUsuarioFixture();

    await crearReserva(jugador.id, cancha.id, fechaRelativa(1), "19:00");
    await crearReserva(jugador.id, cancha.id, fechaRelativa(8), "19:00"); // 7 días después

    const rachas = await obtenerMisRachas(jugador.id);
    expect(rachas[0]?.contadorActual).toBe(2);
  });

  it("desbloquea la recompensa al llegar a 4 semanas seguidas", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const jugador = await crearUsuarioFixture();

    for (const offset of [1, 8, 15, 22]) {
      await crearReserva(jugador.id, cancha.id, fechaRelativa(offset), "19:00");
    }

    const rachas = await obtenerMisRachas(jugador.id);
    expect(rachas[0]).toMatchObject({ contadorActual: 4, recompensaDesbloqueada: true });
  });

  it("reinicia a 1 si pasaron más de 8 días entre reservas", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const jugador = await crearUsuarioFixture();

    await crearReserva(jugador.id, cancha.id, fechaRelativa(1), "19:00");
    await crearReserva(jugador.id, cancha.id, fechaRelativa(20), "19:00"); // 19 días después, rompe la racha

    const rachas = await obtenerMisRachas(jugador.id);
    expect(rachas[0]).toMatchObject({ contadorActual: 1, mejorRacha: 1 });
  });

  it("no la cuenta dos veces si se reserva otra cancha el mismo día", async () => {
    const complejo = await crearComplejoFixture();
    const cancha1 = await crearCanchaFixture(complejo.id, { nombre: "Cancha 1" });
    const cancha2 = await crearCanchaFixture(complejo.id, { nombre: "Cancha 2" });
    const jugador = await crearUsuarioFixture();

    await crearReserva(jugador.id, cancha1.id, fechaRelativa(1), "19:00");
    await crearReserva(jugador.id, cancha2.id, fechaRelativa(1), "13:00"); // mismo día, mismo complejo

    const rachas = await obtenerMisRachas(jugador.id);
    expect(rachas).toHaveLength(1);
    expect(rachas[0]?.contadorActual).toBe(1);
  });

  it("lleva rachas separadas por complejo", async () => {
    const complejoA = await crearComplejoFixture();
    const complejoB = await crearComplejoFixture();
    const canchaA = await crearCanchaFixture(complejoA.id);
    const canchaB = await crearCanchaFixture(complejoB.id);
    const jugador = await crearUsuarioFixture();

    await crearReserva(jugador.id, canchaA.id, fechaRelativa(1), "19:00");
    await crearReserva(jugador.id, canchaB.id, fechaRelativa(2), "19:00");

    const rachas = await obtenerMisRachas(jugador.id);
    expect(rachas).toHaveLength(2);
    expect(rachas.every((r) => r.contadorActual === 1)).toBe(true);
  });
});
