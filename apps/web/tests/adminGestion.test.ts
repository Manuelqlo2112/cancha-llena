import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@cancha-llena/db";
import { actualizarCancha, actualizarComplejo, crearCancha, crearComplejo, obtenerImpactoGamificacion } from "@/lib/adminGestion";
import { crearCanchaFixture, crearComplejoFixture, crearUsuarioFixture, resetDb } from "./helpers";

beforeEach(resetDb);

describe("actualizarComplejo", () => {
  it("permite al admin_complejo dueño editar sus datos", async () => {
    const complejo = await crearComplejoFixture({ requiereAbono: false, porcentajeAbono: "0.00" });
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });

    const r = await actualizarComplejo(admin, complejo.id, {
      telefono: "+56911111111",
      email: "nuevo@correo.cl",
      horarioTexto: "Todos los días 09:00-22:00",
      amenidades: ["Estacionamiento"],
      requiereAbono: true,
      porcentajeAbono: 40,
    });
    expect(r).toEqual({ ok: true });

    const actualizado = await db.query.complejos.findFirst({ where: { id: complejo.id } });
    expect(actualizado?.telefono).toBe("+56911111111");
    expect(actualizado?.requiereAbono).toBe(true);
    expect(Number(actualizado?.porcentajeAbono)).toBe(40);
  });

  it("fuerza porcentajeAbono a 0 si requiereAbono es false, aunque manden otro valor", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });

    await actualizarComplejo(admin, complejo.id, {
      amenidades: [],
      requiereAbono: false,
      porcentajeAbono: 99,
    });

    const actualizado = await db.query.complejos.findFirst({ where: { id: complejo.id } });
    expect(Number(actualizado?.porcentajeAbono)).toBe(0);
  });

  it("rechaza a un admin_complejo de OTRO complejo", async () => {
    const complejoA = await crearComplejoFixture();
    const complejoB = await crearComplejoFixture();
    const adminDeB = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejoB.id });

    const r = await actualizarComplejo(adminDeB, complejoA.id, { amenidades: [], requiereAbono: false, porcentajeAbono: 0 });
    expect(r).toEqual({ ok: false, error: "sin_permiso" });

    const sinCambios = await db.query.complejos.findFirst({ where: { id: complejoA.id } });
    expect(sinCambios?.nombre).toBe(complejoA.nombre); // no tocado
  });

  it("rechaza a un jugador sin rol de admin", async () => {
    const complejo = await crearComplejoFixture();
    const jugador = await crearUsuarioFixture({ rol: "jugador" });

    const r = await actualizarComplejo(jugador, complejo.id, { amenidades: [], requiereAbono: false, porcentajeAbono: 0 });
    expect(r).toEqual({ ok: false, error: "sin_permiso" });
  });

  it("super_admin puede editar cualquier complejo", async () => {
    const complejo = await crearComplejoFixture();
    const superAdmin = await crearUsuarioFixture({ rol: "super_admin" });

    const r = await actualizarComplejo(superAdmin, complejo.id, { amenidades: ["Cafetería"], requiereAbono: false, porcentajeAbono: 0 });
    expect(r).toEqual({ ok: true });
  });

  it("rechaza porcentajeAbono fuera de rango (0, negativo, >100 o NaN) cuando requiereAbono es true", async () => {
    const complejo = await crearComplejoFixture({ requiereAbono: true, porcentajeAbono: "30.00" });
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const base = { amenidades: [] as string[], requiereAbono: true };

    for (const porcentajeAbono of [0, -10, 101, NaN]) {
      const r = await actualizarComplejo(admin, complejo.id, { ...base, porcentajeAbono });
      expect(r).toEqual({ ok: false, error: "datos_invalidos" });
    }

    const sinCambios = await db.query.complejos.findFirst({ where: { id: complejo.id } });
    expect(Number(sinCambios?.porcentajeAbono)).toBe(30); // ningún intento inválido se guardó
  });

  it("no valida el rango de porcentajeAbono cuando requiereAbono es false (siempre se fuerza a 0)", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });

    const r = await actualizarComplejo(admin, complejo.id, { amenidades: [], requiereAbono: false, porcentajeAbono: 999 });
    expect(r).toEqual({ ok: true });
  });
});

describe("actualizarCancha", () => {
  it("permite al admin dueño cambiar precio y estado activo", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id, { precioBase: "40000", activo: true });
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });

    const r = await actualizarCancha(admin, cancha.id, { precioBase: 55000, activo: false });
    expect(r).toEqual({ ok: true });

    const actualizada = await db.query.canchas.findFirst({ where: { id: cancha.id } });
    expect(Number(actualizada?.precioBase)).toBe(55000);
    expect(actualizada?.activo).toBe(false);
  });

  it("rechaza una cancha inexistente", async () => {
    const admin = await crearUsuarioFixture({ rol: "super_admin" });
    const r = await actualizarCancha(admin, "00000000-0000-0000-0000-000000000000", { precioBase: 1000, activo: true });
    expect(r).toEqual({ ok: false, error: "no_encontrada" });
  });

  it("rechaza a un admin de otro complejo", async () => {
    const complejoA = await crearComplejoFixture();
    const complejoB = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejoA.id);
    const adminDeB = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejoB.id });

    const r = await actualizarCancha(adminDeB, cancha.id, { precioBase: 1000, activo: true });
    expect(r).toEqual({ ok: false, error: "sin_permiso" });
  });

  it("rechaza precioBase inválido (0, negativo o NaN)", async () => {
    const complejo = await crearComplejoFixture();
    const cancha = await crearCanchaFixture(complejo.id, { precioBase: "40000" });
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });

    for (const precioBase of [0, -5000, NaN]) {
      const r = await actualizarCancha(admin, cancha.id, { precioBase, activo: true });
      expect(r).toEqual({ ok: false, error: "datos_invalidos" });
    }

    const sinCambios = await db.query.canchas.findFirst({ where: { id: cancha.id } });
    expect(Number(sinCambios?.precioBase)).toBe(40000); // ningún intento inválido se guardó
  });
});

describe("obtenerImpactoGamificacion", () => {
  it("da todo en cero para un complejo sin canchas", async () => {
    const complejo = await crearComplejoFixture();
    const r = await obtenerImpactoGamificacion(complejo.id);
    expect(r).toEqual({ solicitudesAbiertas: 0, solicitudesTotales: 0, cuposViaSolicitud: 0, jugadoresConRachaActiva: 0 });
  });
});

describe("crearComplejo", () => {
  const datosValidos = {
    nombre: "Cancha del Sol",
    comuna: "Ñuñoa",
    direccion: "Av. Siempre Viva 123",
    comisionBasePct: 8,
    comisionVallePct: 14,
    requiereAbono: false,
    porcentajeAbono: 0,
  };

  it("solo super_admin puede crear un complejo", async () => {
    const admin = await crearUsuarioFixture({ rol: "admin_complejo" });
    const jugador = await crearUsuarioFixture({ rol: "jugador" });
    expect(await crearComplejo(admin, datosValidos)).toEqual({ ok: false, error: "sin_permiso" });
    expect(await crearComplejo(jugador, datosValidos)).toEqual({ ok: false, error: "sin_permiso" });
  });

  it("genera un slug sin tildes ni ñ a partir del nombre", async () => {
    const superAdmin = await crearUsuarioFixture({ rol: "super_admin" });
    const r = await crearComplejo(superAdmin, { ...datosValidos, nombre: "Cancha Ñuñoa Fútbol" });
    expect(r).toEqual({ ok: true, slug: "cancha-nunoa-futbol" });
  });

  it("si el slug ya existe le suma un sufijo numérico en vez de chocar", async () => {
    const superAdmin = await crearUsuarioFixture({ rol: "super_admin" });
    const primero = await crearComplejo(superAdmin, datosValidos);
    const segundo = await crearComplejo(superAdmin, datosValidos);
    expect(primero).toEqual({ ok: true, slug: "cancha-del-sol" });
    expect(segundo).toEqual({ ok: true, slug: "cancha-del-sol-2" });
  });

  it("rechaza comisiones fuera de rango", async () => {
    const superAdmin = await crearUsuarioFixture({ rol: "super_admin" });
    expect(await crearComplejo(superAdmin, { ...datosValidos, comisionBasePct: -1 })).toEqual({ ok: false, error: "datos_invalidos" });
    expect(await crearComplejo(superAdmin, { ...datosValidos, comisionVallePct: 101 })).toEqual({ ok: false, error: "datos_invalidos" });
  });

  it("rechaza nombre, comuna o dirección vacíos", async () => {
    const superAdmin = await crearUsuarioFixture({ rol: "super_admin" });
    expect(await crearComplejo(superAdmin, { ...datosValidos, nombre: "  " })).toEqual({ ok: false, error: "datos_invalidos" });
    expect(await crearComplejo(superAdmin, { ...datosValidos, direccion: "" })).toEqual({ ok: false, error: "datos_invalidos" });
  });

  it("dos altas concurrentes con el mismo nombre no chocan: cada una termina con un slug propio", async () => {
    const superAdmin = await crearUsuarioFixture({ rol: "super_admin" });
    const [a, b] = await Promise.all([crearComplejo(superAdmin, datosValidos), crearComplejo(superAdmin, datosValidos)]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.slug).not.toBe(b.slug);
  });
});

describe("crearCancha", () => {
  it("el admin dueño (o super_admin) puede agregar una cancha", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });

    const r = await crearCancha(admin, complejo.id, { nombre: "Cancha 7", deporte: "futbolito", capacidadJugadores: 10, precioBase: 45000 });
    expect(r).toEqual({ ok: true });

    const canchas = await db.query.canchas.findMany({ where: { complejoId: complejo.id } });
    expect(canchas).toHaveLength(1);
    expect(canchas[0]).toMatchObject({ nombre: "Cancha 7", deporte: "futbolito", capacidadJugadores: 10, activo: true });
  });

  it("rechaza a un admin de otro complejo", async () => {
    const complejoA = await crearComplejoFixture();
    const complejoB = await crearComplejoFixture();
    const adminDeB = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejoB.id });

    const r = await crearCancha(adminDeB, complejoA.id, { nombre: "Cancha X", deporte: "futbolito", capacidadJugadores: 10, precioBase: 45000 });
    expect(r).toEqual({ ok: false, error: "sin_permiso" });
  });

  it("rechaza un deporte que no es uno de los válidos", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    const r = await crearCancha(admin, complejo.id, { nombre: "Cancha X", deporte: "basquetbol", capacidadJugadores: 10, precioBase: 45000 });
    expect(r).toEqual({ ok: false, error: "datos_invalidos" });
  });

  it("rechaza capacidad o precio inválidos", async () => {
    const complejo = await crearComplejoFixture();
    const admin = await crearUsuarioFixture({ rol: "admin_complejo", complejoAdminId: complejo.id });
    expect(await crearCancha(admin, complejo.id, { nombre: "X", deporte: "futbolito", capacidadJugadores: 1, precioBase: 45000 })).toEqual({ ok: false, error: "datos_invalidos" });
    expect(await crearCancha(admin, complejo.id, { nombre: "X", deporte: "futbolito", capacidadJugadores: 10, precioBase: 0 })).toEqual({ ok: false, error: "datos_invalidos" });
  });
});
