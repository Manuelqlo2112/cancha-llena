import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@cancha-llena/db";
import { actualizarCancha, actualizarComplejo, obtenerImpactoGamificacion } from "@/lib/adminGestion";
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
});

describe("obtenerImpactoGamificacion", () => {
  it("da todo en cero para un complejo sin canchas", async () => {
    const complejo = await crearComplejoFixture();
    const r = await obtenerImpactoGamificacion(complejo.id);
    expect(r).toEqual({ solicitudesAbiertas: 0, solicitudesTotales: 0, cuposViaSolicitud: 0, jugadoresConRachaActiva: 0 });
  });
});
