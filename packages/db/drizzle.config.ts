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
