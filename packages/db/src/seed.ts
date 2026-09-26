import { eq } from "drizzle-orm";
import { db } from "./index";
import { distanciaKm } from "./geo";
import {
  canchas,
  complejos,
  horariosValle,
  pagos,
  participantesReserva,
  rachas,
  reservas,
  solicitudInvitaciones,
  solicitudesRival,
  usuarios,
} from "./schema";
import { horaFinDe, SLOTS_PRIME, SLOTS_VALLE } from "./slots";

// Piloto real (2026-09-24): dos complejos SOLO de futbolito en Santiago, los que
// Manuel eligió para arrancar en vez de multi-deporte. Datos de ubicación,
// horario, comisión de abono y amenidades vienen de sus propios sitios (ver
// [[doc-tecnico-cancha-llena]] / memoria del proyecto) — los precios por hora y
// las 629 reservas de ejemplo SÍ son dummy, pendientes de confirmar con cada
// complejo antes de ir a producción.

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
const chance = (p: number) => rng() < p;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
const randInt = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};

// 50 jugadores (no 16): con solo 16, la probabilidad de que cualquier
// jugador termine anotado en un partido ajeno era tan alta que "Mis
// reservas" le mostraba a cada uno cientos de partidos de toda la app — un
// bug real que rompía esa pantalla en el celular (poca gente + muchos
// partidos = todos terminan en casi todos). Con un pool más grande, cada
// jugador aparece en una cantidad de partidos razonable.
const NOMBRES = [
  "Cristóbal Fuentes", "Javiera Muñoz", "Matías Contreras", "Fernanda Soto",
  "Diego Vergara", "Antonia Reyes", "Sebastián Palma", "Camila Bravo",
  "Tomás Espinoza", "Valentina Rojas", "Ignacio Castro", "Josefa Lagos",
  "Benjamín Silva", "Constanza Herrera", "Vicente Tapia", "Florencia Núñez",
  "Martina Morales", "Emilia Araya", "Isidora Sepúlveda", "Catalina Fernández",
  "Amanda Pizarro", "Agustín Cárdenas", "Joaquín Bustos", "Maximiliano Toledo",
  "Nicolás Valenzuela", "Gabriel Riquelme", "Felipe Carrasco", "Rodrigo Sandoval",
  "Francisca Aránguiz", "Daniela Órdenes", "Paula Zúñiga", "Carla Figueroa",
  "Pía Mella", "Renata Cid", "Trinidad Salinas", "Bastián Morales",
  "Martina Araya", "Emilia Sepúlveda", "Isidora Fernández", "Catalina Pizarro",
  "Amanda Cárdenas", "Agustín Bustos", "Joaquín Toledo", "Maximiliano Valenzuela",
  "Nicolás Riquelme", "Gabriel Carrasco", "Felipe Sandoval", "Rodrigo Aránguiz",
  "Francisca Órdenes", "Daniela Zúñiga",
] as const;

async function main() {
  console.log("Limpiando datos previos…");
  await db.delete(pagos);
  await db.delete(solicitudInvitaciones);
  await db.delete(solicitudesRival);
  await db.delete(participantesReserva);
  await db.delete(rachas);
  await db.delete(reservas);
  await db.delete(horariosValle);
  await db.delete(canchas);
  await db.delete(usuarios);
  await db.delete(complejos);

  console.log("Creando complejos (piloto real)…");
  const [buenaventura, miraflores] = await db
    .insert(complejos)
    .values([
      {
        nombre: "Buenaventura Soccer Fit",
        slug: "buenaventura-soccer-fit",
        comuna: "Quilicura",
        direccion: "El Juncal 750",
        telefono: "+56 9 9892 4580",
        email: "contacto@buenaventurasoccerfit.cl",
        horarioTexto: "Lun-Vie 09:00-23:30 · Sáb-Dom 09:00-21:30",
        amenidades: ["Estacionamiento", "Camarines", "Cafetería", "Marcadores digitales LED"],
        comisionBasePct: "8.00",
        comisionVallePct: "14.00",
        feeMensualFijo: null,
        // Se paga en cancha (efectivo o débito) — sin abono online hoy.
        requiereAbono: false,
        porcentajeAbono: "0.00",
        // Aproximadas a nivel de comuna (Quilicura) — ajustar con la ubicación
        // exacta del complejo antes de depender de esto para producción.
        lat: "-33.358700",
        lng: "-70.730600",
      },
      {
        nombre: "Complejo Deportivo Miraflores",
        slug: "complejo-deportivo-miraflores",
        comuna: "Renca",
        direccion: "Av. Pdte. Germán Riesco 8712",
        telefono: "+56 9 8272 4562",
        email: "contacto@complejomiraflores.cl",
        horarioTexto: "Todos los días 09:00-24:00",
        amenidades: [
          "Estacionamiento para ~100 autos",
          "Camarines con agua caliente",
          "Cafetería con TV",
          "Quincho y terraza",
          "Seguridad 24 h",
        ],
        comisionBasePct: "7.00",
        comisionVallePct: "13.00",
        feeMensualFijo: null,
        // "Toda reserva requiere un abono del 50%" — dato real de su propio sitio.
        requiereAbono: true,
        porcentajeAbono: "50.00",
        // Aproximadas a nivel de comuna (Renca).
        lat: "-33.401300",
        lng: "-70.721200",
      },
    ])
    .returning();

  console.log("Creando canchas…");
  const canchasBuenaventura = await db
    .insert(canchas)
    .values(
      Array.from({ length: 6 }, (_, i) => ({
        complejoId: buenaventura!.id,
        deporte: "futbolito" as const,
        nombre: `Cancha ${i + 1}`,
        capacidadJugadores: 14,
        precioBase: "45000",
      })),
    )
    .returning();

  const canchasMiraflores = await db
    .insert(canchas)
    .values([
      ...Array.from({ length: 6 }, (_, i) => ({
        complejoId: miraflores!.id,
        deporte: "futbolito" as const,
        nombre: `Cancha ${i + 1}`,
        capacidadJugadores: 14,
        precioBase: "50000",
      })),
      {
        complejoId: miraflores!.id,
        deporte: "futbol" as const,
        nombre: "Cancha de Fútbol 11",
        capacidadJugadores: 22,
        precioBase: "90000",
      },
    ])
    .returning();

  console.log("Creando horarios valle (lunes a viernes, 10:00–17:00)…");
  for (const complejo of [buenaventura!, miraflores!]) {
    await db.insert(horariosValle).values(
      [1, 2, 3, 4, 5].map((diaSemana) => ({
        complejoId: complejo.id,
        canchaId: null,
        diaSemana,
        horaInicio: "10:00",
        horaFin: "17:00",
      })),
    );
  }

  console.log("Creando usuarios…");
  const [superAdmin] = await db
    .insert(usuarios)
    .values([
      { nombre: "Manuel Rodríguez", email: "rodriguez.manuel.c17@gmail.com", rol: "super_admin" },
    ])
    .returning();

  const [adminBuenaventura, adminMiraflores] = await db
    .insert(usuarios)
    .values([
      { nombre: "Admin Buenaventura", email: "piloto.buenaventura@canchallena.dev", rol: "admin_complejo", complejoAdminId: buenaventura!.id },
      { nombre: "Admin Miraflores", email: "piloto.miraflores@canchallena.dev", rol: "admin_complejo", complejoAdminId: miraflores!.id },
    ])
    .returning();

  // Piloto futbolito: el nivel de jugador solo se genera para los deportes que
  // de verdad se juegan en estos dos complejos.
  const DEPORTES = ["futbolito", "futbol"] as const;
  const jugadores = await db
    .insert(usuarios)
    .values(
      NOMBRES.map((nombre) => {
        const nivelPorDeporte: Record<string, number> = {};
        for (const d of DEPORTES) {
          if (chance(0.6)) nivelPorDeporte[d] = Math.round((1 + rng() * 4) * 10) / 10;
        }
        return {
          nombre,
          email: `${nombre.toLowerCase().replace(/\s+/g, ".").replace(/[íáéóú]/g, (c) => "iaeou"["íáéóú".indexOf(c)]!)}@mail.cl`,
          telefono: `+569${randInt(10000000, 99999999)}`,
          rol: "jugador" as const,
          nivelPorDeporte,
        };
      }),
    )
    .returning();

  const hoy = new Date();

  console.log("Ubicando jugadores (simula quiénes activaron 'cerca de mí')…");
  // Como en la vida real, no todos activan la ubicación — se simula con ~70%
  // de los jugadores repartidos cerca de uno de los dos complejos (con algo
  // de dispersión), y el resto sin ubicación conocida.
  const ubicaciones = new Map<string, { lat: number; lng: number }>();
  for (const jugador of jugadores) {
    if (!chance(0.7)) continue;
    const base = chance(0.5) ? { lat: -33.3587, lng: -70.7306 } : { lat: -33.4013, lng: -70.7212 };
    const jitterKm = rng() * 6; // 0–6 km de dispersión
    const anguloRad = rng() * 2 * Math.PI;
    const dLat = ((jitterKm * Math.cos(anguloRad)) / 111) * (chance(0.5) ? 1 : -1);
    const dLng = ((jitterKm * Math.sin(anguloRad)) / 93) * (chance(0.5) ? 1 : -1);
    const lat = base.lat + dLat;
    const lng = base.lng + dLng;
    ubicaciones.set(jugador.id, { lat, lng });
    await db
      .update(usuarios)
      .set({ ultimaLat: lat.toFixed(6), ultimaLng: lng.toFixed(6), ultimaUbicacionEn: hoy })
      .where(eq(usuarios.id, jugador.id));
  }

  // Ocupación objetivo por complejo y tipo de horario — el contraste que sostiene
  // la tesis del documento de producto (horas valle vacías vs. prime lleno).
  // Miraflores tiene más equipamiento (quincho, seguridad 24h) y se modela algo
  // más ocupado que Buenaventura.
  const OCUPACION: Record<string, { valle: number; prime: number }> = {
    [buenaventura!.id]: { valle: 0.2, prime: 0.85 },
    [miraflores!.id]: { valle: 0.3, prime: 0.9 },
  };
  const SLOTS_VALLE_LIST = SLOTS_VALLE;
  const SLOTS_PRIME_LIST = SLOTS_PRIME;
  const PROVEEDORES = ["transbank", "mercadopago", "stripe"] as const;

  const todasCanchas = [
    ...canchasBuenaventura.map((c) => ({ ...c, complejo: buenaventura! })),
    ...canchasMiraflores.map((c) => ({ ...c, complejo: miraflores! })),
  ];

  console.log("Creando reservas, pagos, participantes y solicitudes de rival…");
  let totalReservas = 0;
  const solicitudesCandidatas: { reservaId: string; cupos: number; complejoId: string; excluir: Set<string> }[] = [];

  for (const cancha of todasCanchas) {
    for (let offset = -21; offset <= 10; offset++) {
      const fecha = addDays(hoy, offset);
      const diaSemana = fecha.getDay();
      const esLaboral = diaSemana >= 1 && diaSemana <= 5;
      const slots = [
        ...(esLaboral ? SLOTS_VALLE_LIST.map((h) => ({ hora: h, valle: true })) : []),
        ...SLOTS_PRIME_LIST.map((h) => ({ hora: h, valle: false })),
      ];

      for (const slot of slots) {
        const ocupacion = OCUPACION[cancha.complejo.id]!;
        const prob = slot.valle ? ocupacion.valle : ocupacion.prime;
        if (!chance(prob)) continue;

        const esPasado = offset < 0;
        let estado: (typeof reservas.$inferInsert)["estado"] = "confirmada";
        if (esPasado) {
          estado = chance(0.06) ? "no_show" : chance(0.05) ? "cancelada" : "completada";
        } else if (offset === 0 && chance(0.3)) {
          estado = "completada"; // partidos de hoy que ya se jugaron
        } else if (cancha.complejo.requiereAbono && chance(0.15)) {
          estado = "pendiente"; // esperando el pago del abono
        }

        const organizador = pick(jugadores)!;
        const montoTotal = Number(cancha.precioBase);
        const montoAbono = cancha.complejo.requiereAbono
          ? Math.round((montoTotal * (Number(cancha.complejo.porcentajeAbono) / 100)) / 1000) * 1000
          : 0;

        const [reserva] = await db
          .insert(reservas)
          .values({
            canchaId: cancha.id,
            usuarioId: organizador.id,
            fecha: fmtDate(fecha),
            horaInicio: slot.hora,
            horaFin: horaFinDe(slot.hora),
            estado,
            esHorarioValle: slot.valle,
            montoTotal: String(montoTotal),
            montoAbono: String(montoAbono),
          })
          .returning();
        totalReservas++;

        // Pago — solo existe si el complejo exige abono online (Sección 3 del doc técnico).
        if (montoAbono > 0) {
          let pagoEstado: (typeof pagos.$inferInsert)["estado"] = "pagado";
          if (estado === "pendiente") pagoEstado = "pendiente";
          else if (estado === "cancelada") pagoEstado = chance(0.7) ? "reembolsado" : "pagado";
          else if (esPasado && chance(0.03)) pagoEstado = "fallido";

          await db.insert(pagos).values({
            reservaId: reserva!.id,
            proveedor: pick(PROVEEDORES),
            monto: String(montoAbono),
            estado: pagoEstado,
            referenciaExterna: `ref_${reserva!.id.slice(0, 8)}`,
            comisionAplicadaPct: slot.valle ? cancha.complejo.comisionVallePct : cancha.complejo.comisionBasePct,
          });
        }

        // Participantes: el organizador (como hace crearReserva de verdad,
        // así cuposFaltantes se calcula igual acá que en producción) + algunos
        // más — un rango bajo (15%-45% de la capacidad) a propósito: matches
        // llenos de punta a punta no sostienen la mecánica de "buscar rival"
        // (Sección 05 del doc de producto), que necesita partidos con cupos
        // libres de verdad para que tenga sentido activarla.
        await db.insert(participantesReserva).values({ reservaId: reserva!.id, usuarioId: organizador.id, confirmado: true });
        const cuposDeseados = randInt(Math.ceil(cancha.capacidadJugadores * 0.15), Math.ceil(cancha.capacidadJugadores * 0.45));
        const otrosJugadores = jugadores.filter((j) => j.id !== organizador.id);
        const participantesCount = Math.min(cuposDeseados - 1, otrosJugadores.length);
        const yaElegidos = new Set<string>();
        for (let i = 0; i < participantesCount; i++) {
          let candidato = pick(otrosJugadores)!;
          let intentos = 0;
          while (yaElegidos.has(candidato.id) && intentos < 5) {
            candidato = pick(otrosJugadores)!;
            intentos++;
          }
          yaElegidos.add(candidato.id);
          await db.insert(participantesReserva).values({
            reservaId: reserva!.id,
            usuarioId: candidato.id,
            confirmado: chance(0.85),
          });
        }
        if (chance(0.2)) {
          await db.insert(participantesReserva).values({
            reservaId: reserva!.id,
            nombreInvitado: pick(["Amigo de Rodrigo", "+1 sin confirmar", "Invitado"]),
            confirmado: false,
          });
        }

        const cuposFaltantes = cancha.capacidadJugadores - 1 - participantesCount;
        if (!esPasado && estado !== "cancelada" && cuposFaltantes >= 2) {
          solicitudesCandidatas.push({
            reservaId: reserva!.id,
            cupos: cuposFaltantes,
            complejoId: cancha.complejo.id,
            excluir: new Set([organizador.id, ...yaElegidos]),
          });
        }
      }
    }
  }

  console.log("Creando solicitudes de 'buscar rival'…");
  const COMPLEJO_COORDS: Record<string, { lat: number; lng: number }> = {
    [buenaventura!.id]: { lat: -33.3587, lng: -70.7306 },
    [miraflores!.id]: { lat: -33.4013, lng: -70.7212 },
  };
  const RADIO_INVITACION_KM = 8;
  const solicitudesElegidas = solicitudesCandidatas.sort(() => rng() - 0.5).slice(0, 6);
  let totalInvitaciones = 0;
  for (const s of solicitudesElegidas) {
    const nivelBase = 1 + rng() * 3;
    const [solicitud] = await db
      .insert(solicitudesRival)
      .values({
        reservaId: s.reservaId,
        cuposFaltantes: s.cupos,
        nivelMinimo: (Math.round(nivelBase * 10) / 10).toFixed(1),
        nivelMaximo: (Math.round((nivelBase + 1) * 10) / 10).toFixed(1),
        estado: chance(0.15) ? "cerrada" : "abierta",
      })
      .returning();

    if (solicitud!.estado !== "abierta") continue;

    // Simula el auto-invite "a los que estén cerca de la cancha": cualquier
    // jugador con ubicación conocida, a menos de RADIO_INVITACION_KM, que no
    // sea ya el organizador ni esté anotado en la reserva.
    const centro = COMPLEJO_COORDS[s.complejoId]!;
    const cercanos = jugadores
      .filter((j) => !s.excluir.has(j.id) && ubicaciones.has(j.id))
      .map((j) => ({ jugador: j, km: distanciaKm(centro.lat, centro.lng, ubicaciones.get(j.id)!.lat, ubicaciones.get(j.id)!.lng) }))
      .filter(({ km }) => km <= RADIO_INVITACION_KM);

    for (const { jugador, km } of cercanos) {
      // Solo para variedad visual en la demo (pendiente/aceptada/rechazada) —
      // a diferencia del flujo real, esto no agrega un participantesReserva
      // aunque quede "aceptada"; no hace falta que cuadre para el propósito
      // de mostrar la pantalla de invitaciones con distintos estados.
      const estado = chance(0.15) ? "aceptada" : chance(0.1) ? "rechazada" : "pendiente";
      await db.insert(solicitudInvitaciones).values({
        solicitudId: solicitud!.id,
        usuarioId: jugador.id,
        distanciaKm: km.toFixed(2),
        estado,
        respondidoEn: estado === "pendiente" ? null : hoy,
      });
      totalInvitaciones++;
    }
  }

  console.log("Creando rachas…");
  // ~30% de los jugadores con racha — antes eran 7 de 16 (~44%) a mano; con
  // el pool de jugadores más grande, esto mantiene la misma sensación de
  // "es fácil toparse con una racha" al probar la demo.
  const jugadoresConRacha = [...jugadores].sort(() => rng() - 0.5).slice(0, Math.round(jugadores.length * 0.3));
  for (const jugador of jugadoresConRacha) {
    const contador = randInt(2, 8);
    await db.insert(rachas).values({
      usuarioId: jugador.id,
      complejoId: chance(0.6) ? pick([buenaventura!, miraflores!]).id : null,
      contadorActual: contador,
      mejorRacha: Math.max(contador, randInt(contador, contador + 4)),
      ultimaFechaValida: fmtDate(addDays(hoy, -randInt(0, 6))),
      recompensaDesbloqueada: contador >= 4,
    });
  }

  console.log("\nListo:");
  console.log(`  complejos: 2 (${buenaventura!.slug}, ${miraflores!.slug})`);
  console.log(`  canchas: ${todasCanchas.length}`);
  console.log(`  usuarios: ${1 + 2 + jugadores.length} (1 super_admin, 2 admin_complejo, ${jugadores.length} jugadores)`);
  console.log(`  reservas: ${totalReservas}`);
  console.log(`  solicitudes_rival: ${solicitudesElegidas.length}`);
  console.log(`  solicitud_invitaciones: ${totalInvitaciones}`);
  console.log(`  jugadores con ubicación: ${ubicaciones.size}/${jugadores.length}`);
  console.log(`  rachas: ${jugadoresConRacha.length}`);
  console.log(`\nAdmins de prueba: ${adminBuenaventura!.email} · ${adminMiraflores!.email}`);
  console.log(`Super admin: ${superAdmin!.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
