import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { eliminarCuentaAction } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

const CONTACTO = "rodriguez.manuel.c17@gmail.com";

const MENSAJES_ERROR: Record<string, string> = {
  confirmacion_invalida: 'Tenés que escribir exactamente "ELIMINAR" para confirmar.',
  sin_permiso: "Tu cuenta administra un complejo — escribinos para dar de baja este tipo de cuenta.",
};

// Página pública (no requiere sesión para cargar) porque Google Play exige
// una URL de "solicitud de borrado de cuenta" en el formulario de Data
// Safety — tiene que poder visitarse sin haber iniciado sesión primero.
// Si hay sesión activa, además del trámite explicado, se ofrece el
// formulario de autoservicio real (ver eliminarCuentaAction).
export default async function EliminarCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ listo?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = sp.listo ? null : await getSessionUser();
  const mensajeError = sp.error ? MENSAJES_ERROR[sp.error] : null;

  if (sp.listo) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Cuenta eliminada</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Borramos tu nombre, tu email y tu contraseña de nuestros sistemas, y cerramos todas tus sesiones. Tus
          partidos pasados siguen visibles para los demás jugadores que compartieron cancha con vos, pero ya no
          están asociados a tus datos personales.
        </p>
        <Link href="/" className="mt-6 inline-block underline" style={{ color: "var(--text-secondary)" }}>
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Eliminar tu cuenta</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        Podés pedir que borremos tus datos personales de Cancha Llena en cualquier momento.
      </p>

      <div className="mb-6 flex flex-col gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        <p>Al eliminar tu cuenta:</p>
        <ul className="list-disc pl-5">
          <li>Tu nombre, email, teléfono y contraseña se borran por completo.</li>
          <li>Tu última ubicación conocida se borra.</li>
          <li>Cerramos todas tus sesiones activas (web y celular).</li>
          <li>
            Tus reservas y partidos pasados quedan (otros jugadores que compartieron cancha con vos todavía los ven
            en su propio historial), pero dejan de estar asociados a tus datos personales.
          </li>
        </ul>
        <p className="font-medium" style={{ color: "var(--status-critical)" }}>
          Esto no se puede deshacer.
        </p>
      </div>

      {mensajeError ? (
        <div className="mb-6 rounded-lg px-4 py-2.5 text-sm" style={{ background: "var(--chart-surface)", color: "var(--status-critical)", border: "1px solid var(--gridline)" }}>
          {mensajeError}
        </div>
      ) : null}

      {!session ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <Link href="/login?next=/eliminar-cuenta" className="underline">
              Iniciá sesión
            </Link>{" "}
            para eliminar tu cuenta vos mismo, o escribinos directamente si no podés entrar:
          </p>
          <a href={`mailto:${CONTACTO}?subject=Eliminar mi cuenta de Cancha Llena`} className="underline text-sm" style={{ color: "var(--text-secondary)" }}>
            {CONTACTO}
          </a>
        </div>
      ) : session.rol !== "jugador" ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Tu cuenta ({session.email}) administra un complejo, así que no se puede dar de baja sola. Escribinos a{" "}
          <a href={`mailto:${CONTACTO}?subject=Eliminar cuenta de admin de Cancha Llena`} className="underline">
            {CONTACTO}
          </a>{" "}
          y la damos de baja a mano.
        </p>
      ) : (
        <form action={eliminarCuentaAction} className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Vas a eliminar la cuenta de <strong>{session.email}</strong>. Escribí <strong>ELIMINAR</strong> para
            confirmar.
          </p>
          <input
            type="text"
            name="confirmacion"
            required
            autoComplete="off"
            placeholder="ELIMINAR"
            className="rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
          />
          <button
            type="submit"
            className="rounded-md px-4 py-2 text-sm font-medium"
            style={{ background: "var(--status-critical)", color: "white" }}
          >
            Eliminar mi cuenta
          </button>
        </form>
      )}
    </div>
  );
}
