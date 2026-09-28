import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api, type Jugador } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function LoginDevScreen() {
  const router = useRouter();
  const { usuario, iniciarSesion, cerrarSesion } = useSession();
  const [jugadores, setJugadores] = useState<Jugador[] | null>(null);
  const [entrando, setEntrando] = useState<string | null>(null);

  useEffect(() => {
    api.listarJugadoresDev().then((r) => setJugadores(r.jugadores));
  }, []);

  async function onElegir(jugador: Jugador) {
    setEntrando(jugador.id);
    try {
      // Antes esto solo guardaba el id localmente, sin pedirle nada al
      // servidor — no generaba una sesión de verdad. Ahora sí pide un token
      // real (ver /api/dev/login), igual que login/registro con contraseña.
      const r = await api.loginDev(jugador.id);
      if (!r.ok || !r.usuario || !r.token) {
        Alert.alert("No se pudo entrar", "Intentá de nuevo.");
        return;
      }
      iniciarSesion(r.usuario, r.token);
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } finally {
      setEntrando(null);
    }
  }

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
          <Pressable style={[styles.card, entrando === item.id && { opacity: 0.6 }]} disabled={entrando !== null} onPress={() => onElegir(item)}>
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
