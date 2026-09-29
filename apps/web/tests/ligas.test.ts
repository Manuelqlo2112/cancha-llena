import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@cancha-llena/db";
import { crearLiga, inscribirseALiga, listarLigasDeComplejo, salirDeLiga } from "@/lib/ligas";
import { crearCanchaFixture, crearComplejoFixture, crearUsuarioFixture, resetDb } from "./helpers";

beforeEach(resetDb);

async function ligaFixture(cupoMaximo = 4) {
  const complejo = await crearComplejoFixture();
  const cancha = await crearCanchaFixture(complejo.id, { capacidadJugadores: 10, precioBase: "40000" });
  const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
  const r = await crearLiga(admin, complejo.id, { canchaId: cancha.id, nombre: "Liga de los martes", diaSemana: 2, horaInicio: "10:00", cupoMaximo });
  if (!r.ok) throw new Error("fixture: no se pudo crear la liga");
  return { complejo, cancha, admin, ligaId: r.ligaId };
}

describe("crearLiga", () => {
  it("la crea cuando el admin dueño manda datos válidos", async () => {
    const { ligaId } = await ligaFixture();
    expect(ligaId).toBeTruthy();
  });

  it("rechaza a quien no administra ese complejo", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const jugador = await crearUsuarioFixture({ rol: "jugador" });
    const r = await crearLiga(jugador, complejo.id, { canchaId: cancha.id, nombre: "Liga", diaSemana: 2, horaInicio: "10:00", cupoMaximo: 4 });
    expect(r).toEqual({ ok: false, error: "sin_permiso" });
  });

  it("rechaza un horaInicio que no es un slot valle real", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const r = await crearLiga(admin, complejo.id, { canchaId: cancha.id, nombre: "Liga", diaSemana: 2, horaInicio: "19:00", cupoMaximo: 4 });
    expect(r).toEqual({ ok: false, error: "datos_invalidos" });
  });

  it("rechaza un día de fin de semana (ahí esos horarios son prime, no valle)", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id);
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const sabado = await crearLiga(admin, complejo.id, { canchaId: cancha.id, nombre: "Liga", diaSemana: 6, horaInicio: "10:00", cupoMaximo: 4 });
    expect(sabado).toEqual({ ok: false, error: "datos_invalidos" });
    const domingo = await crearLiga(admin, complejo.id, { canchaId: cancha.id, nombre: "Liga", diaSemana: 0, horaInicio: "10:00", cupoMaximo: 4 });
    expect(domingo).toEqual({ ok: false, error: "datos_invalidos" });
  });

  it("rechaza un cupoMaximo mayor a la capacidad de la cancha", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id, { capacidadJugadores: 6 });
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const r = await crearLiga(admin, complejo.id, { canchaId: cancha.id, nombre: "Liga", diaSemana: 2, horaInicio: "10:00", cupoMaximo: 7 });
    expect(r).toEqual({ ok: false, error: "datos_invalidos" });
  });
});

describe("inscribirseALiga / salirDeLiga", () => {
  it("suma un inscripto y lo refleja en el listado", async () => {
    const { ligaId } = await ligaFixture(4);
    const jugador = await crearUsuarioFixture();

    const r = await inscribirseALiga(jugador.id, ligaId);
    expect(r).toEqual({ ok: true });

    const liga = await db.query.ligas.findFirst({ where: { id: ligaId } });
    expect(liga?.cupoOcupado).toBe(1);
  });

  it("rechaza inscribirse dos veces", async () => {
    const { ligaId } = await ligaFixture(4);
    const jugador = await crearUsuarioFixture();
    await inscribirseALiga(jugador.id, ligaId);
    const segundo = await inscribirseALiga(jugador.id, ligaId);
    expect(segundo).toEqual({ ok: false, error: "ya_inscrito" });
  });

  it("rechaza inscribirse cuando no quedan cupos", async () => {
    const { ligaId } = await ligaFixture(1);
    const j1 = await crearUsuarioFixture();
    const j2 = await crearUsuarioFixture();
    await inscribirseALiga(j1.id, ligaId);
    const r = await inscribirseALiga(j2.id, ligaId);
    expect(r).toEqual({ ok: false, error: "sin_cupo" });
  });

  it("salir libera el cupo y permite volver a inscribirse", async () => {
    const { ligaId } = await ligaFixture(1);
    const jugador = await crearUsuarioFixture();
    await inscribirseALiga(jugador.id, ligaId);

    const salida = await salirDeLiga(jugador.id, ligaId);
    expect(salida).toEqual({ ok: true });
    const liga = await db.query.ligas.findFirst({ where: { id: ligaId } });
    expect(liga?.cupoOcupado).toBe(0);

    const otra = await crearUsuarioFixture();
    const r = await inscribirseALiga(otra.id, ligaId);
    expect(r).toEqual({ ok: true });

    const reinscripcion = await inscribirseALiga(jugador.id, ligaId);
    expect(reinscripcion).toEqual({ ok: false, error: "sin_cupo" }); // el cupo lo tomó "otra"
  });

  it("rechaza salir de una liga en la que no está inscripto", async () => {
    const { ligaId } = await ligaFixture();
    const jugador = await crearUsuarioFixture();
    const r = await salirDeLiga(jugador.id, ligaId);
    expect(r).toEqual({ ok: false, error: "no_inscrito" });
  });
});

describe("listarLigasDeComplejo", () => {
  it("materializa la sesión de la semana apenas hay al menos un inscripto", async () => {
    const { complejo, cancha, ligaId } = await ligaFixture(4);
    const jugador = await crearUsuarioFixture();
    await inscribirseALiga(jugador.id, ligaId);

    const listado = await listarLigasDeComplejo(complejo.id, jugador.id);
    expect(listado).toHaveLength(1);
    expect(listado[0]).toMatchObject({ id: ligaId, cupoOcupado: 1, cupoMaximo: 4, inscrito: true });

    const reservaMaterializada = await db.query.reservas.findFirst({ where: { canchaId: cancha.id, horaInicio: "10:00" } });
    expect(reservaMaterializada).toBeDefined();
    expect(reservaMaterializada?.esHorarioValle).toBe(true);
    const participantes = await db.query.participantesReserva.findMany({ where: { reservaId: reservaMaterializada!.id } });
    expect(participantes).toHaveLength(1);
    expect(participantes[0]?.usuarioId).toBe(jugador.id);
  });

  it("no materializa nada si la liga todavía no tiene inscriptos", async () => {
    const { complejo, cancha } = await ligaFixture(4);
    await listarLigasDeComplejo(complejo.id, null);
    const reservaMaterializada = await db.query.reservas.findFirst({ where: { canchaId: cancha.id } });
    expect(reservaMaterializada).toBeUndefined();
  });

  it("es idempotente: llamarlo dos veces no crea dos reservas", async () => {
    const { complejo, cancha, ligaId } = await ligaFixture(4);
    const jugador = await crearUsuarioFixture();
    await inscribirseALiga(jugador.id, ligaId);

    await listarLigasDeComplejo(complejo.id, jugador.id);
    await listarLigasDeComplejo(complejo.id, jugador.id);

    const reservasDeLaCancha = await db.query.reservas.findMany({ where: { canchaId: cancha.id } });
    expect(reservasDeLaCancha).toHaveLength(1);
  });
});
