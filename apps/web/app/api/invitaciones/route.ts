import { NextRequest, NextResponse } from "next/server";
import { listarInvitacionesPendientes } from "@/lib/reservas";
import { getUserFromRequest } from "@/lib/apiAuth";

// Invitaciones puntuales por cercanía — distinto de /api/solicitudes (el
// listado abierto que ve cualquiera). Necesita sesión: es "a ti te
// invitamos", no un listado público.
export async function GET(req: NextRequest) {
  const usuario = await getUserFromRequest(req);
  if (!usuario) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });

  const invitaciones = await listarInvitacionesPendientes(usuario.id);
  return NextResponse.json({ invitaciones });
}
