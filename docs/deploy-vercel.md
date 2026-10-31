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
2. La integración crea `KV_REST_API_URL` y `KV_REST_API_TOKEN`, y la app las lee tal cual (no hay que copiarlas). Si defines `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, esas tienen prioridad. No uses `KV_REST_API_READ_ONLY_TOKEN`: solo lee y el límite necesita escribir.
3. En producción esto es obligatorio: el límite en memoria no se comparte entre instancias serverless.

## 4. Variables de entorno en Vercel

| Variable                                                | Valor                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                          | cadena pooled de Neon                                                                                        |
| `SESSION_SECRET`                                        | `openssl rand -base64 48` (≥32 caracteres)                                                                   |
| `ACCESS_CODE_KEY`                                       | `openssl rand -base64 48` (≥32 caracteres), distinta de la anterior                                          |
| `CRON_SECRET`                                           | `openssl rand -base64 32`. Vercel la envía como `Authorization: Bearer` al cron de purga                     |
| `CLOUDINARY_CLOUD_NAME`                                 | opcional. «Cloud name» de Cloudinary para las fotos y videos de las recetas; sin él se muestran placeholders |
| `MAX_HOUSEHOLDS`                                        | opcional (200). Ponla en `0` para cerrar la creación de recetarios si hay abuso                              |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN`                  | las crea la integración de Upstash (o `UPSTASH_REDIS_REST_*`)                                                |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`                 | `npx web-push generate-vapid-keys` (una vez; si cambian, todas las suscripciones push dejan de servir)       |
| `VAPID_SUBJECT`                                         | `mailto:` o `https://` de contacto (lo ven los servicios de push)                                            |
| `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | consola de QStash → Signing Keys. Sin ellas, en producción el cron de recordatorios rechaza todo             |

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

> Cada despliegue con migraciones nuevas necesita `pnpm db:migrate` **y** `pnpm db:seed` contra Neon: el seed carga el catálogo de
> alimentos (`foods.json`), los ingredientes estructurados y las recetas de `src/db/seed/recipes/`. Antes de cargar un lote nuevo,
> `pnpm db:check` lo valida sin tocar la base.

## 6. Crear familias

Lo normal es que cada familia cree su recetario en `/empezar` y sume cuidadores con "Invitar a alguien" (en "Mi recetario"). Por CLI:

```bash
DATABASE_URL="<cadena de Neon>" ACCESS_CODE_KEY="<la misma de Vercel>" pnpm household:create "Familia Pérez"
```

Debe usarse la misma `ACCESS_CODE_KEY` que tiene Vercel, o la app no podrá leer ese código.

## Cron de purga por inactividad

`vercel.json` programa `GET /api/cron/purge-inactive` cada día a las 04:00 UTC. Vercel solo ejecuta crons en el deploy de
**producción** y los autentica con `Authorization: Bearer <CRON_SECRET>` si esa variable existe, así que defínela antes de desplegar.
El plan Hobby permite crons diarios como este. Para ver qué borraría sin borrar, llama al endpoint con `?dryRun=1` y el Bearer.
Revisa los resultados en Vercel → Logs (línea `[cron] purge-inactive`).

## Recordatorios push con QStash

El plan Hobby de Vercel solo permite crons diarios, así que los avisos los dispara **QStash** (Upstash), cada 5 minutos.
Plan gratis: 1.000 mensajes al día; cada disparo es un mensaje, así que son 288 al día (29 %). Los envíos de push salen
de nuestra función, no cuentan en QStash. Si agregas un método de pago en Upstash, todos tus recursos pasan al plan de pago.

1. Claves VAPID: `npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` en Vercel.
2. Consola de Upstash → QStash → **Signing Keys**: copia la actual y la siguiente a `QSTASH_CURRENT_SIGNING_KEY` y `QSTASH_NEXT_SIGNING_KEY`.
3. Redeploy (las variables nuevas no aplican a un deploy existente).
4. QStash → **Schedules** → Create: destino `https://<tu-dominio>/api/cron/reminders`, método `POST`, cron `*/5 * * * *`.
5. Probar: en el schedule, "Trigger now" (o espera 5 minutos) y mira Vercel → Logs: línea `[cron] reminders { households, sent, removed, failed }`.
   Sin firma válida responde 401 (un `curl` directo debe dar 401).

El feed de calendario (`/api/calendar/<token>.ics`) no necesita configuración: lo sirve la app.

## 7. Deploy y verificación

```bash
vercel --prod        # o push a la rama de producción
curl https://<tu-dominio>/api/health      # {"status":"ok"}
```

Abre el dominio: debe redirigir a `/acceso`; crea un recetario de prueba y comprueba que entra y que la cookie sale `Secure; HttpOnly`.

## Notas

- `x-forwarded-for` lo fija Vercel, por eso el rate limit por IP es fiable allí.
- HSTS y `upgrade-insecure-requests` solo se activan con `NODE_ENV=production`.
