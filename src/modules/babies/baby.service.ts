import { ageInMonths } from "./baby.age";
import type { AllergenStatus, BabyInput, BabyProfile } from "./baby.schemas";

export const MAX_BABY_AGE_MONTHS = 36;

type Stored = {
  nickname: string | null;
  birthMonth: number;
  birthYear: number;
  allergens: Record<string, AllergenStatus>;
};

type Repo = {
  get: (householdId: string) => Promise<Stored | null>;
  allergenSlugs: () => Promise<string[]>;
  save: (householdId: string, baby: BabyInput) => Promise<void>;
};

export const toProfile = (stored: Stored, now: Date): BabyProfile => ({
  ...stored,
  ageMonths: ageInMonths(
    { month: stored.birthMonth, year: stored.birthYear },
    now,
  ),
});

export async function getBaby(
  repo: Pick<Repo, "get">,
  householdId: string,
  now: Date,
) {
  const stored = await repo.get(householdId);
  return stored ? toProfile(stored, now) : null;
}

// Fecha de nacimiento aceptable: ni futura ni de un niño mayor de 3 años.
export function checkBirth(
  birth: { birthMonth: number; birthYear: number },
  now: Date,
) {
  const age = ageInMonths(
    { month: birth.birthMonth, year: birth.birthYear },
    now,
  );
  if (age < 0) return "future_date" as const;
  if (age > MAX_BABY_AGE_MONTHS) return "too_old" as const;
  return null;
}

export type SaveBabyResult =
  | { ok: true; baby: BabyProfile }
  | { ok: false; reason: "future_date" | "too_old" | "unknown_allergen" };

export async function saveBaby(
  repo: Repo,
  householdId: string,
  input: BabyInput,
  now: Date,
): Promise<SaveBabyResult> {
  const invalid = checkBirth(input, now);
  if (invalid) return { ok: false, reason: invalid };

  const known = new Set(await repo.allergenSlugs());
  if (Object.keys(input.allergens).some((slug) => !known.has(slug))) {
    return { ok: false, reason: "unknown_allergen" };
  }

  await repo.save(householdId, input);
  return {
    ok: true,
    baby: toProfile({ ...input, nickname: input.nickname || null }, now),
  };
}
