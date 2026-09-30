import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, type MiRacha, type NivelJugador, type RivalHistorial } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

const DEPORTE_LABEL: Record<string, string> = { futbolito: "Fútbolito", futbol: "Fútbol", padel: "Pádel", tenis: "Tenis" };

export default function PerfilScreen() {
  const router = useRouter();
  const { usuario, cerrarSesion } = useSession();
  const [rachas, setRachas] = useState<MiRacha[] | null>(null);
  const [niveles, setNiveles] = useState<NivelJugador[]>([]);
  const [rivales, setRivales] = useState<RivalHistorial[]>([]);
  const [errorRachas, setErrorRachas] = useState(false);
  const [modalEliminarVisible, setModalEliminarVisible] = useState(false);
  const [confirmacionTexto, setConfirmacionTexto] = useState("");
  const [eliminando, setEliminando] = useState(false);

  const cargarRachas = useCallback(() => {
    if (!usuario) return;
    setErrorRachas(false);
    // Sesión inválida: lib/session.tsx la cierra sola (ver
    // setSesionInvalidaHandler). Otros errores dejan de mostrar el
    // spinner girando para siempre — antes no había forma de reintentar.
    api.misReservas()
      .then((r) => {
        setRachas(r.rachas);
        setNiveles(r.niveles);
        setRivales(r.rivales);
      })
      .catch(() => setErrorRachas(true));
  }, [usuario]);

  useFocusEffect(cargarRachas);

  async function onConfirmarEliminar() {
    setEliminando(true);
    try {
      const r = await api.eliminarCuenta(confirmacionTexto);
      if (!r.ok) {
        Alert.alert("No se pudo eliminar", r.error === "sin_permiso" ? "Tu cuenta administra un complejo — escribinos para dar de baja este tipo de cuenta." : "Revisá que escribiste ELIMINAR tal cual.");
        return;
      }
      setModalEliminarVisible(false);
      cerrarSesion();
      Alert.alert("Cuenta eliminada", "Borramos tus datos personales y cerramos tu sesión.");
    } catch {
      Alert.alert("No se pudo eliminar", "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEliminando(false);
    }
  }

  if (!usuario) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Iniciá sesión para ver tu perfil.</Text>
        <Pressable onPress={() => router.push("/login")} style={[styles.primaryBtn, { marginTop: 12 }]}>
          <Text style={styles.primaryBtnText}>Iniciar sesión</Text>
        </Pressable>
      </View>
    );
  }

  const mejorRachaGlobal = rachas?.reduce((max, r) => Math.max(max, r.mejorRacha), 0) ?? 0;
  const rachasActivas = rachas?.filter((r) => r.vigente).length ?? 0;

  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{usuario.nombre.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.nombre}>{usuario.nombre}</Text>
        <Text style={styles.email}>{usuario.email}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{rachasActivas}</Text>
          <Text style={styles.statLabel}>Racha{rachasActivas === 1 ? "" : "s"} activa{rachasActivas === 1 ? "" : "s"}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>🔥 {mejorRachaGlobal}</Text>
          <Text style={styles.statLabel}>Mejor racha</Text>
        </View>
      </View>

      {errorRachas ? (
        <Pressable onPress={cargarRachas} style={{ alignItems: "center", marginTop: 16 }}>
          <Text style={[styles.muted, { textDecorationLine: "underline" }]}>No se pudo cargar tu racha — tocá para reintentar</Text>
        </Pressable>
      ) : !rachas ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : null}

      {niveles.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.sectionTitle}>Tu nivel</Text>
          {niveles.map((n) => (
            <View key={n.deporte} style={styles.rachaRow}>
              <Text style={styles.rachaComplejo}>{DEPORTE_LABEL[n.deporte] ?? n.deporte}</Text>
              <Text style={styles.rachaValor}>{n.nivel}</Text>
            </View>
          ))}
          <Text style={[styles.muted, { marginTop: -2, marginBottom: 8 }]}>Sube o baja según el resultado que reportás en tus partidos.</Text>
        </View>
      ) : null}

      {rachas && rachas.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.sectionTitle}>Tus rachas por complejo</Text>
          {rachas.map((r) => (
            <View key={r.complejoSlug} style={styles.rachaRow}>
              <Text style={styles.rachaComplejo}>{r.complejoNombre}</Text>
              <Text style={[styles.rachaValor, !r.vigente && { color: colors.textMuted }]}>
                🔥 {r.contadorActual}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {rivales.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.sectionTitle}>Tus rivales</Text>
          {rivales.slice(0, 5).map((r) => (
            <View key={r.rivalId} style={styles.rachaRow}>
              <Text style={styles.rachaComplejo}>{r.rivalNombre}</Text>
              <Text style={styles.rachaValor}>
                {r.victorias}V {r.empates}E {r.derrotas}D
              </Text>
            </View>
          ))}
          <Text style={[styles.muted, { marginTop: -2, marginBottom: 8 }]}>Historial cabeza a cabeza en partidos con resultado reportado.</Text>
        </View>
      ) : null}

      <Pressable style={styles.logoutBtn} onPress={() => cerrarSesion()}>
        <Text style={styles.logoutBtnText}>Salir</Text>
      </Pressable>

      <Pressable
        style={{ alignSelf: "center", marginTop: 8 }}
        onPress={() => {
          setConfirmacionTexto("");
          setModalEliminarVisible(true);
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 12, textDecorationLine: "underline" }}>Eliminar mi cuenta</Text>
      </Pressable>

      <Modal visible={modalEliminarVisible} transparent animationType="fade" onRequestClose={() => setModalEliminarVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Eliminar tu cuenta</Text>
            <Text style={[styles.muted, { textAlign: "center", marginTop: 8, marginBottom: 4 }]}>
              Borramos tu nombre, email, contraseña y ubicación, y cerramos todas tus sesiones. Esto no se puede
              deshacer.
            </Text>
            <Text style={[styles.muted, { textAlign: "center", marginBottom: 12 }]}>
              Escribí ELIMINAR para confirmar.
            </Text>
            <TextInput
              value={confirmacionTexto}
              onChangeText={setConfirmacionTexto}
              placeholder="ELIMINAR"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
            <Pressable
              disabled={eliminando || confirmacionTexto !== "ELIMINAR"}
              style={[styles.modalBtn, { backgroundColor: "#d03b3b", marginTop: 12, opacity: eliminando || confirmacionTexto !== "ELIMINAR" ? 0.5 : 1 }]}
              onPress={onConfirmarEliminar}
            >
              <Text style={styles.modalBtnText}>{eliminando ? "..." : "Eliminar mi cuenta"}</Text>
            </Pressable>
            <Pressable style={[styles.modalBtn, { backgroundColor: colors.chartSurface, borderWidth: 1, borderColor: colors.gridline, marginTop: 8 }]} onPress={() => setModalEliminarVisible(false)}>
              <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.page, padding: 16 },
  muted: { fontSize: 13, color: colors.textMuted },
  primaryBtn: { backgroundColor: colors.seriesValle, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  primaryBtnText: { color: "white", fontWeight: "600" },
  avatarWrap: { alignItems: "center", marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.seriesValle, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  avatarText: { color: "white", fontSize: 28, fontWeight: "700" },
  nombre: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  email: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.gridline, padding: 14, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, textAlign: "center" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 },
  rachaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.gridline, padding: 12, marginBottom: 8 },
  rachaComplejo: { fontSize: 13, color: colors.textPrimary },
  rachaValor: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  logoutBtn: { marginTop: 24, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 10 },
  logoutBtnText: { color: "#d03b3b", fontWeight: "600", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: "100%", maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
  modalBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalBtnText: { color: "white", fontWeight: "600", fontSize: 14 },
  input: { borderWidth: 1, borderColor: colors.gridline, backgroundColor: colors.chartSurface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textPrimary, textAlign: "center" },
});
