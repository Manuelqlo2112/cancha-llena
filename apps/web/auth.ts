import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { CanchaLlenaAuthAdapter } from "@/lib/authAdapter";
import { verificarCredenciales } from "@/lib/credenciales";

// Login real (Google / Microsoft / email+contraseña). El adapter (ver
// lib/authAdapter.ts) hace que un login OAuth cree/encuentre directo la fila
// en `usuarios` — así que `user.id` acá YA es el id de dominio que usa el
// resto de la app (reservas, racha, admin, la API del móvil), sin tabla
// intermedia. Sesión en JWT porque Credentials lo exige.
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: CanchaLlenaAuthAdapter(),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Google,
    MicrosoftEntraID,
    Credentials({
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credenciales) => {
        const usuario = await verificarCredenciales(String(credenciales?.email ?? ""), String(credenciales?.password ?? ""));
        return usuario ? { id: usuario.id, name: usuario.nombre, email: usuario.email } : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.usuarioId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.usuarioId) {
        (session.user as typeof session.user & { id: string }).id = token.usuarioId as string;
      }
      return session;
    },
  },
});
