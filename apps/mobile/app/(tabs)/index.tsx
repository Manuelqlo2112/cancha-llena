import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api, type ComplejoResumen } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

const DEPORTE_LABEL: Record<string, string> = { futbolito: "Fútbolito", futbol: "Fútbol", padel: "Pádel", tenis: "Tenis" };

export default function ExplorarScreen() {
  const router = useRouter();
  const { usuario } = useSession();
  const [complejos, setComplejos] = useState<ComplejoResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      api
        .listarComplejos()
        .then((r) => vivo && setComplejos(r.complejos))
        .catch((e) => vivo && setError(String(e)));
      return () => {
        vivo = false;
      };
    }, []),
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Reserva tu cancha</Text>
        <Text style={styles.subtitle}>Piloto Quilicura · Renca</Text>
        {!usuario ? (
          <Pressable onPress={() => router.push("/login")} style={[styles.sessionPill, { marginTop: 8 }]}>
            <Text style={styles.sessionPillText}>Iniciar sesión</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!complejos && !error ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}

      <FlatList
        data={complejos ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/complejo/${item.slug}`)}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{item.nombre}</Text>
              <View style={[styles.badge, { backgroundColor: item.requiereAbono ? colors.seriesValle : colors.statusGood }]}>
                <Text style={styles.badgeText}>{item.requiereAbono ? `Abono ${item.porcentajeAbono}%` : "Sin abono"}</Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle}>
              {item.direccion}, {item.comuna}
            </Text>
            {item.horarioTexto ? <Text style={styles.cardMuted}>{item.horarioTexto}</Text> : null}
            <View style={styles.tagsRow}>
              {item.deportes.map((d) => (
                <View key={d} style={styles.tag}>
                  <Text style={styles.tagText}>{DEPORTE_LABEL[d] ?? d}</Text>
                </View>
              ))}
              <View style={[styles.tag, styles.tagOutline]}>
                <Text style={styles.tagOutlineText}>
                  {item.cantidadCanchas} cancha{item.cantidadCanchas === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  header: { paddingHorizontal: 16, paddingTop: 12, gap: 2 },
  title: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary },
  sessionPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: colors.chartSurface, borderWidth: 1, borderColor: colors.gridline },
  sessionPillText: { fontSize: 12, color: colors.textSecondary },
  error: { color: "crimson", padding: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.gridline, gap: 4 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: "600", color: colors.textPrimary, flexShrink: 1 },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary },
  cardMuted: { fontSize: 12, color: colors.textMuted },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  badgeText: { color: "white", fontSize: 11, fontWeight: "600" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tag: { backgroundColor: colors.seriesValle, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: "white", fontSize: 11, fontWeight: "600" },
  tagOutline: { backgroundColor: colors.chartSurface, borderWidth: 1, borderColor: colors.gridline },
  tagOutlineText: { color: colors.textSecondary, fontSize: 11 },
});
