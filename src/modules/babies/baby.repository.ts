import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { allergen, babyAllergen, babyProfile } from "@/db/schema";
import type { AllergenStatus, BabyInput } from "./baby.schemas";

export const babyRepository = {
  get: async (householdId: string) => {
    const db = getDb();
    const [profile] = await db
      .select()
      .from(babyProfile)
      .where(eq(babyProfile.householdId, householdId));
    if (!profile) return null;
    const rows = await db
      .select({ slug: allergen.slug, status: babyAllergen.status })
      .from(babyAllergen)
      .innerJoin(allergen, eq(allergen.id, babyAllergen.allergenId))
      .where(eq(babyAllergen.householdId, householdId))
      .orderBy(asc(allergen.id));
    return {
      nickname: profile.nickname,
      birthMonth: profile.birthMonth,
      birthYear: profile.birthYear,
      allergens: Object.fromEntries(
        rows.map((r) => [r.slug, r.status]),
      ) as Record<string, AllergenStatus>,
    };
  },

  allergenSlugs: async () =>
    (await getDb().select({ slug: allergen.slug }).from(allergen)).map(
      (a) => a.slug,
    ),

  save: async (householdId: string, baby: BabyInput) => {
    await getDb().transaction(async (tx) => {
      await tx
        .insert(babyProfile)
        .values({
          householdId,
          nickname: baby.nickname || null,
          birthMonth: baby.birthMonth,
          birthYear: baby.birthYear,
        })
        .onConflictDoUpdate({
          target: babyProfile.householdId,
          set: {
            nickname: baby.nickname || null,
            birthMonth: baby.birthMonth,
            birthYear: baby.birthYear,
            updatedAt: new Date(),
          },
        });
      await tx
        .delete(babyAllergen)
        .where(eq(babyAllergen.householdId, householdId));
      const entries = Object.entries(baby.allergens);
      if (entries.length === 0) return;
      const ids = new Map(
        (
          await tx
            .select({ id: allergen.id, slug: allergen.slug })
            .from(allergen)
        ).map((a) => [a.slug, a.id]),
      );
      await tx.insert(babyAllergen).values(
        entries.map(([slug, status]) => ({
          householdId,
          allergenId: ids.get(slug)!,
          status,
        })),
      );
    });
  },
};
