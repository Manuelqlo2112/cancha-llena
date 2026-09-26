import { Card } from "./Card";

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      {/* Cifra grande: figuras proporcionales, no tabulares (spec de la skill dataviz) */}
      <div className="mt-1 text-3xl font-semibold" style={{ fontVariantNumeric: "proportional-nums" }}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {hint}
        </div>
      ) : null}
    </Card>
  );
}
