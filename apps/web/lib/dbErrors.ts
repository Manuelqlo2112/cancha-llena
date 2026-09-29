// drizzle-orm envuelve cualquier error de Postgres en un DrizzleQueryError
// propio: el código real (ej. "23505" de unique_violation) queda en
// `err.cause.code`, no en `err.code` — chequear solo `err.code` nunca
// matchea nada y el catch termina relanzando el error crudo. Esto pasaba
// desapercibido porque los tests que ejercitaban estas ramas usaban
// llamadas secuenciales (el SELECT previo ya atajaba la carrera) en vez de
// concurrencia real que llegue a golpear el constraint en el INSERT.
export function esErrorPostgres(err: unknown, code: string): boolean {
  const candidatos = [err, err && typeof err === "object" && "cause" in err ? err.cause : undefined];
  return candidatos.some((c) => c && typeof c === "object" && "code" in c && c.code === code);
}
