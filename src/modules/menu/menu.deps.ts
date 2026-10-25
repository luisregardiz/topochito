import "server-only";
import { HttpError } from "@/lib/http";
import { ageInMonths } from "@/modules/babies/baby.age";
import { babyRepository } from "@/modules/babies/baby.repository";
import { menuRepository } from "./menu.repository";
import type { Deps, MenuError } from "./menu.service";

export const menuDeps = (): Deps => ({
  menu: menuRepository,
  baby: babyRepository,
  babyAge: (b, now) =>
    ageInMonths({ month: b.birthMonth, year: b.birthYear }, now),
  now: () => new Date(),
  random: Math.random,
});

const ERRORS: Record<MenuError, [status: number, message: string]> = {
  baby_required: [422, "Indica la fecha de nacimiento de tu bebé"],
  not_enough_recipes: [
    422,
    "Todavía no hay recetas suficientes para esa edad y esos alérgenos",
  ],
  no_menu: [409, "Todavía no hay menú para esta semana"],
  invalid_recipe: [422, "Esa receta no es de esa comida"],
  invalid_slot: [422, "Esa comida no está en el menú de tu bebé"],
};

export function menuError(error: MenuError): never {
  const [status, message] = ERRORS[error];
  throw new HttpError(status, error, message);
}
