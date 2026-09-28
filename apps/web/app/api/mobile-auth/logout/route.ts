import { NextRequest, NextResponse } from "next/server";
import { revocarSesionMovil } from "@/lib/sesionesMovil";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (token) await revocarSesionMovil(token);
  return NextResponse.json({ ok: true });
}
