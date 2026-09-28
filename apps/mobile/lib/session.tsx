import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setAuthToken, setSesionInvalidaHandler, type Jugador } from "./api";

// AsyncStorage hace las veces de la cookie httpOnly de la web — guarda el
// usuario (para mostrar nombre/email sin pegarle al servidor) y el token de
// sesión (ver apps/web/lib/sesionesMovil.ts), que es lo que de verdad
// autentica cada request.
const STORAGE_KEY = "cancha_llena_sesion";

type SesionGuardada = { usuario: Jugador; token: string };
type Sesion = { usuario: Jugador | null; cargando: boolean; iniciarSesion: (u: Jugador, token: string) => void; cerrarSesion: () => void };

const SessionContext = createContext<Sesion | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Jugador | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const guardada = JSON.parse(raw) as SesionGuardada;
        setAuthToken(guardada.token);
        setUsuario(guardada.usuario);
      })
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = useCallback((u: Jugador, token: string) => {
    setAuthToken(token);
    setUsuario(u);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ usuario: u, token } satisfies SesionGuardada));
  }, []);

  const cerrarSesion = useCallback(() => {
    api.logout().catch(() => {}); // best-effort — revoca el token en el servidor
    setAuthToken(null);
    setUsuario(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  // Si el servidor dice "no autenticado" para el token guardado (por
  // ejemplo, porque se reseedeó la base y esa sesión ya no existe), se
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
