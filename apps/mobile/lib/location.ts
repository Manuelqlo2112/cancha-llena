import * as Location from "expo-location";

export type PedirUbicacionResultado = { ok: true; lat: number; lng: number } | { ok: false; motivo: "permiso_denegado" | "error" };

// Se pide una sola vez (no tracking en segundo plano): alcanza con la última
// posición conocida para invitar a partidos cercanos.
export async function pedirUbicacionActual(): Promise<PedirUbicacionResultado> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { ok: false, motivo: "permiso_denegado" };

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return { ok: false, motivo: "error" };
  }
}
