import { connection } from "next/server";
import { handle, HttpError } from "@/lib/http";
import { REMINDER_SOURCES } from "@/modules/reminders/reminders.deps";
import { remindersRepository } from "@/modules/reminders/reminders.repository";
import { calendarTokenParam } from "@/modules/reminders/reminders.schemas";
import { calendarFeed } from "@/modules/reminders/reminders.service";

// Feed .ics público (se autentica por el token) con rate limit propio en proxy.ts.
export const GET = handle(
  async (req, { params }: RouteContext<"/api/calendar/[token]">) => {
    await connection();
    const token = calendarTokenParam.safeParse((await params).token);
    const ics = token.success
      ? await calendarFeed(
          { ...remindersRepository, sources: REMINDER_SOURCES },
          token.data,
          { now: new Date(), origin: new URL(req.url).origin },
        )
      : null;
    if (!ics) throw new HttpError(404, "not_found", "Calendario no encontrado");
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="topochito.ics"',
        "Cache-Control": "private, max-age=300",
      },
    });
  },
);
