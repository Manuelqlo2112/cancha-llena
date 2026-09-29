import { NextRequest, NextResponse } from "next/server";
import { obtenerMisRachas, obtenerMisReservas } from "@/lib/reservas";
import { nivelesDeJugador } from "@/lib/resultados";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const usuario = await getUserFromRequest(req);
  if (!usuario) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });

  const [reservas, rachas] = await Promise.all([obtenerMisReservas(usuario.id), obtenerMisRachas(usuario.id)]);
  const niveles = nivelesDeJugador(usuario.nivelPorDeporte);
  return NextResponse.json({ reservas, rachas, niveles });
}
