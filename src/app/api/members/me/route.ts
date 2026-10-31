import { requireSession } from "@/lib/current-session";
import { handle, json, parseJson } from "@/lib/http";
import { remindersRepository } from "@/modules/reminders/reminders.repository";
import { leadInput } from "@/modules/reminders/reminders.schemas";

// Preferencias del cuidador actual: anticipación de sus avisos push.
export const GET = handle(async () => {
  const { memberId } = await requireSession();
  return json({
    pushLeadMinutes: await remindersRepository.leadMinutes(memberId),
  });
});

export const PUT = handle(async (req) => {
  const { memberId } = await requireSession();
  const { pushLeadMinutes } = await parseJson(req, leadInput, 128);
  await remindersRepository.setLeadMinutes(memberId, pushLeadMinutes);
  return json({ pushLeadMinutes });
});
