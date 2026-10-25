import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

let db: ReturnType<typeof createDb> | undefined;

function createDb() {
  const pool = new Pool({ connectionString: getEnv().DATABASE_URL, max: 5 });
  attachDatabasePool(pool); // cierra conexiones ociosas antes de suspender la instancia (Fluid compute)
  return drizzle(pool, { schema });
}

export function getDb() {
  return (db ??= createDb());
}
