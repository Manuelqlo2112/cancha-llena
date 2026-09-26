import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/lib/theme";

// Misma estructura de navegación que la app real de EasyCancha (Inicio /
// Reservas / Match / Perfil / Prime) — nos quedamos con las 3 que tenemos
// hoy. Iconos en emoji a propósito: sin agregar una librería de íconos
// nueva, funciona igual en iOS/Android/web.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.seriesValle,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.gridline },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Inicio", tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🏠</Text> }}
      />
      <Tabs.Screen
        name="mis-reservas"
        options={{ title: "Mis reservas", tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📅</Text> }}
      />
      <Tabs.Screen
        name="partidos"
        options={{ title: "Partidos", tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>⚽</Text> }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: "Perfil", tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>👤</Text> }}
      />
    </Tabs>
  );
}
