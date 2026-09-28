import { NextRequest } from "next/server";
import { obtenerUsuarioPorToken } from "@/lib/sesionesMovil";

// La app móvil no puede usar la cookie httpOnly de la web (lib/session.ts):
// manda "Authorization: Bearer <token>" con el token que recibió al
// loguearse (ver lib/sesionesMovil.ts). Antes esto confiaba directo en un
// header "x-user-id" mandado por el cliente — cualquiera que supiera el
// UUID de otro usuario podía actuar como él, sin contraseña ni nada.
export async function getUserFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) return null;
  return obtenerUsuarioPorToken(token);
}
