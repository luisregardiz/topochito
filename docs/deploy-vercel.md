# Despliegue manual en Vercel

Orden recomendado: base de datos → Upstash → variables → deploy → migrar y sembrar → crear familias.

## 1. Proyecto en Vercel

Importa el repositorio (framework Next.js, gestor pnpm, Node 22). No hace falta Docker ni configurar el comando de build.

## 2. Neon (Postgres) desde el Marketplace

1. Vercel → proyecto → **Storage** → **Create Database** → **Neon** (plan Free).
2. Conéctalo al proyecto para los entornos Production y Preview.
3. La integración crea variables de entorno. Usa **`DATABASE_URL`** (cadena _pooled_, el host contiene `-pooler`) para la app.
   La cadena directa (`DATABASE_URL_UNPOOLED`, sin `-pooler`) sirve para migraciones. Verifica los nombres en
   Settings → Environment Variables: si la integración usa otros, crea `DATABASE_URL` con el valor pooled.

## 3. Upstash Redis (rate limit)

1. Storage → **Upstash** (Redis) → crea la base (plan Free) y conéctala al proyecto.
2. La app espera `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. Si la integración inyecta otros nombres
   (p. ej. `KV_REST_API_URL` / `KV_REST_API_TOKEN`), crea esas dos variables con los mismos valores.
3. En producción esto es obligatorio: el límite en memoria no se comparte entre instancias serverless.

## 4. Variables de entorno en Vercel

| Variable                                             | Valor                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`                                       | cadena pooled de Neon                                                           |
| `SESSION_SECRET`                                     | `openssl rand -base64 48` (≥32 caracteres)                                      |
| `ACCESS_CODE_KEY`                                    | `openssl rand -base64 48` (≥32 caracteres), distinta de la anterior             |
| `MAX_HOUSEHOLDS`                                     | opcional (200). Ponla en `0` para cerrar la creación de recetarios si hay abuso |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | de Upstash                                                                      |

Cambiar `SESSION_SECRET` cierra todas las sesiones. **Guarda `ACCESS_CODE_KEY` en un lugar seguro:** si se pierde o cambia, los códigos de familia existentes dejan de funcionar.

## 5. Migraciones y seed contra Neon (desde tu máquina)

Las migraciones **no** corren en el build. Ejecútalas tú, con la cadena **directa** (sin pooler) para el DDL:

```bash
export DATABASE_URL="postgres://...neon.tech/neondb?sslmode=require"   # sin -pooler
pnpm db:migrate
pnpm db:seed
```

Un valor exportado en la shell tiene prioridad sobre `.env`. Ambos comandos se pueden repetir sin riesgo.
Repite `pnpm db:migrate` en cada despliegue que incluya migraciones nuevas, **antes** de promover el deploy.

## 6. Crear familias

Lo normal es que cada persona cree su recetario desde `/acceso` y comparta el enlace con el botón "Compartir recetario". Por CLI:

```bash
DATABASE_URL="<cadena de Neon>" ACCESS_CODE_KEY="<la misma de Vercel>" pnpm household:create "Familia Pérez"
```

Debe usarse la misma `ACCESS_CODE_KEY` que tiene Vercel, o la app no podrá leer ese código.

## 7. Deploy y verificación

```bash
vercel --prod        # o push a la rama de producción
curl https://<tu-dominio>/api/health      # {"status":"ok"}
```

Abre el dominio: debe redirigir a `/acceso`; crea un recetario de prueba y comprueba que entra y que la cookie sale `Secure; HttpOnly`.

## Notas

- `x-forwarded-for` lo fija Vercel, por eso el rate limit por IP es fiable allí.
- HSTS y `upgrade-insecure-requests` solo se activan con `NODE_ENV=production`.
