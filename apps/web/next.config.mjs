/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Components importan @cancha-llena/db directo (PGlite corre embebido
  // en el proceso de Node); no hace falta transpilePackages porque el paquete
  // se consume como TS fuente vía workspace symlink.
  transpilePackages: ["@cancha-llena/db"],
  // PGlite mezcla WASM + detección de entorno Node en tiempo de carga; si
  // Turbopack/webpack lo empaqueta, esa detección se rompe (termina pasándole
  // un URL donde Node espera un string). Se deja fuera del bundle para que
  // corra tal cual en el proceso de Node.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
