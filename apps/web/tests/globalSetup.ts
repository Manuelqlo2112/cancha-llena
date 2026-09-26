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
