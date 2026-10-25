import "server-only";
import { eq } from "drizzle-orm";
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
};
