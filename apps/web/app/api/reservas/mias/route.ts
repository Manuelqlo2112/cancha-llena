import { NextRequest, NextResponse } from "next/server";
import { obtenerMisRachas, obtenerMisReservas } from "@/lib/reservas";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const usuario = await getUserFromRequest(req);
  if (!usuario) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });

  const [reservas, rachas] = await Promise.all([obtenerMisReservas(usuario.id), obtenerMisRachas(usuario.id)]);
  return NextResponse.json({ reservas, rachas });
}
