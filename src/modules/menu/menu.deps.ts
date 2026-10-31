import "server-only";
import { HttpError } from "@/lib/http";
import { ageInMonths, APP_TIME_ZONE } from "@/modules/babies/baby.age";
import { householdsRepository } from "@/modules/households/households.repository";
import { DEFAULT_MEAL_TIMES } from "@/modules/households/households.schemas";
import { babyRepository } from "@/modules/babies/baby.repository";
import { menuRepository } from "./menu.repository";
import type { Deps, MenuError } from "./menu.service";

export const menuDeps = (): Deps => ({
  menu: menuRepository,
  baby: babyRepository,
  babyAge: (b, now) =>
    ageInMonths({ month: b.birthMonth, year: b.birthYear }, now),
  household: async (householdId) => {
    const s = await householdsRepository.settings(householdId);
    return {
      timeZone: s?.timeZone ?? APP_TIME_ZONE,
      mealTimes: s?.mealTimes ?? DEFAULT_MEAL_TIMES,
    };
  },
  now: () => new Date(),
  random: Math.random,
});

const ERRORS: Record<MenuError, [status: number, message: string]> = {
  baby_required: [422, "Indica la fecha de nacimiento de tu bebé"],
  not_enough_recipes: [
    422,
    "No alcanzan las recetas para armar el menú con la edad, los alérgenos y los alimentos que marcaste como que no consigues",
  ],
  no_menu: [409, "Todavía no hay menú para esta semana"],
  invalid_recipe: [422, "Esa receta no es de esa comida"],
  invalid_slot: [422, "Esa comida no está en el menú de tu bebé"],
};

export function menuError(error: MenuError): never {
  const [status, message] = ERRORS[error];
  throw new HttpError(status, error, message);
}
