import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/Card";
import { DEPORTE_LABEL, formatFechaCorta, formatHora } from "@/lib/format";
import { getSessionUser } from "@/lib/session";
import { obtenerReservaParaReportar } from "@/lib/resultados";
import { reportarResultadoAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const MENSAJES: Record<string, string> = {
  error_datos_invalidos: "Asigna al menos un jugador a cada equipo.",
  error_ya_reportado: "Ese resultado ya se había reportado.",
  error_partido_no_jugado: "Ese partido todavía no se jugó.",
  error_sin_permiso: "No puedes reportar el resultado de ese partido.",
};

export default async function ReportarResultadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSessionUser();
  if (!session) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportar resultado</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Link href={`/login?next=/mis-reservas/${id}/resultado`} className="underline">
            Inicia sesión
          </Link>{" "}
          para reportar el resultado.
        </p>
      </div>
    );
  }

  const reserva = await obtenerReservaParaReportar(session.id, id);
  if (!reserva) notFound();

  const mensajeError = sp.error ? MENSAJES[`error_${sp.error}`] : null;

  if (reserva.yaReportado) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportar resultado</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          El resultado de ese partido ya se reportó.{" "}
          <Link href="/mis-reservas" className="underline">
            Volver a Mis reservas
          </Link>
          .
        </p>
      </div>
    );
  }

  if (reserva.participantes.length < 2) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportar resultado</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Este partido no tuvo suficientes jugadores anotados como para armar dos equipos.{" "}
          <Link href="/mis-reservas" className="underline">
            Volver a Mis reservas
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Reportar resultado</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        {reserva.complejo.nombre} · {reserva.cancha.nombre} · {DEPORTE_LABEL[reserva.cancha.deporte] ?? reserva.cancha.deporte}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {formatFechaCorta(reserva.fecha)} · {formatHora(reserva.horaInicio)}
      </p>

      {mensajeError ? (
        <div className="mt-4 rounded-lg px-4 py-2.5 text-sm" style={{ background: "var(--chart-surface)", color: "var(--text-secondary)", border: "1px solid var(--gridline)" }}>
          {mensajeError}
        </div>
      ) : null}

      <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Este resultado no se verifica con el rival — cualquier jugador del partido lo puede cargar, y una vez cargado
        queda fijo.
      </p>

      <Card className="mt-4">
        <form action={reportarResultadoAction} className="flex flex-col gap-4">
          <input type="hidden" name="reservaId" value={reserva.id} />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Equipos</span>
            {reserva.participantes.map((p) => (
              <label key={p.usuarioId} className="flex items-center justify-between gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                {p.nombre}
                <select
                  name={`equipo_${p.usuarioId}`}
                  defaultValue="A"
                  className="rounded-md border px-2 py-1 text-sm"
                  style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
                >
                  <option value="A">Equipo A</option>
                  <option value="B">Equipo B</option>
                </select>
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">¿Quién ganó?</span>
            <div className="flex flex-wrap gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="equipoGanador" value="A" defaultChecked /> Equipo A
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="equipoGanador" value="B" /> Equipo B
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="equipoGanador" value="empate" /> Empate
              </label>
            </div>
          </div>

          <button type="submit" className="self-start rounded-md px-4 py-2 text-sm font-medium" style={{ background: "var(--series-valle)", color: "white" }}>
            Reportar resultado
          </button>
        </form>
      </Card>
    </div>
  );
}
