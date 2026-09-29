import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Corre UNA vez antes de todos los tests, en el proceso principal de
// Vitest — antes de que se levanten los workers, así que la variable de
// entorno que setea acá la heredan. Crea una base PGlite descartable en el
// temp del sistema (nunca en packages/db/pgdata, esa es la de desarrollo) y
// le aplica el esquema actual.
const packagesDbDir = fileURLToPath(new URL("../../../packages/db", import.meta.url));

export default async function setup() {
  // Los tests resetean tablas enteras entre corridas (ver resetDb en
  // tests/helpers.ts) — si DATABASE_URL quedó seteada en el entorno donde se
  // corre `pnpm test` (ahora que existe una base Supabase real y compartida
  // con producción), esa lógica de reseteo se ejecutaría contra datos
  // reales. Se borra acá, ANTES de que arranquen los workers de Vitest (que
  // heredan el process.env de este proceso), así los tests siempre usan
  // PGlite sin importar qué haya en el entorno de quien los corre.
  delete process.env.DATABASE_URL;

  const dataDir = mkdtempSync(path.join(tmpdir(), "cancha-llena-test-db-"));
  process.env.PGLITE_DATA_DIR = dataDir;

  execSync("pnpm exec drizzle-kit push", {
    cwd: packagesDbDir,
    env: { ...process.env, PGLITE_DATA_DIR: dataDir },
    stdio: "inherit",
  });

  return () => {
    rmSync(dataDir, { recursive: true, force: true });
  };
}
