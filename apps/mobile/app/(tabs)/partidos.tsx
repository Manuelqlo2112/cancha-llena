import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api, SesionInvalidaError, type InvitacionPendiente, type SolicitudAbierta } from "@/lib/api";
import { useSession } from "@/lib/session";
import { pedirUbicacionActual } from "@/lib/location";
import { colors } from "@/lib/theme";
import { formatHora } from "@/lib/format";

const DEPORTE_LABEL: Record<string, string> = { futbolito: "Fútbolito", futbol: "Fútbol", padel: "Pádel", tenis: "Tenis" };

function formatFechaCorta(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}

// Pantalla separada del flujo de reservar: acá se descubren partidos a los
// que les faltan jugadores (listado abierto) y las invitaciones puntuales
// para quienes activaron su ubicación y quedaron cerca de una cancha.
export default function PartidosScreen() {
  const router = useRouter();
  const { usuario } = useSession();
  const [solicitudes, setSolicitudes] = useState<SolicitudAbierta[] | null>(null);
  const [invitaciones, setInvitaciones] = useState<InvitacionPendiente[]>([]);
  const [ubicacionActiva, setUbicacionActiva] = useState(false);
  const [pidiendoUbicacion, setPidiendoUbicacion] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [enCurso, setEnCurso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Por separado (no Promise.all): si la sesión guardada quedó inválida,
      // que igual se pueda ver el listado abierto de partidos, que no
      // necesita sesión.
      const { solicitudes } = await api.listarSolicitudes();
      setSolicitudes(solicitudes);
    } finally {
      setCargando(false);
    }

    if (usuario) {
      try {
        const inv = await api.listarInvitaciones();
        setInvitaciones(inv.invitaciones);
      } catch (e) {
        // Sesión inválida: lib/session.tsx ya la cerró sola. Otros errores
        // (de red) los ignoramos acá — el listado de solicitudes de arriba
        // ya se cargó bien, no vale la pena romper toda la pantalla por esto.
        if (!(e instanceof SesionInvalidaError)) console.warn("no se pudieron cargar las invitaciones:", e);
      }
    }
  }, [usuario?.id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function onActivarUbicacion() {
    if (!usuario) return router.push("/login");
    setPidiendoUbicacion(true);
    try {
      const res = await pedirUbicacionActual();
      if (!res.ok) {
        Alert.alert("No pudimos activarla", res.motivo === "permiso_denegado" ? "Necesitamos permiso de ubicación para avisarte de partidos cerca." : "Intentá de nuevo en un rato.");
        return;
      }
      await api.actualizarUbicacion(res.lat, res.lng);
      setUbicacionActiva(true);
      Alert.alert("Listo", "Te vamos a avisar de partidos cerca tuyo.");
      await cargar();
    } finally {
      setPidiendoUbicacion(false);
    }
  }

  async function onUnirse(id: string) {
    if (!usuario) return router.push("/login");
    setEnCurso(id);
    try {
      const r = await api.unirseSolicitud(id);
      if (!r.ok) Alert.alert("No se pudo unir", r.error ?? "");
      else {
        Alert.alert("Listo", "Te anotaste en el partido.");
        await cargar();
      }
    } finally {
      setEnCurso(null);
    }
  }

  async function onResponderInvitacion(id: string, respuesta: "aceptada" | "rechazada") {
    if (!usuario) return;
    setEnCurso(id);
    try {
      const r = await api.responderInvitacion(id, respuesta);
      if (!r.ok) Alert.alert("No se pudo", r.error === "solicitud_cerrada" ? "Justo se completó ese partido." : (r.error ?? ""));
      else Alert.alert(respuesta === "aceptada" ? "¡Listo!" : "Avisado", respuesta === "aceptada" ? "Te anotaste en el partido." : "Avisamos que no vas.");
      await cargar();
    } finally {
      setEnCurso(null);
    }
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.page }}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
      contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
      ListHeaderComponent={
        <View style={{ marginBottom: 4 }}>
          <Text style={styles.title}>Partidos que buscan jugadores</Text>
          <Text style={styles.muted}>Sumate a un partido ya reservado al que le falta gente.</Text>

          {usuario && !ubicacionActiva ? (
            <Pressable disabled={pidiendoUbicacion} style={styles.ubicacionBanner} onPress={onActivarUbicacion}>
              <Text style={styles.ubicacionText}>📍 Activá tu ubicación para que te avisemos de partidos cerca</Text>
              <Text style={styles.ubicacionCta}>{pidiendoUbicacion ? "..." : "Activar"}</Text>
            </Pressable>
          ) : null}

          {invitaciones.length > 0 ? <Text style={styles.sectionTitle}>Te invitaron — están cerca tuyo</Text> : null}
          {invitaciones.map((i) => {
            const busy = enCurso === i.id;
            return (
              <View key={i.id} style={[styles.card, { marginBottom: 8 }]}>
                <Text style={styles.cardTitle}>{i.complejo.nombre}</Text>
                <Text style={styles.muted}>
                  {i.cancha.nombre} · {DEPORTE_LABEL[i.cancha.deporte] ?? i.cancha.deporte}
                </Text>
                <View style={styles.badgeRow}>
                  <Text style={styles.rowText}>{formatFechaCorta(i.fecha)}</Text>
                  <Text style={styles.rowText}>{formatHora(i.horaInicio)}–{formatHora(i.horaFin)}</Text>
                  {i.esHorarioValle ? <Chip text="Horario valle" bg={colors.seriesValle} /> : null}
                  <Chip text={`Faltan ${i.cuposFaltantes}`} bg={colors.statusWarning} />
                  {i.distanciaKm !== null ? <Text style={styles.rowText}>{i.distanciaKm < 1 ? "< 1 km" : `${Math.round(i.distanciaKm)} km`}</Text> : null}
                </View>
                <Text style={styles.rowText}>Organiza {i.organizadorNombre}</Text>
                <View style={styles.invitacionAcciones}>
                  <Pressable disabled={busy} style={[styles.actionBtn, { backgroundColor: colors.chartSurface, borderWidth: 1, borderColor: colors.gridline }]} onPress={() => onResponderInvitacion(i.id, "rechazada")}>
                    <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>No puedo</Text>
                  </Pressable>
                  <Pressable disabled={busy} style={[styles.actionBtn, { backgroundColor: colors.seriesPrime }]} onPress={() => onResponderInvitacion(i.id, "aceptada")}>
                    <Text style={styles.actionBtnText}>{busy ? "..." : "Voy"}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <Text style={styles.sectionTitle}>Todos los partidos abiertos</Text>
        </View>
      }
      data={solicitudes ?? []}
      keyExtractor={(s) => s.id}
      ListEmptyComponent={
        !solicitudes ? (
          <ActivityIndicator style={{ marginVertical: 24 }} />
        ) : (
          <View style={styles.center}>
            <Text style={styles.muted}>No hay partidos buscando jugadores por ahora.</Text>
          </View>
        )
      }
      renderItem={({ item: s }) => {
        const busy = enCurso === s.id;
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{s.complejo.nombre}</Text>
            <Text style={styles.muted}>
              {s.cancha.nombre} · {DEPORTE_LABEL[s.cancha.deporte] ?? s.cancha.deporte}
            </Text>
            <View style={styles.badgeRow}>
              <Text style={styles.rowText}>{formatFechaCorta(s.fecha)}</Text>
              <Text style={styles.rowText}>
                {formatHora(s.horaInicio)}–{formatHora(s.horaFin)}
              </Text>
              {s.esHorarioValle ? <Chip text="Horario valle" bg={colors.seriesValle} /> : null}
              <Chip text={`Faltan ${s.cuposFaltantes}`} bg={colors.statusWarning} />
            </View>
            <Text style={styles.rowText}>Organiza {s.organizadorNombre}</Text>
            {s.yaParticipa ? (
              <Chip text="Ya estás anotado" bg={colors.statusGood} />
            ) : (
              <Pressable disabled={busy} style={[styles.actionBtn, { backgroundColor: colors.seriesPrime, opacity: busy ? 0.6 : 1, alignSelf: "flex-start" }]} onPress={() => onUnirse(s.id)}>
                <Text style={styles.actionBtnText}>{busy ? "..." : "Unirme"}</Text>
              </Pressable>
            )}
          </View>
        );
      }}
    />
  );
}

function Chip({ text, bg }: { text: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  muted: { fontSize: 13, color: colors.textMuted },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginTop: 12, marginBottom: 8 },
  ubicacionBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.chartSurface,
    borderWidth: 1,
    borderColor: colors.gridline,
  },
  ubicacionText: { flex: 1, fontSize: 12, color: colors.textSecondary },
  ubicacionCta: { fontSize: 12, fontWeight: "700", color: colors.seriesValle },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.gridline, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 },
  rowText: { fontSize: 12, color: colors.textSecondary },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, alignSelf: "flex-start" },
  chipText: { color: "white", fontSize: 11, fontWeight: "600" },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, marginTop: 6 },
  actionBtnText: { color: "white", fontSize: 12, fontWeight: "600" },
  invitacionAcciones: { flexDirection: "row", gap: 8, marginTop: 4 },
});
