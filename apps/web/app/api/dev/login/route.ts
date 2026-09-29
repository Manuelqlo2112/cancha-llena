import { NextRequest, NextResponse } from "next/server";
import { db } from "@cancha-llena/db";
import { devLoginHabilitado } from "@/lib/devAuth";
import { crearSesionMovil } from "@/lib/sesionesMovil";
import { esUuid } from "@/lib/validacion";

// Login de desarrollo para la app móvil (mismo criterio que /login/dev en la
// web: sin password, solo confirma que el id pertenece a un usuario
// sembrado). Separado a propósito de /api/auth/** — ahí vive Auth.js
// (Google/Microsoft/credentials), esto es solo para probar rápido.
//
// Deshabilitado salvo que ALLOW_DEV_LOGIN=true esté seteado a propósito:
// sin esto, cualquiera podía listar todos los usuarios y loguearse como
// cualquiera (incluido super_admin) sin contraseña — ver lib/devAuth.ts.
export async function POST(req: NextRequest) {
  if (!devLoginHabilitado()) return NextResponse.json({ ok: false, error: "no disponible" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const usuarioId = body?.usuarioId as string | undefined;
  if (!usuarioId || !esUuid(usuarioId)) return NextResponse.json({ ok: false, error: "usuarioId requerido" }, { status: 400 });

  const usuario = await db.query.usuarios.findFirst({ where: { id: usuarioId } });
  if (!usuario) return NextResponse.json({ ok: false, error: "usuario no existe" }, { status: 404 });

  const token = await crearSesionMovil(usuario.id);
  return NextResponse.json({ ok: true, token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
}

export async function GET() {
  if (!devLoginHabilitado()) return NextResponse.json({ ok: false, error: "no disponible" }, { status: 404 });

  // Lista de jugadores para el selector de login (igual que /login/dev en la web).
  const jugadores = await db.query.usuarios.findMany({
    where: { rol: "jugador" },
    orderBy: { nombre: "asc" },
    columns: { id: true, nombre: true, email: true },
  });
  return NextResponse.json({ jugadores });
}
