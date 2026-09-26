import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api, type Jugador } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function LoginDevScreen() {
  const router = useRouter();
  const { usuario, iniciarSesion, cerrarSesion } = useSession();
  const [jugadores, setJugadores] = useState<Jugador[] | null>(null);

  useEffect(() => {
    api.listarJugadoresDev().then((r) => setJugadores(r.jugadores));
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>Solo para desarrollo — sin contraseña, elegís directamente con qué usuario sembrado entrar.</Text>

      {usuario ? (
        <Pressable style={[styles.card, { borderColor: colors.seriesPrime }]} onPress={() => cerrarSesion()}>
          <Text style={styles.cardTitle}>Salir de &quot;{usuario.nombre}&quot;</Text>
        </Pressable>
      ) : null}

      {!jugadores ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}

      <FlatList
        data={jugadores ?? []}
        keyExtractor={(j) => j.id}
        contentContainerStyle={{ gap: 8, paddingTop: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              iniciarSesion(item);
              if (router.canGoBack()) router.back();
              else router.replace("/");
            }}
          >
            <Text style={styles.cardTitle}>{item.nombre}</Text>
            <Text style={styles.cardSubtitle}>{item.email}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page, padding: 16 },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.gridline },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
