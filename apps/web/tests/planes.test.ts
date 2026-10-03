import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@cancha-llena/db";
import { cancelarSuscripcion, consumirCupoSiAplica, crearPlan, listarPlanesDeComplejo, suscribirse } from "@/lib/planes";
import { crearComplejoFixture, crearUsuarioFixture, proximoDiaLaboral, resetDb } from "./helpers";

beforeEach(resetDb);

const datosValidos = { deporte: "futbolito", nombre: "Plan mensual", cuposPorMes: 4, precioMensual: 140000 };

describe("crearPlan", () => {
  it("el admin dueño (o super_admin) puede crear un plan", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });

    const r = await crearPlan(admin, complejo.id, datosValidos);
    expect(r.ok).toBe(true);

    const planes = await db.query.planesMensuales.findMany({ where: { complejoId: complejo.id } });
    expect(planes).toHaveLength(1);
    expect(planes[0]).toMatchObject({ nombre: "Plan mensual", cuposPorMes: 4 });
    expect(Number(planes[0]!.precioMensual)).toBe(140000);
  });

  it("rechaza a un admin de otro complejo", async () => {
    const complejoA = await crearComplejoFixture();
    const complejoB = await crearComplejoFixture();
    const adminDeB = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejoB.id });

    const r = await crearPlan(adminDeB, complejoA.id, datosValidos);
    expect(r).toEqual({ ok: false, error: "sin_permiso" });
  });

  it("rechaza un deporte inválido, cupos fuera de rango o precio inválido", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });

    expect(await crearPlan(admin, complejo.id, { ...datosValidos, deporte: "basquetbol" })).toEqual({ ok: false, error: "datos_invalidos" });
    expect(await crearPlan(admin, complejo.id, { ...datosValidos, cuposPorMes: 0 })).toEqual({ ok: false, error: "datos_invalidos" });
    expect(await crearPlan(admin, complejo.id, { ...datosValidos, precioMensual: 0 })).toEqual({ ok: false, error: "datos_invalidos" });
  });
});

describe("suscribirse / cancelarSuscripcion / listarPlanesDeComplejo", () => {
  it("suscribirse activa la suscripción y aparece en el listado", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const jugador = await crearUsuarioFixture();
    const creado = await crearPlan(admin, complejo.id, datosValidos);
    if (!creado.ok) throw new Error("fixture");

    expect(await suscribirse(jugador.id, creado.planId)).toEqual({ ok: true });

    const planes = await listarPlanesDeComplejo(complejo.id, jugador.id);
    expect(planes).toEqual([
      expect.objectContaining({ id: creado.planId, suscrito: true, cuposUsadosMes: 0 }),
    ]);
  });

  it("rechaza suscribirse dos veces mientras ya está activa", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const jugador = await crearUsuarioFixture();
    const creado = await crearPlan(admin, complejo.id, datosValidos);
    if (!creado.ok) throw new Error("fixture");

    await suscribirse(jugador.id, creado.planId);
    expect(await suscribirse(jugador.id, creado.planId)).toEqual({ ok: false, error: "ya_suscrito" });
  });

  it("cancelar y volver a suscribirse reactiva la misma fila, resetea cupos usados", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const jugador = await crearUsuarioFixture();
    const creado = await crearPlan(admin, complejo.id, datosValidos);
    if (!creado.ok) throw new Error("fixture");

    await suscribirse(jugador.id, creado.planId);
    await consumirCupoSiAplica(jugador.id, complejo.id, "futbolito", proximoDiaLaboral(), "19:00");
    expect(await cancelarSuscripcion(jugador.id, creado.planId)).toEqual({ ok: true });
    expect(await suscribirse(jugador.id, creado.planId)).toEqual({ ok: true });

    const planes = await listarPlanesDeComplejo(complejo.id, jugador.id);
    expect(planes[0]).toMatchObject({ suscrito: true, cuposUsadosMes: 0 });
  });

  it("dos suscripciones concurrentes del mismo usuario: solo una queda activa", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const jugador = await crearUsuarioFixture();
    const creado = await crearPlan(admin, complejo.id, datosValidos);
    if (!creado.ok) throw new Error("fixture");

    const [a, b] = await Promise.all([suscribirse(jugador.id, creado.planId), suscribirse(jugador.id, creado.planId)]);
    const resultados = [a, b];
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    expect(resultados.filter((r) => !r.ok && r.error === "ya_suscrito")).toHaveLength(1);
  });
});

describe("consumirCupoSiAplica", () => {
  it("consume un cupo en horario normal entre semana si hay plan activo", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const jugador = await crearUsuarioFixture();
    const creado = await crearPlan(admin, complejo.id, { ...datosValidos, cuposPorMes: 2 });
    if (!creado.ok) throw new Error("fixture");
    await suscribirse(jugador.id, creado.planId);

    const dia = proximoDiaLaboral();
    expect(await consumirCupoSiAplica(jugador.id, complejo.id, "futbolito", dia, "19:00")).toBe(true);
    expect(await consumirCupoSiAplica(jugador.id, complejo.id, "futbolito", dia, "21:00")).toBe(true);
    // El cupo del mes (2) ya se gastó entero.
    expect(await consumirCupoSiAplica(jugador.id, complejo.id, "futbolito", dia, "19:00")).toBe(false);
  });

  it("no aplica en horario valle (ya tiene su propio descuento por racha)", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const jugador = await crearUsuarioFixture();
    const creado = await crearPlan(admin, complejo.id, datosValidos);
    if (!creado.ok) throw new Error("fixture");
    await suscribirse(jugador.id, creado.planId);

    expect(await consumirCupoSiAplica(jugador.id, complejo.id, "futbolito", proximoDiaLaboral(), "10:00")).toBe(false);
  });

  it("no aplica sin plan activo para ese complejo+deporte", async () => {
    const complejo = await crearComplejoFixture();
    const jugador = await crearUsuarioFixture();
    expect(await consumirCupoSiAplica(jugador.id, complejo.id, "futbolito", proximoDiaLaboral(), "19:00")).toBe(false);
  });

  it("dos consumos concurrentes con un solo cupo restante: solo uno gana", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const jugador = await crearUsuarioFixture();
    const creado = await crearPlan(admin, complejo.id, { ...datosValidos, cuposPorMes: 1 });
    if (!creado.ok) throw new Error("fixture");
    await suscribirse(jugador.id, creado.planId);

    const dia = proximoDiaLaboral();
    const [a, b] = await Promise.all([
      consumirCupoSiAplica(jugador.id, complejo.id, "futbolito", dia, "19:00"),
      consumirCupoSiAplica(jugador.id, complejo.id, "futbolito", dia, "21:00"),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });
});
