export function formatCLP(n: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

export const DEPORTE_LABEL: Record<string, string> = {
  futbolito: "Fútbolito",
  futbol: "Fútbol",
  padel: "Pádel",
  tenis: "Tenis",
};

export const ESTADO_RESERVA: Record<string, { label: string; tone: "good" | "warning" | "serious" | "critical" | "muted" }> = {
  confirmada: { label: "Confirmada", tone: "good" },
  completada: { label: "Completada", tone: "muted" },
  pendiente: { label: "Pendiente de pago", tone: "warning" },
  cancelada: { label: "Cancelada", tone: "critical" },
  no_show: { label: "No-show", tone: "serious" },
};

export function formatFechaCorta(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}

export function formatHora(hhmmss: string): string {
  return hhmmss.slice(0, 5);
}
