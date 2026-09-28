import { NextRequest, NextResponse } from "next/server";
import { registrarConCredenciales } from "@/lib/credenciales";
import { crearSesionMovil } from "@/lib/sesionesMovil";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre ?? "");
  const email = String(body?.email ?? "");
  const password = String(body?.password ?? "");

  const resultado = await registrarConCredenciales(nombre, email, password);
  if (!resultado.ok) return NextResponse.json(resultado, { status: 409 });

  const { usuario } = resultado;
  const token = await crearSesionMovil(usuario.id);
  return NextResponse.json({ ok: true, token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
}
