import { primaryKey, smallint, uuid } from "drizzle-orm/pg-core";
import { recetario } from "./_schema";
import { food } from "./catalog";
import { household } from "./households";

// Despensa de la familia, guardada al revés: solo los alimentos que NO consigue. Así los alimentos nuevos
// del catálogo (recetas nuevas) quedan disponibles por defecto y no esconden recetas por sorpresa.
export const householdUnavailableFood = recetario.table(
  "household_unavailable_food",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    foodId: smallint("food_id")
      .notNull()
      .references(() => food.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.foodId] })],
);
