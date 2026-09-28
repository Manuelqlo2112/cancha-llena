import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@cancha-llena/db";
import { Card } from "@/components/Card";
import { StatTile } from "@/components/StatTile";
import { OccupancyBars } from "@/components/OccupancyBars";
import { DEPORTE_LABEL, formatCLP } from "@/lib/format";
import { calcularOcupacionPorCancha, VENTANA_DIAS } from "@/lib/occupancy";
import { getSessionUser, puedeAdministrar } from "@/lib/session";
import { obtenerImpactoGamificacion } from "@/lib/adminGestion";
import { actualizarCanchaAction, actualizarComplejoAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const MENSAJES: Record<string, string> = {
  guardado: "Cambios guardados.",
  error_sin_permiso: "No tenés permiso para editar esto.",
  error_no_encontrada: "Esa cancha ya no existe.",
  error_datos_invalidos: "Revisá los datos — el precio tiene que ser mayor a 0, y el % de abono entre 1 y 100.",
};

export default async function AdminComplejoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ guardado?: string; error?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const mensaje = sp.guardado ? MENSAJES.guardado : sp.error ? MENSAJES[`error_${sp.error}`] : null;

  const session = await getSessionUser();
  if (!session) redirect(`/login?next=/admin/${slug}`);

  const complejo = await db.query.complejos.findFirst({
    where: { slug },
    with: {
      canchas: {
        with: {
          reservas: {
            columns: { id: true, fecha: true, estado: true, esHorarioValle: true },
            with: { pagos: { columns: { monto: true, estado: true } } },
          },
        },
      },
    },
  });

  if (!complejo) notFound();

  if (!puedeAdministrar(session, complejo.id)) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No autorizado</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Tu cuenta no es admin de {complejo.nombre}.{" "}
          <Link href="/admin" className="underline">
            Ir a tu panel
          </Link>
          .
        </p>
      </div>
    );
  }

  const porCancha = complejo.canchas.map((cancha) => ({
    id: cancha.id,
    nombre: cancha.nombre,
    ...calcularOcupacionPorCancha(cancha.reservas),
  }));

  // Ojo: los conteos de ocupados vienen ya filtrados a la misma ventana de 21
  // días que los slots posibles (calcularOcupacionPorCancha) — sumar acá en vez
  // de re-filtrar reservas "a mano" es lo que evita que el numerador incluya
  // reservas futuras mientras el denominador solo cubre el pasado (daba >100%).
  const totalReservasVentana = porCancha.reduce((acc, c) => acc + c.reservasEnVentana, 0);
  const totalSlotsValle = porCancha.reduce((acc, c) => acc + c.slotsVallePosibles, 0);
  const totalSlotsPrime = porCancha.reduce((acc, c) => acc + c.slotsPrimePosibles, 0);
  const valleOcupados = porCancha.reduce((acc, c) => acc + c.valleOcupados, 0);
  const primeOcupados = porCancha.reduce((acc, c) => acc + c.primeOcupados, 0);
  const valleGlobalPct = totalSlotsValle === 0 ? 0 : Math.round((valleOcupados / totalSlotsValle) * 100);
  const primeGlobalPct = totalSlotsPrime === 0 ? 0 : Math.round((primeOcupados / totalSlotsPrime) * 100);

  const ingresosAbonos = complejo.canchas
    .flatMap((c) => c.reservas)
    .flatMap((r) => r.pagos)
    .filter((p) => p.estado === "pagado")
    .reduce((acc, p) => acc + Number(p.monto), 0);

  const impacto = await obtenerImpactoGamificacion(complejo.id);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{complejo.nombre} · Panel de admin</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Comisión {Number(complejo.comisionBasePct)}% base · {Number(complejo.comisionVallePct)}% en horario valle
          {complejo.requiereAbono ? ` · abono ${Number(complejo.porcentajeAbono)}%` : " · sin abono online"}
          {complejo.feeMensualFijo ? ` · fee mensual ${formatCLP(Number(complejo.feeMensualFijo))}` : ""}
        </p>
      </div>

      {mensaje ? (
        <div
          className="mb-6 rounded-lg px-4 py-2.5 text-sm"
          style={{ background: "var(--chart-surface)", color: "var(--text-secondary)", border: "1px solid var(--gridline)" }}
        >
          {mensaje}
        </div>
      ) : null}

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Ocupación horario valle" value={`${valleGlobalPct}%`} hint={`últimos ${VENTANA_DIAS} días`} />
        <StatTile label="Ocupación horario prime" value={`${primeGlobalPct}%`} hint={`últimos ${VENTANA_DIAS} días`} />
        <StatTile label="Reservas" value={String(totalReservasVentana)} hint={`últimos ${VENTANA_DIAS} días`} />
        <StatTile label="Ingresos por abonos" value={formatCLP(ingresosAbonos)} hint="histórico, pagos confirmados" />
      </div>

      <div className="mb-8">
        <h2 className="mb-3 font-medium">Impacto de gamificación</h2>
        <p className="mb-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          Esto es lo que respalda la comisión incremental: demanda que la app generó, no la operación completa del
          complejo (Sección 04 del documento de producto).
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile label="Cupos llenados por 'buscar rival'" value={String(impacto.cuposViaSolicitud)} hint="histórico" />
          <StatTile label="Búsquedas de rival abiertas ahora" value={String(impacto.solicitudesAbiertas)} hint={`de ${impacto.solicitudesTotales} creadas en total`} />
          <StatTile label="Jugadores con racha activa" value={String(impacto.jugadoresConRachaActiva)} hint="jugaron ahí en los últimos 8 días" />
        </div>
      </div>

      <Card>
        <h2 className="mb-1 font-medium">Ocupación por cancha</h2>
        <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Esto es lo que un piloto tendría que ver moverse si la gamificación está funcionando: la brecha entre
          las barras naranjas (llenas) y azules (vacías) es la demanda que hoy no existe en horario valle.
        </p>
        <OccupancyBars canchas={porCancha} />
      </Card>

      <Card className="mt-6">
        <h2 className="mb-4 font-medium">Canchas</h2>
        <div className="flex flex-col gap-2">
          {complejo.canchas.map((cancha) => (
            <form
              key={cancha.id}
              action={actualizarCanchaAction}
              className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: "var(--chart-surface)" }}
            >
              <input type="hidden" name="canchaId" value={cancha.id} />
              <input type="hidden" name="slug" value={slug} />
              <span className="min-w-[10rem] text-sm font-medium">
                {cancha.nombre} <span style={{ color: "var(--text-muted)" }}>· {DEPORTE_LABEL[cancha.deporte] ?? cancha.deporte}</span>
              </span>
              <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                $
                <input
                  type="number"
                  name="precioBase"
                  defaultValue={cancha.precioBase}
                  min={1000}
                  step={1000}
                  className="w-24 rounded-md border px-2 py-1 text-sm"
                  style={{ borderColor: "var(--gridline)", background: "var(--surface)" }}
                />
                / hora
              </label>
              <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" name="activo" defaultChecked={cancha.activo} />
                Activa
              </label>
              <button type="submit" className="ml-auto rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: "var(--series-valle)", color: "white" }}>
                Guardar
              </button>
            </form>
          ))}
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="mb-1 font-medium">Configuración del complejo</h2>
        <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Lo que ven los jugadores en la ficha del complejo. La comisión de la plataforma no se edita acá.
        </p>
        <form action={actualizarComplejoAction} className="flex flex-col gap-3">
          <input type="hidden" name="complejoId" value={complejo.id} />
          <input type="hidden" name="slug" value={slug} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Teléfono
              <input
                type="text"
                name="telefono"
                defaultValue={complejo.telefono ?? ""}
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Email
              <input
                type="email"
                name="email"
                defaultValue={complejo.email ?? ""}
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
              defaultValue={complejo.horarioTexto ?? ""}
              placeholder="Lun-Vie 09:00-23:30 · Sáb-Dom 09:00-21:30"
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Amenidades (separadas por coma)
            <input
              type="text"
              name="amenidades"
              defaultValue={complejo.amenidades.join(", ")}
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
            />
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" name="requiereAbono" defaultChecked={complejo.requiereAbono} />
              Exige abono online
            </label>
            <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
              % de abono
              <input
                type="number"
                name="porcentajeAbono"
                defaultValue={Number(complejo.porcentajeAbono)}
                min={1}
                max={100}
                className="w-20 rounded-md border px-2 py-1 text-sm"
                style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
              />
            </label>
          </div>

          <button type="submit" className="mt-1 self-start rounded-md px-4 py-2 text-sm font-medium" style={{ background: "var(--series-valle)", color: "white" }}>
            Guardar configuración
          </button>
        </form>
      </Card>
    </div>
  );
}
