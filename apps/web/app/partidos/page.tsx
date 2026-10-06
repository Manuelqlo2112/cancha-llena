import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { ActivarUbicacionButton } from "@/components/ActivarUbicacionButton";
import { DEPORTE_LABEL, formatFechaCorta, formatHora } from "@/lib/format";
import { getSessionUser } from "@/lib/session";
import { listarInvitacionesPendientes, obtenerSolicitudesAbiertas } from "@/lib/reservas";
import { responderInvitacionAction, unirseComoRival } from "@/app/actions";

export const dynamic = "force-dynamic";

const MENSAJES: Record<string, string> = {
  error_ya_unido: "Ya estabas anotado en ese partido.",
  error_solicitud_cerrada: "Esa búsqueda de rival ya se cerró — llegaste justo tarde.",
  error_ya_respondida: "Ya habías respondido esa invitación.",
  error_no_encontrada: "Esa invitación ya no existe.",
  error_coordenadas_invalidas: "No pudimos usar esa ubicación — prueba de nuevo.",
};

// Pantalla separada del flujo de reservar (que es puro calendario): acá se
// descubren partidos ya reservados a los que les falta gente, más las
// invitaciones puntuales para quienes activaron su ubicación y están cerca.
export default async function PartidosPage({
  searchParams,
}: {
  searchParams: Promise<{ unido?: string; rechazado?: string; ubicacion?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSessionUser();
  const [solicitudes, invitaciones] = await Promise.all([
    obtenerSolicitudesAbiertas(session?.id ?? null),
    session ? listarInvitacionesPendientes(session.id) : Promise.resolve([]),
  ]);

  const mensaje = sp.unido
    ? "Te uniste al partido — ya avisamos que se completó un cupo."
    : sp.rechazado
      ? "Listo, avisamos que no vas a ese partido."
      : sp.ubicacion
        ? "Ubicación activada — te vamos a avisar de partidos cerca tuyo."
        : sp.error
          ? MENSAJES[`error_${sp.error}`]
          : null;

  const tieneUbicacion = session?.ultimaLat !== null && session?.ultimaLat !== undefined;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Partidos que buscan jugadores</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Súmate a un partido ya reservado al que le falta gente para completar el equipo.
        </p>
      </div>

      {session && !tieneUbicacion ? <ActivarUbicacionButton /> : null}

      {mensaje ? (
        <div className="mb-6 rounded-lg px-4 py-2.5 text-sm" style={{ background: "var(--chart-surface)", color: "var(--text-secondary)", border: "1px solid var(--gridline)" }}>
          {mensaje}
        </div>
      ) : null}

      {invitaciones.length > 0 ? (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Te invitaron — están cerca tuyo
          </h2>
          <div className="flex flex-col gap-3">
            {invitaciones.map((i) => (
              <Card key={i.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{i.complejo.nombre}</p>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {i.cancha.nombre} · {DEPORTE_LABEL[i.cancha.deporte] ?? i.cancha.deporte}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>{formatFechaCorta(i.fecha)}</span>
                      <span>{formatHora(i.horaInicio)}–{formatHora(i.horaFin)}</span>
                      {i.esHorarioValle ? <Badge tone="accent">Horario valle</Badge> : null}
                      <Badge tone="warning">Faltan {i.cuposFaltantes}</Badge>
                      {i.distanciaKm !== null ? <span>{i.distanciaKm < 1 ? "a menos de 1 km" : `a ${Math.round(i.distanciaKm)} km`}</span> : null}
                      <span>Organiza {i.organizadorNombre}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={responderInvitacionAction}>
                      <input type="hidden" name="invitacionId" value={i.id} />
                      <input type="hidden" name="respuesta" value="rechazada" />
                      <button type="submit" className="rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: "var(--chart-surface)", border: "1px solid var(--gridline)" }}>
                        No puedo
                      </button>
                    </form>
                    <form action={responderInvitacionAction}>
                      <input type="hidden" name="invitacionId" value={i.id} />
                      <input type="hidden" name="respuesta" value="aceptada" />
                      <button type="submit" className="rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: "var(--series-prime)", color: "white" }}>
                        Voy
                      </button>
                    </form>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Todos los partidos abiertos
      </h2>
      {solicitudes.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No hay partidos buscando jugadores por ahora.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {solicitudes.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{s.complejo.nombre}</p>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {s.cancha.nombre} · {DEPORTE_LABEL[s.cancha.deporte] ?? s.cancha.deporte}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{formatFechaCorta(s.fecha)}</span>
                    <span>{formatHora(s.horaInicio)}–{formatHora(s.horaFin)}</span>
                    {s.esHorarioValle ? <Badge tone="accent">Horario valle</Badge> : null}
                    <Badge tone="warning">Faltan {s.cuposFaltantes}</Badge>
                    <span>Organiza {s.organizadorNombre}</span>
                  </p>
                </div>
                {s.yaParticipa ? (
                  <Badge tone="good">Ya estás anotado</Badge>
                ) : (
                  <form action={unirseComoRival}>
                    <input type="hidden" name="solicitudId" value={s.id} />
                    <input type="hidden" name="returnTo" value="partidos" />
                    <button type="submit" className="rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: "var(--series-prime)", color: "white" }}>
                      Unirme
                    </button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
