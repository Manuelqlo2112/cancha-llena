import { NextRequest, NextResponse } from "next/server";
import { crearReserva } from "@/lib/reservas";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function POST(req: NextRequest) {
  const usuario = await getUserFromRequest(req);
  if (!usuario) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { canchaId, fecha, hora } = body ?? {};
  if (!canchaId || !fecha || !hora) {
    return NextResponse.json({ ok: false, error: "canchaId, fecha y hora son requeridos" }, { status: 400 });
  }

  const resultado = await crearReserva(usuario.id, canchaId, fecha, hora);
  return NextResponse.json(resultado, { status: resultado.ok ? 201 : 409 });
}
