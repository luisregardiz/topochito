import { requireSession } from "@/lib/current-session";
import { handle, json, parseJson } from "@/lib/http";
import { newToken } from "@/lib/tokens";
import { remindersRepository } from "@/modules/reminders/reminders.repository";
import { calendarSettingsInput } from "@/modules/reminders/reminders.schemas";

// Estado del feed de la familia (sin el token: solo se guarda su hash).
export const GET = handle(async () => {
  const { householdId } = await requireSession();
  return json(await remindersRepository.calendarStatus(householdId));
});

export const PUT = handle(async (req) => {
  const { householdId } = await requireSession();
  const { alarmMinutes } = await parseJson(req, calendarSettingsInput, 128);
  await remindersRepository.setCalendarAlarm(householdId, alarmMinutes);
  return json(await remindersRepository.calendarStatus(householdId));
});

// Enlace nuevo: el anterior deja de funcionar en los calendarios suscritos. El token solo viaja aquí.
export const POST = handle(async () => {
  const { householdId } = await requireSession();
  const { token, tokenHash } = newToken();
  await remindersRepository.setCalendarToken(householdId, tokenHash);
  return json({ token }, { status: 201 });
});
