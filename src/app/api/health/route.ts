import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { errorResponse, json } from "@/lib/http";

export async function GET() {
  await connection(); // sin esto se prerenderiza: devolvería siempre el estado del momento del build
  try {
    await getDb().execute(sql`select 1`);
    return json({ status: "ok" });
  } catch (e) {
    console.error("[health] base de datos no disponible", e);
    return errorResponse(503, "db_unavailable", "Servicio no disponible");
  }
}
