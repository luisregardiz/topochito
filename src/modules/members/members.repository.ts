import "server-only";
import { and, asc, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { household, householdInvite, householdMember } from "@/db/schema";

export const membersRepository = {
  find: async (id: string) =>
    (
      await getDb()
        .select({
          id: householdMember.id,
          householdId: householdMember.householdId,
          revokedAt: householdMember.revokedAt,
        })
        .from(householdMember)
        .where(eq(householdMember.id, id))
        .limit(1)
    )[0],

  create: async (householdId: string, label: string) =>
    (
      await getDb()
        .insert(householdMember)
        .values({ householdId, label })
        .returning({ id: householdMember.id })
    )[0]!.id,

  // Idempotente (cookies viejas): false si la familia ya no existe.
  ensure: async (id: string, householdId: string, label: string) => {
    const [exists] = await getDb()
      .select({ id: household.id })
      .from(household)
      .where(eq(household.id, householdId));
    if (!exists) return false;
    await getDb()
      .insert(householdMember)
      .values({ id, householdId, label })
      .onConflictDoNothing({ target: householdMember.id });
    return true;
  },

  // Como mucho una escritura por hora y cuidador.
  touch: async (id: string) => {
    await getDb()
      .update(householdMember)
      .set({ lastSeenAt: sql`now()` })
      .where(
        and(
          eq(householdMember.id, id),
          lt(householdMember.lastSeenAt, sql`now() - interval '1 hour'`),
        ),
      );
  },

  list: (householdId: string) =>
    getDb()
      .select({
        id: householdMember.id,
        label: householdMember.label,
        lastSeenAt: householdMember.lastSeenAt,
        createdAt: householdMember.createdAt,
      })
      .from(householdMember)
      .where(
        and(
          eq(householdMember.householdId, householdId),
          isNull(householdMember.revokedAt),
        ),
      )
      .orderBy(desc(householdMember.lastSeenAt)),

  revoke: async (householdId: string, memberId: string) =>
    (
      await getDb()
        .update(householdMember)
        .set({ revokedAt: sql`now()` })
        .where(
          and(
            eq(householdMember.id, memberId),
            eq(householdMember.householdId, householdId),
            isNull(householdMember.revokedAt),
          ),
        )
        .returning({ id: householdMember.id })
    ).length > 0,

  // --- invitaciones ---
  findInvite: async (tokenHash: string) =>
    (
      await getDb()
        .select({
          householdId: householdInvite.householdId,
          householdName: household.name,
          tokenHash: householdInvite.tokenHash,
          expiresAt: householdInvite.expiresAt,
          revokedAt: householdInvite.revokedAt,
        })
        .from(householdInvite)
        .innerJoin(household, eq(household.id, householdInvite.householdId))
        .where(eq(householdInvite.tokenHash, tokenHash))
        .limit(1)
    )[0],

  createInvite: async (
    householdId: string,
    tokenHash: string,
    expiresAt: Date,
  ) =>
    (
      await getDb()
        .insert(householdInvite)
        .values({ householdId, tokenHash, expiresAt })
        .returning({ id: householdInvite.id })
    )[0]!.id,

  activeInvites: (householdId: string) =>
    getDb()
      .select({ id: householdInvite.id, expiresAt: householdInvite.expiresAt })
      .from(householdInvite)
      .where(
        and(
          eq(householdInvite.householdId, householdId),
          isNull(householdInvite.revokedAt),
          gt(householdInvite.expiresAt, sql`now()`),
        ),
      )
      .orderBy(asc(householdInvite.expiresAt)),

  revokeInvite: async (householdId: string, inviteId: string) =>
    (
      await getDb()
        .update(householdInvite)
        .set({ revokedAt: sql`now()` })
        .where(
          and(
            eq(householdInvite.id, inviteId),
            eq(householdInvite.householdId, householdId),
            isNull(householdInvite.revokedAt),
          ),
        )
        .returning({ id: householdInvite.id })
    ).length > 0,
};
