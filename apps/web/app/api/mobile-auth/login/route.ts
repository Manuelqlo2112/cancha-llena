import { NextRequest, NextResponse } from "next/server";
import { verificarCredenciales } from "@/lib/credenciales";

// Login real con email+contraseña para el móvil. Separado de /api/auth/**
// (ahí vive Auth.js, que depende de cookies/redirects — el móvil no puede
// usar ese flujo) y de /api/dev/login (que no pide contraseña, es solo para
// pruebas rápidas).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "");
  const password = String(body?.password ?? "");

  const usuario = await verificarCredenciales(email, password);
  if (!usuario) return NextResponse.json({ ok: false, error: "credenciales_invalidas" }, { status: 401 });

  return NextResponse.json({ ok: true, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
}
