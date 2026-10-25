// Uso: pnpm household:create "<nombre>". Imprime el código y el enlace de entrada.
// Corre fuera de Next: no importa server-only ni lib/env.
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { household } from "@/db/schema";
import { createHouseholdInput } from "@/modules/households/households.schemas";
import {
  createHousehold,
  deriveCodeKeys,
} from "@/modules/households/households.service";

async function main() {
  const url = process.env.DATABASE_URL;
  const key = process.env.ACCESS_CODE_KEY;
  if (!url || !key) throw new Error("Faltan DATABASE_URL y/o ACCESS_CODE_KEY");
  const { name } = createHouseholdInput.parse({ name: process.argv[2] });

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  const created = await createHousehold(
    {
      insert: async (row) =>
        (
          await db
            .insert(household)
            .values(row)
            .onConflictDoNothing({ target: household.accessCodeLookup })
            .returning({ id: household.id })
        )[0],
    },
    name,
    deriveCodeKeys(key),
  );
  await pool.end();

  console.log(
    `Familia "${name}" creada.\nCódigo: ${created.code}\nEnlace: /entrar/${created.code}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
