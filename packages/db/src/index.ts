import { fileURLToPath } from "node:url";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { dbRelations } from "./schema";

// Dev: Postgres embebido en disco (packages/db/pgdata), sin Docker ni cuenta en la
// nube. El path se arma con un string no-literal a propósito: `new URL("../pgdata",
// import.meta.url)` con literal dispara el análisis estático de assets de
// Turbopack/webpack (intenta empaquetar "pgdata" como archivo) y falla el build.
// PGLITE_DATA_DIR permite apuntar a otra carpeta (p. ej. un directorio
// temporal para los tests) sin tocar la de desarrollo — ver apps/web/tests/.
const pgDataRelative = ["..", "pgdata"].join("/");
const pgDataDir = process.env.PGLITE_DATA_DIR ?? fileURLToPath(new URL(pgDataRelative, import.meta.url));

function createDbLocal() {
  return drizzlePglite({
    connection: { dataDir: pgDataDir },
    relations: dbRelations,
  });
}

// Tipo "canónico" de `db` en toda la app — ver el cast más abajo.
type Db = ReturnType<typeof createDbLocal>;

// Con DATABASE_URL seteada (p. ej. la connection string de Supabase, típicamente
// la del pooler en :6543) se usa Postgres real vía postgres.js — el driver que
// recomienda Drizzle para Supabase — con prepare:false porque el pooler en modo
// transacción no soporta prepared statements. Sin esa variable, PGlite embebido,
// para no depender de ninguna cuenta en dev. Activar Supabase es solo setear
// DATABASE_URL y correr `pnpm db:push` — ni una tabla de código cambia.
//
// El cast a Db es intencional: drizzle-orm tipa cada driver por separado, así
// que una función con dos ramas de retorno real distintas pierde la inferencia
// de `db.query.*` en toda la app si no se fuerza a un solo tipo. Las dos ramas
// comparten el mismo `relations: dbRelations`, así que la forma en runtime es
// la misma — el cast solo evita que TypeScript una los dos tipos de driver en
// un union inservible.
function createDb(): Db {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return drizzlePostgres({
      connection: { url: databaseUrl, prepare: false },
      relations: dbRelations,
    }) as unknown as Db;
  }
  return createDbLocal();
}

// PGlite (o cualquier driver) es una única conexión por proceso: si dos
// instancias en memoria se abren para el mismo destino (p. ej. porque Next.js
// empaqueta cada ruta en su propio bundle de servidor y cada uno re-evalúa
// este módulo), quedan con su propio caché y una puede no ver los commits de
// la otra. Se cachea en globalThis para garantizar una única instancia por
// proceso, sin importar cuántas veces se re-evalúe este módulo.
const globalForDb = globalThis as unknown as { __canchaLlenaDb?: Db };

export const db = globalForDb.__canchaLlenaDb ?? (globalForDb.__canchaLlenaDb = createDb());

export * from "./schema";
