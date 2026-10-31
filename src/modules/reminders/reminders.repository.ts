import "server-only";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  babyProfile,
  household,
  householdMember,
  pushSubscription,
  reminderDelivery,
} from "@/db/schema";

export const remindersRepository = {
  // --- calendario ---
  findByCalendarToken: async (hash: string) =>
    (
      await getDb()
        .select({
          id: household.id,
          tokenHash: household.calendarTokenHash,
          timeZone: household.timeZone,
          alarmMinutes: household.calendarAlarmMinutes,
          babyNickname: babyProfile.nickname,
        })
        .from(household)
        .leftJoin(babyProfile, eq(babyProfile.householdId, household.id))
        .where(eq(household.calendarTokenHash, hash))
        .limit(1)
    ).map((r) => ({ ...r, tokenHash: r.tokenHash ?? "" }))[0],

  calendarStatus: async (householdId: string) => {
    const [row] = await getDb()
      .select({
        hash: household.calendarTokenHash,
        alarmMinutes: household.calendarAlarmMinutes,
      })
      .from(household)
      .where(eq(household.id, householdId));
    return { active: !!row?.hash, alarmMinutes: row?.alarmMinutes ?? 0 };
  },
  setCalendarToken: async (householdId: string, hash: string) => {
    await getDb()
      .update(household)
      .set({ calendarTokenHash: hash })
      .where(eq(household.id, householdId));
  },
  setCalendarAlarm: async (householdId: string, minutes: number) => {
    await getDb()
      .update(household)
      .set({ calendarAlarmMinutes: minutes })
      .where(eq(household.id, householdId));
  },

  // --- push ---
  upsertSubscription: async (
    memberId: string,
    sub: { endpoint: string; p256dh: string; auth: string },
  ) => {
    // Un navegador = un endpoint: si cambia de cuidador (otra sesión), la suscripción pasa al nuevo.
    await getDb()
      .insert(pushSubscription)
      .values({ memberId, ...sub })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: { memberId, p256dh: sub.p256dh, auth: sub.auth },
      });
  },
  removeSubscription: async (memberId: string, endpoint: string) => {
    await getDb()
      .delete(pushSubscription)
      .where(
        and(
          eq(pushSubscription.memberId, memberId),
          eq(pushSubscription.endpoint, endpoint),
        ),
      );
  },
  hasSubscription: async (memberId: string, endpoint: string) =>
    (
      await getDb()
        .select({ id: pushSubscription.id })
        .from(pushSubscription)
        .where(
          and(
            eq(pushSubscription.memberId, memberId),
            eq(pushSubscription.endpoint, endpoint),
          ),
        )
        .limit(1)
    ).length > 0,
  leadMinutes: async (memberId: string) =>
    (
      await getDb()
        .select({ lead: householdMember.pushLeadMinutes })
        .from(householdMember)
        .where(eq(householdMember.id, memberId))
    )[0]?.lead ?? 0,
  setLeadMinutes: async (memberId: string, minutes: number) => {
    await getDb()
      .update(householdMember)
      .set({ pushLeadMinutes: minutes })
      .where(eq(householdMember.id, memberId));
  },

  // --- cron ---
  // Familias con al menos un cuidador vigente suscrito, con la anticipación de cada uno.
  subscribedHouseholds: async () => {
    const rows = await getDb()
      .selectDistinct({
        householdId: householdMember.householdId,
        memberId: householdMember.id,
        lead: householdMember.pushLeadMinutes,
      })
      .from(pushSubscription)
      .innerJoin(
        householdMember,
        eq(householdMember.id, pushSubscription.memberId),
      )
      .where(isNull(householdMember.revokedAt));
    const byHousehold = new Map<
      string,
      { id: string; leadMinutes: number }[]
    >();
    for (const r of rows) {
      const list = byHousehold.get(r.householdId) ?? [];
      list.push({ id: r.memberId, leadMinutes: r.lead });
      byHousehold.set(r.householdId, list);
    }
    return [...byHousehold].map(([householdId, members]) => ({
      householdId,
      members,
    }));
  },
  claim: async (memberId: string, reminderKey: string) =>
    (
      await getDb()
        .insert(reminderDelivery)
        .values({ memberId, reminderKey })
        .onConflictDoNothing()
        .returning({ key: reminderDelivery.reminderKey })
    ).length > 0,
  subscriptions: (memberId: string) =>
    getDb()
      .select({
        id: pushSubscription.id,
        endpoint: pushSubscription.endpoint,
        p256dh: pushSubscription.p256dh,
        auth: pushSubscription.auth,
      })
      .from(pushSubscription)
      .where(eq(pushSubscription.memberId, memberId)),
  deleteSubscription: async (id: string) => {
    await getDb().delete(pushSubscription).where(eq(pushSubscription.id, id));
  },
  markSuccess: async (id: string) => {
    await getDb()
      .update(pushSubscription)
      .set({ lastSuccessAt: sql`now()` })
      .where(eq(pushSubscription.id, id));
  },
  purgeDeliveries: async (before: Date) => {
    await getDb()
      .delete(reminderDelivery)
      .where(lt(reminderDelivery.sentAt, before));
  },
};
