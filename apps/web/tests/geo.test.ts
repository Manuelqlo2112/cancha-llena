import { describe, expect, it } from "vitest";
import { distanciaKm } from "@cancha-llena/db/geo";

describe("distanciaKm", () => {
  it("da 0 para el mismo punto", () => {
    expect(distanciaKm(-33.45, -70.65, -33.45, -70.65)).toBe(0);
  });

  it("da ~96km en línea recta entre Santiago y Valparaíso (referencia conocida)", () => {
    const santiago = { lat: -33.4489, lng: -70.6693 };
    const valparaiso = { lat: -33.0472, lng: -71.6127 };
    const km = distanciaKm(santiago.lat, santiago.lng, valparaiso.lat, valparaiso.lng);
    expect(km).toBeGreaterThan(90);
    expect(km).toBeLessThan(100);
  });

  it("es simétrica", () => {
    const a = distanciaKm(-33.45, -70.65, -33.5, -70.7);
    const b = distanciaKm(-33.5, -70.7, -33.45, -70.65);
    expect(a).toBeCloseTo(b, 10);
  });
});
