"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actualizarCancha, actualizarComplejo } from "@/lib/adminGestion";
import { crearLiga } from "@/lib/ligas";
import { getSessionUser } from "@/lib/session";

export async function actualizarComplejoAction(formData: FormData) {
  const complejoId = String(formData.get("complejoId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const session = await getSessionUser();
  if (!session) redirect(`/login?next=/admin/${slug}`);

  const amenidades = String(formData.get("amenidades") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const resultado = await actualizarComplejo(session, complejoId, {
    telefono: String(formData.get("telefono") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    horarioTexto: String(formData.get("horarioTexto") ?? "").trim(),
    amenidades,
    requiereAbono: formData.get("requiereAbono") === "on",
    porcentajeAbono: Number(formData.get("porcentajeAbono") ?? 0) || 0,
  });

  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/complejos/${slug}`);
  revalidatePath("/");
  redirect(`/admin/${slug}${resultado.ok ? "?guardado=1" : `?error=${resultado.error}`}`);
}

export async function actualizarCanchaAction(formData: FormData) {
  const canchaId = String(formData.get("canchaId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const session = await getSessionUser();
  if (!session) redirect(`/login?next=/admin/${slug}`);

  const resultado = await actualizarCancha(session, canchaId, {
    precioBase: Number(formData.get("precioBase") ?? 0),
    activo: formData.get("activo") === "on",
  });

  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/complejos/${slug}`);
  redirect(`/admin/${slug}${resultado.ok ? "?guardado=1" : `?error=${resultado.error}`}`);
}

export async function crearLigaAction(formData: FormData) {
  const complejoId = String(formData.get("complejoId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const session = await getSessionUser();
  if (!session) redirect(`/login?next=/admin/${slug}`);

  const resultado = await crearLiga(session, complejoId, {
    canchaId: String(formData.get("canchaId") ?? ""),
    nombre: String(formData.get("nombre") ?? "").trim(),
    diaSemana: Number(formData.get("diaSemana") ?? -1),
    horaInicio: String(formData.get("horaInicio") ?? ""),
    cupoMaximo: Number(formData.get("cupoMaximo") ?? 0),
  });

  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/complejos/${slug}`);
  redirect(`/admin/${slug}${resultado.ok ? "?guardado=1" : `?error=${resultado.error}`}`);
}
