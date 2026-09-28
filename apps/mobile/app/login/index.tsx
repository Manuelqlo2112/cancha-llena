import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

const ERRORES: Record<string, string> = {
  credenciales_invalidas: "Email o contraseña incorrectos.",
};

export default function LoginScreen() {
  const router = useRouter();
  const { iniciarSesion } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onEntrar() {
    setCargando(true);
    setError(null);
    try {
      const r = await api.login(email, password);
      if (!r.ok || !r.usuario || !r.token) {
        setError(ERRORES[r.error ?? ""] ?? "No se pudo iniciar sesión.");
        return;
      }
      iniciarSesion(r.usuario, r.token);
      // router.back() no tiene a dónde volver si se entró directo a /login
      // (sin pasar por Home antes) — pasa con deep links o al recargar la
      // página estando en esta pantalla.
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch {
      setError("No se pudo conectar — revisá tu conexión e intentá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Iniciar sesión</Text>
      <Text style={styles.hint}>Para reservar, unirte a un partido o ver tus reservas.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable disabled={cargando} style={[styles.primaryBtn, { opacity: cargando ? 0.6 : 1 }]} onPress={onEntrar}>
        {cargando ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Entrar</Text>}
      </Pressable>

      <Link href="/registro" style={styles.link}>
        ¿No tenés cuenta? Crear cuenta
      </Link>
      {__DEV__ ? (
        <Link href="/login/dev" style={[styles.link, { marginTop: 16, fontSize: 12 }]}>
          ¿Sos del equipo? Entrar como usuario de prueba
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page, padding: 16, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
  hint: { fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: 4, marginBottom: 20 },
  error: { color: "#d03b3b", fontSize: 13, marginBottom: 12, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: colors.gridline,
    backgroundColor: colors.chartSurface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    color: colors.textPrimary,
  },
  primaryBtn: { backgroundColor: colors.seriesValle, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  primaryBtnText: { color: "white", fontWeight: "600", fontSize: 15 },
  link: { textAlign: "center", marginTop: 18, color: colors.seriesValle, fontSize: 14 },
});
