import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@cancha-llena/db";
import { Card } from "@/components/Card";
import { getSessionUser } from "@/lib/session";
import { crearComplejoAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const MENSAJES: Record<string, string> = {
  error_sin_permiso: "No tienes permiso para hacer eso.",
  error_datos_invalidos: "Revisa los datos ingresados en el formulario.",
};

export default async function AdminIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/admin");
  const sp = await searchParams;
  const mensajeError = sp.error ? MENSAJES[`error_${sp.error}`] : null;

  if (session.rol === "admin_complejo" && session.complejoAdminId) {
    const propio = await db.query.complejos.findFirst({ where: { id: session.complejoAdminId } });
    if (propio) redirect(`/admin/${propio.slug}`);
  }

  if (session.rol !== "super_admin") {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No autorizado</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Tu cuenta no tiene un panel de admin asociado.
        </p>
      </div>
    );
  }

  // super_admin: elegir cuál complejo administrar.
  const complejos = await db.query.complejos.findMany({ orderBy: { nombre: "asc" } });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Elige un complejo</h1>

      {mensajeError ? (
        <div className="mb-6 rounded-lg px-4 py-2.5 text-sm" style={{ background: "var(--chart-surface)", color: "var(--text-secondary)", border: "1px solid var(--gridline)" }}>
          {mensajeError}
        </div>
      ) : null}

      <div className="mb-8 flex flex-col gap-2">
        {complejos.map((c) => (
          <Link key={c.id} href={`/admin/${c.slug}`}>
            <Card className="transition-shadow hover:shadow-md">
              <span className="font-medium">{c.nombre}</span>
              <span className="ml-2 text-sm" style={{ color: "var(--text-muted)" }}>
                {c.comuna}
              </span>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <h2 className="mb-1 font-medium">Agregar un complejo nuevo</h2>
        <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Da de alta un complejo real — después le asignás un admin propio actualizando su cuenta con
          complejoAdminId, o lo administras tú mismo desde acá.
        </p>
        <form action={crearComplejoAction} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Nombre
              <input
                type="text"
                name="nombre"
                required
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Comuna
              <input
                type="text"
                name="comuna"
                required
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Dirección
            <input
              type="text"
              name="direccion"
              required
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Teléfono
              <input
                type="text"
                name="telefono"
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Email
              <input
                type="email"
                name="email"
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Horario (texto libre)
            <input
              type="text"
              name="horarioTexto"
              placeholder="Lun-Vie 09:00-23:30 · Sáb-Dom 09:00-21:30"
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Comisión base (%)
              <input
                type="number"
                name="comisionBasePct"
                min={0}
                max={100}
                step={0.5}
                defaultValue={8}
                required
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Comisión en horario valle (%)
              <input
                type="number"
                name="comisionVallePct"
                min={0}
                max={100}
                step={0.5}
                defaultValue={14}
                required
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" name="requiereAbono" />
              Exige abono online
            </label>
            <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
              % de abono
              <input
                type="number"
                name="porcentajeAbono"
                min={1}
                max={100}
                defaultValue={30}
                className="w-20 rounded-md border px-2 py-1 text-sm"
                style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
              />
            </label>
          </div>

          <button type="submit" className="mt-1 self-start rounded-md px-4 py-2 text-sm font-medium" style={{ background: "var(--series-valle)", color: "white" }}>
            Crear complejo
          </button>
        </form>
      </Card>
    </div>
  );
}
