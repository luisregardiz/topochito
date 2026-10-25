import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { errorResponse, json } from "@/lib/http";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return json({ status: "ok" });
  } catch (e) {
    console.error("[health] base de datos no disponible", e);
    return errorResponse(503, "db_unavailable", "Servicio no disponible");
  }
}
