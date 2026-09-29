import Link from "next/link";
import { Card } from "@/components/Card";
import { getSessionUser } from "@/lib/session";
import { obtenerMisRachas } from "@/lib/reservas";
import { nivelesDeJugador } from "@/lib/resultados";
import { DEPORTE_LABEL } from "@/lib/format";
import { cerrarSesionUniversal } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

const ROL_LABEL: Record<string, string> = {
  jugador: "Jugador",
  admin_complejo: "Admin de complejo",
  super_admin: "Super admin",
};

export default async function PerfilPage() {
  const session = await getSessionUser();

  if (!session) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Link href="/login?next=/perfil" className="underline">
            Iniciá sesión
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
    </div>
  );
}
