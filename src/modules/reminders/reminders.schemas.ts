import { z } from "zod";
import { tokenParamPattern } from "@/lib/tokens";

export const LEAD_OPTIONS = [0, 15] as const; // a la hora exacta o 15 minutos antes
const lead = z.union([z.literal(0), z.literal(15)]);

export const calendarSettingsInput = z.object({ alarmMinutes: lead });
export const leadInput = z.object({ pushLeadMinutes: lead });

// Algunos calendarios piden el feed con «.ics» al final: se acepta con o sin él.
export const calendarTokenParam = z
  .string()
  .transform((t) => t.replace(/\.ics$/, ""))
  .pipe(z.string().regex(tokenParamPattern));

export const subscriptionInput = z.object({
  endpoint: z.url().max(1024).startsWith("https://"),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
});
export const unsubscribeInput = z.object({ endpoint: z.url().max(1024) });

export type CalendarStatus = { active: boolean; alarmMinutes: number };
