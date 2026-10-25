// Uso: pnpm household:create "<nombre>". Muestra el código UNA sola vez.
// Corre fuera de Next: no importa server-only ni lib/env.
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { household } from "@/db/schema";
import { createHouseholdInput } from "@/modules/households/households.schemas";
import {
  generateAccessCode,
  hashAccessCode,
} from "@/modules/households/households.service";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const { name } = createHouseholdInput.parse({ name: process.argv[2] });

  const code = generateAccessCode();
  const pool = new Pool({ connectionString: url });
  await drizzle(pool)
    .insert(household)
    .values({ name, accessCodeHash: await hashAccessCode(code) });
  await pool.end();

  console.log(
    `Familia "${name}" creada.\nCódigo de acceso (no se vuelve a mostrar): ${code}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
