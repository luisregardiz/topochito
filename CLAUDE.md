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
src/proxy.ts             rate limit + CSRF (Origin) + gate de sesión (Next 16: proxy, no middleware); públicas: /acceso, /limite, /join/*, /api/access, /api/households, /api/health, /api/cron/purge-inactive (esta última exige `CRON_SECRET`)
src/scripts/             CLIs (corren con tsx, fuera de Next)
src/components/ui/       shadcn (base-nova); tamaños ajustados al diseño: Button/Input h-14 (lg) o h-12, texto 18px
src/components/recetario/ componentes propios del diseño (EmptyState, AppNav, FamilyCodeInput, OfflineBanner…)
src/app/(app)/           rutas con sesión y navegación: /menu, /recetas, /recetas/[code], /guias/*, /bebe, /recetario
src/modules/<m>/<m>.queries.ts  hooks de TanStack Query del frontend ("use client"); los tipos viven en <m>.schemas.ts
design/                  exportación de Claude Design: SOLO referencia (excluida de lint/prettier); la hoja de implementación manda
```

## Reglas

- **Handlers delgados**: validar con Zod → llamar al servicio → responder. Sin lógica de negocio ni queries. Envuélvelos con `handle()` de `lib/http.ts` (errores uniformes `{ error: { code, message } }`, sin stack ni mensajes de BD).
- **Zod en todos los bordes**: body (`parseJson` con límite de tamaño), query, params y variables de entorno.
- **`server-only`** en todo lo que toque BD o secretos (`db/client.ts`, repositories, `lib/env.ts`, `lib/rate-limit.ts`). Los scripts CLI y `db/seed.ts` NO pueden importarlo (lanza fuera de Next): crean su propio `Pool`.
- **Servicios sin dependencias ocultas**: reciben repositorio, reloj y random por parámetro (testeables con semilla fija). No importan `server-only`.
- **El schema Drizzle manda**: cambia `src/db/schema/` → `pnpm db:generate` → revisa el SQL → `pnpm db:migrate`. Nunca edites migraciones aplicadas.
- Todo el schema vive en el schema Postgres `recetario` (`drizzle.config.ts` filtra por él).
- El dato de usuario pertenece a un `household` (FK a `household.id`); la sesión solo lleva `householdId`.
- Toda tabla con FK a `household.id` debe usar `ON DELETE CASCADE`: la purga por inactividad (30 días, cron diario) borra familias enteras.
- `last_seen_at` se renueva en `getCurrentHousehold()`; toda página nueva de una familia debe pasar por ahí.
- **Peticiones del frontend**: siempre con `api` (axios, `lib/api-client.ts`) dentro de hooks de TanStack Query (`*.queries.ts`); nada de `fetch` suelto. Los errores llegan como `ApiError` (`status`, `code`). Zustand no está instalado: añadirlo solo cuando exista estado global real (los filtros viven en el componente; los tokens de color siguen `prefers-color-scheme`).
- **Tests de componentes**: `// @vitest-environment jsdom` en la primera línea, `renderWithQuery` de `src/test/render.tsx` y `vi.mock("@/lib/api-client")`. jsdom está fijado a la v26 por compatibilidad con Node 22.14.
- **Medios**: en la base solo van public IDs de Cloudinary (`image_public_id`, `video_public_id`); las URLs se arman en `lib/cloudinary-url.ts` (puro, con tests) y `lib/media.ts` (lee `CLOUDINARY_CLOUD_NAME`). El cliente recibe URLs ya hechas y nunca el nombre de la cuenta. Todo medio debe tener placeholder: no puede haber huecos ni imágenes rotas. Los IDs se validan antes de entrar en una URL (`isValidPublicId`).
- **Tipografía**: IBM Plex Sans (texto), Space Grotesk (h1–h3 y `.font-display`) y DM Mono (códigos). Los difuminados de las cards usan `--card-glow` (8 %): subirlo rompe el contraste AA del texto secundario en oscuro.
- Diseño: tokens y valores salen de `design/…Hoja de implementación` y viven en `globals.css` (claro/oscuro por `prefers-color-scheme`). Primario verde; rojo solo para peligro; texto mínimo 16px, controles 48–56px. No inventar tokens ni tamaños.
- Páginas con datos de la familia pasan por el layout `(app)` (`getCurrentHousehold`): cuenta como visita y redirige a `/acceso?motivo=borrado` si el recetario ya no existe.
- **Drizzle y `sql` a mano**: dentro de una consulta de una sola tabla, Drizzle omite el prefijo de tabla de TODAS las columnas, incluida la de otra tabla que interpolas en un `sql`\`…\``. Una subconsulta correlacionada escrita así compara contra la tabla equivocada sin dar error (nos pasó con el pescado). Usa el constructor con joins (que califica las columnas) o consultas separadas, y verifica contra datos reales.
- **Menú y perfil**: la generación del menú vive en `menu.generator.ts` (pura, con `random` inyectado y tests con semilla). Cualquier regla nueva (nutricional o de seguridad) se prueba ahí con varias semillas y datos con las proporciones reales del dataset. Toda mutación del menú devuelve el menú completo y los cambios son deshacibles.
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
