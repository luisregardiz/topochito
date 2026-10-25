import type { RecipeAllergen, RecipeDetail } from "./recipes.schemas";

type Tramo = RecipeDetail["ageAdaptations"][number];

export const ironLabel = (note: string | null, detailed = false) => {
  if (!detailed) return "Hierro";
  if (!note) return "Fuente de hierro";
  return note.toLowerCase().startsWith("si ")
    ? `Hierro, ${note}`
    : `Hierro · ${note}`;
};

export const allergenLabel = (a: RecipeAllergen) =>
  a.isOptional ? `${a.name} · ${a.condition ?? "opcional"}` : a.name;

export const ageLabel = (min: number | null) =>
  min === null ? "Preparación base" : `Desde ${min} meses`;

export const tramoLabel = (t: Pick<Tramo, "minAgeMonths" | "maxAgeMonths">) =>
  t.maxAgeMonths === null
    ? `${t.minAgeMonths}+ meses`
    : `${t.minAgeMonths}–${t.maxAgeMonths} meses`;

export const ageInTramo = (
  age: number | null,
  t: Pick<Tramo, "minAgeMonths" | "maxAgeMonths">,
) =>
  age !== null &&
  age >= t.minAgeMonths &&
  (t.maxAgeMonths === null || age <= t.maxAgeMonths);

// shortcut: el dataset no marca qué notas son precauciones; se detecta por palabras clave.
// Cuando haya un campo explícito (p. ej. note_kind), reemplazar esto.
const PRECAUTION =
  /\b(nunca|evita|evitar|riesgo|cuidado|peligro|mercurio|no uses|no lo des|no las des|no los des|no des)\b|atragant/i;
export const isPrecaution = (note: string | null) =>
  !!note && PRECAUTION.test(note);

export type FoodAgeBadge = {
  variant: "secondary" | "warning" | "destructive";
  text: string;
};

// «6 m» y «6 m (cocina)» → Desde 6 m; «Con cautela»; «—» (el dataset lo usa para lo que no se da en la infancia).
export function foodAgeBadge(fromAge: string): FoodAgeBadge {
  if (fromAge === "—")
    return { variant: "destructive", text: "No recomendado" };
  if (fromAge === "Con cautela")
    return { variant: "warning", text: "Con cautela" };
  return {
    variant: "secondary",
    text: fromAge.startsWith("6 m") ? "Desde 6 m" : fromAge,
  };
}
