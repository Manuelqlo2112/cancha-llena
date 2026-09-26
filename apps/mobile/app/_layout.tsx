import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.page },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login/index" options={{ title: "Iniciar sesión", presentation: "modal" }} />
          <Stack.Screen name="login/dev" options={{ title: "Usuario de prueba", presentation: "modal" }} />
          <Stack.Screen name="registro" options={{ title: "Crear cuenta", presentation: "modal" }} />
          <Stack.Screen name="complejo/[slug]" options={{ title: "" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
