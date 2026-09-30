import { NextRequest, NextResponse } from "next/server";
import { eliminarCuenta } from "@/lib/credenciales";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function POST(req: NextRequest) {
  const usuario = await getUserFromRequest(req);
  if (!usuario) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const confirmacion = typeof body?.confirmacion === "string" ? body.confirmacion : "";
  // trim+upper: el teclado del celular no garantiza mayúsculas en todos los
  // IME (autoCapitalize es una sugerencia visual, no una transformación
  // forzada), así que la comparación exacta rechazaba intentos válidos.
  if (confirmacion.trim().toUpperCase() !== "ELIMINAR") return NextResponse.json({ ok: false, error: "confirmacion_invalida" }, { status: 400 });

  const resultado = await eliminarCuenta(usuario.id);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 409 });
}
