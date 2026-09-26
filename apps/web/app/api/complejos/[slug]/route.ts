import { NextRequest, NextResponse } from "next/server";
import { getComplejoView } from "@/lib/complejoView";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const usuario = await getUserFromRequest(req);
  const complejo = await getComplejoView(slug, usuario?.id ?? null);
  if (!complejo) return NextResponse.json({ ok: false, error: "no encontrado" }, { status: 404 });
  return NextResponse.json({ complejo });
}
