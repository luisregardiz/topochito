import { describe, expect, it } from "vitest";
import { recipeListQuery } from "./recipes.schemas";
import { getRecipe, listRecipes, normalizeSearch } from "./recipes.service";

describe("normalizeSearch", () => {
  it("pasa a minúsculas y quita tildes (ñ se conserva)", () => {
    expect(normalizeSearch("Salmón")).toBe("salmon");
    expect(normalizeSearch("Plátano Güisa")).toBe("platano guisa");
    expect(normalizeSearch("Año")).toBe("año");
  });

  it("escapa los comodines de LIKE", () => {
    expect(normalizeSearch("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });
});

describe("recipeListQuery", () => {
  it("convierte listas separadas por comas y la edad numérica", () => {
    expect(
      recipeListQuery.parse({
        exclude: "mani, huevo",
        tags: "sin-sal",
        age: "7",
        iron: "1",
      }),
    ).toEqual({
      exclude: ["mani", "huevo"],
      tags: ["sin-sal"],
      age: 7,
      iron: "1",
    });
  });

  it("rechaza valores fuera de rango o con formato inválido", () => {
    expect(recipeListQuery.safeParse({ age: "2" }).success).toBe(false);
    expect(recipeListQuery.safeParse({ meal: "postre" }).success).toBe(false);
    expect(recipeListQuery.safeParse({ exclude: "Mani;DROP" }).success).toBe(
      false,
    );
    expect(recipeListQuery.safeParse({ iron: "0" }).success).toBe(false);
  });
});

describe("servicio de recetas", () => {
  it("normaliza la búsqueda antes de llegar al repositorio", async () => {
    let received: unknown;
    const repo = { list: async (f: unknown) => ((received = f), []) };
    await listRecipes(repo, { q: "Salmón", age: 8 });
    expect(received).toEqual({ q: "salmon", age: 8 });
  });

  it("busca el código en mayúsculas", async () => {
    let received = "";
    const repo = { findByCode: async (c: string) => ((received = c), null) };
    expect(await getRecipe(repo, "d10")).toBeNull();
    expect(received).toBe("D10");
  });
});
