import { NextRequest, NextResponse } from "next/server";

// La app móvil (Expo) llama a estas rutas desde otro origen: en un teléfono
// real (Expo Go / build nativo) eso no dispara CORS porque no es un fetch de
// navegador, pero "expo start --web" corre en el navegador y sí lo dispara.
// Origin abierto a propósito: la API usa tokens Bearer (lib/apiAuth.ts), no
// cookies, así que un origin cualquiera no puede robar la sesión de nadie
// con esto — CORS solo protege flujos basados en cookies del navegador.
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function proxy(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }
  const res = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders())) res.headers.set(key, value);
  return res;
}

export const config = { matcher: "/api/:path*" };
