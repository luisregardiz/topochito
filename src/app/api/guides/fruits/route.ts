import { connection } from "next/server";
import { handle, json } from "@/lib/http";
import { guidesRepository } from "@/modules/guides/guides.repository";
import { listFruitCuts } from "@/modules/guides/guides.service";

export const GET = handle(async () => {
  await connection(); // por petición: el build no consulta la base
  return json({ items: await listFruitCuts(guidesRepository) });
});
