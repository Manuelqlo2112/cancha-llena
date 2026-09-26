const TONE_COLOR: Record<string, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
  muted: "var(--text-muted)",
  accent: "var(--series-valle)",
};

export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE_COLOR;
}) {
  const color = TONE_COLOR[tone];
  return (
    // El color de estado vive solo en el punto + el fondo tenue, nunca en el texto
    // (el texto queda en un token de tinta neutra, siguiendo la guía de dataviz).
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color: "var(--text-secondary)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}
