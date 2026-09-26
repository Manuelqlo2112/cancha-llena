type CanchaOcupacion = {
  id: string;
  nombre: string;
  valleOcupadoPct: number;
  primeOcupadoPct: number;
};

// Comparación valle vs. prime por cancha — el gráfico que sostiene el argumento
// comercial del documento de producto (Sección 04: "demanda medible", no solo la
// promesa). Dos series categóricas (skill dataviz: slot 1 = valle, slot 2 = prime),
// con leyenda porque hay 2+ series, barras con extremo redondeado 4px y base
// cuadrada, separadas por el gap de 2px de superficie, valor en la punta.
export function OccupancyBars({ canchas }: { canchas: CanchaOcupacion[] }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Legend swatch="var(--series-valle)" label="Horario valle" />
        <Legend swatch="var(--series-prime)" label="Horario prime" />
      </div>
      <div className="flex flex-col">
        {canchas.map((c) => (
          <div key={c.id} className="grid grid-cols-[140px_1fr] items-center gap-3 py-2.5" style={{ borderTop: "1px solid var(--gridline)" }}>
            <div className="truncate text-sm">{c.nombre}</div>
            <div className="flex flex-col gap-[2px]">
              <Bar pct={c.valleOcupadoPct} color="var(--series-valle)" title={`${c.nombre} · horario valle: ${c.valleOcupadoPct}% ocupado`} />
              <Bar pct={c.primeOcupadoPct} color="var(--series-prime)" title={`${c.nombre} · horario prime: ${c.primeOcupadoPct}% ocupado`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: swatch }} />
      {label}
    </span>
  );
}

function Bar({ pct, color, title }: { pct: number; color: string; title: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2" title={title}>
      <div className="h-3.5 flex-1 overflow-hidden" style={{ background: "var(--gridline)", borderRadius: 4 }}>
        <div
          className="h-full"
          style={{
            width: `${clamped}%`,
            background: color,
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
          }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {clamped}%
      </span>
    </div>
  );
}
