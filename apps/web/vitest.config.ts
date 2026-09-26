import { defineConfig } from "vitest/config";

// Toda la suite comparte UNA instancia de PGlite (singleton en
// @cancha-llena/db) apuntando a una carpeta temporal — por eso todo corre
// en un solo fork y con los archivos en serie (fileParallelism: false): dos
// llamadas interleaved contra la misma instancia de PGlite (dos archivos
// "en paralelo" dentro del mismo worker cuentan) la dejan en un estado
// inconsistente — el mismo tipo de corrupción que ya mordió en dev con dos
// procesos concurrentes.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globalSetup: "./tests/globalSetup.ts",
    testTimeout: 20_000,
    hookTimeout: 30_000,
    pool: "forks",
    fileParallelism: false,
    isolate: false, // ya está garantizado en serie arriba; reutilizar el worker entre archivos es solo más rápido.
  },
});
