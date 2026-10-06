"use client";

import { useState, useTransition } from "react";
import { actualizarUbicacionAction } from "@/app/actions";

export function ActivarUbicacionButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta ubicación.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fd = new FormData();
        fd.set("lat", String(pos.coords.latitude));
        fd.set("lng", String(pos.coords.longitude));
        startTransition(() => {
          actualizarUbicacionAction(fd);
        });
      },
      () => setError("No pudimos acceder a tu ubicación."),
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg px-4 py-2.5 text-sm" style={{ background: "var(--chart-surface)", border: "1px solid var(--gridline)" }}>
      <span style={{ color: "var(--text-secondary)" }}>Activa tu ubicación para que te avisemos de partidos cerca tuyo.</span>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md px-3 py-1.5 text-xs font-medium"
        style={{ background: "var(--series-valle)", color: "white", opacity: pending ? 0.6 : 1 }}
      >
        {pending ? "..." : "Activar ubicación"}
      </button>
      {error ? <span style={{ color: "var(--status-critical)" }}>{error}</span> : null}
    </div>
  );
}
