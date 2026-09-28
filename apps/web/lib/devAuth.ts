// El login de desarrollo (/login/dev, /api/dev/login) deja entrar a
// cualquier usuario sembrado con un click, sin contraseña — y encima expone
// el listado completo de usuarios (nombre + email) sin autenticación. Eso es
// aceptable en un backend que solo vive en la LAN de un dev, pero es un
// agujero de seguridad real (toma de cuenta total, incluido super_admin) en
// cuanto el backend tiene una URL pública. Apagado por defecto: hay que
// prenderlo a propósito con ALLOW_DEV_LOGIN=true en .env.local. Nunca
// configurar esa variable en Vercel/producción.
export function devLoginHabilitado(): boolean {
  return process.env.ALLOW_DEV_LOGIN === "true";
}
