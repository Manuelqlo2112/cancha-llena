import { NextRequest, NextResponse } from "next/server";
import { actualizarUbicacion } from "@/lib/reservas";
import { getUserFromRequest } from "@/lib/apiAuth";

// El celular manda su ubicación acá (con permiso del usuario, vía
// expo-location) — es lo único que usa "geolocalización" hoy: no hay
// tracking en segundo plano, solo se guarda la última posición conocida
// para poder invitar a quien esté cerca cuando alguien abre una solicitud.
export async function POST(req: NextRequest) {
  const usuario = await getUserFromRequest(req);
  if (!usuario) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);

  // actualizarUbicacion valida el rango geográfico — acá solo se traduce
  // ese resultado al código de estado HTTP.
  const resultado = await actualizarUbicacion(usuario.id, lat, lng);
  if (!resultado.ok) return NextResponse.json({ ok: false, error: "coordenadas invalidas" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
