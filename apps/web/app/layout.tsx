import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { cerrarSesionUniversal } from "@/app/auth-actions";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Cancha Llena",
  description: "Reserva canchas y llena los horarios valle de tu complejo favorito.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();

  return (
    <html lang="es">
      <body className="min-h-screen font-sans antialiased">
        <header
          className="sticky top-0 z-10 border-b backdrop-blur"
          style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 85%, transparent)" }}
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-3 sm:flex-row sm:justify-between sm:px-6 sm:py-4">
            <Link href="/" className="text-base font-semibold tracking-tight sm:text-lg">
              ⚽ Cancha Llena
            </Link>
            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              <Link href="/" className="hover:underline">
                Explorar
              </Link>
              <Link href="/partidos" className="hover:underline">
                Partidos
              </Link>
              {session && (session.rol === "admin_complejo" || session.rol === "super_admin") ? (
                <Link href="/admin" className="hover:underline">
                  Admin
                </Link>
              ) : null}
              {session ? (
                <Link href="/mis-reservas" className="hover:underline">
                  Mis reservas
                </Link>
              ) : null}
              {session ? (
                <form action={cerrarSesionUniversal} className="flex items-center gap-2">
                  <Link href="/perfil" className="hover:underline">
                    {session.nombre}
                  </Link>
                  <button type="submit" className="hover:underline" style={{ color: "var(--text-muted)" }}>
                    Salir
                  </button>
                </form>
              ) : (
                <>
                  <Link href="/login" className="hover:underline">
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/registrarse"
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
                    style={{ background: "var(--series-valle)" }}
                  >
                    Crear cuenta
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="border-t px-6 py-6 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4">
            <span>© {new Date().getFullYear()} Cancha Llena</span>
            <Link href="/privacidad" className="hover:underline">
              Privacidad
            </Link>
            <Link href="/terminos" className="hover:underline">
              Términos
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
