import { handle, HttpError, json } from "@/lib/http";
import { sendPush } from "@/lib/push";
import { isQstashRequest } from "@/lib/qstash";
import { REMINDER_SOURCES } from "@/modules/reminders/reminders.deps";
import { remindersRepository } from "@/modules/reminders/reminders.repository";
import { runReminders } from "@/modules/reminders/reminders.service";

// Lo dispara un schedule de QStash cada 5 minutos. Sin firma válida: 401.
export const POST = handle(async (req) => {
  const body = await req.text();
  if (!(await isQstashRequest(req, body)))
    throw new HttpError(401, "unauthorized", "No autorizado");
  const stats = await runReminders(
    { ...remindersRepository, sources: REMINDER_SOURCES, send: sendPush },
    { now: new Date(), origin: new URL(req.url).origin },
  );
  console.log("[cron] reminders", stats);
  return json(stats);
});
