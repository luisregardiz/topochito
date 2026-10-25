import { handle, json } from "@/lib/http";
import { guidesRepository } from "@/modules/guides/guides.repository";
import { listFoodGuide } from "@/modules/guides/guides.service";

export const GET = handle(async () =>
  json({ items: await listFoodGuide(guidesRepository) }),
);
