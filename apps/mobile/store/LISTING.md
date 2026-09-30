# Ficha de Play Store — Cancha Llena

Todo lo que hay que pegar/cargar a mano en Play Console (developer account
de Google, no algo que se pueda automatizar desde acá). Los assets de
imagen están en esta misma carpeta (`icon-512.png`, `feature-graphic.png`).

## Textos

**Nombre de la app** (máx. 30 caracteres)
```
Cancha Llena
```

**Descripción breve** (máx. 80 caracteres)
```
Reserva canchas de futbolito, arma tu equipo y sube de nivel
```

**Descripción completa** (máx. 4000 caracteres)
```
Cancha Llena es la forma más simple de reservar una cancha de futbolito y
armar el partido — sin llamadas, sin grupos de WhatsApp perdidos.

RESERVA EN SEGUNDOS
Elegí el complejo, la cancha y el horario. Confirmás al toque, con abono
online cuando el complejo lo pide.

¿TE FALTA GENTE PARA EL PARTIDO?
Con "Buscar rival" avisamos a jugadores cerca tuyo que hay cupos libres, y
también podés desafiar directo a alguien con quien ya jugaste antes.

SUBÍ DE NIVEL
Cada resultado que reportás actualiza tu nivel por deporte (sistema tipo
ELO) y tu historial cabeza a cabeza contra cada rival — victorias,
empates y derrotas.

LIGAS SEMANALES
Sumate a una liga recurrente en tu complejo y jugá el mismo horario todas
las semanas con el mismo grupo.

RACHAS Y DESCUENTOS
Jugá seguido en un complejo y desbloqueá descuento en los horarios de
menor demanda mientras tu racha siga activa.

Pensada para complejos de futbolito en Chile, con más deportes y ciudades
en camino.
```

## Categoría y clasificación

- **Categoría**: Deportes
- **Tipo de contenido**: App (no juego)
- **Clasificación de contenido (cuestionario IARC)**: sin violencia, sin
  contenido para adultos, sin apuestas de dinero real (el abono es el pago
  de una reserva de cancha, no una apuesta) — debería calificar como apta
  para todo público / PEGI 3 equivalente. Contestar el cuestionario con
  "No" en todas las categorías sensibles (violencia, contenido sexual,
  drogas, apuestas, lenguaje ofensivo).

## Política de privacidad (obligatorio, ya está lista)

```
https://web-ashy-one-28.vercel.app/privacidad
```

## URL de solicitud de borrado de cuenta (obligatorio, ya está lista)

Google pide esto como campo aparte de la política de privacidad — es una
página real con un formulario de autoservicio (no solo texto explicando
cómo pedirlo por mail):

```
https://web-ashy-one-28.vercel.app/eliminar-cuenta
```

## Formulario de seguridad de datos (Data Safety)

Google pide declarar, tipo por tipo, qué datos se recolectan y para qué.
Esto es lo que Cancha Llena realmente hace — contestar el formulario según
esta tabla:

| Tipo de dato | ¿Se recolecta? | ¿Se comparte con terceros? | Para qué | ¿Es opcional? |
|---|---|---|---|---|
| Nombre | Sí | No | Funcionalidad de la app (identificarte en tus reservas) | No (hace falta para crear la cuenta) |
| Email | Sí | No | Funcionalidad de la app (login, contacto) | No |
| Ubicación aproximada/precisa | Sí | No | Funcionalidad de la app (avisar partidos cercanos) | Sí — el usuario la activa a mano |
| Historial de reservas/partidos | Sí | No | Funcionalidad de la app | No |
| Info de pago (si se agrega pasarela real en el futuro) | Aún no aplica (hoy es simulado) | — | — | — |

Puntos clave para el formulario:
- Todos los datos viajan cifrados en tránsito (HTTPS) → marcar "Sí" en esa
  pregunta.
- El usuario puede eliminar su cuenta y sus datos él mismo, desde la app o
  desde la URL de arriba → marcar que sí existe un mecanismo de borrado
  in-app, y pegar esa misma URL en el campo "cuenta y borrado de datos".
- Ningún dato se vende ni se usa para publicidad de terceros.
- La ubicación es la única categoría "sensible" — remarcar que es
  opcional y que el usuario la activa explícitamente desde Perfil.

## Cuenta de Google Play Developer

Esto lo tenés que hacer vos, no es algo que yo pueda hacer en tu nombre:

1. Entrar a https://play.google.com/console/signup con tu cuenta de
   Google.
2. Pagar la inscripción única de USD 25.
3. Crear la app nueva dentro de la consola (nombre: Cancha Llena, tipo:
   App, gratis).
4. Completar Store Listing con los textos de arriba + subir
   `icon-512.png` y `feature-graphic.png`.
5. Completar el cuestionario de clasificación de contenido y el
   formulario de seguridad de datos (tablas de arriba).
6. Pegar la URL de política de privacidad.
7. Subir el `.aab` que генera `eas build` (ver abajo) en la sección
   "Producción" → "Crear versión nueva".
8. Google pide 2 capturas de pantalla de teléfono como mínimo — se pueden
   sacar corriendo la app (`npx expo start`) en un emulador o en tu
   celular con Expo Go, o directo desde el build de preview.
9. Enviar a revisión. Google suele tardar entre unas horas y unos días en
   la primera revisión de una app nueva.
