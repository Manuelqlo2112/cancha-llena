import { NextRequest } from "next/server";
import { db } from "@cancha-llena/db";

// La app móvil no puede usar la cookie httpOnly de la web (lib/session.ts):
// manda el id del usuario logueado en un header y listo. Mismo nivel de
// "seguridad" que el login de la web — cero, a propósito — hasta que exista
// Supabase Auth con tokens reales; ver la nota en session.ts.
export async function getUserFromRequest(req: NextRequest) {
  const uid = req.headers.get("x-user-id");
  if (!uid) return null;
  return db.query.usuarios.findFirst({ where: { id: uid } }) ?? null;
}
