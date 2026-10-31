import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  allergen,
  babyAllergen,
  babyProfile,
  household,
  householdMember,
} from "@/db/schema";
import {
  DEFAULT_MEAL_TIMES,
  type HouseholdSettings,
  type MealTimes,
  type SettingsInput,
} from "./households.schemas";
import type { FamilyExtras } from "./households.service";

const UNIQUE_VIOLATION = "23505";
const isUniqueViolation = (e: unknown) =>
  (e as { cause?: { code?: string } })?.cause?.code === UNIQUE_VIOLATION ||
  (e as { code?: string })?.code === UNIQUE_VIOLATION;

export const householdsRepository = {
  findByLookup: async (lookup: string) =>
    (
      await getDb()
        .select({ id: household.id, name: household.name })
        .from(household)
        .where(eq(household.accessCodeLookup, lookup))
        .limit(1)
    )[0],
  findById: async (id: string) =>
    (
      await getDb()
        .select({
          id: household.id,
          name: household.name,
          accessCodeEnc: household.accessCodeEnc,
        })
        .from(household)
        .where(eq(household.id, id))
        .limit(1)
    )[0],
  count: () => getDb().$count(household),
  // undefined si el índice único del código ya existía (colisión)
  insert: async (row: {
    name: string;
    accessCodeLookup: string;
    accessCodeEnc: string;
  }) =>
    (
      await getDb()
        .insert(household)
        .values(row)
        .onConflictDoNothing({ target: household.accessCodeLookup })
        .returning({ id: household.id })
    )[0],
  // Familia + primer cuidador + bebé (alta autoservicio). undefined ante colisión del código.
  insertFamily: async (
    row: { name: string; accessCodeLookup: string; accessCodeEnc: string },
    extras: FamilyExtras,
  ) =>
    getDb().transaction(async (tx) => {
      const [created] = await tx
        .insert(household)
        .values({
          ...row,
          timeZone: extras.timeZone,
          country: extras.country,
          mealTimes: extras.mealTimes,
        })
        .onConflictDoNothing({ target: household.accessCodeLookup })
        .returning({ id: household.id });
      if (!created) return undefined;
      const [member] = await tx
        .insert(householdMember)
        .values({ householdId: created.id, label: extras.label })
        .returning({ id: householdMember.id });
      const { baby } = extras;
      await tx.insert(babyProfile).values({
        householdId: created.id,
        nickname: baby.nickname || null,
        birthMonth: baby.birthMonth,
        birthYear: baby.birthYear,
      });
      if (baby.introduced.length) {
        const ids = await tx
          .select({ id: allergen.id })
          .from(allergen)
          .where(inArray(allergen.slug, baby.introduced));
        await tx.insert(babyAllergen).values(
          ids.map((a) => ({
            householdId: created.id,
            allergenId: a.id,
            status: "introduced" as const,
          })),
        );
      }
      return { id: created.id, memberId: member!.id };
    }),
  // false si el código nuevo choca con otro (se reintenta con otro código).
  updateCode: async (
    id: string,
    row: { accessCodeLookup: string; accessCodeEnc: string },
  ) => {
    try {
      await getDb().update(household).set(row).where(eq(household.id, id));
      return true;
    } catch (e) {
      if (isUniqueViolation(e)) return false;
      throw e;
    }
  },
  settings: async (id: string): Promise<HouseholdSettings | undefined> => {
    const [row] = await getDb()
      .select({
        name: household.name,
        timeZone: household.timeZone,
        country: household.country,
        mealTimes: household.mealTimes,
      })
      .from(household)
      .where(eq(household.id, id));
    if (!row) return undefined;
    return {
      ...row,
      country: row.country as HouseholdSettings["country"],
      // Familias anteriores a los horarios: valores por defecto.
      mealTimes: { ...DEFAULT_MEAL_TIMES, ...(row.mealTimes as MealTimes) },
    };
  },
  saveSettings: async (id: string, input: SettingsInput) => {
    await getDb().update(household).set(input).where(eq(household.id, id));
  },
  // Como mucho una escritura por día y familia: evita una escritura en cada visita.
  touch: async (id: string) => {
    await getDb()
      .update(household)
      .set({ lastSeenAt: sql`now()` })
      .where(
        and(
          eq(household.id, id),
          lt(household.lastSeenAt, sql`now() - interval '1 day'`),
        ),
      );
  },
  countInactive: (cutoff: Date) =>
    getDb().$count(household, lt(household.lastSeenAt, cutoff)),
  deleteInactive: async (cutoff: Date) =>
    (
      await getDb()
        .delete(household)
        .where(lt(household.lastSeenAt, cutoff))
        .returning({ id: household.id })
    ).length,
};
