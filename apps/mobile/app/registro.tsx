import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

const ERRORES: Record<string, string> = {
  datos_invalidos: "Completá tu nombre, email y una contraseña de al menos 8 caracteres.",
  email_en_uso: "Ya existe una cuenta con ese email — probá iniciar sesión.",
};

export default function RegistroScreen() {
  const router = useRouter();
  const { iniciarSesion } = useSession();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCrear() {
    setCargando(true);
    setError(null);
    try {
      const r = await api.registrarse(nombre, email, password);
      if (!r.ok || !r.usuario || !r.token) {
        setError(ERRORES[r.error ?? ""] ?? "No se pudo crear la cuenta.");
        return;
      }
      iniciarSesion(r.usuario, r.token);
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } finally {
      setCargando(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.hint}>Para reservar, unirte a un partido y ver tu historial.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput style={styles.input} placeholder="Nombre y apellido" placeholderTextColor={colors.textMuted} value={nombre} onChangeText={setNombre} />
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
        placeholder="Contraseña (mínimo 8 caracteres)"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable disabled={cargando} style={[styles.primaryBtn, { opacity: cargando ? 0.6 : 1 }]} onPress={onCrear}>
        {cargando ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Crear cuenta</Text>}
      </Pressable>

      <Link href="/login" style={styles.link}>
        ¿Ya tenés cuenta? Iniciar sesión
      </Link>
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
