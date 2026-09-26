const ACTUALIZADO = "26 de septiembre de 2026";
const CONTACTO = "rodriguez.manuel.c17@gmail.com";

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-base font-semibold">{titulo}</h2>
      <div className="flex flex-col gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </section>
  );
}

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Términos de uso</h1>
      <p className="mb-8 text-xs" style={{ color: "var(--text-muted)" }}>
        Última actualización: {ACTUALIZADO}
      </p>

      <Seccion titulo="Aceptación">
        <p>Al usar Cancha Llena aceptás estos términos. Si no estás de acuerdo, no uses la app.</p>
      </Seccion>

      <Seccion titulo="Qué hace Cancha Llena">
        <p>
          Conectamos jugadores con complejos deportivos para reservar canchas y coordinar partidos. Cancha Llena
          intermedia la reserva; el servicio de la cancha (calidad, horarios, mantención) es responsabilidad de cada
          complejo.
        </p>
      </Seccion>

      <Seccion titulo="Tu cuenta">
        <p>
          Sos responsable de mantener tu contraseña segura y de la actividad que ocurra en tu cuenta. Avisanos si
          creés que alguien más accedió a tu cuenta sin tu permiso.
        </p>
      </Seccion>

      <Seccion titulo="Reservas y cancelaciones">
        <p>
          Podés cancelar una reserva hasta el mismo día en que la hiciste; después de esa fecha, la cancelación queda
          a criterio del complejo. Algunos complejos piden un abono online al reservar — otros cobran todo en cancha.
          Esto se indica siempre antes de confirmar.
        </p>
      </Seccion>

      <Seccion titulo="Buscar rival y rachas">
        <p>
          Si te faltan jugadores, podés abrir tu partido para que otros se sumen. Cualquier jugador anotado puede
          hacer esto. Las rachas premian jugar seguido en un mismo complejo — son un incentivo, no una garantía ni un
          producto financiero.
        </p>
      </Seccion>

      <Seccion titulo="Conducta">
        <p>
          Esperamos buen trato entre jugadores y hacia el personal de los complejos. Nos reservamos el derecho de
          suspender cuentas que hagan un mal uso de la app (reservas falsas, acoso a otros usuarios, etc.).
        </p>
      </Seccion>

      <Seccion titulo="Cambios">
        <p>Podemos actualizar estos términos con el tiempo. Si el cambio es importante, te avisamos dentro de la app.</p>
      </Seccion>

      <Seccion titulo="Contacto">
        <p>
          Consultas sobre estos términos:{" "}
          <a href={`mailto:${CONTACTO}`} className="underline">
            {CONTACTO}
          </a>
          .
        </p>
      </Seccion>
    </div>
  );
}
