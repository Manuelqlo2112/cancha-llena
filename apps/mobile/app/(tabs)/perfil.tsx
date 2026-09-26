import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, type MiRacha } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function PerfilScreen() {
  const router = useRouter();
  const { usuario, cerrarSesion } = useSession();
  const [rachas, setRachas] = useState<MiRacha[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!usuario) return;
      let vivo = true;
      // Si la sesión guardada ya no es válida, lib/session.tsx la cierra
      // sola (ver setSesionInvalidaHandler) — acá solo hace falta no dejar
      // el rechazo de la promesa sin atrapar.
      api.misReservas(usuario.id)
        .then((r) => vivo && setRachas(r.rachas))
        .catch(() => {});
      return () => {
        vivo = false;
      };
    }, [usuario]),
  );

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

      {!rachas ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}

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

      <Pressable style={styles.logoutBtn} onPress={() => cerrarSesion()}>
        <Text style={styles.logoutBtnText}>Salir</Text>
      </Pressable>
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
});
