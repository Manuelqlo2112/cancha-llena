import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
      <span className="text-4xl">⚽</span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Esta cancha no existe</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        La página que buscas no está, o el link cambió.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: "var(--series-valle)" }}
      >
        Volver a explorar
      </Link>
    </div>
  );
}
