import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api, SesionInvalidaError, type MiRacha, type MiReserva } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

const DEPORTE_LABEL: Record<string, string> = { futbolito: "Fútbolito", futbol: "Fútbol", padel: "Pádel", tenis: "Tenis" };
const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente de pago",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No-show",
};

function formatFechaCorta(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}

export default function MisReservasScreen() {
  const router = useRouter();
  const { usuario } = useSession();
  const [reservas, setReservas] = useState<MiReserva[] | null>(null);
  const [rachas, setRachas] = useState<MiRacha[]>([]);
  const [cargando, setCargando] = useState(false);
  const [enCurso, setEnCurso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    try {
      const { reservas, rachas } = await api.misReservas(usuario.id);
      setReservas(reservas);
      setRachas(rachas);
    } catch (e) {
      // Sesión inválida: lib/session.tsx ya la cerró sola (el usuario va a
      // ver la pantalla de "iniciá sesión" apenas cambie ese estado). Otros
      // errores de red sí los mostramos.
      if (!(e instanceof SesionInvalidaError)) Alert.alert("No se pudo cargar", "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (!usuario) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Iniciá sesión para ver tus reservas.</Text>
        <Pressable onPress={() => router.push("/login")} style={[styles.actionBtn, { backgroundColor: colors.seriesValle, marginTop: 12 }]}>
          <Text style={styles.actionBtnText}>Iniciar sesión</Text>
        </Pressable>
      </View>
    );
  }

  async function onCancelar(id: string) {
    if (!usuario) return;
    setEnCurso(id);
    try {
      const r = await api.cancelarReserva(usuario.id, id);
      if (!r.ok) Alert.alert("No se pudo cancelar", r.error ?? "");
      else {
        Alert.alert("Listo", "Reserva cancelada.");
        await cargar();
      }
    } finally {
      setEnCurso(null);
    }
  }

  async function onBuscarRival(id: string) {
    if (!usuario) return;
    setEnCurso(id);
    try {
      const r = await api.buscarRival(usuario.id, id);
      if (!r.ok) Alert.alert("No se pudo", r.error ?? "");
      else {
        Alert.alert("Listo", "Avisamos que buscás rival para ese partido.");
        await cargar();
      }
    } finally {
      setEnCurso(null);
    }
  }

  const hoyISO = new Date().toISOString().slice(0, 10);
  const proximas = (reservas ?? []).filter((r) => r.fecha >= hoyISO && r.estado !== "cancelada");
  const pasadas = (reservas ?? []).filter((r) => r.fecha < hoyISO || r.estado === "cancelada");

  return (
    <FlatList
      style={{ backgroundColor: colors.page }}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      data={[
        ...(rachas.length > 0 ? [{ tipo: "racha-header" as const }, ...rachas.map((r) => ({ tipo: "racha" as const, r }))] : []),
        { tipo: "header" as const },
        ...(proximas.length === 0 ? [{ tipo: "vacio" as const }] : proximas.map((r) => ({ tipo: "reserva" as const, r, accionable: true }))),
        ...(pasadas.length > 0 ? [{ tipo: "historial-header" as const }, ...pasadas.map((r) => ({ tipo: "reserva" as const, r, accionable: false }))] : []),
      ]}
      keyExtractor={(item, i) => (item.tipo === "reserva" ? item.r.id : item.tipo === "racha" ? `racha-${item.r.complejoSlug}` : `${item.tipo}-${i}`)}
      renderItem={({ item }) => {
        if (item.tipo === "racha-header") return <Text style={styles.sectionTitle}>Tu racha</Text>;
        if (item.tipo === "racha") {
          const r = item.r;
          return (
            <View style={[styles.card, !r.vigente && { opacity: 0.6 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <Text style={styles.cardTitle}>
                    🔥 {r.contadorActual} semana{r.contadorActual === 1 ? "" : "s"} seguidas
                  </Text>
                  <Text style={styles.muted}>{r.complejoNombre}</Text>
                </View>
                {r.recompensaDesbloqueada ? <Chip text="Recompensa" bg={colors.statusGood} /> : null}
              </View>
              <Text style={[styles.muted, !r.vigente && { color: "#d03b3b" }]}>
                {r.vigente ? `Mejor racha: ${r.mejorRacha}` : `Se corta si no jugás esta semana — mejor racha: ${r.mejorRacha}`}
              </Text>
            </View>
          );
        }
        if (item.tipo === "header") return <Text style={styles.sectionTitle}>Próximas</Text>;
        if (item.tipo === "historial-header") return <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Historial</Text>;
        if (item.tipo === "vacio") return !reservas ? <ActivityIndicator style={{ marginVertical: 24 }} /> : <Text style={styles.muted}>Todavía no tenés partidos agendados.</Text>;

        const { r, accionable } = item;
        const busy = enCurso === r.id;
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{r.complejo.nombre}</Text>
            <Text style={styles.muted}>
              {r.cancha.nombre} · {DEPORTE_LABEL[r.cancha.deporte] ?? r.cancha.deporte}
            </Text>
            <View style={styles.badgeRow}>
              <Text style={styles.rowText}>{formatFechaCorta(r.fecha)}</Text>
              <Text style={styles.rowText}>{r.horaInicio}–{r.horaFin}</Text>
              {r.esHorarioValle ? <Chip text="Horario valle" bg={colors.seriesValle} /> : null}
              {!r.esOrganizador ? <Chip text="Te uniste" bg={colors.statusGood} /> : null}
              <Chip text={ESTADO_LABEL[r.estado] ?? r.estado} bg={colors.textMuted} />
            </View>
            {accionable && r.esOrganizador && r.estado !== "cancelada" ? (
              <View style={styles.actionsRow}>
                {r.puedeBuscarRival ? (
                  <Pressable disabled={busy} style={[styles.actionBtn, { backgroundColor: colors.seriesPrime, opacity: busy ? 0.6 : 1 }]} onPress={() => onBuscarRival(r.id)}>
                    <Text style={styles.actionBtnText}>Buscar rival</Text>
                  </Pressable>
                ) : r.solicitudAbiertaId ? (
                  <Chip text="Ya buscando rival" bg={colors.statusWarning} />
                ) : null}
                <Pressable disabled={busy} style={[styles.actionBtn, { backgroundColor: "#d03b3b", opacity: busy ? 0.6 : 1 }]} onPress={() => onCancelar(r.id)}>
                  <Text style={styles.actionBtnText}>Cancelar</Text>
                </Pressable>
              </View>
            ) : null}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.page, padding: 16 },
  muted: { fontSize: 13, color: colors.textMuted },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.gridline, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 },
  rowText: { fontSize: 12, color: colors.textSecondary },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  chipText: { color: "white", fontSize: 11, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  actionBtnText: { color: "white", fontSize: 12, fontWeight: "600" },
});
