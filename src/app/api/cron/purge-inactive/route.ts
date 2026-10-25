import { isCronAuthorized } from "@/lib/cron";
import { getEnv } from "@/lib/env";
import { handle, HttpError, json } from "@/lib/http";
import { householdsRepository } from "@/modules/households/households.repository";
import { purgeQuery } from "@/modules/households/households.schemas";
import { purgeInactive } from "@/modules/households/households.service";

// Lo invoca Vercel Cron (vercel.json). ?dryRun=1 solo cuenta, sin borrar.
export const GET = handle(async (req) => {
  if (
    !isCronAuthorized(req.headers.get("authorization"), getEnv().CRON_SECRET)
  ) {
    throw new HttpError(401, "unauthorized", "No autorizado");
  }
  const { dryRun } = purgeQuery.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  const result = await purgeInactive(householdsRepository, {
    now: new Date(),
    dryRun: dryRun === "1",
  });
  console.log("[cron] purge-inactive", result);
  return json(result);
});
