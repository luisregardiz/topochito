# recetario-bebe — convenciones

@AGENTS.md

App de recetas y menú semanal para bebés. Next.js 16 (App Router, `cacheComponents`), Drizzle + PostgreSQL, Zod, Tailwind + shadcn/ui.
Gestor: **pnpm** (nunca npm/yarn). Node 22.

## Comandos

`pnpm dev | build | start | lint | typecheck | test | format`
`pnpm db:generate | db:migrate | db:seed | db:pull | db:studio` · `pnpm household:create "<nombre>"`
Antes de dar algo por hecho: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
Base local: `docker compose up -d db`.

## Estructura (todo bajo `src/`)

```
src/app/                 rutas y UI; handlers en app/api/**/route.ts
src/modules/<modulo>/    <modulo>.schemas.ts (Zod) · .service.ts (lógica pura) · .repository.ts (Drizzle)
src/db/                  client.ts (server-only), schema/ (fuente de verdad), migrations/, seed.ts, seed/
src/lib/                 env.ts, http.ts, rate-limit.ts, session.ts
src/proxy.ts             rate limit + CSRF (Origin) + gate de sesión (Next 16: proxy, no middleware); públicas: /acceso, /join/*, /api/access, /api/households, /api/health
src/scripts/             CLIs (corren con tsx, fuera de Next)
```

## Reglas

- **Handlers delgados**: validar con Zod → llamar al servicio → responder. Sin lógica de negocio ni queries. Envuélvelos con `handle()` de `lib/http.ts` (errores uniformes `{ error: { code, message } }`, sin stack ni mensajes de BD).
- **Zod en todos los bordes**: body (`parseJson` con límite de tamaño), query, params y variables de entorno.
- **`server-only`** en todo lo que toque BD o secretos (`db/client.ts`, repositories, `lib/env.ts`, `lib/rate-limit.ts`). Los scripts CLI y `db/seed.ts` NO pueden importarlo (lanza fuera de Next): crean su propio `Pool`.
- **Servicios sin dependencias ocultas**: reciben repositorio, reloj y random por parámetro (testeables con semilla fija). No importan `server-only`.
- **El schema Drizzle manda**: cambia `src/db/schema/` → `pnpm db:generate` → revisa el SQL → `pnpm db:migrate`. Nunca edites migraciones aplicadas.
- Todo el schema vive en el schema Postgres `recetario` (`drizzle.config.ts` filtra por él).
- El dato de usuario pertenece a un `household` (FK a `household.id`); la sesión solo lleva `householdId`.
- Con `cacheComponents`, cualquier acceso a BD o a request corta el prerender: es esperado en handlers.
- Tests con Vitest junto al código (`*.test.ts`); `server-only` está stubeado en `vitest.config.mts`.

## Agregar un módulo

1. `src/modules/<modulo>/` con `schemas`, `service`, `repository` (solo los que tengan uso).
2. Tablas nuevas en `src/db/schema/` + exportar en `index.ts` + migración.
3. Rutas en `src/app/api/<modulo>/**/route.ts` (delgadas) y UI en `src/app/`.
4. Tests del servicio. Las rutas protegidas ya quedan tras el gate de `proxy.ts`; si una ruta debe ser pública, añádela a `PUBLIC_PATHS` explícitamente.

## No hacer

- No variables `NEXT_PUBLIC_*` con secretos.
- No lógica ni SQL en handlers o componentes.
- No interfaces genéricas de repositorio, contenedores de DI ni capas sin uso.
- No límites de rate en memoria como solución de producción (serverless): Upstash.
- El código de familia se guarda cifrado con `ACCESS_CODE_KEY` (+ índice HMAC), nunca en claro ni en logs. No reutilizar `SESSION_SECRET` para eso.
- Todo endpoint o ruta que acepte un código o cree familias debe ir tras el rate limit de `proxy.ts` (`/api/access`, `/api/households`, `/join/*`).
- No `next lint` (usar `eslint` por CLI) ni `middleware.ts` (es `proxy.ts`).
