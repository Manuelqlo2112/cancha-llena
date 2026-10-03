import { randomUUID } from "node:crypto";
import {
  authAccounts,
  canchas,
  complejos,
  db,
  horariosValle,
  ligaInscripciones,
  ligas,
  pagos,
  participantesReserva,
  planesMensuales,
  rachas,
  reservas,
  solicitudInvitaciones,
  solicitudesRival,
  suscripcionesMensuales,
  usuarios,
} from "@cancha-llena/db";

// Se llama en beforeEach de cada archivo de test — más simple y confiable
// que hacer que cada test invente datos únicos para no pisarse con otros.
export async function resetDb() {
  await db.delete(pagos);
  await db.delete(solicitudInvitaciones);
  await db.delete(solicitudesRival);
  await db.delete(participantesReserva);
  await db.delete(rachas);
  await db.delete(ligaInscripciones);
  await db.delete(ligas);
  await db.delete(suscripcionesMensuales);
  await db.delete(planesMensuales);
  await db.delete(reservas);
  await db.delete(horariosValle);
  await db.delete(canchas);
  await db.delete(authAccounts);
  await db.delete(usuarios);
  await db.delete(complejos);
}

// Para los planes mensuales: consumirCupoSiAplica solo aplica en un día
// laboral — fechaRelativa(1) puede caer en fin de semana según cuándo
// corran los tests, así que esto sí garantiza un día de semana real.
export function proximoDiaLaboral(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function crearComplejoFixture(overrides: Partial<typeof complejos.$inferInsert> = {}) {
  const [c] = await db
    .insert(complejos)
    .values({
      nombre: "Complejo Test",
      slug: `complejo-test-${randomUUID().slice(0, 8)}`,
      comuna: "Testville",
      direccion: "Calle Falsa 123",
      comisionBasePct: "8.00",
      comisionVallePct: "14.00",
      requiereAbono: false,
      porcentajeAbono: "0.00",
      lat: "-33.450000",
      lng: "-70.650000",
      ...overrides,
    })
    .returning();
  return c!;
}

export async function crearCanchaFixture(complejoId: string, overrides: Partial<typeof canchas.$inferInsert> = {}) {
  const [c] = await db
    .insert(canchas)
    .values({
      complejoId,
      deporte: "futbolito",
      nombre: "Cancha 1",
      capacidadJugadores: 10,
      precioBase: "40000",
      ...overrides,
    })
    .returning();
  return c!;
}

export async function crearUsuarioFixture(overrides: Partial<typeof usuarios.$inferInsert> = {}) {
  const [u] = await db
    .insert(usuarios)
    .values({
      nombre: "Jugador Test",
      email: `test-${randomUUID()}@mail.cl`,
      rol: "jugador",
      ...overrides,
    })
    .returning();
  return u!;
}

// Fecha ISO relativa a hoy — para no hardcodear fechas que con el tiempo
// pasan a estar "en el pasado" y rompen tests que asumen que están vigentes.
export function fechaRelativa(diasDesdeHoy: number): string {
  const d = new Date();
  d.setDate(d.getDate() + diasDesdeHoy);
  return d.toISOString().slice(0, 10);
}
