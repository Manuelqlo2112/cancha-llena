import { NextRequest, NextResponse } from "next/server";
import { obtenerReservaParaReportar } from "@/lib/resultados";
import { getUserFromRequest } from "@/lib/apiAuth";

// Para armar el formulario de "reportar resultado" del móvil — mismos datos
// que usa la página web equivalente.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUserFromRequest(req);
  if (!usuario) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });

  const { id } = await params;
  const reserva = await obtenerReservaParaReportar(usuario.id, id);
  if (!reserva) return NextResponse.json({ ok: false, error: "no encontrada" }, { status: 404 });
  return NextResponse.json({ reserva });
}
