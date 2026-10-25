import { z } from "zod";

export const accessInput = z.object({ code: z.string().min(1).max(64) });

export const createHouseholdInput = z.object({
  name: z.string().trim().min(1).max(80),
});
