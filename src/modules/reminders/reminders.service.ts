import { createHash } from "node:crypto";
import { buildCalendar } from "@/lib/ics";
import { safeEqual } from "@/lib/safe-equal";
import { hashToken } from "@/lib/tokens";
import { addDays, zonedInstant } from "@/lib/zoned-time";
import { weekOf } from "@/modules/menu/menu.week";
import {
  collectReminders,
  type ReminderEvent,
  type ReminderSource,
} from "./reminders.source";

export const FEED_DAYS = 14;
export const CRON_WINDOW_MINUTES = 10; // el cron corre cada 5 min: la ventana tolera una ejecución perdida o tardía
export const DELIVERY_RETENTION_DAYS = 2;

// --- Feed .ics ---------------------------------------------------------------

type FeedHousehold = {
  id: string;
  tokenHash: string;
  timeZone: string;
  alarmMinutes: number;
  babyNickname: string | null;
};

export async function calendarFeed(
  deps: {
    findByCalendarToken: (hash: string) => Promise<FeedHousehold | undefined>;
    sources: ReminderSource[];
  },
  token: string,
  { now, origin }: { now: Date; origin: string },
) {
  const hash = hashToken(token);
  const h = await deps.findByCalendarToken(hash);
  if (!h || !safeEqual(h.tokenHash, hash)) return null;

  // Desde el comienzo de hoy (en la zona de la familia) y 14 días hacia adelante.
  const today = weekOf(now, h.timeZone);
  const todayDate = addDays(today.weekStart, today.today - 1);
  const from = zonedInstant(todayDate, "00:00", h.timeZone);
  const to = zonedInstant(addDays(todayDate, FEED_DAYS), "00:00", h.timeZone);
  const events = await collectReminders(deps.sources, h.id, { from, to });

  // El UID no revela el id de la familia, pero es único entre familias.
  const scope = createHash("sha256").update(h.id).digest("hex").slice(0, 12);
  return buildCalendar({
    name: h.babyNickname
      ? `topochito · ${h.babyNickname}`
      : "topochito · comidas del bebé",
    timeZone: h.timeZone,
    alarmMinutes: h.alarmMinutes,
    now,
    events: events.map((e) => ({
      uid: `${e.key.replace(/:/g, "-")}-${scope}@topochito`,
      start: e.startsAt,
      durationMinutes: 30,
      summary: e.title,
      description: `Ver la receta: ${origin}${e.url}`,
      url: `${origin}${e.url}`,
    })),
  });
}

// --- Push --------------------------------------------------------------------

export type DueReminder = { memberId: string; event: ReminderEvent };

// Avisos que tocan ahora: el momento de avisar (hora − anticipación) cae en la ventana (now − ventana, now].
export function dueReminders(
  events: ReminderEvent[],
  members: { id: string; leadMinutes: number }[],
  now: Date,
  windowMinutes = CRON_WINDOW_MINUTES,
): DueReminder[] {
  const start = now.getTime() - windowMinutes * 60_000;
  return members.flatMap((m) =>
    events
      .filter((e) => {
        const at = e.startsAt.getTime() - m.leadMinutes * 60_000;
        return at > start && at <= now.getTime();
      })
      .map((event) => ({ memberId: m.id, event })),
  );
}

export type PushResult = "ok" | "gone" | "failed";
type Subscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function runReminders(
  deps: {
    subscribedHouseholds: () => Promise<
      { householdId: string; members: { id: string; leadMinutes: number }[] }[]
    >;
    sources: ReminderSource[];
    // true solo la primera vez para (cuidador, clave): hace idempotente el cron.
    claim: (memberId: string, key: string) => Promise<boolean>;
    subscriptions: (memberId: string) => Promise<Subscription[]>;
    send: (sub: Subscription, payload: string) => Promise<PushResult>;
    deleteSubscription: (id: string) => Promise<void>;
    markSuccess: (id: string) => Promise<void>;
    purgeDeliveries: (before: Date) => Promise<void>;
  },
  { now, origin }: { now: Date; origin: string },
) {
  const stats = { households: 0, sent: 0, removed: 0, failed: 0 };
  const maxLead = 15;
  for (const h of await deps.subscribedHouseholds()) {
    stats.households++;
    const events = await collectReminders(deps.sources, h.householdId, {
      from: new Date(now.getTime() - CRON_WINDOW_MINUTES * 60_000),
      to: new Date(now.getTime() + (maxLead + 1) * 60_000),
    });
    for (const { memberId, event } of dueReminders(events, h.members, now)) {
      // Se reserva antes de enviar: si el envío falla se pierde ese aviso, pero nunca llega dos veces.
      if (!(await deps.claim(memberId, event.key))) continue;
      const payload = JSON.stringify({
        title: "topochito",
        body: event.title,
        url: `${origin}${event.url}`,
        tag: event.key,
      });
      for (const sub of await deps.subscriptions(memberId)) {
        const result = await deps.send(sub, payload);
        if (result === "ok") {
          stats.sent++;
          await deps.markSuccess(sub.id);
        } else if (result === "gone") {
          stats.removed++;
          await deps.deleteSubscription(sub.id);
        } else stats.failed++;
      }
    }
  }
  await deps.purgeDeliveries(
    new Date(now.getTime() - DELIVERY_RETENTION_DAYS * 24 * 3600_000),
  );
  return stats;
}
