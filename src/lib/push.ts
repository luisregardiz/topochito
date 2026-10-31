import "server-only";
import webpush from "web-push";
import type { PushResult } from "@/modules/reminders/reminders.service";
import { getEnv } from "./env";

let warned = false;

// Claves VAPID o null si faltan: el push se apaga con un aviso en el log, sin romper la app.
export function vapidConfig() {
  const env = getEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    if (!warned) {
      warned = true;
      console.warn(
        "[push] faltan VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY: los avisos push están desactivados",
      );
    }
    return null;
  }
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT ?? "mailto:admin@topochito.app",
  };
}

export async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
): Promise<PushResult> {
  const vapid = vapidConfig();
  if (!vapid) return "failed";
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      { vapidDetails: vapid, TTL: 60 * 30, urgency: "normal" },
    );
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone"; // el navegador ya no tiene esa suscripción
    console.warn("[push] envío fallido", status ?? e);
    return "failed";
  }
}
