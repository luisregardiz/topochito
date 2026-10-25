import "server-only";
import { z } from "zod";

// "" (como en .env.example) cuenta como no definida
const optional = z
  .string()
  .optional()
  .transform((v) => v || undefined);

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32, "mínimo 32 caracteres"),
    UPSTASH_REDIS_REST_URL: optional,
    UPSTASH_REDIS_REST_TOKEN: optional,
  })
  .refine((e) => !!e.UPSTASH_REDIS_REST_URL === !!e.UPSTASH_REDIS_REST_TOKEN, {
    message: "UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN van juntas",
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Perezoso para que `next build` no exija secretos; instrumentation.ts lo invoca al arrancar el servidor.
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Variables de entorno inválidas:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return (cached = parsed.data);
}
