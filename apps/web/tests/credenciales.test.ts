import { beforeEach, describe, expect, it } from "vitest";
import { registrarConCredenciales, verificarCredenciales } from "@/lib/credenciales";
import { resetDb } from "./helpers";

beforeEach(resetDb);

describe("registrarConCredenciales", () => {
  it("crea la cuenta con la contraseña hasheada (no en texto plano)", async () => {
    const r = await registrarConCredenciales("Ana Test", "ANA@Mail.cl", "supersecreta");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.usuario.email).toBe("ana@mail.cl"); // normalizado a minúscula
    expect(r.usuario.passwordHash).not.toBe("supersecreta");
    expect(r.usuario.passwordHash).not.toBeNull();
  });

  it("rechaza un email ya registrado", async () => {
    await registrarConCredenciales("Ana Test", "ana@mail.cl", "supersecreta");
    const segundo = await registrarConCredenciales("Otra Ana", "ana@mail.cl", "otraClave123");
    expect(segundo).toEqual({ ok: false, error: "email_en_uso" });
  });

  it("rechaza contraseñas menores a 8 caracteres", async () => {
    const r = await registrarConCredenciales("Ana Test", "ana2@mail.cl", "corta");
    expect(r).toEqual({ ok: false, error: "datos_invalidos" });
  });

  it("rechaza nombre o email vacíos", async () => {
    expect(await registrarConCredenciales("  ", "ana3@mail.cl", "supersecreta")).toEqual({ ok: false, error: "datos_invalidos" });
    expect(await registrarConCredenciales("Ana", "  ", "supersecreta")).toEqual({ ok: false, error: "datos_invalidos" });
  });

  it("rechaza nombre, email o contraseña con largo absurdo", async () => {
    expect(await registrarConCredenciales("A".repeat(101), "ana4@mail.cl", "supersecreta")).toEqual({ ok: false, error: "datos_invalidos" });
    expect(await registrarConCredenciales("Ana", `${"a".repeat(250)}@mail.cl`, "supersecreta")).toEqual({ ok: false, error: "datos_invalidos" });
    expect(await registrarConCredenciales("Ana", "ana5@mail.cl", "a".repeat(201))).toEqual({ ok: false, error: "datos_invalidos" });
  });
});

describe("verificarCredenciales", () => {
  it("acepta email+contraseña correctos, sin importar mayúsculas en el email", async () => {
    await registrarConCredenciales("Ana Test", "ana@mail.cl", "supersecreta");
    const u = await verificarCredenciales("ANA@mail.cl", "supersecreta");
    expect(u?.email).toBe("ana@mail.cl");
  });

  it("rechaza contraseña incorrecta", async () => {
    await registrarConCredenciales("Ana Test", "ana@mail.cl", "supersecreta");
    const u = await verificarCredenciales("ana@mail.cl", "incorrecta");
    expect(u).toBeNull();
  });

  it("rechaza un email que no existe", async () => {
    const u = await verificarCredenciales("nadie@mail.cl", "cualquiera");
    expect(u).toBeNull();
  });
});
