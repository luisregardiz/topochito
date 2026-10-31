import { describe, expect, it } from "vitest";
import { hashToken } from "@/lib/tokens";
import { DEFAULT_MEAL_TIMES } from "@/modules/households/households.schemas";
import type { MenuMeal, StoredEntry } from "@/modules/menu/menu.schemas";
import {
  calendarFeed,
  dueReminders,
  runReminders,
  type PushResult,
} from "./reminders.service";
import { mealEvents, type ReminderEvent } from "./reminders.source";

const entry = (day: number, meal: MenuMeal, code: string): StoredEntry => ({
  day,
  meal,
  isFish: false,
  isMaxOnce: false,
  recipe: {
    code,
    title: `Puré ${code}`,
    mealType: meal,
    minAgeMonths: 6,
    isIronSource: false,
    ironNote: null,
    thumbUrl: null,
    missingFoods: [],
    allergens: [],
  },
});
const week = {
  weekStart: "2026-10-26",
  entries: [
    entry(5, "desayuno", "D1"),
    entry(5, "almuerzo", "A1"),
    entry(6, "almuerzo", "A2"),
  ],
};

describe("fuente de comidas", () => {
  it("da eventos con clave estable, título corto, hora exacta y enlace a la receta", () => {
    const events = mealEvents({
      weeks: [week],
      ageMonths: 7,
      timeZone: "America/Caracas",
      mealTimes: DEFAULT_MEAL_TIMES,
      from: new Date("2026-10-30T00:00:00Z"),
      to: new Date("2026-10-31T04:00:00Z"),
    });
    expect(events).toEqual([
      {
        key: "meal:2026-10-30:desayuno",
        title: "Hora del desayuno: Puré D1",
        startsAt: new Date("2026-10-30T11:30:00Z"),
        url: "/recetas/D1",
      },
      {
        key: "meal:2026-10-30:almuerzo",
        title: "Hora del almuerzo: Puré A1",
        startsAt: new Date("2026-10-30T16:00:00Z"),
        url: "/recetas/A1",
      },
    ]);
  });
});

describe("ventana del cron", () => {
  const ev = (iso: string, key = iso): ReminderEvent => ({
    key,
    title: "Hora del almuerzo: Puré",
    startsAt: new Date(iso),
    url: "/recetas/A1",
  });
  const now = new Date("2026-10-30T16:00:00Z");

  it("a la hora exacta: avisa si la comida cayó en los últimos 10 minutos (sin incluir el borde)", () => {
    const due = dueReminders(
      [
        ev("2026-10-30T16:00:00Z"),
        ev("2026-10-30T15:51:00Z"),
        ev("2026-10-30T15:50:00Z"),
        ev("2026-10-30T16:01:00Z"),
      ],
      [{ id: "m1", leadMinutes: 0 }],
      now,
    );
    expect(due.map((d) => d.event.key)).toEqual([
      "2026-10-30T16:00:00Z",
      "2026-10-30T15:51:00Z",
    ]);
  });

  it("15 minutos antes: avisa por la comida de las 16:15, no por la de las 16:00", () => {
    const due = dueReminders(
      [ev("2026-10-30T16:15:00Z"), ev("2026-10-30T16:00:00Z")],
      [{ id: "m1", leadMinutes: 15 }],
      now,
    );
    expect(due.map((d) => d.event.key)).toEqual(["2026-10-30T16:15:00Z"]);
  });
});

describe("envío de avisos", () => {
  const now = new Date("2026-10-30T16:02:00Z");
  function fakeDeps(sendResult: PushResult = "ok") {
    const claimed = new Set<string>();
    const sent: { sub: string; payload: string }[] = [];
    const deleted: string[] = [];
    let purgedBefore: Date | null = null;
    return {
      sent,
      deleted,
      purged: () => purgedBefore,
      deps: {
        subscribedHouseholds: async () => [
          { householdId: "h1", members: [{ id: "m1", leadMinutes: 0 }] },
        ],
        sources: [
          async () => [
            {
              key: "meal:2026-10-30:almuerzo",
              title: "Hora del almuerzo: Puré de auyama con caraotas",
              startsAt: new Date("2026-10-30T16:00:00Z"),
              url: "/recetas/A1",
            },
          ],
        ],
        claim: async (m: string, k: string) => {
          const id = `${m}|${k}`;
          if (claimed.has(id)) return false;
          claimed.add(id);
          return true;
        },
        subscriptions: async () => [
          {
            id: "s1",
            endpoint: "https://push.example/1",
            p256dh: "p",
            auth: "a",
          },
        ],
        send: async (sub: { id: string }, payload: string) => {
          sent.push({ sub: sub.id, payload });
          return sendResult;
        },
        deleteSubscription: async (id: string) => void deleted.push(id),
        markSuccess: async () => {},
        purgeDeliveries: async (before: Date) => void (purgedBefore = before),
      },
    };
  }

  it("envía un aviso corto con el enlace absoluto a la receta", async () => {
    const f = fakeDeps();
    const stats = await runReminders(f.deps, {
      now,
      origin: "https://topochito.com",
    });
    expect(stats).toMatchObject({ households: 1, sent: 1 });
    expect(JSON.parse(f.sent[0]!.payload)).toEqual({
      title: "topochito",
      body: "Hora del almuerzo: Puré de auyama con caraotas",
      url: "https://topochito.com/recetas/A1",
      tag: "meal:2026-10-30:almuerzo",
    });
    expect(f.purged()).toEqual(new Date("2026-10-28T16:02:00Z"));
  });

  it("es idempotente: si el cron corre dos veces, el aviso sale una sola vez", async () => {
    const f = fakeDeps();
    await runReminders(f.deps, { now, origin: "https://x" });
    await runReminders(f.deps, {
      now: new Date(now.getTime() + 60_000),
      origin: "https://x",
    });
    expect(f.sent).toHaveLength(1);
  });

  it("si el servicio de push responde que la suscripción ya no existe (404/410), la borra", async () => {
    const f = fakeDeps("gone");
    const stats = await runReminders(f.deps, { now, origin: "https://x" });
    expect(f.deleted).toEqual(["s1"]);
    expect(stats.removed).toBe(1);
  });
});

describe("feed de calendario", () => {
  const token = "t".repeat(43);
  const deps = {
    findByCalendarToken: async (hash: string) =>
      hash === hashToken(token)
        ? {
            id: "h1",
            tokenHash: hash,
            timeZone: "America/Caracas",
            alarmMinutes: 15,
            babyNickname: "Topo",
          }
        : undefined,
    sources: [
      async (_h: string, range: { from: Date; to: Date }) => {
        // la fuente recibe 14 días desde la medianoche local de hoy
        expect(range.from.toISOString()).toBe("2026-10-30T04:00:00.000Z");
        expect(range.to.toISOString()).toBe("2026-11-13T04:00:00.000Z");
        return [
          {
            key: "meal:2026-10-30:almuerzo",
            title: "Hora del almuerzo: Puré",
            startsAt: new Date("2026-10-30T16:00:00Z"),
            url: "/recetas/A1",
          },
        ];
      },
    ],
  };

  it("token válido: calendario con nombre, UID estable y enlace absoluto", async () => {
    const ics = await calendarFeed(deps, token, {
      now: new Date("2026-10-30T12:00:00Z"),
      origin: "https://topochito.com",
    });
    const unfolded = ics!.replace(/\r\n /g, "");
    expect(unfolded).toContain("X-WR-CALNAME:topochito · Topo");
    expect(unfolded).toMatch(
      /UID:meal-2026-10-30-almuerzo-[0-9a-f]{12}@topochito/,
    );
    expect(unfolded).not.toContain("h1");
    expect(unfolded).toContain("URL:https://topochito.com/recetas/A1");
    expect(unfolded).toContain("TRIGGER:-PT15M");
  });

  it("token desconocido: null", async () => {
    expect(
      await calendarFeed(deps, "x".repeat(43), {
        now: new Date(),
        origin: "https://x",
      }),
    ).toBeNull();
  });
});
