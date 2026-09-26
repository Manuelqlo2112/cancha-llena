import { cookies } from "next/headers";
import { db } from "@cancha-llena/db";
import { auth } from "@/auth";

export { puedeAdministrar } from "@/lib/permisos";

// getSessionUser() es lo que usa el resto de la app (Server Actions, páginas,
// la API) — no le importa CÓMO entraste. Primero mira la sesión real de
// Auth.js (Google / Microsoft / email+contraseña); si no hay, cae a la
// cookie de desarrollo (/login/dev, pensada para probar rápido como
// cualquier jugador sembrado sin crear una cuenta real).
const DEV_COOKIE_NAME = "cancha_llena_dev_uid";

export async function getSessionUser() {
  const sesionReal = await auth();
  if (sesionReal?.user && "id" in sesionReal.user && sesionReal.user.id) {
    const usuario = await db.query.usuarios.findFirst({ where: { id: sesionReal.user.id as string } });
    if (usuario) return usuario;
  }

  const store = await cookies();
  const uid = store.get(DEV_COOKIE_NAME)?.value;
  if (!uid) return null;
  return db.query.usuarios.findFirst({ where: { id: uid } }) ?? null;
}

// --- Solo para /login/dev (atajo de desarrollo, sin password) ---

export async function setDevSessionUser(usuarioId: string) {
  const store = await cookies();
  store.set(DEV_COOKIE_NAME, usuarioId, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function clearDevSession() {
  const store = await cookies();
  store.delete(DEV_COOKIE_NAME);
}
