import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usuarios } from "@cancha-llena/db";

// Lógica de email+contraseña compartida entre el Credentials provider de
// Auth.js (auth.ts, para la web) y la API que usa el móvil (que no puede
// usar el flujo de cookies/redirect de Auth.js) — un solo lugar para el
// hash/verificación de contraseña.

export async function verificarCredenciales(email: string, password: string) {
  const emailNorm = email.toLowerCase().trim();
  if (!emailNorm || !password) return null;

  const usuario = await db.query.usuarios.findFirst({ where: { email: emailNorm } });
  if (!usuario?.passwordHash) return null; // no existe, o es una cuenta OAuth sin password

  const ok = await bcrypt.compare(password, usuario.passwordHash);
  return ok ? usuario : null;
}

export type RegistrarConCredencialesResult =
  | { ok: true; usuario: typeof usuarios.$inferSelect }
  | { ok: false; error: "datos_invalidos" | "email_en_uso" };

export async function registrarConCredenciales(nombre: string, email: string, password: string): Promise<RegistrarConCredencialesResult> {
  const nombreLimpio = nombre.trim();
  const emailNorm = email.toLowerCase().trim();
  // Topes generosos pero explícitos — sin esto, un cliente cualquiera podía
  // mandar un nombre/email/password de cualquier largo (nada los frenaba
  // antes de llegar al hash de bcrypt o al insert).
  if (!nombreLimpio || nombreLimpio.length > 100 || !emailNorm || emailNorm.length > 254 || password.length < 8 || password.length > 200) {
    return { ok: false, error: "datos_invalidos" };
  }

  const yaExiste = await db.query.usuarios.findFirst({ where: { email: emailNorm } });
  if (yaExiste) return { ok: false, error: "email_en_uso" };

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [nuevo] = await db.insert(usuarios).values({ nombre: nombreLimpio, email: emailNorm, rol: "jugador", passwordHash }).returning();
    return { ok: true, usuario: nuevo! };
  } catch (err) {
    // Dos registros concurrentes con el mismo email pueden pasar ambos el
    // chequeo de arriba (race check-then-insert) — el segundo insert choca
    // con la constraint unique de la columna. Se traduce a la misma
    // respuesta prolija en vez de dejar pasar el error crudo de Postgres.
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      return { ok: false, error: "email_en_uso" };
    }
    throw err;
  }
}

export type CambiarContrasenaResult = { ok: true } | { ok: false; error: "sin_password" | "actual_incorrecta" | "datos_invalidos" };

// Nada de esto existía antes: las cuentas admin sembradas (y cualquier
// cuenta a la que le generemos una contraseña a mano) no tenían forma de
// que el dueño la cambiara por una propia sin pedirle a un desarrollador
// que la actualizara directo en la base.
export async function cambiarContrasena(usuarioId: string, actual: string, nueva: string): Promise<CambiarContrasenaResult> {
  if (nueva.length < 8 || nueva.length > 200) return { ok: false, error: "datos_invalidos" };

  const usuario = await db.query.usuarios.findFirst({ where: { id: usuarioId } });
  // Cuenta OAuth pura (Google/Microsoft) sin contraseña — no hay "actual"
  // contra qué comparar. Ofrecer un flujo de "crear contraseña" sin
  // verificación previa queda fuera de alcance por ahora.
  if (!usuario?.passwordHash) return { ok: false, error: "sin_password" };

  const coincide = await bcrypt.compare(actual, usuario.passwordHash);
  if (!coincide) return { ok: false, error: "actual_incorrecta" };

  const passwordHash = await bcrypt.hash(nueva, 10);
  await db.update(usuarios).set({ passwordHash }).where(eq(usuarios.id, usuarioId));
  return { ok: true };
}
