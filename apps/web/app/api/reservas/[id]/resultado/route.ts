import { NextRequest, NextResponse } from "next/server";
import { reportarResultado } from "@/lib/resultados";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUserFromRequest(req);
  if (!usuario) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const equipoGanadorRaw = body?.equipoGanador;
  const equipoGanador = equipoGanadorRaw === "A" || equipoGanadorRaw === "B" || equipoGanadorRaw === "empate" ? equipoGanadorRaw : null;
  const asignaciones = Array.isArray(body?.asignaciones)
    ? body.asignaciones
        .filter((a: unknown): a is { usuarioId: unknown; equipo: unknown } => !!a && typeof a === "object")
        .map((a: { usuarioId: unknown; equipo: unknown }) => ({ usuarioId: String(a.usuarioId ?? ""), equipo: a.equipo === "B" ? ("B" as const) : ("A" as const) }))
    : [];

  if (!equipoGanador) return NextResponse.json({ ok: false, error: "datos_invalidos" }, { status: 400 });

  const resultado = await reportarResultado(usuario.id, id, equipoGanador, asignaciones);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 409 });
}
