"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import { registrarConCredenciales } from "@/lib/credenciales";
import { clearDevSession, setDevSessionUser } from "@/lib/session";

export async function signInGoogleAction(formData: FormData) {
  await signIn("google", { redirectTo: String(formData.get("next") ?? "/") || "/" });
}

export async function signInMicrosoftAction(formData: FormData) {
  await signIn("microsoft-entra-id", { redirectTo: String(formData.get("next") ?? "/") || "/" });
}

export async function loginConCredencialesAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  try {
    await signIn("credentials", { email, password, redirectTo: next || "/" });
  } catch (error) {
    // signIn() usa una excepción especial para redirigir cuando SÍ funciona
    // — solo interceptamos los errores reales de autenticación.
    if (error instanceof AuthError) {
      redirect("/login?error=credenciales_invalidas");
    }
    throw error;
  }
}

export async function registrarUsuarioAction(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  const resultado = await registrarConCredenciales(nombre, email, password);
  if (!resultado.ok) redirect(`/registrarse?error=${resultado.error}`);

  try {
    await signIn("credentials", { email, password, redirectTo: next || "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      // La cuenta se creó igual; que entre a mano desde /login.
      redirect("/login?error=cuenta_creada_reintentar");
    }
    throw error;
  }
}

// Cierra la sesión que corresponda: la real de Auth.js si existe, si no la
// cookie de desarrollo (/login/dev).
export async function cerrarSesionUniversal() {
  const sesionReal = await auth();
  if (sesionReal) {
    await signOut({ redirectTo: "/" });
    return;
  }
  await clearDevSession();
  redirect("/");
}

// --- Solo /login/dev ---

export async function iniciarSesionDevAction(formData: FormData) {
  const usuarioId = String(formData.get("usuarioId") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!usuarioId) return;
  await setDevSessionUser(usuarioId);
  redirect(next || "/");
}
