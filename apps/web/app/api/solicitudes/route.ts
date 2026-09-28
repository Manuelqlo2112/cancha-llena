import { NextRequest, NextResponse } from "next/server";
import { obtenerSolicitudesAbiertas } from "@/lib/reservas";
import { getUserFromRequest } from "@/lib/apiAuth";

// Lista de "partidos que faltan jugadores" — pantalla Partidos del móvil. El
// token es opcional acá (a diferencia de las rutas de escritura): sin sesión
// igual se puede mirar el listado, solo cambia si sabemos "ya participa"
// para no ofrecer unirse a tu propio partido.
export async function GET(req: NextRequest) {
  const usuario = await getUserFromRequest(req);
  const solicitudes = await obtenerSolicitudesAbiertas(usuario?.id ?? null);
  return NextResponse.json({ solicitudes });
}
