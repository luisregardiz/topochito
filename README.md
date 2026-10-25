# recetario-bebe

Menú semanal aleatorio y recetas en cards para la alimentación complementaria de bebés (desde los 6–7 meses).
Next.js 16 (App Router) + PostgreSQL + Drizzle. Nombre técnico provisional.

## Requisitos

- Node 22 (`.nvmrc`) y pnpm 9 (`corepack enable`)
- Docker (para PostgreSQL local)

## Setup local (app en el host, solo la base en Docker)

```bash
pnpm install
cp .env.example .env            # completa SESSION_SECRET: openssl rand -base64 48
docker compose up -d db         # postgres:17 en localhost:5432
pnpm db:migrate                 # crea el schema "recetario"
pnpm db:seed                    # carga las recetas (idempotente)
pnpm household:create "Mi familia"   # imprime el código de acceso UNA vez
pnpm dev                        # http://localhost:3000
```

## Todo en Docker

```bash
docker compose up               # db + app en modo dev (bind mount, hot reload)
```

La primera vez el contenedor `app` instala dependencias (tarda). Las migraciones y el seed se ejecutan desde el host
(`pnpm db:migrate && pnpm db:seed`) contra `localhost:5432`.

Validar la imagen de producción (standalone, usuario no root):

```bash
docker build -t recetario-bebe .
docker run --rm -p 3000:3000 -e DATABASE_URL=... -e SESSION_SECRET=... recetario-bebe
```

El despliegue real es en Vercel, sin Docker: ver [docs/deploy-vercel.md](docs/deploy-vercel.md).

## Base de datos

El schema Drizzle (`src/db/schema/`) es la fuente de verdad. `src/db/seed/recetario.sql` es solo el origen histórico del dataset.

| Comando            | Qué hace                                                           |
| ------------------ | ------------------------------------------------------------------ |
| `pnpm db:generate` | Genera una migración en `src/db/migrations` tras cambiar el schema |
| `pnpm db:migrate`  | Aplica las migraciones pendientes                                  |
| `pnpm db:seed`     | Carga `src/db/seed/recetario.json` (upsert; se puede repetir)      |
| `pnpm db:pull`     | Introspección de una base existente                                |
| `pnpm db:studio`   | Explorador visual                                                  |

## Acceso por código de familia

No hay usuarios ni contraseñas. Cada familia (`household`) tiene un código; se entrega por fuera de la app.

```bash
pnpm household:create "Familia Pérez"
# → Código de acceso (no se vuelve a mostrar): 7D3Z-66PB
```

Solo se guarda el hash (bcrypt). Si se pierde un código hay que crear otra familia (o actualizar el hash a mano).
Contra Neon: `DATABASE_URL="<cadena de Neon>" pnpm household:create "Familia"`.

## Variables de entorno

| Variable                                              | Obligatoria | Uso                                                                   |
| ----------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                                        | sí          | PostgreSQL. En producción, la cadena **pooled** de Neon               |
| `SESSION_SECRET`                                      | sí (≥32)    | Firma de la cookie de acceso (HS256)                                  |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | prod        | Rate limit. Sin ellas usa memoria (solo desarrollo) y avisa en el log |

La app valida el entorno al arrancar y falla con un mensaje claro si falta algo. Nada lleva prefijo `NEXT_PUBLIC_`.

## Calidad

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
