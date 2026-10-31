import { describe, expect, it } from "vitest";
import { DEFAULT_MEAL_TIMES } from "@/modules/households/households.schemas";
import type { RecipeListItem } from "@/modules/recipes/recipes.schemas";
import type { MenuMeal, StoredEntry } from "./menu.schemas";
import { todayPlan } from "./menu.today";

const recipe = (code: string, meal: MenuMeal): RecipeListItem => ({
  code,
  title: `Receta ${code}`,
  mealType: meal,
  minAgeMonths: 6,
  isIronSource: false,
  ironNote: null,
  thumbUrl: null,
  missingFoods: [],
  allergens: [],
});
const entry = (day: number, meal: MenuMeal, code: string): StoredEntry => ({
  day,
  meal,
  recipe: recipe(code, meal),
  isFish: false,
  isMaxOnce: false,
});

describe("comidas de hoy", () => {
  const entries = [
    entry(3, "desayuno", "D1"),
    entry(3, "almuerzo", "A1"),
    entry(4, "desayuno", "D2"),
  ];

  it("da la fecha civil del día, la hora local y el instante exacto, ordenadas por hora", () => {
    const t = todayPlan({
      entries,
      week: { weekStart: "2026-10-26", today: 3 },
      ageMonths: 7,
      timeZone: "America/Caracas",
      mealTimes: DEFAULT_MEAL_TIMES,
    });
    expect(t.date).toBe("2026-10-28");
    expect(t.meals.map((m) => [m.meal, m.time, m.startsAt])).toEqual([
      ["desayuno", "07:30", "2026-10-28T11:30:00.000Z"],
      ["almuerzo", "12:00", "2026-10-28T16:00:00.000Z"],
      ["merienda", "15:30", "2026-10-28T19:30:00.000Z"],
    ]);
    expect(t.meals[0]!.recipe?.code).toBe("D1");
    expect(t.meals[2]!.recipe).toBeNull(); // hueco sin receta
  });

  it("la cena aparece desde los 8 meses y el orden sigue los horarios de la familia", () => {
    const t = todayPlan({
      entries,
      week: { weekStart: "2026-10-26", today: 3 },
      ageMonths: 9,
      timeZone: "America/Caracas",
      mealTimes: { ...DEFAULT_MEAL_TIMES, merienda: "11:00" },
    });
    expect(t.meals.map((m) => m.meal)).toEqual([
      "desayuno",
      "merienda",
      "almuerzo",
      "cena",
    ]);
  });

  it("en Santiago (con horario de verano) el mismo almuerzo cambia de instante UTC", () => {
    const at = (weekStart: string, today: number) =>
      todayPlan({
        entries: [],
        week: { weekStart, today },
        ageMonths: 7,
        timeZone: "America/Santiago",
        mealTimes: DEFAULT_MEAL_TIMES,
      }).meals.find((m) => m.meal === "almuerzo")!.startsAt;
    expect(at("2026-08-31", 6)).toBe("2026-09-05T16:00:00.000Z"); // sábado, UTC-4
    expect(at("2026-09-07", 1)).toBe("2026-09-07T15:00:00.000Z"); // lunes, UTC-3
  });
});
