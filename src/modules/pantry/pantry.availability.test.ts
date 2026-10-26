import { describe, expect, it } from "vitest";
import {
  missingFoods,
  missingInLine,
  type FoodRef,
  type Requirement,
} from "./pantry.availability";

const f = (slug: string, name: string, staple = false): FoodRef => ({
  slug,
  name,
  staple,
});
const POLLO = f("pollo", "Pollo");
const SALMON = f("salmon", "Salmón");
const YUCA = f("yuca", "Yuca");
const OCUMO = f("ocumo", "Ocumo");
const NAME = f("name", "Ñame");
const AGUA = f("agua", "Agua", true);
const none = new Set<string>();
const without = (...slugs: string[]) => new Set(slugs);
const line = (
  groups: FoodRef[][],
  optional = false,
  position = 1,
): Requirement => ({ position, optional, groups });

describe("línea de ingredientes", () => {
  it("se puede cocinar si el alimento está disponible", () => {
    expect(missingInLine(line([[SALMON]]), none)).toEqual([]);
    expect(missingInLine(line([[SALMON]]), without("pollo"))).toEqual([]);
  });

  it("falta el alimento si la familia no lo consigue", () => {
    expect(missingInLine(line([[SALMON]]), without("salmon"))).toEqual([
      "salmón",
    ]);
  });

  it("con alternativas basta una; faltan todas si no hay ninguna", () => {
    const yucaOrOcumo = line([[YUCA, OCUMO]]);
    expect(missingInLine(yucaOrOcumo, without("yuca"))).toEqual([]);
    expect(missingInLine(yucaOrOcumo, without("yuca", "ocumo"))).toEqual([
      "yuca o ocumo",
    ]);
  });

  it("los grupos de una línea son todos necesarios (yuca Y ocumo-o-ñame)", () => {
    const l = line([[YUCA], [OCUMO, NAME]]);
    expect(missingInLine(l, without("ocumo"))).toEqual([]);
    expect(missingInLine(l, without("ocumo", "name"))).toEqual([
      "ocumo o ñame",
    ]);
    expect(missingInLine(l, without("yuca", "ocumo", "name"))).toEqual([
      "yuca",
      "ocumo o ñame",
    ]);
  });

  it("los básicos nunca faltan, aunque estén marcados", () => {
    expect(missingInLine(line([[AGUA]]), without("agua"))).toEqual([]);
    // «agua o leche»: el básico cubre la alternativa
    expect(
      missingInLine(
        line([[AGUA, f("leche-entera", "Leche entera")]]),
        without("leche-entera", "agua"),
      ),
    ).toEqual([]);
  });

  it("una línea opcional no bloquea y una sin alimentos tampoco", () => {
    expect(missingInLine(line([[SALMON]], true), without("salmon"))).toEqual(
      [],
    );
    expect(missingInLine(line([]), without("salmon"))).toEqual([]);
  });
});

describe("receta", () => {
  const reqs = [
    line([[POLLO]], false, 1),
    line([[YUCA], [OCUMO, NAME]], false, 2),
    line([[SALMON]], true, 3),
    line([[AGUA]], false, 4),
  ];

  it("es cocinable con todo disponible", () => {
    expect(missingFoods(reqs, none)).toEqual([]);
  });

  it("junta lo que falta en el orden de la receta, sin repetir", () => {
    expect(missingFoods(reqs, without("pollo", "ocumo", "name"))).toEqual([
      "pollo",
      "ocumo o ñame",
    ]);
    expect(
      missingFoods(
        [line([[POLLO]], false, 1), line([[POLLO]], false, 2)],
        without("pollo"),
      ),
    ).toEqual(["pollo"]);
  });

  it("ignora lo opcional aunque no se consiga", () => {
    expect(missingFoods(reqs, without("salmon"))).toEqual([]);
  });
});
