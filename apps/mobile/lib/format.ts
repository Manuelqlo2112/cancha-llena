// La API devuelve horaInicio/horaFin tal cual las guarda Postgres (un tipo
// TIME, "19:00:00") — esto es lo único que lo recorta a "19:00" para mostrar.
export function formatHora(hhmmss: string): string {
  return hhmmss.slice(0, 5);
}

export function formatCLP(n: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
