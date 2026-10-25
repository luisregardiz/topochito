import {
  DAYS,
  MIN_IRON_PER_DAY,
  type Candidate,
  type Plan,
  slotKey,
} from "./menu.generator";
import type { MenuCheck, MenuMeal } from "./menu.schemas";

const times = (n: number) => `${n} ${n === 1 ? "vez" : "veces"}`;

// Resumen de la semana: dice lo que realmente cumple el menú, sin maquillar.
export function summarize(
  plan: Plan,
  byCode: Map<string, Candidate>,
  meals: MenuMeal[],
): MenuCheck[] {
  const ironDays = DAYS.filter(
    (d) =>
      meals.filter((m) => byCode.get(plan[slotKey(d, m)] ?? "")?.isIron)
        .length >= MIN_IRON_PER_DAY,
  ).length;
  const recipes = Object.values(plan).map((code) => byCode.get(code));
  const fish = recipes.filter((c) => c?.isFish).length;
  const liver = recipes.filter((c) => c?.isMaxOnce).length;

  return [
    {
      key: "iron",
      ok: ironDays === DAYS.length,
      title: "Hierro",
      detail:
        ironDays === DAYS.length
          ? "Todos los días tienen 2 comidas o más con hierro."
          : `${ironDays} de 7 días tienen 2 comidas o más con hierro.`,
      short:
        ironDays === DAYS.length ? "2 o más al día" : `${ironDays} de 7 días`,
    },
    {
      key: "fish",
      ok: fish >= 2,
      title: "Pescado",
      detail: `${times(fish)} esta semana. Lo recomendado son unas 2.`,
      short: times(fish),
    },
    {
      key: "liver",
      ok: liver <= 1,
      title: "Hígado",
      detail: `${times(liver)}. Máximo 1 vez por semana.`,
      short: `${liver} de 1 máx.`,
    },
  ];
}
