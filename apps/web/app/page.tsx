import Link from "next/link";
import { db } from "@cancha-llena/db";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { DEPORTE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExplorarPage() {
  const complejos = await db.query.complejos.findMany({
    with: { canchas: { where: { activo: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Reserva tu cancha</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Piloto Quilicura · Renca — reserva de futbolito y avísale al grupo cuando falten jugadores.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {complejos.map((c) => {
          const deportes = [...new Set(c.canchas.map((cancha) => cancha.deporte))];
          return (
            <Card key={c.id} className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-medium">{c.nombre}</h2>
                <Badge tone={c.requiereAbono ? "accent" : "good"}>
                  {c.requiereAbono ? `Abono ${Number(c.porcentajeAbono)}%` : "Sin abono online"}
                </Badge>
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                {c.direccion}, {c.comuna}
              </p>
              {c.horarioTexto ? (
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {c.horarioTexto}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {deportes.map((d) => (
                  <span
                    key={d}
                    className="rounded-md px-2 py-0.5 text-xs font-medium"
                    style={{ background: "var(--series-valle)", color: "white" }}
                  >
                    {DEPORTE_LABEL[d] ?? d}
                  </span>
                ))}
                <span
                  className="rounded-md px-2 py-0.5 text-xs"
                  style={{ background: "var(--chart-surface)", color: "var(--text-secondary)", border: "1px solid var(--gridline)" }}
                >
                  {c.canchas.length} cancha{c.canchas.length === 1 ? "" : "s"}
                </span>
              </div>

              {c.amenidades.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {c.amenidades.map((a) => (
                    <li key={a}>✓ {a}</li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--gridline)" }}>
                {c.telefono ? (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {c.telefono}
                  </span>
                ) : (
                  <span />
                )}
                <Link
                  href={`/complejos/${c.slug}`}
                  className="rounded-md px-4 py-1.5 text-sm font-medium"
                  style={{ background: "var(--series-valle)", color: "white" }}
                >
                  Reservar
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
