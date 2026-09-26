import { NextRequest, NextResponse } from "next/server";
import { db } from "@cancha-llena/db";

// Login de desarrollo para la app móvil (mismo criterio que /login/dev en la
// web: sin password, solo confirma que el id pertenece a un usuario
// sembrado). Separado a propósito de /api/auth/** — ahí vive Auth.js
// (Google/Microsoft/credentials), esto es solo para probar rápido.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const usuarioId = body?.usuarioId as string | undefined;
  if (!usuarioId) return NextResponse.json({ ok: false, error: "usuarioId requerido" }, { status: 400 });

  const usuario = await db.query.usuarios.findFirst({ where: { id: usuarioId } });
  if (!usuario) return NextResponse.json({ ok: false, error: "usuario no existe" }, { status: 404 });

  return NextResponse.json({ ok: true, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
}

export async function GET() {
  // Lista de jugadores para el selector de login (igual que /login/dev en la web).
  const jugadores = await db.query.usuarios.findMany({
    where: { rol: "jugador" },
    orderBy: { nombre: "asc" },
    columns: { id: true, nombre: true, email: true },
  });
  return NextResponse.json({ jugadores });
}
