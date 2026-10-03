import { NextRequest, NextResponse } from "next/server";
import { cancelarSuscripcion } from "@/lib/planes";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUserFromRequest(req);
  if (!usuario) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });

  const { id } = await params;
  const resultado = await cancelarSuscripcion(usuario.id, id);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 409 });
}
