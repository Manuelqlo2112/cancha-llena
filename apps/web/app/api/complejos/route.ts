import { NextResponse } from "next/server";
import { db } from "@cancha-llena/db";

export async function GET() {
  const complejos = await db.query.complejos.findMany({
    with: { canchas: { where: { activo: true }, columns: { id: true, deporte: true } } },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json({
    complejos: complejos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      slug: c.slug,
      comuna: c.comuna,
      direccion: c.direccion,
      telefono: c.telefono,
      horarioTexto: c.horarioTexto,
      amenidades: c.amenidades,
      requiereAbono: c.requiereAbono,
      porcentajeAbono: Number(c.porcentajeAbono),
      deportes: [...new Set(c.canchas.map((cancha) => cancha.deporte))],
      cantidadCanchas: c.canchas.length,
    })),
  });
}
