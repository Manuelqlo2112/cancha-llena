import { NextRequest, NextResponse } from "next/server";
import { invitarRivalDirecto } from "@/lib/reservas";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUserFromRequest(req);
  if (!usuario) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const rivalId = typeof body?.rivalId === "string" ? body.rivalId : "";

  const resultado = await invitarRivalDirecto(usuario.id, id, rivalId);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 409 });
}
