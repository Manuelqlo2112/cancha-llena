import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, participantesReserva, reservas } from "@cancha-llena/db";
import { crearReserva } from "@/lib/reservas";
import { nivelesDeJugador, obtenerReservaParaReportar, reportarResultado } from "@/lib/resultados";
import { crearCanchaFixture, crearComplejoFixture, crearUsuarioFixture, fechaRelativa, resetDb } from "./helpers";

beforeEach(resetDb);

// crearReserva ya rechaza fechas pasadas, asÃ­ que para simular "partido ya
// jugado" el helper reserva para maÃ±ana y despuÃ©s mueve la fecha al pasado
// directo en la base â€” mÃ¡s simple que tener que abrir una segunda vÃ­a de
// creaciÃ³n de reservas solo para los tests.
async function partidoJugadoFixture(capacidad = 4) {
  const complejo = await crearComplejoFixture();
  const cancha = await crearCanchaFixture(complejo.id, { capacidadJugadores: capacidad });
  const organizador = await crearUsuarioFixture();
  const r = await crearReserva(organizador.id, cancha.id, fechaRelativa(1), "19:00");
  if (!r.ok) throw new Error("fixture: no se pudo reservar");
  await db.update(reservas).set({ fecha: fechaRelativa(-1) }).where(eq(reservas.id, r.reservaId));
  return { complejo, cancha, organizador, reservaId: r.reservaId };
}

async function agregarParticipante(reservaId: string, usuarioId: string) {
  await db.insert(participantesReserva).values({ reservaId, usuarioId, confirmado: true });
}

describe("reportarResultado", () => {
  it("actualiza el nivel de ambos equipos y deja fijo el resultado", async () => {
    const { reservaId, organizador } = await partidoJugadoFixture(4);
    const rival = await crearUsuarioFixture();
    await agregarParticipante(reservaId, rival.id);

    const r = await reportarResultado(organizador.id, reservaId, "A", [
      { usuarioId: organizador.id, equipo: "A" },
      { usuarioId: rival.id, equipo: "B" },
    ]);
    expect(r).toEqual({ ok: true });

    const ganador = await db.query.usuarios.findFirst({ where: { id: organizador.id } });
    const perdedor = await db.query.usuarios.findFirst({ where: { id: rival.id } });
    const nivelGanador = nivelesDeJugador(ganador?.nivelPorDeporte).find((n) => n.deporte === "futbolito")?.nivel;
    const nivelPerdedor = nivelesDeJugador(perdedor?.nivelPorDeporte).find((n) => n.deporte === "futbolito")?.nivel;
    expect(nivelGanador).toBe(1016); // 1000 + round(32 * (1 - 0.5))
    expect(nivelPerdedor).toBe(984); // 1000 - 16

    const reserva = await db.query.reservas.findFirst({ where: { id: reservaId } });
    expect(reserva?.equipoGanador).toBe("A");
    expect(reserva?.resultadoReportadoPorId).toBe(organizador.id);
    expect(reserva?.resultadoReportadoEn).not.toBeNull();

    const participantes = await db.query.participantesReserva.findMany({ where: { reservaId } });
    expect(participantes.find((p) => p.usuarioId === organizador.id)?.equipo).toBe("A");
    expect(participantes.find((p) => p.usuarioId === rival.id)?.equipo).toBe("B");
  });

  it("un empate no mueve el nivel de nadie", async () => {
    const { reservaId, organizador } = await partidoJugadoFixture(4);
    const rival = await crearUsuarioFixture();
    await agregarParticipante(reservaId, rival.id);

    await reportarResultado(organizador.id, reservaId, "empate", [
      { usuarioId: organizador.id, equipo: "A" },
      { usuarioId: rival.id, equipo: "B" },
    ]);

    const u1 = await db.query.usuarios.findFirst({ where: { id: organizador.id } });
    const u2 = await db.query.usuarios.findFirst({ where: { id: rival.id } });
    expect(nivelesDeJugador(u1?.nivelPorDeporte).find((n) => n.deporte === "futbolito")?.nivel).toBe(1000);
    expect(nivelesDeJugador(u2?.nivelPorDeporte).find((n) => n.deporte === "futbolito")?.nivel).toBe(1000);
  });

  it("rechaza reportar dos veces", async () => {
    const { reservaId, organizador } = await partidoJugadoFixture(4);
    const rival = await crearUsuarioFixture();
    await agregarParticipante(reservaId, rival.id);

    await reportarResultado(organizador.id, reservaId, "A", [
      { usuarioId: organizador.id, equipo: "A" },
      { usuarioId: rival.id, equipo: "B" },
    ]);
    const segundo = await reportarResultado(organizador.id, reservaId, "B", [
      { usuarioId: organizador.id, equipo: "A" },
      { usuarioId: rival.id, equipo: "B" },
    ]);
    expect(segundo).toEqual({ ok: false, error: "ya_reportado" });
  });

  it("rechaza a alguien que no participÃ³ en el partido", async () => {
    const { reservaId } = await partidoJugadoFixture(4);
    const ajeno = await crearUsuarioFixture();
    const r = await reportarResultado(ajeno.id, reservaId, "A", []);
    expect(r).toEqual({ ok: false, error: "sin_permiso" });
  });

  it("rechaza reportar un partido que todavÃ­a no se jugÃ³", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const organizador = await crearUsuarioFixture();
    const reserva = await crearReserva(organizador.id, cancha.id, fechaRelativa(1), "19:00");
    if (!reserva.ok) throw new Error("fixture");

    const r = await reportarResultado(organizador.id, reserva.reservaId, "A", [{ usuarioId: organizador.id, equipo: "A" }]);
    expect(r).toEqual({ ok: false, error: "partido_no_jugado" });
  });

  it("rechaza si un equipo queda vacÃ­o o si sobra/falta un participante", async () => {
    const { reservaId, organizador } = await partidoJugadoFixture(4);
    const rival = await crearUsuarioFixture();
    await agregarParticipante(reservaId, rival.id);

    const equipoVacio = await reportarResultado(organizador.id, reservaId, "A", [
      { usuarioId: organizador.id, equipo: "A" },
      { usuarioId: rival.id, equipo: "A" },
    ]);
    expect(equipoVacio).toEqual({ ok: false, error: "datos_invalidos" });

    const faltaUno = await reportarResultado(organizador.id, reservaId, "A", [{ usuarioId: organizador.id, equipo: "A" }]);
    expect(faltaUno).toEqual({ ok: false, error: "datos_invalidos" });
  });
});

describe("obtenerReservaParaReportar", () => {
  it("devuelve los participantes con cuenta para armar el formulario", async () => {
    const { reservaId, organizador } = await partidoJugadoFixture(4);
    const r = await obtenerReservaParaReportar(organizador.id, reservaId);
    expect(r).not.toBeNull();
    expect(r!.participantes).toEqual([{ usuarioId: organizador.id, nombre: organizador.nombre }]);
    expect(r!.yaReportado).toBe(false);
  });

  it("devuelve null para quien no participÃ³", async () => {
    const { reservaId } = await partidoJugadoFixture(4);
    const ajeno = await crearUsuarioFixture();
    const r = await obtenerReservaParaReportar(ajeno.id, reservaId);
    expect(r).toBeNull();
  });
});

