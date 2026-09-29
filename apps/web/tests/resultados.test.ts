import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, participantesReserva, reservas } from "@cancha-llena/db";
import { crearReserva } from "@/lib/reservas";
import { nivelesDeJugador, obtenerReservaParaReportar, obtenerRivales, reportarResultado } from "@/lib/resultados";
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

// El organizador (equipo A) contra un rival nuevo (equipo B) — para los
// tests de obtenerRivales, donde lo que importa es acumular resultados
// entre las MISMAS dos personas a través de varios partidos.
async function jugarPartido(capacidad: number, equipoGanador: "A" | "B" | "empate") {
  const { reservaId, organizador } = await partidoJugadoFixture(capacidad);
  const rival = await crearUsuarioFixture();
  await agregarParticipante(reservaId, rival.id);
  await reportarResultado(organizador.id, reservaId, equipoGanador, [
    { usuarioId: organizador.id, equipo: "A" },
    { usuarioId: rival.id, equipo: "B" },
  ]);
  return { organizador, rival, reservaId };
}

async function jugarPartidoConMismoRival(
  organizador: Awaited<ReturnType<typeof crearUsuarioFixture>>,
  rival: Awaited<ReturnType<typeof crearUsuarioFixture>>,
  equipoGanador: "A" | "B" | "empate",
) {
  const complejo = await crearComplejoFixture();
  const cancha = await crearCanchaFixture(complejo.id, { capacidadJugadores: 4 });
  const r = await crearReserva(organizador.id, cancha.id, fechaRelativa(1), "19:00");
  if (!r.ok) throw new Error("fixture: no se pudo reservar");
  await db.update(reservas).set({ fecha: fechaRelativa(-1) }).where(eq(reservas.id, r.reservaId));
  await agregarParticipante(r.reservaId, rival.id);
  await reportarResultado(organizador.id, r.reservaId, equipoGanador, [
    { usuarioId: organizador.id, equipo: "A" },
    { usuarioId: rival.id, equipo: "B" },
  ]);
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

  it("dos reportes concurrentes del mismo partido: el ELO se aplica una sola vez", async () => {
    const { reservaId, organizador } = await partidoJugadoFixture(4);
    const rival = await crearUsuarioFixture();
    await agregarParticipante(reservaId, rival.id);

    const asignaciones = [
      { usuarioId: organizador.id, equipo: "A" as const },
      { usuarioId: rival.id, equipo: "B" as const },
    ];
    const [a, b] = await Promise.all([
      reportarResultado(organizador.id, reservaId, "A", asignaciones),
      reportarResultado(rival.id, reservaId, "A", asignaciones),
    ]);

    const resultados = [a, b];
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    expect(resultados.filter((r) => !r.ok && r.error === "ya_reportado")).toHaveLength(1);

    const ganador = await db.query.usuarios.findFirst({ where: { id: organizador.id } });
    const nivelGanador = nivelesDeJugador(ganador?.nivelPorDeporte).find((n) => n.deporte === "futbolito")?.nivel;
    expect(nivelGanador).toBe(1016); // si el delta se aplicara dos veces, sería 1032
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

describe("obtenerRivales", () => {
  it("acumula victorias, derrotas y empates contra el mismo rival a través de varios partidos", async () => {
    const { organizador, rival } = await jugarPartido(4, "A"); // organizador gana
    await jugarPartidoConMismoRival(organizador, rival, "B"); // organizador pierde
    await jugarPartidoConMismoRival(organizador, rival, "empate");

    const rivales = await obtenerRivales(organizador.id);
    expect(rivales).toEqual([{ rivalId: rival.id, rivalNombre: rival.nombre, victorias: 1, derrotas: 1, empates: 1 }]);

    const desdeElOtroLado = await obtenerRivales(rival.id);
    expect(desdeElOtroLado).toEqual([{ rivalId: organizador.id, rivalNombre: organizador.nombre, victorias: 1, derrotas: 1, empates: 1 }]);
  });

  it("no cuenta un partido que todavía no tiene resultado reportado", async () => {
    const { reservaId, organizador } = await partidoJugadoFixture(4);
    const rival = await crearUsuarioFixture();
    await agregarParticipante(reservaId, rival.id);

    expect(await obtenerRivales(organizador.id)).toEqual([]);
  });

  it("no cuenta a un compañero del mismo equipo como rival", async () => {
    const { reservaId, organizador } = await partidoJugadoFixture(4);
    const companero = await crearUsuarioFixture();
    const rival = await crearUsuarioFixture();
    await agregarParticipante(reservaId, companero.id);
    await agregarParticipante(reservaId, rival.id);

    await reportarResultado(organizador.id, reservaId, "A", [
      { usuarioId: organizador.id, equipo: "A" },
      { usuarioId: companero.id, equipo: "A" },
      { usuarioId: rival.id, equipo: "B" },
    ]);

    const rivales = await obtenerRivales(organizador.id);
    expect(rivales.map((r) => r.rivalId)).toEqual([rival.id]);
  });

  it("devuelve vacío para alguien que nunca jugó", async () => {
    const jugador = await crearUsuarioFixture();
    expect(await obtenerRivales(jugador.id)).toEqual([]);
  });
});

