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
    // Clave de los códigos de familia. Aparte de SESSION_SECRET: rotar la sesión no debe invalidar los códigos.
    // Tope de familias; 0 cierra la creación de recetarios nuevos.
    MAX_HOUSEHOLDS: z.coerce.number().int().min(0).default(200),
    // Cuenta de Cloudinary para imágenes y videos de las recetas. Opcional: sin ella se muestran los placeholders.
    CLOUDINARY_CLOUD_NAME: optional,
    // Autoriza al cron de Vercel. Sin ella el endpoint de purga responde 401.
    CRON_SECRET: optional,
    ACCESS_CODE_KEY: z.string().min(32, "mínimo 32 caracteres"),
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
