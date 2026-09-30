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

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Política de privacidad</h1>
      <p className="mb-8 text-xs" style={{ color: "var(--text-muted)" }}>
        Última actualización: {ACTUALIZADO}
      </p>

      <Seccion titulo="Qué es Cancha Llena">
        <p>
          Cancha Llena es una app para reservar canchas de fútbolito y coordinar partidos con otros jugadores. Esta
          política explica qué datos recolectamos, para qué los usamos y qué control tenés sobre ellos.
        </p>
      </Seccion>

      <Seccion titulo="Qué datos recolectamos">
        <p>
          <strong>Cuenta:</strong> nombre, email y, si te registrás con contraseña, un hash de tu contraseña (nunca la
          guardamos en texto plano). Si entrás con Google o Microsoft, recibimos tu nombre y email desde ese
          proveedor.
        </p>
        <p>
          <strong>Reservas:</strong> qué canchas reservás, cuándo, con quién jugás y el estado de tus pagos.
        </p>
        <p>
          <strong>Ubicación (opcional):</strong> si activás "avisame de partidos cerca mío", guardamos tu última
          ubicación conocida para poder invitarte a partidos cercanos que buscan jugadores. Podés desactivar esto en
          cualquier momento; no rastreamos tu ubicación en segundo plano.
        </p>
        <p>
          <strong>Uso de la app:</strong> información técnica básica (tipo de dispositivo, errores) para poder
          arreglar problemas.
        </p>
      </Seccion>

      <Seccion titulo="Para qué usamos tus datos">
        <p>Para que la app funcione: mostrarte canchas disponibles, procesar tus reservas y conectarte con otros jugadores.</p>
        <p>Para la mecánica de rachas y "buscar rival": estos usos son inherentes a cómo funciona Cancha Llena, no compartimos esta información con nadie fuera de la app.</p>
        <p>Para avisarte de partidos cerca tuyo, solo si activaste la ubicación.</p>
        <p>Nunca vendemos tus datos a terceros ni los usamos para publicidad.</p>
      </Seccion>

      <Seccion titulo="Con quién compartimos datos">
        <p>
          Con el complejo deportivo donde reservás (necesita saber quién reservó). Con nuestro proveedor de
          infraestructura (hosting y base de datos) para poder operar la app. Con Google o Microsoft únicamente si
          elegís iniciar sesión con esas cuentas.
        </p>
      </Seccion>

      <Seccion titulo="Tus derechos">
        <p>
          Podés eliminar tu cuenta y tus datos personales vos mismo, en cualquier momento, desde{" "}
          <a href="/eliminar-cuenta" className="underline">
            /eliminar-cuenta
          </a>
          . Para cualquier otro pedido (ver o corregir tus datos), escribinos a{" "}
          <a href={`mailto:${CONTACTO}`} className="underline">
            {CONTACTO}
          </a>
          .
        </p>
      </Seccion>

      <Seccion titulo="Menores de edad">
        <p>Cancha Llena está pensada para mayores de 13 años. Si sos menor de edad, usá la app con supervisión de un adulto responsable.</p>
      </Seccion>

      <Seccion titulo="Contacto">
        <p>
          Cualquier consulta sobre esta política, escribinos a{" "}
          <a href={`mailto:${CONTACTO}`} className="underline">
            {CONTACTO}
          </a>
          .
        </p>
      </Seccion>
    </div>
  );
}
