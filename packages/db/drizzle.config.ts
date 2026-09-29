import { defineConfig } from "drizzle-kit";

// Mismo swap que packages/db/src/index.ts: sin DATABASE_URL, PGlite embebido
// para dev local sin cuenta en la nube; con DATABASE_URL (p. ej. la
// connection string de Supabase), Postgres real — mismo esquema en los dos
// casos, esto solo decide contra qué corre `drizzle-kit push`.
const databaseUrl = process.env.DATABASE_URL;

export default databaseUrl
  ? defineConfig({
      out: "./drizzle",
      schema: "./src/schema.ts",
      dialect: "postgresql",
      dbCredentials: { url: databaseUrl },
      // Supabase tiene sus propios schemas internos (auth, storage, realtime,
      // vault, extensions) con sus propias tablas — sin este filtro,
      // drizzle-kit los trata como "no están en mi schema.ts" y ofrece
      // BORRARLOS. Nuestro esquema vive entero en `public`.
      schemaFilter: ["public"],
    })
  : defineConfig({
      out: "./drizzle",
      schema: "./src/schema.ts",
      dialect: "postgresql",
      driver: "pglite",
      // Mismo override que packages/db/src/index.ts — usado por los tests
      // para aplicar el esquema contra una carpeta temporal, no `./pgdata`.
      dbCredentials: { url: process.env.PGLITE_DATA_DIR ?? "./pgdata" },
    });
