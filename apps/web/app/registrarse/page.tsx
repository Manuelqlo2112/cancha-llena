import Link from "next/link";
import { Card } from "@/components/Card";
import { registrarUsuarioAction } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

const ERRORES: Record<string, string> = {
  datos_invalidos: "Completá tu nombre, email y una contraseña de al menos 8 caracteres.",
  email_en_uso: "Ya existe una cuenta con ese email — probá iniciar sesión.",
};

export default async function RegistrarsePage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Para reservar, unirte a un partido y ver tu historial.
        </p>
      </div>

      {error && ERRORES[error] ? (
        <div className="mb-4 rounded-lg px-4 py-2.5 text-sm" style={{ background: "var(--chart-surface)", color: "var(--status-critical)", border: "1px solid var(--gridline)" }}>
          {ERRORES[error]}
        </div>
      ) : null}

      <Card>
        <form action={registrarUsuarioAction} className="flex flex-col gap-2">
          <input type="hidden" name="next" value={next ?? "/"} />
          <input
            type="text"
            name="nombre"
            placeholder="Nombre y apellido"
            required
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
          />
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
            placeholder="Contraseña (mínimo 8 caracteres)"
            required
            minLength={8}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
          />
          <button type="submit" className="mt-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white" style={{ background: "var(--series-valle)" }}>
            Crear cuenta
          </button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
