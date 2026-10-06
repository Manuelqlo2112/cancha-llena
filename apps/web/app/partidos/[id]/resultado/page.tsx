import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/Card";
import { obtenerResultadoPublico } from "@/lib/resultados";
import { DEPORTE_LABEL, formatFechaCorta, formatHora } from "@/lib/format";

export const dynamic = "force-dynamic";

// Pública a propósito (sin getSessionUser) — es la página que se comparte
// fuera de la app. Ver el comentario en obtenerResultadoPublico.
export default async function ResultadoPublicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await obtenerResultadoPublico(id);
  if (!resultado) notFound();

  const ganoA = resultado.equipoGanador === "A";
  const ganoB = resultado.equipoGanador === "B";

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {resultado.complejo.nombre} · {resultado.cancha.nombre}
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {formatFechaCorta(resultado.fecha)} · {formatHora(resultado.horaInicio)} · {DEPORTE_LABEL[resultado.cancha.deporte] ?? resultado.cancha.deporte}
        </p>
      </div>

      <Card>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Equipo nombres={resultado.equipoA} ganador={ganoA} alineacion="right" />
          <span className="text-lg font-semibold" style={{ color: "var(--text-muted)" }}>
            vs
          </span>
          <Equipo nombres={resultado.equipoB} ganador={ganoB} alineacion="left" />
        </div>
        <p className="mt-4 text-center text-sm font-medium" style={{ color: resultado.equipoGanador === "empate" ? "var(--text-secondary)" : "var(--series-valle)" }}>
          {resultado.equipoGanador === "empate" ? "Empate" : `Ganó el equipo ${resultado.equipoGanador}`}
        </p>
      </Card>

      <div className="mt-8 text-center">
        <p className="mb-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          Reserva tu cancha y arma tu propio partido.
        </p>
        <Link href="/" className="inline-block rounded-md px-5 py-2.5 text-sm font-medium" style={{ background: "var(--series-valle)", color: "white" }}>
          Abrir Cancha Llena
        </Link>
      </div>
    </div>
  );
}

function Equipo({ nombres, ganador, alineacion }: { nombres: string[]; ganador: boolean; alineacion: "left" | "right" }) {
  return (
    <div className={`flex flex-col gap-1 ${alineacion === "right" ? "items-end text-right" : "items-start text-left"}`}>
      {nombres.map((n) => (
        <span key={n} className="text-sm" style={{ color: ganador ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: ganador ? 600 : 400 }}>
          {n}
        </span>
      ))}
    </div>
  );
}
