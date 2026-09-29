import Link from "next/link";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { DEPORTE_LABEL, ESTADO_RESERVA, formatCLP, formatFechaCorta, formatHora } from "@/lib/format";
import { getSessionUser } from "@/lib/session";
import { obtenerMisRachas, obtenerMisReservas } from "@/lib/reservas";
import { obtenerRivales } from "@/lib/resultados";
import { buscarRivalAction, cancelarReservaAction, invitarRivalAction } from "@/app/actions";

export const dynamic = "force-dynamic";

// Un jugador activo (o, en el seed, cualquiera con suficiente historial)
// puede acumular decenas de partidos pasados — mostrarlos todos de una hace
// que la pantalla sea puro scroll. Los primeros quedan siempre visibles, el
// resto se pliega en un <details> nativo (sin JS aparte).
const LIMITE_HISTORIAL_INICIAL = 10;

const MENSAJES: Record<string, string> = {
  cancelado: "Reserva cancelada.",
  solicitud: "Listo — avisamos que buscás rival para ese partido.",
  resultado: "Resultado reportado — el nivel se actualizó.",
  invitado: "Listo — le mandamos la invitación directa.",
  error_no_encontrada: "Esa reserva ya no existe.",
  error_sin_permiso: "Esa reserva no es tuya.",
  error_ya_paso: "Ya no se puede modificar (es de hoy o ya pasó).",
  error_ya_cancelada: "Esa reserva ya estaba cancelada.",
  error_ya_existe: "Ya hay una búsqueda de rival abierta para ese partido.",
  error_sin_cupos: "Esa cancha ya está completa.",
  error_solicitud_cerrada: "Esa búsqueda de rival ya no está abierta.",
  error_rival_invalido: "Ese jugador ya está en el partido.",
};

export default async function MisReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelado?: string; solicitud?: string; resultado?: string; invitado?: string; error?: string }>;
}) {
  const session = await getSessionUser();
  const sp = await searchParams;
  const mensaje = sp.cancelado
    ? MENSAJES.cancelado
    : sp.solicitud
      ? MENSAJES.solicitud
      : sp.resultado
        ? MENSAJES.resultado
        : sp.invitado
          ? MENSAJES.invitado
          : sp.error
            ? MENSAJES[`error_${sp.error}`]
            : null;

  if (!session) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mis reservas</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Link href="/login?next=/mis-reservas" className="underline">
            Iniciá sesión
          </Link>{" "}
          para ver tus reservas.
        </p>
      </div>
    );
  }

  const [reservas, rachas, rivales] = await Promise.all([obtenerMisReservas(session.id), obtenerMisRachas(session.id), obtenerRivales(session.id)]);
  const hoyISO = new Date().toISOString().slice(0, 10);
  const proximas = reservas.filter((r) => r.fecha >= hoyISO && r.estado !== "cancelada");
  const pasadas = reservas.filter((r) => r.fecha < hoyISO || r.estado === "cancelada");

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Mis reservas</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        {session.nombre}
      </p>

      {rachas.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-medium">Tu racha</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {rachas.map((r) => (
              <Card key={r.complejoSlug} className={r.vigente ? "" : "opacity-60"}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl">🔥</span>
                      <span className="text-2xl font-semibold">{r.contadorActual}</span>
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        semana{r.contadorActual === 1 ? "" : "s"} seguidas
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {r.complejoNombre}
                    </p>
                  </div>
                  {r.recompensaDesbloqueada ? <Badge tone="good">Recompensa desbloqueada</Badge> : null}
                </div>
                {!r.vigente ? (
                  <p className="mt-2 text-xs" style={{ color: "var(--status-critical)" }}>
                    Se corta si no jugás ahí esta semana — mejor racha: {r.mejorRacha}
                  </p>
                ) : (
                  <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    Mejor racha: {r.mejorRacha}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {mensaje ? (
        <div className="mb-6 rounded-lg px-4 py-2.5 text-sm" style={{ background: "var(--chart-surface)", color: "var(--text-secondary)", border: "1px solid var(--gridline)" }}>
          {mensaje}
        </div>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 font-medium">Próximas</h2>
        {proximas.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Todavía no tenés partidos agendados —{" "}
            <Link href="/" className="underline">
              explorá los complejos
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {proximas.map((r) => (
              <ReservaRow key={r.id} r={r} accionable rivales={rivales} />
            ))}
          </div>
        )}
      </section>

      {pasadas.length > 0 ? (
        <section>
          <h2 className="mb-3 font-medium">Historial</h2>
          <div className="flex flex-col gap-2">
            {pasadas.slice(0, LIMITE_HISTORIAL_INICIAL).map((r) => (
              <ReservaRow key={r.id} r={r} accionable={false} />
            ))}
          </div>
          {pasadas.length > LIMITE_HISTORIAL_INICIAL ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm underline" style={{ color: "var(--text-secondary)" }}>
                Ver los {pasadas.length - LIMITE_HISTORIAL_INICIAL} partidos anteriores
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {pasadas.slice(LIMITE_HISTORIAL_INICIAL).map((r) => (
                  <ReservaRow key={r.id} r={r} accionable={false} />
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ReservaRow({
  r,
  accionable,
  rivales = [],
}: {
  r: Awaited<ReturnType<typeof obtenerMisReservas>>[number];
  accionable: boolean;
  rivales?: Awaited<ReturnType<typeof obtenerRivales>>;
}) {
  const estado = ESTADO_RESERVA[r.estado] ?? { label: r.estado, tone: "muted" as const };
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{r.complejo.nombre}</span>
            <span style={{ color: "var(--text-muted)" }}>· {r.cancha.nombre} · {DEPORTE_LABEL[r.cancha.deporte] ?? r.cancha.deporte}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <span>{formatFechaCorta(r.fecha)}</span>
            <span>{formatHora(r.horaInicio)}–{formatHora(r.horaFin)}</span>
            {r.esHorarioValle ? <Badge tone="accent">Horario valle</Badge> : null}
            {!r.esOrganizador ? <Badge tone="good">Te uniste</Badge> : null}
            <Badge tone={estado.tone}>{estado.label}</Badge>
          </div>
          {r.montoAbono > 0 ? (
            <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Abono pagado: {formatCLP(r.montoAbono)} de {formatCLP(r.montoTotal)}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {accionable && r.esOrganizador && r.estado !== "cancelada" ? (
            <>
              {r.puedeBuscarRival ? (
                <form action={buscarRivalAction}>
                  <input type="hidden" name="reservaId" value={r.id} />
                  <button type="submit" className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: "var(--series-prime)", color: "white" }}>
                    Buscar rival
                  </button>
                </form>
              ) : r.solicitudAbiertaId ? (
                <Badge tone="warning">Ya buscando rival</Badge>
              ) : null}
              <form action={cancelarReservaAction}>
                <input type="hidden" name="reservaId" value={r.id} />
                <button type="submit" className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: "var(--status-critical)", color: "white" }}>
                  Cancelar
                </button>
              </form>
            </>
          ) : null}
          {r.puedeReportarResultado ? (
            <Link href={`/mis-reservas/${r.id}/resultado`} className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: "var(--chart-surface)", border: "1px solid var(--gridline)" }}>
              Reportar resultado
            </Link>
          ) : null}
        </div>
      </div>

      {r.solicitudAbiertaId && rivales.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs underline" style={{ color: "var(--text-secondary)" }}>
            Desafiar directo a un rival anterior
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {rivales.slice(0, 5).map((riv) => (
              <form key={riv.rivalId} action={invitarRivalAction}>
                <input type="hidden" name="solicitudId" value={r.solicitudAbiertaId!} />
                <input type="hidden" name="rivalId" value={riv.rivalId} />
                <button
                  type="submit"
                  className="rounded-md px-2.5 py-1 text-xs"
                  style={{ background: "var(--chart-surface)", border: "1px solid var(--gridline)" }}
                >
                  {riv.rivalNombre} ({riv.victorias}V {riv.empates}E {riv.derrotas}D)
                </button>
              </form>
            ))}
          </div>
        </details>
      ) : null}
    </Card>
  );
}
