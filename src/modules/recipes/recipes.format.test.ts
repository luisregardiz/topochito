import { describe, expect, it } from "vitest";
import {
  ageInTramo,
  allergenLabel,
  foodAgeBadge,
  ironLabel,
  isPrecaution,
  tramoLabel,
} from "./recipes.format";

describe("isPrecaution", () => {
  it("detecta advertencias reales del dataset", () => {
    expect(
      isPrecaution("La crema de maní nunca se da sola ni a cucharadas"),
    ).toBe(true);
    expect(
      isPrecaution("Evita pez espada, tiburón y atún rojo por su mercurio"),
    ).toBe(true);
    expect(isPrecaution("no lo des todos los días y alterna con pasta")).toBe(
      true,
    );
    expect(isPrecaution("pueden causar atragantamiento")).toBe(true);
  });

  it("no marca como precaución las notas informativas", () => {
    expect(
      isPrecaution(
        "El plátano muy maduro ya es dulce: no necesita azúcar ni papelón.",
      ),
    ).toBe(false);
    expect(
      isPrecaution("La harina de maíz precocida está enriquecida con hierro"),
    ).toBe(false);
    expect(isPrecaution(null)).toBe(false);
  });
});

describe("etiquetas", () => {
  it("hierro: corta en tarjeta, detallada en el detalle", () => {
    expect(ironLabel("muslo")).toBe("Hierro");
    expect(ironLabel(null, true)).toBe("Fuente de hierro");
    expect(ironLabel("muslo", true)).toBe("Hierro · muslo");
    expect(ironLabel("si usas avena enriquecida", true)).toBe(
      "Hierro, si usas avena enriquecida",
    );
  });

  it("alérgeno opcional lleva su condición", () => {
    expect(
      allergenLabel({
        slug: "lacteos",
        name: "Lácteos",
        isOptional: true,
        condition: "si usas leche",
      }),
    ).toBe("Lácteos · si usas leche");
    expect(
      allergenLabel({
        slug: "huevo",
        name: "Huevo",
        isOptional: false,
        condition: null,
      }),
    ).toBe("Huevo");
  });

  it("tramos de edad", () => {
    expect(tramoLabel({ minAgeMonths: 7, maxAgeMonths: 8 })).toBe("7–8 meses");
    expect(tramoLabel({ minAgeMonths: 12, maxAgeMonths: null })).toBe(
      "12+ meses",
    );
    expect(ageInTramo(8, { minAgeMonths: 7, maxAgeMonths: 8 })).toBe(true);
    expect(ageInTramo(13, { minAgeMonths: 12, maxAgeMonths: null })).toBe(true);
    expect(ageInTramo(6, { minAgeMonths: 7, maxAgeMonths: 8 })).toBe(false);
    expect(ageInTramo(null, { minAgeMonths: 7, maxAgeMonths: 8 })).toBe(false);
  });
});

describe("foodAgeBadge", () => {
  it("mapea los cuatro valores del dataset", () => {
    expect(foodAgeBadge("6 m")).toEqual({
      variant: "secondary",
      text: "Desde 6 m",
    });
    expect(foodAgeBadge("6 m (cocina)")).toEqual({
      variant: "secondary",
      text: "Desde 6 m",
    });
    expect(foodAgeBadge("Con cautela")).toEqual({
      variant: "warning",
      text: "Con cautela",
    });
    expect(foodAgeBadge("—")).toEqual({
      variant: "destructive",
      text: "No recomendado",
    });
  });
});
