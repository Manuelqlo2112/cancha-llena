import { NextRequest, NextResponse } from "next/server";

// La app móvil (Expo) llama a estas rutas desde otro origen: en un teléfono
// real (Expo Go / build nativo) eso no dispara CORS porque no es un fetch de
// navegador, pero "expo start --web" corre en el navegador y sí lo dispara.
// Headers abiertos porque hoy no hay nada sensible detrás (auth de desarrollo,
// sin cookies) — hay que restringir el origin cuando exista Supabase Auth real.
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
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
