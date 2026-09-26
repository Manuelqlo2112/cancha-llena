import { defineRelations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Mirrors the technical doc (Sección 2 — Modelo de datos). Postgres dialect so the
// same schema applies unchanged to Supabase in production; only the driver changes.

export const userRoleEnum = pgEnum("user_role", [
  "jugador",
  "admin_complejo",
  "super_admin",
]);

export const deporteEnum = pgEnum("deporte", [
  "futbolito",
  "futbol",
  "padel",
  "tenis",
]);

export const reservaEstadoEnum = pgEnum("reserva_estado", [
  "pendiente",
  "confirmada",
  "cancelada",
  "completada",
  "no_show",
]);

export const paymentProviderEnum = pgEnum("payment_provider", [
  "transbank",
  "mercadopago",
  "stripe",
]);

export const paymentEstadoEnum = pgEnum("payment_estado", [
  "pendiente",
  "pagado",
  "fallido",
  "reembolsado",
]);

export const solicitudEstadoEnum = pgEnum("solicitud_estado", [
  "abierta",
  "cerrada",
  "expirada",
]);

export const invitacionEstadoEnum = pgEnum("invitacion_estado", [
  "pendiente",
  "aceptada",
  "rechazada",
]);

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull().unique(),
  telefono: text("telefono"),
  rol: userRoleEnum("rol").notNull().default("jugador"),
  // { futbolito: 3.5, padel: 2.0, ... } — placeholder hasta que exista ranking ELO (Fase 2)
  nivelPorDeporte: jsonb("nivel_por_deporte").notNull().default(sql`'{}'::jsonb`),
  complejoAdminId: uuid("complejo_admin_id").references((): any => complejos.id),
  // Última ubicación conocida, la manda el celular con permiso del usuario
  // (expo-location) — sirve para elegir a quién avisar cuando un partido
  // busca jugadores "cerca de la cancha". Null hasta que el usuario active
  // la ubicación al menos una vez; nunca se pide en la web.
  ultimaLat: numeric("ultima_lat", { precision: 9, scale: 6 }),
  ultimaLng: numeric("ultima_lng", { precision: 9, scale: 6 }),
  ultimaUbicacionEn: timestamp("ultima_ubicacion_en", { withTimezone: true }),
  // Solo para cuentas creadas con email+contraseña (proveedor "credentials" de
  // Auth.js) — null en cuentas que entran por Google/Microsoft.
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Login real (Google / Microsoft / futuros proveedores OAuth) ----
// @auth/drizzle-adapter (el paquete "oficial") todavía no soporta
// drizzle-orm v1 — rompe el build con exports que ya no existen. En vez de
// esperar a que se actualice, apps/web/lib/authAdapter.ts implementa el
// `Adapter` de Auth.js a mano contra estas tablas; como esa capa la
// escribimos nosotros, no hace falta una tabla auth_users separada — la
// cuenta OAuth se linkea directo a `usuarios.id`.
export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const complejos = pgTable("complejos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  slug: text("slug").notNull().unique(),
  comuna: text("comuna").notNull(),
  direccion: text("direccion").notNull(),
  telefono: text("telefono"),
  email: text("email"),
  // Texto libre tipo "Lun-Vie 09:00-23:30 · Sáb-Dom 09:00-21:30" — horario de
  // atención mostrado al público. Los bloques de reserva reales viven en
  // `horarios_valle` + la grilla de packages/db/src/slots.ts.
  horarioTexto: text("horario_texto"),
  amenidades: text("amenidades").array().notNull().default(sql`ARRAY[]::text[]`),
  // Coordenadas reales del complejo — base para calcular "jugadores cerca de
  // la cancha" cuando se abre una solicitud de rival.
  lat: numeric("lat", { precision: 9, scale: 6 }),
  lng: numeric("lng", { precision: 9, scale: 6 }),
  comisionBasePct: numeric("comision_base_pct", { precision: 5, scale: 2 }).notNull(),
  comisionVallePct: numeric("comision_valle_pct", { precision: 5, scale: 2 }).notNull(),
  feeMensualFijo: numeric("fee_mensual_fijo", { precision: 10, scale: 0 }),
  // Sección 3 del doc técnico: no todos los complejos exigen abono online.
  requiereAbono: boolean("requiere_abono").notNull().default(true),
  porcentajeAbono: numeric("porcentaje_abono", { precision: 5, scale: 2 }).notNull().default("30.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const canchas = pgTable("canchas", {
  id: uuid("id").primaryKey().defaultRandom(),
  complejoId: uuid("complejo_id")
    .notNull()
    .references(() => complejos.id, { onDelete: "cascade" }),
  deporte: deporteEnum("deporte").notNull(),
  nombre: text("nombre").notNull(),
  capacidadJugadores: integer("capacidad_jugadores").notNull(),
  precioBase: numeric("precio_base", { precision: 10, scale: 0 }).notNull(),
  activo: boolean("activo").notNull().default(true),
});

export const horariosValle = pgTable("horarios_valle", {
  id: uuid("id").primaryKey().defaultRandom(),
  complejoId: uuid("complejo_id")
    .notNull()
    .references(() => complejos.id, { onDelete: "cascade" }),
  // null = aplica a todas las canchas del complejo
  canchaId: uuid("cancha_id").references(() => canchas.id, { onDelete: "cascade" }),
  diaSemana: integer("dia_semana").notNull(), // 0 = domingo .. 6 = sábado
  horaInicio: time("hora_inicio").notNull(),
  horaFin: time("hora_fin").notNull(),
});

export const reservas = pgTable("reservas", {
  id: uuid("id").primaryKey().defaultRandom(),
  canchaId: uuid("cancha_id")
    .notNull()
    .references(() => canchas.id, { onDelete: "cascade" }),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  fecha: date("fecha").notNull(),
  horaInicio: time("hora_inicio").notNull(),
  horaFin: time("hora_fin").notNull(),
  estado: reservaEstadoEnum("estado").notNull().default("pendiente"),
  esHorarioValle: boolean("es_horario_valle").notNull().default(false),
  montoTotal: numeric("monto_total", { precision: 10, scale: 0 }).notNull(),
  // 0 cuando el complejo no exige abono (requiereAbono = false)
  montoAbono: numeric("monto_abono", { precision: 10, scale: 0 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const participantesReserva = pgTable("participantes_reserva", {
  id: uuid("id").primaryKey().defaultRandom(),
  reservaId: uuid("reserva_id")
    .notNull()
    .references(() => reservas.id, { onDelete: "cascade" }),
  usuarioId: uuid("usuario_id").references(() => usuarios.id),
  nombreInvitado: text("nombre_invitado"),
  confirmado: boolean("confirmado").notNull().default(false),
  // true si este cupo se llenó por la mecánica de "buscar rival" (se unió a
  // una solicitud abierta) en vez de haber sido agregado por el organizador.
  // Es el dato que sostiene el argumento comercial de la Sección 04 del doc
  // de producto: "cuántas reservas vinieron de una mecánica específica".
  viaSolicitudRival: boolean("via_solicitud_rival").notNull().default(false),
});

export const pagos = pgTable("pagos", {
  id: uuid("id").primaryKey().defaultRandom(),
  reservaId: uuid("reserva_id")
    .notNull()
    .references(() => reservas.id, { onDelete: "cascade" }),
  proveedor: paymentProviderEnum("proveedor").notNull(),
  monto: numeric("monto", { precision: 10, scale: 0 }).notNull(),
  moneda: text("moneda").notNull().default("CLP"),
  estado: paymentEstadoEnum("estado").notNull().default("pendiente"),
  referenciaExterna: text("referencia_externa"),
  comisionAplicadaPct: numeric("comision_aplicada_pct", { precision: 5, scale: 2 }).notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const solicitudesRival = pgTable("solicitudes_rival", {
  id: uuid("id").primaryKey().defaultRandom(),
  reservaId: uuid("reserva_id")
    .notNull()
    .references(() => reservas.id, { onDelete: "cascade" }),
  cuposFaltantes: integer("cupos_faltantes").notNull(),
  nivelMinimo: numeric("nivel_minimo", { precision: 3, scale: 1 }),
  nivelMaximo: numeric("nivel_maximo", { precision: 3, scale: 1 }),
  estado: solicitudEstadoEnum("estado").notNull().default("abierta"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

// Quién fue invitado a una solicitud de rival por estar cerca, y qué
// respondió. Existe aparte de `participantes_reserva` porque una invitación
// puede quedar "rechazada" o "pendiente" sin nunca sumar un cupo — y la
// restricción única es lo que evita mandar la misma invitación dos veces
// (el requisito de "avisar si ya se anotaron para completar").
export const solicitudInvitaciones = pgTable(
  "solicitud_invitaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    solicitudId: uuid("solicitud_id")
      .notNull()
      .references(() => solicitudesRival.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    distanciaKm: numeric("distancia_km", { precision: 6, scale: 2 }),
    estado: invitacionEstadoEnum("estado").notNull().default("pendiente"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    respondidoEn: timestamp("respondido_en", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.solicitudId, t.usuarioId] })],
);

export const rachas = pgTable("rachas", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  // null = racha global del jugador, no atada a un complejo
  complejoId: uuid("complejo_id").references(() => complejos.id, { onDelete: "cascade" }),
  contadorActual: integer("contador_actual").notNull().default(0),
  mejorRacha: integer("mejor_racha").notNull().default(0),
  ultimaFechaValida: date("ultima_fecha_valida"),
  recompensaDesbloqueada: boolean("recompensa_desbloqueada").notNull().default(false),
});

// ---- Relations (para queries anidadas con db.query.*) ----
// API de relations de drizzle-orm v1 (defineRelations): un único objeto para
// todo el esquema, en vez de un relations() por tabla como en la línea 0.x.

export const dbRelations = defineRelations(
  {
    usuarios,
    complejos,
    canchas,
    horariosValle,
    reservas,
    participantesReserva,
    pagos,
    solicitudesRival,
    solicitudInvitaciones,
    rachas,
    authAccounts,
  },
  (r) => ({
    complejos: {
      canchas: r.many.canchas(),
      horariosValle: r.many.horariosValle(),
      rachas: r.many.rachas(),
    },
    canchas: {
      complejo: r.one.complejos({ from: r.canchas.complejoId, to: r.complejos.id }),
      reservas: r.many.reservas(),
    },
    horariosValle: {
      complejo: r.one.complejos({ from: r.horariosValle.complejoId, to: r.complejos.id }),
      cancha: r.one.canchas({ from: r.horariosValle.canchaId, to: r.canchas.id }),
    },
    reservas: {
      cancha: r.one.canchas({ from: r.reservas.canchaId, to: r.canchas.id }),
      usuario: r.one.usuarios({ from: r.reservas.usuarioId, to: r.usuarios.id }),
      participantes: r.many.participantesReserva(),
      pagos: r.many.pagos(),
      solicitudRival: r.many.solicitudesRival(),
    },
    participantesReserva: {
      reserva: r.one.reservas({ from: r.participantesReserva.reservaId, to: r.reservas.id }),
      usuario: r.one.usuarios({ from: r.participantesReserva.usuarioId, to: r.usuarios.id }),
    },
    usuarios: {
      reservas: r.many.reservas(),
      rachas: r.many.rachas(),
      invitaciones: r.many.solicitudInvitaciones(),
      complejoAdmin: r.one.complejos({ from: r.usuarios.complejoAdminId, to: r.complejos.id }),
    },
    pagos: {
      reserva: r.one.reservas({ from: r.pagos.reservaId, to: r.reservas.id }),
    },
    solicitudesRival: {
      reserva: r.one.reservas({ from: r.solicitudesRival.reservaId, to: r.reservas.id }),
      invitaciones: r.many.solicitudInvitaciones(),
    },
    solicitudInvitaciones: {
      solicitud: r.one.solicitudesRival({ from: r.solicitudInvitaciones.solicitudId, to: r.solicitudesRival.id }),
      usuario: r.one.usuarios({ from: r.solicitudInvitaciones.usuarioId, to: r.usuarios.id }),
    },
    rachas: {
      usuario: r.one.usuarios({ from: r.rachas.usuarioId, to: r.usuarios.id }),
      complejo: r.one.complejos({ from: r.rachas.complejoId, to: r.complejos.id }),
    },
  }),
);
