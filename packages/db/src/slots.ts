// Única fuente de verdad para la grilla de horarios reservables (el seed, el
// cálculo de ocupación y la página de reserva deben coincidir siempre en esto —
// que hayan estado duplicados en dos archivos ya causó un bug de ocupación >100%).
// Cuando exista disponibilidad configurable por complejo, esto se reemplaza por
// una consulta a `horarios_valle` + una tabla de bloques reservables reales.
export const SLOTS_VALLE = ["10:00", "13:00"] as const;
export const SLOTS_PRIME = ["19:00", "21:00"] as const;

export function esDiaLaboral(fecha: Date): boolean {
  const dia = fecha.getDay();
  return dia >= 1 && dia <= 5;
}

export function slotsDelDia(fecha: Date): { hora: string; valle: boolean }[] {
  return [
    ...(esDiaLaboral(fecha) ? SLOTS_VALLE.map((hora) => ({ hora, valle: true })) : []),
    ...SLOTS_PRIME.map((hora) => ({ hora, valle: false })),
  ];
}

export function horaFinDe(horaInicio: string): string {
  const h = Number(horaInicio.slice(0, 2));
  return `${String(h + 1).padStart(2, "0")}:00`;
}
