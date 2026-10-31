import "server-only";
import { Receiver } from "@upstash/qstash";
import { isCronAuthorized } from "./cron";
import { getEnv } from "./env";

// Solo QStash (firma con las claves de firma) puede disparar el cron de recordatorios.
// En desarrollo, sin claves, se acepta el Bearer CRON_SECRET para poder correrlo a mano (pnpm reminders:run).
export async function isQstashRequest(req: Request, body: string) {
  const env = getEnv();
  if (env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY) {
    const signature = req.headers.get("upstash-signature");
    if (!signature) return false;
    try {
      return await new Receiver({
        currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
        devMode: false,
      }).verify({ signature, body, clockTolerance: 5 });
    } catch {
      return false;
    }
  }
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[cron] faltan las claves de firma de QStash: se rechaza todo",
    );
    return false;
  }
  return isCronAuthorized(req.headers.get("authorization"), env.CRON_SECRET);
}
