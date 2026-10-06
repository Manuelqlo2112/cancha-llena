"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
      <span className="text-4xl">⚠️</span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Algo salió mal</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        Prueba de nuevo — si sigue pasando, cuéntanos qué estabas haciendo.
      </p>
      <button
        onClick={() => reset()}
        className="mt-6 rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: "var(--series-valle)" }}
      >
        Reintentar
      </button>
    </div>
  );
}
