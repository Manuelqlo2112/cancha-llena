import { and, eq } from "drizzle-orm";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { authAccounts, db, usuarios } from "@cancha-llena/db";

// Adapter de Auth.js escrito a mano contra `usuarios` + `auth_accounts` (ver
// schema.ts) — @auth/drizzle-adapter todavía no soporta drizzle-orm v1 RC
// (el driver que necesitamos para PGlite), así que en vez de esperar
// implementamos solo lo que de verdad usamos: alta/búsqueda de usuario y
// linkeo de cuenta OAuth. Sin sesión de base de datos (usamos JWT) ni magic
// links, así que no hace falta `createSession`/`getSessionAndUser`/etc. ni
// verification tokens.

function aAdapterUser(u: typeof usuarios.$inferSelect): AdapterUser {
  return { id: u.id, email: u.email, emailVerified: null, name: u.nombre, image: null };
}

export function CanchaLlenaAuthAdapter(): Adapter {
  return {
    async createUser(user) {
      const [nuevo] = await db
        .insert(usuarios)
        .values({
          nombre: user.name ?? user.email.split("@")[0],
          email: user.email,
          rol: "jugador",
        })
        .returning();
      return aAdapterUser(nuevo!);
    },

    async getUser(id) {
      const u = await db.query.usuarios.findFirst({ where: { id } });
      return u ? aAdapterUser(u) : null;
    },

    async getUserByEmail(email) {
      const u = await db.query.usuarios.findFirst({ where: { email } });
      return u ? aAdapterUser(u) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const cuenta = await db.query.authAccounts.findFirst({ where: { provider, providerAccountId } });
      if (!cuenta) return null;
      const u = await db.query.usuarios.findFirst({ where: { id: cuenta.userId } });
      return u ? aAdapterUser(u) : null;
    },

    async updateUser(user) {
      await db
        .update(usuarios)
        .set({ nombre: user.name ?? undefined, email: user.email })
        .where(eq(usuarios.id, user.id));
      const u = await db.query.usuarios.findFirst({ where: { id: user.id } });
      return aAdapterUser(u!);
    },

    async linkAccount(account) {
      await db.insert(authAccounts).values({
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refreshToken: account.refresh_token as string | undefined,
        accessToken: account.access_token as string | undefined,
        expiresAt: account.expires_at as number | undefined,
        tokenType: account.token_type as string | undefined,
        scope: account.scope as string | undefined,
        idToken: account.id_token as string | undefined,
        sessionState: account.session_state as string | undefined,
      });
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await db
        .delete(authAccounts)
        .where(and(eq(authAccounts.provider, provider), eq(authAccounts.providerAccountId, providerAccountId)));
    },

    async deleteUser(userId) {
      await db.delete(usuarios).where(eq(usuarios.id, userId));
    },
  };
}
