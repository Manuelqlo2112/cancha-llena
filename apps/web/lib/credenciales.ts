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
