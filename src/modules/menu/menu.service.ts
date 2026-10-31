import type { BabyProfile } from "@/modules/babies/baby.schemas";
import {
  generateWeek,
  mealsForAge,
  regenerateDay,
  regenerateMeal,
  slotKey,
  type Candidate,
  type Ctx,
  type Plan,
  type Pools,
} from "./menu.generator";
import type { MealTimes } from "@/modules/households/households.schemas";
import { summarize } from "./menu.summary";
import { todayPlan } from "./menu.today";
import { weekOf } from "./menu.week";
import {
  MENU_MEALS,
  type EntriesInput,
  type EntryRef,
  type Menu,
  type MenuMeal,
  type RegenerateInput,
  type StoredEntry,
} from "./menu.schemas";

export type MenuError =
  | "baby_required"
  | "not_enough_recipes"
  | "no_menu"
  | "invalid_recipe"
  | "invalid_slot";

export type Deps = {
  menu: {
    candidates: (
      ageMonths: number,
      avoid: string[],
      householdId: string,
    ) => Promise<Candidate[]>;
    getWeek: (householdId: string, weekStart: string) => Promise<StoredEntry[]>;
    replaceWeek: (
      householdId: string,
      weekStart: string,
      entries: EntryRef[],
    ) => Promise<void>;
    setEntries: (
      householdId: string,
      weekStart: string,
      entries: EntryRef[],
    ) => Promise<void>;
    recipeMeals: (codes: string[]) => Promise<Map<string, string>>;
  };
  baby: {
    get: (householdId: string) => Promise<
      | (Pick<BabyProfile, "allergens"> & {
          birthMonth: number;
          birthYear: number;
        })
      | null
    >;
  };
  babyAge: (
    baby: { birthMonth: number; birthYear: number },
    now: Date,
  ) => number;
  household: (
    householdId: string,
  ) => Promise<{ timeZone: string; mealTimes: MealTimes }>;
  now: () => Date;
  random: () => number;
};

type Fail = { ok: false; error: MenuError };
const fail = (error: MenuError): Fail => ({ ok: false, error });

const toCandidate = (e: StoredEntry): Candidate => ({
  code: e.recipe.code,
  meal: e.meal,
  isIron: e.recipe.isIronSource,
  isFish: e.isFish,
  isMaxOnce: e.isMaxOnce,
});
const toPlan = (entries: StoredEntry[]): Plan =>
  Object.fromEntries(
    entries.map((e) => [slotKey(e.day, e.meal), e.recipe.code]),
  );
const toRefs = (plan: Plan): EntryRef[] =>
  Object.entries(plan).map(([k, recipe]) => {
    const [day, meal] = k.split(":");
    return { day: Number(day), meal: meal as MenuMeal, recipe };
  });

type Week = ReturnType<typeof weekOf>;

function buildMenu(
  entries: StoredEntry[],
  ageMonths: number,
  week: Week,
): Menu {
  const meals = mealsForAge(ageMonths); // los huecos sin receta (menú armado a mano) cuentan como faltantes
  const byCode = new Map(entries.map((e) => [e.recipe.code, toCandidate(e)]));
  return {
    weekStart: week.weekStart,
    today: week.today,
    ageMonths,
    meals,
    days: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
      day,
      meals: meals.flatMap((meal) => {
        const e = entries.find((x) => x.day === day && x.meal === meal);
        return e ? [{ meal, recipe: e.recipe }] : [];
      }),
    })),
    checks: summarize(toPlan(entries), byCode, meals),
  };
}

async function load(deps: Deps, householdId: string) {
  const baby = await deps.baby.get(householdId);
  if (!baby) return null;
  const now = deps.now();
  const ageMonths = deps.babyAge(baby, now);
  // La semana y el «hoy» se cuentan en la zona horaria de la familia, no en la del servidor.
  const household = await deps.household(householdId);
  const week = weekOf(now, household.timeZone);
  const entries = await deps.menu.getWeek(householdId, week.weekStart);
  const avoid = Object.entries(baby.allergens)
    .filter(([, status]) => status === "avoid")
    .map(([slug]) => slug);
  return { baby, now, week, household, ageMonths, entries, avoid };
}

async function context(
  deps: Deps,
  householdId: string,
  ageMonths: number,
  avoid: string[],
  known: Candidate[] = [],
): Promise<Ctx | null> {
  const meals = mealsForAge(ageMonths);
  const candidates = await deps.menu.candidates(ageMonths, avoid, householdId);
  const pools = Object.fromEntries(
    MENU_MEALS.map((m) => [m, candidates.filter((c) => c.meal === m)]),
  ) as Pools;
  if (meals.some((m) => pools[m].length === 0)) return null;
  return { pools, meals, random: deps.random, known };
}

export async function getMenu(deps: Deps, householdId: string) {
  const state = await load(deps, householdId);
  if (!state || state.entries.length === 0) return { menu: null };
  return { menu: buildMenu(state.entries, state.ageMonths, state.week) };
}

export async function generateMenu(
  deps: Deps,
  householdId: string,
): Promise<{ ok: true; menu: Menu } | Fail> {
  const state = await load(deps, householdId);
  if (!state) return fail("baby_required");
  const ctx = await context(deps, householdId, state.ageMonths, state.avoid);
  const plan = ctx && generateWeek(ctx);
  if (!plan) return fail("not_enough_recipes");

  await deps.menu.replaceWeek(householdId, state.week.weekStart, toRefs(plan));
  const entries = await deps.menu.getWeek(householdId, state.week.weekStart);
  return { ok: true, menu: buildMenu(entries, state.ageMonths, state.week) };
}

// Cambia una comida o un día. `previous` permite deshacer; vacío si no había alternativa.
export async function regenerate(
  deps: Deps,
  householdId: string,
  input: RegenerateInput,
): Promise<{ ok: true; menu: Menu; previous: EntryRef[] } | Fail> {
  const state = await load(deps, householdId);
  if (!state) return fail("baby_required");
  if (state.entries.length === 0) return fail("no_menu");
  const plan = toPlan(state.entries);
  if (input.scope === "meal" && !plan[slotKey(input.day, input.meal)])
    return fail("invalid_slot");

  const ctx = await context(
    deps,
    householdId,
    state.ageMonths,
    state.avoid,
    state.entries.map(toCandidate),
  );
  if (!ctx) return fail("not_enough_recipes");
  const result =
    input.scope === "meal"
      ? regenerateMeal(ctx, plan, input.day, input.meal)
      : regenerateDay(ctx, plan, input.day);

  const weekStart = state.week.weekStart;
  const changed = toRefs(result.plan).filter(
    (r) => plan[slotKey(r.day, r.meal)] !== r.recipe,
  );
  // Los huecos que estaban vacíos no se pueden deshacer (no hay receta anterior que restaurar).
  const previous = changed.flatMap((r) => {
    const recipe = plan[slotKey(r.day, r.meal)];
    return recipe ? [{ ...r, recipe }] : [];
  });
  if (changed.length)
    await deps.menu.setEntries(householdId, weekStart, changed);

  const entries = changed.length
    ? await deps.menu.getWeek(householdId, weekStart)
    : state.entries;
  return {
    ok: true,
    menu: buildMenu(entries, state.ageMonths, state.week),
    previous,
  };
}

// Pone recetas concretas en huecos del menú (elegir a mano, deshacer, «Poner en el menú»); también arma un menú
// desde cero. No filtra por alérgenos: la familia puede elegir «Poner en el menú igual».
export async function setEntries(
  deps: Deps,
  householdId: string,
  input: EntriesInput,
): Promise<{ ok: true; menu: Menu } | Fail> {
  const state = await load(deps, householdId);
  if (!state) return fail("baby_required");

  const entries = input.entries.map((e) => ({
    ...e,
    recipe: e.recipe.toUpperCase(),
  }));
  const slots = mealsForAge(state.ageMonths);
  if (entries.some((e) => !slots.includes(e.meal))) return fail("invalid_slot");
  const meals = await deps.menu.recipeMeals(entries.map((e) => e.recipe));
  if (entries.some((e) => meals.get(e.recipe) !== e.meal))
    return fail("invalid_recipe");

  const weekStart = state.week.weekStart;
  await deps.menu.setEntries(householdId, weekStart, entries);
  const updated = await deps.menu.getWeek(householdId, weekStart);
  return { ok: true, menu: buildMenu(updated, state.ageMonths, state.week) };
}

// «Hoy»: las comidas del día con su hora en la zona de la familia (pantalla /hoy y app móvil).
export async function getToday(deps: Deps, householdId: string) {
  const state = await load(deps, householdId);
  if (!state) return { today: null };
  return {
    today: todayPlan({
      entries: state.entries,
      week: state.week,
      ageMonths: state.ageMonths,
      ...state.household,
    }),
  };
}
