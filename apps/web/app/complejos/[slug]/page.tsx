import { notFound } from "next/navigation";
import { db } from "@cancha-llena/db";
import { slotsDelDia } from "@cancha-llena/db/slots";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { DEPORTE_LABEL, formatCLP } from "@/lib/format";
import { getSessionUser } from "@/lib/session";
import { reservarCancha, buscarRivalAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const DIAS_ADELANTE = 5; // hoy + 4 días más

const MENSAJES: Record<string, string> = {
  error_ocupado: "Justo se ocupó ese horario — elegí otro.",
  error_cancha_no_existe: "Esa cancha ya no existe.",
  error_fecha_pasada: "Ese día ya pasó — elegí otro.",
  error_ya_existe: "Ese partido ya está buscando jugadores.",
  error_sin_cupos: "Ese partido ya está completo.",
  error_ya_paso: "Ese partido ya pasó.",
  error_sin_permiso: "No podés hacer eso en esa reserva.",
  error_no_encontrada: "No encontramos esa reserva.",
};

export default async function ComplejoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dia?: string; reservado?: string; solicitud?: string; error?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const session = await getSessionUser();

  const hoy = new Date();
  const dias = Array.from({ length: DIAS_ADELANTE }, (_, i) => addDays(hoy, i));
  const diasISO = dias.map(fmtISO);
  const hoyISO = diasISO[0];
  const finISO = diasISO.at(-1)!;
  const diaSeleccionado = sp.dia && diasISO.includes(sp.dia) ? sp.dia : hoyISO;

  const complejo = await db.query.complejos.findFirst({
    where: { slug },
    with: {
      canchas: {
        where: { activo: true },
        with: {
          reservas: {
            where: { fecha: { gte: hoyISO, lte: finISO }, estado: { ne: "cancelada" } },
          },
        },
      },
    },
  });

  if (!complejo) notFound();

  const mensajeError = sp.error ? MENSAJES[`error_${sp.error}`] : null;

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{complejo.nombre}</h1>
          <Badge tone={complejo.requiereAbono ? "accent" : "good"}>
            {complejo.requiereAbono ? `Exige abono del ${Number(complejo.porcentajeAbono)}%` : "Reserva sin pago online"}
          </Badge>
        </div>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {complejo.direccion}, {complejo.comuna}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs" style={{ color: "var(--text-muted)" }}>
          {complejo.horarioTexto ? <span>{complejo.horarioTexto}</span> : null}
          {complejo.telefono ? <span>{complejo.telefono}</span> : null}
        </p>
        {complejo.amenidades.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {complejo.amenidades.map((a) => (
              <li key={a}>✓ {a}</li>
            ))}
          </ul>
        ) : null}
        {!session ? (
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <a href={`/login?next=/complejos/${slug}`} className="underline">
              Iniciá sesión
            </a>{" "}
            para poder reservar.
          </p>
        ) : null}
      </div>

      {mensajeError ? (
        <div className="mb-6 rounded-lg px-4 py-2.5 text-sm" style={{ background: "var(--chart-surface)", color: "var(--text-secondary)", border: "1px solid var(--gridline)" }}>
          {mensajeError}
        </div>
      ) : null}

      {sp.solicitud ? (
        <div className="mb-6 rounded-lg px-4 py-2.5 text-sm" style={{ background: "var(--chart-surface)", color: "var(--text-secondary)", border: "1px solid var(--gridline)" }}>
          Avisamos que este partido busca jugadores — ya aparece en <a href="/partidos" className="underline">Partidos</a>.
        </div>
      ) : null}

      {/* Se pregunta apenas se reserva, arriba de todo, en vez de una pantalla aparte */}
      {sp.reservado ? (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm"
          style={{ background: "color-mix(in srgb, var(--status-good) 12%, var(--chart-surface))", border: "1px solid var(--gridline)" }}
        >
          <div>
            <p className="font-medium">¡Reserva confirmada!</p>
            <p style={{ color: "var(--text-secondary)" }}>¿Tenés los equipos completos, o te faltan jugadores?</p>
          </div>
          <div className="flex items-center gap-2">
            <form action={buscarRivalAction}>
              <input type="hidden" name="reservaId" value={sp.reservado} />
              <input type="hidden" name="returnTo" value={slug} />
              <button type="submit" className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: "var(--series-prime)", color: "white" }}>
                Me faltan jugadores
              </button>
            </form>
            <a href={`/complejos/${slug}${sp.dia ? `?dia=${sp.dia}` : ""}`} className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: "var(--chart-surface)", border: "1px solid var(--gridline)" }}>
              Estamos completos
            </a>
          </div>
        </div>
      ) : null}

      {/* Calendario: se elige el día primero, y todo lo de abajo depende de eso */}
      <div className="mb-6 flex flex-wrap gap-2">
        {dias.map((dia) => {
          const iso = fmtISO(dia);
          const activo = iso === diaSeleccionado;
          const { dow, num } = diaChip(dia);
          return (
            <a
              key={iso}
              href={`/complejos/${slug}?dia=${iso}`}
              className="flex w-14 flex-col items-center rounded-xl px-2 py-2 text-xs"
              style={{
                background: activo ? "var(--series-valle)" : "var(--chart-surface)",
                color: activo ? "white" : "var(--text-primary)",
                border: "1px solid var(--gridline)",
              }}
            >
              <span className="capitalize" style={{ color: activo ? "white" : "var(--text-muted)" }}>{dow}</span>
              <span className="mt-0.5 text-base font-semibold">{num}</span>
            </a>
          );
        })}
      </div>

      <div className="flex flex-col gap-6">
        {complejo.canchas.map((cancha) => {
          const ocupadas = new Set(cancha.reservas.filter((r) => r.fecha === diaSeleccionado).map((r) => r.horaInicio.slice(0, 5)));
          const diaDate = new Date(`${diaSeleccionado}T00:00:00`);
          const libres = slotsDelDia(diaDate).filter(({ hora }) => !ocupadas.has(hora));

          return (
            <Card key={cancha.id}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-medium">
                  {cancha.nombre} <span style={{ color: "var(--text-muted)" }}>· {DEPORTE_LABEL[cancha.deporte] ?? cancha.deporte}</span>
                </h2>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{formatCLP(Number(cancha.precioBase))} / hora</span>
              </div>

              {libres.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sin horarios libres este día.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {libres.map(({ hora, valle }) => (
                    <li key={hora}>
                      <form action={reservarCancha}>
                        <input type="hidden" name="canchaId" value={cancha.id} />
                        <input type="hidden" name="fecha" value={diaSeleccionado} />
                        <input type="hidden" name="hora" value={hora} />
                        <input type="hidden" name="returnTo" value={slug} />
                        <button
                          type="submit"
                          className="rounded-md px-3 py-1.5 text-sm font-medium"
                          style={{ background: valle ? "var(--series-valle)" : "var(--chart-surface)", color: valle ? "white" : "var(--text-primary)", border: "1px solid var(--gridline)" }}
                        >
                          {hora}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function diaChip(d: Date) {
  return {
    dow: d.toLocaleDateString("es-CL", { weekday: "short" }).replace(".", ""),
    num: d.getDate(),
  };
}
