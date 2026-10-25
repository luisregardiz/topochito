import "server-only";
import { getDb } from "@/db/client";
import { household } from "@/db/schema";

export const householdsRepository = {
  listAll: () =>
    getDb()
      .select({
        id: household.id,
        name: household.name,
        accessCodeHash: household.accessCodeHash,
      })
      .from(household),
};
