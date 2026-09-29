const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Antes de esto, un id con formato inválido (no-uuid) llegaba tal cual a una
// columna `uuid` de Postgres y tiraba un error crudo de sintaxis en vez de
// un "no encontrada" prolijo — esto corta esa clase de bug en el borde.
export function esUuid(v: string): boolean {
  return UUID_RE.test(v);
}

// Valida formato (YYYY-MM-DD) Y que sea una fecha calendario real: rechaza
// "2026-13-45" o "2026-02-30", que el regex solo no detecta.
export function esFechaValida(v: string): boolean {
  if (!FECHA_RE.test(v)) return false;
  const [anio, mes, dia] = v.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}
