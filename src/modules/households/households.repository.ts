import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { household } from "@/db/schema";

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
