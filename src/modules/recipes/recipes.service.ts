import type {
  AllergenOption,
  RecipeDetail,
  RecipeListItem,
  RecipeListQuery,
} from "./recipes.schemas";

const FOLD: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
};

// Búsqueda sin tildes (la columna se pliega igual en SQL) y con %, _ y \ escapados para LIKE.
export function normalizeSearch(q: string) {
  return q
    .toLowerCase()
    .replace(/[áéíóúü]/g, (c) => FOLD[c] ?? c)
    .replace(/[\\%_]/g, "\\$&");
}

type Repo = {
  list: (
    filters: RecipeListQuery,
    householdId: string,
  ) => Promise<RecipeListItem[]>;
  findByCode: (
    code: string,
    householdId: string,
  ) => Promise<RecipeDetail | null>;
  listAllergens: () => Promise<AllergenOption[]>;
};

export async function listRecipes(
  repo: Pick<Repo, "list">,
  query: RecipeListQuery,
  householdId: string,
) {
  const q = query.q ? normalizeSearch(query.q) : undefined;
  return { recipes: await repo.list({ ...query, q }, householdId) };
}

export const getRecipe = (
  repo: Pick<Repo, "findByCode">,
  code: string,
  householdId: string,
) => repo.findByCode(code.toUpperCase(), householdId);

export const listAllergens = (repo: Pick<Repo, "listAllergens">) =>
  repo.listAllergens();
