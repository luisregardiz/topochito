# recetario-bebe

Menú semanal aleatorio y recetas en cards para la alimentación complementaria de bebés (desde los 6–7 meses).
Next.js 16 (App Router) + PostgreSQL + Drizzle. Nombre técnico provisional.

## Requisitos

- Node 22 (`.nvmrc`) y pnpm 9 (`corepack enable`)
- Docker (para PostgreSQL local)

## Setup local (app en el host, solo la base en Docker)

```bash
pnpm install
cp .env.example .env            # completa SESSION_SECRET y ACCESS_CODE_KEY: openssl rand -base64 48
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
docker run --rm -p 3000:3000 -e DATABASE_URL=... -e SESSION_SECRET=... -e ACCESS_CODE_KEY=... recetario-bebe
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

No hay usuarios ni contraseñas. Cada familia (`household`) tiene un código `XXXX-XXXX`.

- **Crear:** en `/acceso`, "Crear mi recetario" pide el nombre de la persona o familia, genera el código y entra directo.
- **Compartir:** en el inicio, el botón "Compartir recetario" copia al portapapeles solo el enlace (`{origen}/join/XXXX-XXXX`); en local, `http://localhost:3000/join/XXXX-XXXX`.
  El enlace es `/join/XXXX-XXXX`: muestra "Te invitaron al recetario de …" y, al confirmar, inicia sesión y redirige a `/` (sin el código en la URL).
  Pide confirmación porque un simple GET no debe cambiarte de cuenta.
- **Entrar con código:** `/acceso` → "Acceder al recetario de mi bebé" (acepta minúsculas, espacios y guiones).
- **Por CLI:** `pnpm household:create "Familia Pérez"` imprime el código y la ruta del enlace.

El código se guarda **cifrado** (AES-256-GCM) con `ACCESS_CODE_KEY` y se busca por un índice HMAC, para poder volver a mostrarlo
y compartirlo. Si pierdes o cambias `ACCESS_CODE_KEY`, los códigos existentes dejan de funcionar (la sesión usa otro secreto).
Límites: 5 creaciones por hora por IP y 30 por hora en total; 5 intentos de código cada 15 minutos por IP.
`MAX_HOUSEHOLDS` (por defecto 200) es el tope de recetarios; con `0` se cierra la creación (en Vercel, cambiar la variable requiere un redeploy).

## Purga por inactividad

Las familias que no abren su recetario en **30 días** se borran. Cada visita al inicio actualiza `last_seen_at` (como mucho una
vez al día), así que usar la app con la sesión abierta cuenta como actividad. Un cron diario de Vercel (`vercel.json`,
04:00 UTC) llama a `GET /api/cron/purge-inactive` con `Authorization: Bearer $CRON_SECRET`.

- Probar sin borrar: `curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/purge-inactive?dryRun=1"`
- **No hay aviso previo** (no se guarda ningún correo): a los 30 días el recetario desaparece. Es irreversible.
- Las tablas que dependan de una familia deben declarar `ON DELETE CASCADE`.

## Variables de entorno

| Variable                                              | Obligatoria | Uso                                                                         |
| ----------------------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`                                        | sí          | PostgreSQL. En producción, la cadena **pooled** de Neon                     |
| `SESSION_SECRET`                                      | sí (≥32)    | Firma de la cookie de acceso (HS256)                                        |
| `ACCESS_CODE_KEY`                                     | sí (≥32)    | Cifra los códigos de familia. Distinta de `SESSION_SECRET`                  |
| `CRON_SECRET`                                         | prod        | Autoriza el cron de purga. Sin ella `/api/cron/purge-inactive` responde 401 |
| `MAX_HOUSEHOLDS`                                      | no          | Tope de recetarios (200 por defecto). `0` cierra la creación                |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | prod        | Rate limit. Sin ellas usa memoria (solo desarrollo) y avisa en el log       |

La app valida el entorno al arrancar y falla con un mensaje claro si falta algo. Nada lleva prefijo `NEXT_PUBLIC_`.

## Diseño

La referencia visual (exportada de Claude Design) está en `design/`; la **Hoja de implementación** lista tokens, tipografías,
componentes y rutas. Los tokens viven en `src/app/globals.css` (modo claro y oscuro automático según el sistema) y las fuentes
son IBM Plex Sans (texto), Space Grotesk (títulos y cifras grandes) y DM Mono (códigos). Las cards llevan el halo difuminado del design system, en verde y limitado al 8 % para no perjudicar el contraste. Rutas: `/acceso`, `/join/[código]`, `/menu`, `/recetas`, `/bebe`, `/recetario`
y `/limite`. Con sesión: `/recetas` (catálogo con filtros), `/recetas/[código]` (detalle), `/guias/despensa`, `/guias/frutas`
`/bebe` (perfil del bebé), `/menu` (menú de la semana) y `/recetario`. Los datos llegan por `/api/recipes`,
`/api/recipes/[código]`, `/api/allergens` y `/api/guides/*`.

## Perfil del bebé y menú semanal

- **Perfil** (`/bebe`): mes y año de nacimiento (sin nombre ni datos sensibles) y el estado de cada alérgeno: _No introducido_
  (sin fila), _Ya lo come_ o _Evitar_. Un bebé por familia. La edad se calcula en meses de calendario, en la hora de Caracas.
  La edad y los alérgenos a evitar son el punto de partida de los filtros de Recetas y activan el aviso del detalle.
- **Menú** (`/menu`): se genera al azar para la semana actual (lunes a domingo). Desayuno, almuerzo y merienda; la **cena desde los
  8 meses**. Reglas: solo recetas de la edad del bebé y **sin ningún alérgeno que evite** (aunque sea opcional), pescado unas 2 veces
  por semana en días no seguidos, hígado (etiqueta «máx. 1 vez por semana») como mucho 1, y 2 comidas con hierro al día.
  Las reglas de hierro se persiguen pero pueden no cumplirse (hay pocas recetas con hierro de desayuno y merienda): el resumen de
  la semana dice lo que realmente se cumple.
- Cambiar una comida o un día devuelve lo anterior, y la interfaz ofrece «Deshacer» (`PUT /api/menu/entries`). Solo se conserva el
  menú de la semana actual; las semanas pasadas se descartan al generar uno nuevo.
- Sin fecha de nacimiento no se genera menú: el generador necesita la edad para elegir recetas seguras.

## Mi despensa: recetas según lo que la familia consigue

No todas las familias consiguen los mismos alimentos (quinoa, salmón, tofu…). En `/despensa` (se llega desde Mi recetario) se marcan
los alimentos que la familia compra; lo desmarcado se guarda como «no lo consigo» y todo lo demás se da por disponible, así que los
alimentos nuevos que lleguen con recetas nuevas no esconden nada por sorpresa.

- **Menú:** nunca incluye una receta que necesite un alimento que no consigues. Si ya tenías un menú y cambias la despensa, el menú
  avisa de las recetas afectadas.
- **Recetas:** el filtro «Solo lo que puedo cocinar» arranca activo si marcaste algo; cada receta afectada dice «Te falta: …» y el
  detalle marca el ingrediente («No lo consigues»).
- **Cómo se decide:** cada línea de ingredientes tiene _grupos_ de alimentos. Los grupos son todos necesarios y dentro de un grupo
  basta uno (alternativas: «yuca, ocumo, ñame o apio criollo»). Las líneas opcionales nunca bloquean. Agua, aceite, hierbas y
  especias son _básicos_: no se preguntan.
- Una receta que usa una preparación base (p. ej. el sofrito) anota los alimentos de esa base, así que si no se consigue ají dulce,
  las recetas con sofrito dejan de ser cocinables.

## Agregar recetas nuevas

Las recetas viven en `src/db/seed/` y se cargan con `pnpm db:seed` (idempotente, también contra Neon):

| Archivo          | Qué es                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `recetario.json` | Dataset base (71 recetas, alérgenos, guías y plan de ejemplo)                                 |
| `foods.json`     | Catálogo de alimentos (slug, nombre, categoría; `staple: true` = básico)                      |
| `recipes/*.json` | **Lotes de recetas nuevas**, uno por archivo: `{ "foods": [...nuevos...], "recipes": [...] }` |
| `media.json`     | Fotos y videos por código de receta                                                           |

`pnpm db:check` valida todos los archivos **sin tocar la base de datos** (formato estricto, alimentos y alérgenos que existan,
códigos sin repetir, edades coherentes, cena desde los 8 meses) y explica cada problema. El prompt para pedirle lotes a Claude, con
el formato exacto, el catálogo y los huecos actuales del menú, está en [docs/prompt-nuevas-recetas.md](docs/prompt-nuevas-recetas.md).

## Fotos y videos de las recetas (Cloudinary)

Las recetas pueden tener una foto (se ve como miniatura de 88 px y como imagen principal 4:3) y un video (16:9, al final del detalle).
Los archivos viven en Cloudinary y en la base solo se guarda su **public ID** (`recipe.image_public_id` y `recipe.video_public_id`);
la URL, con recorte y formato automáticos, se arma en `src/lib/cloudinary-url.ts`. Sin foto, o si falla, se ve el placeholder de la comida.
El video no se descarga hasta que se pulsa «Reproducir video».

1. Crea la cuenta gratuita y copia el **Cloud name** del Dashboard a `CLOUDINARY_CLOUD_NAME` (en `.env` y en Vercel).
2. Sube los archivos con una convención fija: imagen `recetario/D10`, video `recetario/D10-video` (el public ID aparece en la Media Library).
3. Anótalos en `src/db/seed/media.json`: `{ "D10": { "image": "recetario/D10", "video": "recetario/D10-video" } }`.
4. `pnpm db:seed` los aplica (también contra Neon). Es idempotente: solo toca las recetas del archivo; `null` borra el medio.

Consejo para no gastar el plan gratuito: videos de 30–45 s y 720p, y fotos de hasta ~1600 px.

## Calidad

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
