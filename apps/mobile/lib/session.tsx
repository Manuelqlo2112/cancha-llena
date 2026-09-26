import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { setSesionInvalidaHandler, type Jugador } from "./api";

// Mismo criterio "sesión de desarrollo" que la web (ver apps/web/lib/session.ts):
// sin password, solo guarda qué jugador sembrado sos. AsyncStorage hace las
// veces de la cookie httpOnly de la web.
const STORAGE_KEY = "cancha_llena_usuario";

type Sesion = { usuario: Jugador | null; cargando: boolean; iniciarSesion: (u: Jugador) => void; cerrarSesion: () => void };

const SessionContext = createContext<Sesion | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Jugador | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setUsuario(raw ? JSON.parse(raw) : null))
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = useCallback((u: Jugador) => {
    setUsuario(u);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }, []);

  const cerrarSesion = useCallback(() => {
    setUsuario(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  // Si el servidor dice "no autenticado" para el usuarioId guardado (por
  // ejemplo, porque se reseedeó la base y ese usuario ya no existe), se
  // cierra la sesión sola en vez de dejar que cada pantalla se rompa tratando
  // de usar datos que nunca llegaron.
  useEffect(() => {
    setSesionInvalidaHandler(cerrarSesion);
    return () => setSesionInvalidaHandler(null);
  }, [cerrarSesion]);

  return <SessionContext.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
