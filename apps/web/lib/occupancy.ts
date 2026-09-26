import { SLOTS_PRIME, SLOTS_VALLE } from "@cancha-llena/db/slots";

// Ocupación = reservas / horarios posibles, no solo un conteo de reservas — si no,
// un complejo con pocas canchas "parece" tan lleno como uno grande. Usa la misma
// grilla de horarios que el seed y la página de reserva (packages/db/src/slots.ts)
// — que estuviera duplicada en dos archivos ya causó un bug de ocupación >100%.
export const VENTANA_DIAS = 21;
const SLOTS_VALLE_POR_DIA = SLOTS_VALLE.length;
const SLOTS_PRIME_POR_DIA = SLOTS_PRIME.length;

export function ventanaPasada(dias: number = VENTANA_DIAS) {
  const hoy = new Date();
  const inicio = new Date(hoy);
  inicio.setDate(inicio.getDate() - dias);
  return {
    inicioISO: inicio.toISOString().slice(0, 10),
    hoyISO: hoy.toISOString().slice(0, 10),
  };
}

export function contarDiasHabiles(inicioISO: string, finISOExclusivo: string): number {
  let dias = 0;
  const cursor = new Date(`${inicioISO}T00:00:00`);
  const fin = new Date(`${finISOExclusivo}T00:00:00`);
  while (cursor < fin) {
    const diaSemana = cursor.getDay();
    if (diaSemana >= 1 && diaSemana <= 5) dias++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export type ReservaOcupacion = { fecha: string; estado: string; esHorarioValle: boolean };

export function calcularOcupacionPorCancha(reservas: ReservaOcupacion[], dias: number = VENTANA_DIAS) {
  const { inicioISO, hoyISO } = ventanaPasada(dias);
  const diasHabiles = contarDiasHabiles(inicioISO, hoyISO);

  const slotsVallePosibles = diasHabiles * SLOTS_VALLE_POR_DIA;
  const slotsPrimePosibles = dias * SLOTS_PRIME_POR_DIA;

  const enVentana = reservas.filter((r) => r.fecha >= inicioISO && r.fecha < hoyISO && r.estado !== "cancelada");
  const valleOcupados = enVentana.filter((r) => r.esHorarioValle).length;
  const primeOcupados = enVentana.filter((r) => !r.esHorarioValle).length;

  const pct = (num: number, den: number) => (den === 0 ? 0 : Math.round((num / den) * 100));

  return {
    valleOcupadoPct: pct(valleOcupados, slotsVallePosibles),
    primeOcupadoPct: pct(primeOcupados, slotsPrimePosibles),
    reservasEnVentana: enVentana.length,
    slotsVallePosibles,
    slotsPrimePosibles,
    // Conteos crudos (mismo filtro de ventana ya aplicado) para poder sumar
    // varias canchas sin volver a filtrar por fecha en otro lado y desalinear
    // numerador/denominador.
    valleOcupados,
    primeOcupados,
  };
}
