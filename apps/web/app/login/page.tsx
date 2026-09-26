import Link from "next/link";
import { Card } from "@/components/Card";
import { loginConCredencialesAction, signInGoogleAction, signInMicrosoftAction } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

const ERRORES: Record<string, string> = {
  credenciales_invalidas: "Email o contraseña incorrectos.",
  cuenta_creada_reintentar: "Tu cuenta se creó, pero hubo un problema al entrar — probá de nuevo.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Para reservar, unirte a un partido o ver tus reservas.
        </p>
      </div>

      {error && ERRORES[error] ? (
        <div className="mb-4 rounded-lg px-4 py-2.5 text-sm" style={{ background: "var(--danger-soft, var(--chart-surface))", color: "var(--status-critical)", border: "1px solid var(--gridline)" }}>
          {ERRORES[error]}
        </div>
      ) : null}

      <Card className="flex flex-col gap-3">
        <form action={signInGoogleAction}>
          <input type="hidden" name="next" value={next ?? "/"} />
          <button type="submit" className="flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80" style={{ borderColor: "var(--gridline)" }}>
            <GoogleIcon />
            Continuar con Google
          </button>
        </form>
        <form action={signInMicrosoftAction}>
          <input type="hidden" name="next" value={next ?? "/"} />
          <button type="submit" className="flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80" style={{ borderColor: "var(--gridline)" }}>
            <MicrosoftIcon />
            Continuar con Microsoft
          </button>
        </form>

        <div className="my-1 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: "var(--gridline)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>o con tu email</span>
          <div className="h-px flex-1" style={{ background: "var(--gridline)" }} />
        </div>

        <form action={loginConCredencialesAction} className="flex flex-col gap-2">
          <input type="hidden" name="next" value={next ?? "/"} />
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
          />
          <input
            type="password"
            name="password"
            placeholder="Contraseña"
            required
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
          />
          <button type="submit" className="mt-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white" style={{ background: "var(--series-valle)" }}>
            Entrar
          </button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        ¿No tenés cuenta?{" "}
        <Link href="/registrarse" className="underline">
          Crear cuenta
        </Link>
      </p>
      <p className="mt-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
        ¿Sos del equipo?{" "}
        <Link href="/login/dev" className="underline">
          Entrar como usuario de prueba
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.87 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <rect x="0" y="0" width="8.5" height="8.5" fill="#F25022" />
      <rect x="9.5" y="0" width="8.5" height="8.5" fill="#7FBA00" />
      <rect x="0" y="9.5" width="8.5" height="8.5" fill="#00A4EF" />
      <rect x="9.5" y="9.5" width="8.5" height="8.5" fill="#FFB900" />
    </svg>
  );
}
