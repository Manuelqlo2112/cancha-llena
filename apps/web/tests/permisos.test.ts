import { describe, expect, it } from "vitest";
import { puedeAdministrar } from "@/lib/permisos";

type UsuarioFake = { rol: string; complejoAdminId: string | null };

describe("puedeAdministrar", () => {
  it("super_admin puede administrar cualquier complejo", () => {
    const u: UsuarioFake = { rol: "super_admin", complejoAdminId: null };
    expect(puedeAdministrar(u as never, "cualquier-id")).toBe(true);
  });

  it("admin_complejo solo puede administrar el suyo", () => {
    const u: UsuarioFake = { rol: "admin_complejo", complejoAdminId: "complejo-1" };
    expect(puedeAdministrar(u as never, "complejo-1")).toBe(true);
    expect(puedeAdministrar(u as never, "otro-complejo")).toBe(false);
  });

  it("un jugador nunca puede administrar", () => {
    const u: UsuarioFake = { rol: "jugador", complejoAdminId: null };
    expect(puedeAdministrar(u as never, "complejo-1")).toBe(false);
  });

  it("sin sesión (null) nunca puede administrar", () => {
    expect(puedeAdministrar(null, "complejo-1")).toBe(false);
  });
});
