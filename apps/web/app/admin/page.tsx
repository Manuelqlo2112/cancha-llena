import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@cancha-llena/db";
import { Card } from "@/components/Card";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminIndexPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/admin");

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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Elegí un complejo</h1>
      <div className="flex flex-col gap-2">
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
    </div>
  );
}
