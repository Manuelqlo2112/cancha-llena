import Link from "next/link";
import { Card } from "@/components/Card";
import { getSessionUser } from "@/lib/session";
import { obtenerMisRachas } from "@/lib/reservas";
import { nivelesDeJugador, obtenerRivales } from "@/lib/resultados";
import { DEPORTE_LABEL } from "@/lib/format";
import { cambiarContrasenaAction, cerrarSesionUniversal } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

const ROL_LABEL: Record<string, string> = {
  jugador: "Jugador",
  admin_complejo: "Admin de complejo",
  super_admin: "Super admin",
};

const MENSAJES: Record<string, string> = {
  contrasena: "Contraseña actualizada.",
  error_no_coincide: "La confirmación no coincide con la contraseña nueva.",
  error_actual_incorrecta: "La contraseña actual no es correcta.",
  error_datos_invalidos: "La contraseña nueva tiene que tener entre 8 y 200 caracteres.",
  error_sin_password: "Esta cuenta entra con Google o Microsoft — no tiene contraseña para cambiar.",
};

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ contrasena?: string; error?: string }>;
}) {
  const session = await getSessionUser();
  const sp = await searchParams;
  const mensaje = sp.contrasena ? MENSAJES.contrasena : sp.error ? MENSAJES[`error_${sp.error}`] : null;

  if (!session) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Link href="/login?next=/perfil" className="underline">
            Inicia sesión
          </Link>{" "}
          para ver tu perfil.
        </p>
      </div>
    );
  }

  const rachas = await obtenerMisRachas(session.id);
  const mejorRachaGlobal = rachas.reduce((max, r) => Math.max(max, r.mejorRacha), 0);
  const rachasActivas = rachas.filter((r) => r.vigente).length;
  const niveles = nivelesDeJugador(session.nivelPorDeporte);
  const rivales = await obtenerRivales(session.id);

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <div
          className="mb-3 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold text-white"
          style={{ background: "var(--series-valle)" }}
        >
          {session.nombre.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{session.nombre}</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {session.email}
        </p>
        <span className="mt-2 rounded-full px-3 py-1 text-xs" style={{ background: "var(--chart-surface)", color: "var(--text-secondary)", border: "1px solid var(--gridline)" }}>
          {ROL_LABEL[session.rol] ?? session.rol}
        </span>
      </div>

      {mensaje ? (
        <div className="mb-6 rounded-lg px-4 py-2.5 text-sm" style={{ background: "var(--chart-surface)", color: "var(--text-secondary)", border: "1px solid var(--gridline)" }}>
          {mensaje}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Card className="text-center">
          <div className="text-2xl font-semibold">{rachasActivas}</div>
          <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Racha{rachasActivas === 1 ? "" : "s"} activa{rachasActivas === 1 ? "" : "s"}
          </div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-semibold">🔥 {mejorRachaGlobal}</div>
          <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Mejor racha
          </div>
        </Card>
      </div>

      {niveles.length > 0 ? (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">Tu nivel</h2>
          <div className="flex flex-col gap-2">
            {niveles.map((n) => (
              <Card key={n.deporte} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{DEPORTE_LABEL[n.deporte] ?? n.deporte}</span>
                <span className="text-sm font-medium">{n.nivel}</span>
              </Card>
            ))}
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Sube o baja según el resultado que reportás en tus partidos.
          </p>
        </div>
      ) : null}

      {rachas.length > 0 ? (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">Tus rachas por complejo</h2>
          <div className="flex flex-col gap-2">
            {rachas.map((r) => (
              <Card key={r.complejoSlug} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{r.complejoNombre}</span>
                <span className="text-sm font-medium" style={{ color: r.vigente ? "var(--text-primary)" : "var(--text-muted)" }}>
                  🔥 {r.contadorActual}
                </span>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {rivales.length > 0 ? (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">Tus rivales</h2>
          <div className="flex flex-col gap-2">
            {rivales.slice(0, 5).map((r) => (
              <Card key={r.rivalId} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{r.rivalNombre}</span>
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  {r.victorias}V {r.empates}E {r.derrotas}D
                </span>
              </Card>
            ))}
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Historial cabeza a cabeza en partidos con resultado reportado.
          </p>
        </div>
      ) : null}

      {session.passwordHash ? (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-medium">Cambiar contraseña</h2>
          <form action={cambiarContrasenaAction} className="flex flex-col gap-2">
            <input
              type="password"
              name="actual"
              placeholder="Contraseña actual"
              required
              autoComplete="current-password"
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
            />
            <input
              type="password"
              name="nueva"
              placeholder="Contraseña nueva"
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
            />
            <input
              type="password"
              name="confirmacion"
              placeholder="Repite la contraseña nueva"
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--gridline)", background: "var(--chart-surface)" }}
            />
            <button type="submit" className="mt-1 self-start rounded-md px-4 py-2 text-sm font-medium" style={{ background: "var(--series-valle)", color: "white" }}>
              Guardar contraseña
            </button>
          </form>
        </Card>
      ) : null}

      <div className="flex justify-center gap-4 text-sm">
        <Link href="/mis-reservas" className="underline" style={{ color: "var(--text-secondary)" }}>
          Ver mis reservas
        </Link>
        <form action={cerrarSesionUniversal}>
          <button type="submit" className="underline" style={{ color: "var(--status-critical)" }}>
            Salir
          </button>
        </form>
      </div>

      <div className="mt-4 flex justify-center text-xs">
        <Link href="/eliminar-cuenta" className="underline" style={{ color: "var(--text-muted)" }}>
          Eliminar mi cuenta
        </Link>
      </div>
    </div>
  );
}
