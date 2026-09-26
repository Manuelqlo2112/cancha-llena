import type { usuarios } from "@cancha-llena/db";

// Separado de lib/session.ts a propósito: esta función es pura (sin
// cookies()/auth()), así que lib/adminGestion.ts y los tests pueden
// importarla sin arrastrar next-auth ni next/headers — esos no se resuelven
// fuera del runtime de Next (rompen Vitest con "Cannot find module
// next/server").
type UsuarioBasico = Pick<typeof usuarios.$inferSelect, "rol" | "complejoAdminId">;

// true si este usuario puede administrar ese complejo — super_admin ve
// cualquiera, admin_complejo solo el suyo.
export function puedeAdministrar(usuario: UsuarioBasico | null, complejoId: string): boolean {
  if (!usuario) return false;
  if (usuario.rol === "super_admin") return true;
  return usuario.rol === "admin_complejo" && usuario.complejoAdminId === complejoId;
}
