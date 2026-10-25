import type { MenuMeal } from "./menu.schemas";

export type Candidate = {
  code: string;
  meal: MenuMeal;
  isIron: boolean;
  isFish: boolean;
  isMaxOnce: boolean; // «Máx. 1 vez por semana» (hígado)
};
export type Pools = Record<MenuMeal, Candidate[]>;
export type Plan = Record<string, string>; // "día:comida" → código de receta

export const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const FISH_PER_WEEK = 2;
export const MAX_ONCE_PER_WEEK = 1;
export const MIN_IRON_PER_DAY = 2;
const ATTEMPTS = 40;

export const slotKey = (day: number, meal: MenuMeal) => `${day}:${meal}`;

// La cena aparece desde los 8 meses.
export const mealsForAge = (ageMonths: number): MenuMeal[] =>
  ageMonths >= 8
    ? ["desayuno", "almuerzo", "merienda", "cena"]
    : ["desayuno", "almuerzo", "merienda"];

export type Ctx = {
  pools: Pools;
  meals: MenuMeal[];
  random: () => number;
  known?: Candidate[]; // recetas ya en el menú que quizá ya no están en los pools (p. ej. cambió el perfil)
  avoid?: Set<string>; // recetas que, si hay alternativa, no deben volver a salir (al rehacer un día)
};

const pick = <T>(xs: readonly T[], random: () => number) =>
  xs[Math.floor(random() * xs.length)]!;

function shuffle<T>(xs: readonly T[], random: () => number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function indexOf(ctx: Ctx) {
  const byCode = new Map<string, Candidate>();
  for (const c of [...Object.values(ctx.pools).flat(), ...(ctx.known ?? [])])
    byCode.set(c.code, c);
  return byCode;
}

// Cuenta pescado y «máx. 1 vez» en el plan, sin contar `skip` (el hueco que se va a rellenar).
function counts(plan: Plan, byCode: Map<string, Candidate>, skip?: string) {
  let fish = 0;
  let maxOnce = 0;
  for (const [k, code] of Object.entries(plan)) {
    if (k === skip) continue;
    const c = byCode.get(code);
    if (c?.isFish) fish++;
    if (c?.isMaxOnce) maxOnce++;
  }
  return { fish, maxOnce };
}

const ironOfDay = (
  plan: Plan,
  byCode: Map<string, Candidate>,
  ctx: Ctx,
  day: number,
) =>
  ctx.meals.filter((m) => byCode.get(plan[slotKey(day, m)] ?? "")?.isIron)
    .length;

// Elige entre `options` prefiriendo lo que aún no está en la semana y no está en `ctx.avoid`;
// si no queda nada así, relaja primero lo uno y luego lo otro, y al final permite repetir.
function choose(options: Candidate[], plan: Plan, ctx: Ctx) {
  const used = new Set(Object.values(plan));
  const avoid = ctx.avoid ?? new Set<string>();
  const tiers = [
    options.filter((c) => !used.has(c.code) && !avoid.has(c.code)),
    options.filter((c) => !avoid.has(c.code)),
    options.filter((c) => !used.has(c.code)),
    options,
  ];
  return pick(
    tiers.find((t) => t.length > 0)!,
    ctx.random,
  );
}

function fillDay(
  ctx: Ctx,
  byCode: Map<string, Candidate>,
  plan: Plan,
  day: number,
) {
  for (const meal of ctx.meals) {
    const k = slotKey(day, meal);
    if (plan[k]) continue;
    const st = counts(plan, byCode);
    const yesterday = plan[slotKey(day - 1, meal)];
    const allowed = ctx.pools[meal].filter(
      (c) =>
        !c.isFish &&
        !(c.isMaxOnce && st.maxOnce >= MAX_ONCE_PER_WEEK) &&
        c.code !== yesterday,
    );
    plan[k] = choose(
      allowed.length ? allowed : ctx.pools[meal],
      plan,
      ctx,
    ).code;
  }
}

// Si el día no llega a MIN_IRON_PER_DAY comidas con hierro, cambia comidas sin hierro por otras con hierro.
function fixIron(
  ctx: Ctx,
  byCode: Map<string, Candidate>,
  plan: Plan,
  day: number,
) {
  for (const meal of shuffle(ctx.meals, ctx.random)) {
    if (ironOfDay(plan, byCode, ctx, day) >= MIN_IRON_PER_DAY) return;
    const k = slotKey(day, meal);
    const current = byCode.get(plan[k]!);
    if (!current || current.isIron || current.isFish) continue;
    const st = counts(plan, byCode, k);
    const options = ctx.pools[meal].filter(
      (c) =>
        c.isIron &&
        !c.isFish &&
        !(c.isMaxOnce && st.maxOnce >= MAX_ONCE_PER_WEEK),
    );
    if (options.length) plan[k] = choose(options, plan, ctx).code;
  }
}

function placeFish(
  ctx: Ctx,
  byCode: Map<string, Candidate>,
  plan: Plan,
  days: number[],
) {
  const meals = (["almuerzo", "cena"] as const).filter((m) =>
    ctx.meals.includes(m),
  );
  for (const day of days) {
    const options = meals.flatMap((m) => ctx.pools[m].filter((c) => c.isFish));
    if (!options.length) return;
    const c = choose(options, plan, ctx);
    plan[slotKey(day, c.meal)] = c.code;
    byCode.set(c.code, c);
  }
}

// Dos días de pescado, separados si se puede.
function fishDays(random: () => number, wanted = FISH_PER_WEEK) {
  const days = shuffle(DAYS, random);
  const first = days[0]!;
  const rest = days.slice(1);
  const second = rest.find((d) => Math.abs(d - first) >= 2) ?? rest[0]!;
  return [first, second].slice(0, wanted);
}

function score(plan: Plan, byCode: Map<string, Candidate>, ctx: Ctx) {
  const ironDays = DAYS.filter(
    (d) => ironOfDay(plan, byCode, ctx, d) >= MIN_IRON_PER_DAY,
  ).length;
  const repeats = Object.keys(plan).length - new Set(Object.values(plan)).size;
  return ironDays * 100 - repeats;
}

// Menú de 7 días. null si falta alguna comida con recetas disponibles.
export function generateWeek(ctx: Ctx): Plan | null {
  if (ctx.meals.some((m) => ctx.pools[m].length === 0)) return null;
  const byCode = indexOf(ctx);
  let best: Plan | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < ATTEMPTS; i++) {
    const plan: Plan = {};
    placeFish(ctx, byCode, plan, fishDays(ctx.random));
    for (const day of DAYS) {
      fillDay(ctx, byCode, plan, day);
      fixIron(ctx, byCode, plan, day);
    }
    const s = score(plan, byCode, ctx);
    if (s > bestScore) [best, bestScore] = [plan, s];
  }
  return best;
}

// Cambia una comida por otra distinta. `changed` es false si no hay alternativa.
export function regenerateMeal(
  ctx: Ctx,
  plan: Plan,
  day: number,
  meal: MenuMeal,
) {
  const byCode = indexOf(ctx);
  const k = slotKey(day, meal);
  const current = plan[k];
  const st = counts(plan, byCode, k);
  const dayIronWithout = ctx.meals.filter(
    (m) => m !== meal && byCode.get(plan[slotKey(day, m)] ?? "")?.isIron,
  ).length;

  const allowed = ctx.pools[meal].filter(
    (c) =>
      c.code !== current &&
      !(c.isFish && st.fish >= FISH_PER_WEEK) &&
      !(c.isMaxOnce && st.maxOnce >= MAX_ONCE_PER_WEEK),
  );
  if (!allowed.length) return { plan, changed: false };

  // Si el día se queda corto de hierro, solo se acepta una receta con hierro (cuando existe).
  const keepsIron = allowed.filter(
    (c) => dayIronWithout + (c.isIron ? 1 : 0) >= MIN_IRON_PER_DAY,
  );
  const next = {
    ...plan,
    [k]: choose(keepsIron.length ? keepsIron : allowed, plan, ctx).code,
  };
  return { plan: next, changed: true };
}

// Rehace los huecos de un día; si ese día tenía pescado, mantiene uno.
// Evita las recetas que ese día tenía (cuando hay alternativa): «Cambiar este día» debe verse como un cambio.
export function regenerateDay(ctx: Ctx, plan: Plan, day: number) {
  const byCode = indexOf(ctx);
  const next: Plan = { ...plan };
  const hadFish = ctx.meals.some(
    (m) => byCode.get(plan[slotKey(day, m)] ?? "")?.isFish,
  );
  const previous = new Set(
    ctx.meals.map((m) => plan[slotKey(day, m)]).filter((c): c is string => !!c),
  );
  for (const m of ctx.meals) delete next[slotKey(day, m)];

  const fresh: Ctx = { ...ctx, avoid: previous };
  if (hadFish && counts(next, byCode).fish < FISH_PER_WEEK)
    placeFish(fresh, byCode, next, [day]);
  fillDay(fresh, byCode, next, day);
  fixIron(fresh, byCode, next, day);
  return {
    plan: next,
    changed: ctx.meals.some(
      (m) => next[slotKey(day, m)] !== plan[slotKey(day, m)],
    ),
  };
}
