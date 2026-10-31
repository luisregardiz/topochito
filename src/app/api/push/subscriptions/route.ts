import { requireSession } from "@/lib/current-session";
import { handle, json, parseJson } from "@/lib/http";
import { remindersRepository } from "@/modules/reminders/reminders.repository";
import {
  subscriptionInput,
  unsubscribeInput,
} from "@/modules/reminders/reminders.schemas";

export const POST = handle(async (req) => {
  const { memberId } = await requireSession();
  const { endpoint, keys } = await parseJson(req, subscriptionInput, 2048);
  await remindersRepository.upsertSubscription(memberId, {
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });
  return json({ ok: true }, { status: 201 });
});

export const DELETE = handle(async (req) => {
  const { memberId } = await requireSession();
  const { endpoint } = await parseJson(req, unsubscribeInput, 1536);
  await remindersRepository.removeSubscription(memberId, endpoint);
  return json({ ok: true });
});
