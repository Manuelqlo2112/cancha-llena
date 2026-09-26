import { NextRequest, NextResponse } from "next/server";
import { responderInvitacion } from "@/lib/reservas";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUserFromRequest(req);
  if (!usuario) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const respuesta = body?.respuesta === "aceptada" || body?.respuesta === "rechazada" ? body.respuesta : null;
  if (!respuesta) return NextResponse.json({ ok: false, error: "respuesta invalida" }, { status: 400 });

  const resultado = await responderInvitacion(usuario.id, id, respuesta);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 409 });
}
