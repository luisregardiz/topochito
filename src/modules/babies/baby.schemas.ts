import { z } from "zod";

export const ALLERGEN_STATUSES = ["introduced", "avoid"] as const;
export type AllergenStatus = (typeof ALLERGEN_STATUSES)[number];

// Solo viajan los alérgenos con estado: lo que falta es «No introducido».
export const babyInput = z.object({
  nickname: z.string().trim().max(30).optional(), // apodo opcional, solo para la interfaz
  birthMonth: z.number().int().min(1).max(12),
  birthYear: z.number().int().min(2000).max(2100),
  allergens: z.record(
    z.string().regex(/^[a-z0-9_-]{1,40}$/),
    z.enum(ALLERGEN_STATUSES),
  ),
});
export type BabyInput = z.infer<typeof babyInput>;

export type BabyProfile = {
  nickname: string | null;
  birthMonth: number;
  birthYear: number;
  ageMonths: number;
  allergens: Record<string, AllergenStatus>;
};
