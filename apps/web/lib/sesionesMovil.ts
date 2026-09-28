import { randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, sesionesMovil } from "@cancha-llena/db";

const DIAS_VIGENCIA = 30;

// Token opaco de 256 bits, no un JWT: no hace falta poder decodificarlo en
// el cliente, y revocar una sesión (logout, "esta cuenta ya no existe") es
// simplemente borrar la fila — no hay que llevar una lista de invalidados.
export async function crearSesionMovil(usuarioId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiraEn = new Date(Date.now() + DIAS_VIGENCIA * 86_400_000);
  await db.insert(sesionesMovil).values({ token, usuarioId, expiraEn });
  return token;
}

export async function obtenerUsuarioPorToken(token: string) {
  const sesion = await db.query.sesionesMovil.findFirst({ where: { token }, with: { usuario: true } });
  if (!sesion || !sesion.usuario) return null;
  if (sesion.expiraEn.getTime() < Date.now()) return null;
  return sesion.usuario;
}

export async function revocarSesionMovil(token: string): Promise<void> {
  await db.delete(sesionesMovil).where(eq(sesionesMovil.token, token));
}

// Limpieza de sesiones vencidas — no es crítico (una sesión vencida ya no
// autentica a nadie, obtenerUsuarioPorToken la rechaza igual), pero evita
// que la tabla crezca indefinido. Llamarla de vez en cuando alcanza, no
// hace falta un cron.
export async function limpiarSesionesVencidas(): Promise<void> {
  await db.delete(sesionesMovil).where(lt(sesionesMovil.expiraEn, new Date()));
}
