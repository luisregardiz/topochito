// ¿Puede la familia cocinar la receta con su despensa? Lógica pura.
//
// Una línea de ingredientes tiene grupos; los grupos son todos necesarios y dentro de un grupo basta un
// alimento (alternativas). Un grupo se cumple si algún alimento es básico o la familia lo consigue.
// Una receta es cocinable si ninguna línea obligatoria tiene un grupo sin cumplir.

export type FoodRef = { slug: string; name: string; staple: boolean };
export type Requirement = {
  position: number;
  optional: boolean;
  groups: FoodRef[][];
};

const lower = (s: string) => s[0]!.toLowerCase() + s.slice(1);

// Alimentos que faltan en una línea, como texto («ocumo o ñame»); vacío si se puede cocinar.
export function missingInLine(
  req: Requirement,
  unavailable: ReadonlySet<string>,
): string[] {
  if (req.optional) return [];
  return req.groups
    .filter((group) => group.every((f) => !f.staple && unavailable.has(f.slug)))
    .map((group) => group.map((f) => lower(f.name)).join(" o "));
}

// Alimentos que faltan en toda la receta, sin repetidos y en el orden en que aparecen.
export function missingFoods(
  reqs: readonly Requirement[],
  unavailable: ReadonlySet<string>,
): string[] {
  return [...new Set(reqs.flatMap((r) => missingInLine(r, unavailable)))];
}
