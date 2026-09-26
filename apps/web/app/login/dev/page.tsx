import Link from "next/link";
import { db } from "@cancha-llena/db";
import { Card } from "@/components/Card";
import { iniciarSesionDevAction } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

export default async function LoginDevPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const usuarios = await db.query.usuarios.findMany({
    orderBy: { rol: "asc", nombre: "asc" },
  });

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar como usuario de prueba</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Solo para desarrollo — sin contraseña, elegís directamente con qué jugador sembrado entrar. Para el login
          real (Google, Microsoft, email) andá a{" "}
          <Link href="/login" className="underline">
            /login
          </Link>
          .
        </p>
      </div>
      <Card>
        <div className="flex flex-col gap-2">
          {usuarios.map((u) => (
            <form key={u.id} action={iniciarSesionDevAction}>
              <input type="hidden" name="usuarioId" value={u.id} />
              <input type="hidden" name="next" value={next ?? "/"} />
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:opacity-80"
                style={{ background: "var(--chart-surface)" }}
              >
                <span>
                  {u.nombre}
                  {u.rol !== "jugador" ? (
                    <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--series-valle)", color: "white" }}>
                      {u.rol === "super_admin" ? "super admin" : "admin"}
                    </span>
                  ) : null}
                </span>
                <span style={{ color: "var(--text-muted)" }}>{u.email}</span>
              </button>
            </form>
          ))}
        </div>
      </Card>
    </div>
  );
}
