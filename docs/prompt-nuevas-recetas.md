# Prompt para pedir recetas nuevas

> **Cómo usarlo:** copia TODO lo que hay debajo de la línea `--- PROMPT ---` y pégalo en tu chat de Claude donde tienes el contexto de las comidas.
> Cuando te responda, guarda el JSON en `src/db/seed/recipes/lote-01.json` (un archivo por lote: `lote-02.json`, …) y valida **sin tocar la base**:
>
> ```bash
> pnpm db:check      # revisa el formato, los alimentos, los alérgenos y los códigos
> pnpm db:seed       # las carga (local o contra Neon); se puede repetir
> ```
>
> Los datos de abajo (códigos libres, huecos, catálogo) son de **2026-10-25**: si ya cargaste lotes, regenera este archivo o corrige los códigos a mano.

--- PROMPT ---

Necesito que generes **recetas NUEVAS** para la app de alimentación complementaria de la que ya tienes contexto (las 71 recetas, las reglas de seguridad y el estilo venezolano/latinoamericano). Esta vez las recetas se cargan como **JSON estricto** que valida un programa, así que el formato importa tanto como el contenido.

## 1. Qué quiero

Un lote de **10 a 12 recetas**. Prioriza estos huecos del menú semanal, en este orden:

1. **Desayunos y meriendas con hierro.** Hoy hay 4 desayunos y 2 meriendas con hierro (de 16 y 15); el menú intenta que cada día tenga 2 comidas con hierro y no le alcanzan. Idealmente la mayoría de los desayunos y meriendas nuevos son fuente de hierro real (legumbres, carne, hígado, huevo, cereales fortificados, verduras de hoja con vitamina C…).
2. **Opciones sin huevo y sin lácteos.** Para un bebé que evita huevo hay 10 desayunos y 12 meriendas posibles; sin lácteos, 9 desayunos y 11 meriendas. Haz varias recetas SIN huevo y SIN lácteos (y que sigan teniendo hierro y proteína).
3. **Cenas y almuerzos con pescado** (hoy hay 1 cena y 6 almuerzos con pescado): pescados blancos o azules pequeños de bajo mercurio, bien desespinados.
4. **Recetas con alimentos fáciles de conseguir.** Algunas familias no consiguen ingredientes como quinoa, salmón, tofu o quinchonchos y la app les oculta esas recetas. Haz recetas ricas con ingredientes muy comunes (papa, auyama, zanahoria, plátano, huevo, pollo, arroz, harina de maíz, lentejas, caraotas, cambur…).
5. Variedad: no repitas platos que ya existen; cambia técnicas, texturas y combinaciones.

Reparte las comidas con sentido (p. ej. 4 desayunos, 3 meriendas, 2 almuerzos, 2 cenas, 1 preparación base) salvo que algún hueco pida otra cosa.

## 2. Formato de salida

Responde **solo** con un bloque de código JSON (sin texto antes ni después) con esta forma:

```json
{
  "foods": [
    { "slug": "remolacha", "name": "Remolacha", "category": "verduras" }
  ],
  "recipes": [ ...recetas... ]
}
```

- `foods` es **opcional**: solo para alimentos que NO estén en el catálogo de la sección 5 (si no hay ninguno nuevo, usa `"foods": []` o quita la clave).
- Cada receta tiene **exactamente** estas claves (el programa rechaza cualquier clave de más o mal escrita). Ejemplo real:

```json
{
  "code": "D10",
  "title": "Arepita dominó: caraotas negras y queso fresco",
  "mealType": "desayuno",
  "minAgeMonths": 7,
  "sortOrder": 16,
  "iron": { "isSource": true, "note": null },
  "allergens": [{ "slug": "lacteos", "optional": false, "condition": null }],
  "tags": [
    {
      "slug": "harina-enriquecida",
      "name": "Harina enriquecida",
      "label": "Harina enriquecida"
    }
  ],
  "ingredients": [
    {
      "text": "1–2 arepitas blandas (P5)",
      "optional": false,
      "foods": [["harina-maiz"]]
    },
    {
      "text": "3 cdas de caraotas negras sin sal (P3), con un poco de su caldo",
      "optional": false,
      "foods": [["caraotas"]]
    },
    {
      "text": "1 cda de queso fresco bajo en sal o ricota",
      "optional": false,
      "foods": [["queso-fresco", "ricota"]]
    },
    {
      "text": "De acompañante: mango, lechosa o mandarina",
      "optional": true,
      "foods": [["mango", "lechosa", "mandarina"]]
    }
  ],
  "steps": [
    "Calienta las caraotas y aplástalas con un tenedor hasta formar una pasta untable.",
    "Abre las arepitas y úntalas con las caraotas; desmenuza el queso encima.",
    "Sirve con la fruta: su vitamina C ayuda a absorber el hierro de las caraotas."
  ],
  "ageAdaptations": [
    {
      "minAgeMonths": 7,
      "maxAgeMonths": 8,
      "instructions": "Tiras de arepa untadas, sin costra dura."
    },
    {
      "minAgeMonths": 9,
      "maxAgeMonths": 11,
      "instructions": "Trocitos rellenos."
    },
    {
      "minAgeMonths": 12,
      "maxAgeMonths": null,
      "instructions": "Arepa dominó entera."
    }
  ],
  "note": "La harina de maíz precocida venezolana está enriquecida con hierro (50 mg/kg), vitamina A y vitaminas B por norma COVENIN: arepa + caraotas + fruta es un desayuno muy completo.",
  "references": ["P3", "P5"]
}
```

## 3. Reglas del formato (todas se validan)

- **`code`**: letra + número. Prefijos: `D` desayuno, `A` almuerzo, `M` merienda, `C` cena, `P` preparación base. **Siguientes libres: A19, C17, D17, M16, P7** (continúa desde ahí, sin saltos ni repetir).
- **`sortOrder`**: número entero; continúa desde **72** en el orden en que las entregas.
- **`mealType`**: `desayuno`, `almuerzo`, `merienda`, `cena` o `base`.
- **`minAgeMonths`**: entre 6 y 36; las **cenas, mínimo 8**; las `base` llevan `null`. `ageAdaptations` siempre con los tramos 7–8, 9–11 y 12+ (`maxAgeMonths: null` en el último), como en el ejemplo.
- **`iron.isSource`**: `true` solo si es una fuente real de hierro; `note` explica la condición (p. ej. «muslo», «vegetal», «si usas avena enriquecida») o es `null`. Si `isSource` es `false`, `note` es `null`.
- **`allergens`**: declara **todo alérgeno presente en cualquier ingrediente** (en el catálogo de la sección 5, `→ lacteos` indica que ese alimento lleva ese alérgeno; **el programa rechaza la receta si una línea obligatoria exige un alimento con alérgeno y no lo declaraste como no opcional**), con los slugs de la sección 6. Si está en un ingrediente opcional o hay alternativa, `optional: true` y `condition` (p. ej. «si usas leche»); si no, `optional: false` y `condition: null`. Sigue las convenciones ya usadas: pasta y pan → `trigo`; yogur, queso, leche y mantequilla → `lacteos`; cualquier pescado → `pescado` (obligatorio y **no opcional**: el menú cuenta con él para limitar el pescado a ~2 veces por semana). La avena no declara `trigo`; usa la etiqueta `avena-puede-contener-gluten` como en las recetas existentes.
- **`tags`**: usa las etiquetas de la sección 6 con su `slug`, `name` y `label` exactos. Puedes crear una etiqueta nueva si hace falta. **Nunca** uses `max-1-vez-por-semana` salvo en alimentos como el hígado: el menú limita a una vez por semana cualquier receta con esa etiqueta.
- **`references`**: códigos de las preparaciones base que usa la receta (P1–P6 u otras que crees en este mismo lote) y menciónalas en el texto del ingrediente como en el ejemplo, `(P5)`.
- **`steps`**: al menos uno, frases completas. **`note`**: `null` o una nota breve; las advertencias de seguridad («nunca…», «evita…», «riesgo de atragantamiento») se muestran destacadas en la app, así que úsalas solo para eso.

### Cómo se escriben los ingredientes (lo más importante)

Cada ingrediente es un objeto `{ "text", "optional", "foods" }`:

- `text`: la línea tal como la leería una persona (cantidad incluida), sin sal ni azúcar añadidos.
- `optional`: `true` si se puede omitir sin que la receta deje de funcionar («opcional», «de acompañante», «para decorar»). Una línea opcional nunca impide cocinar la receta.
- `foods`: lista de **grupos**. Esto es lo que usa la app para saber si la familia puede cocinar la receta con su despensa:
  - Un grupo con **un** alimento → hace falta ese: `[["pollo"]]`.
  - Un grupo con **varios** alimentos = **alternativas** (basta uno): «yuca, ocumo, ñame o apio criollo» → `[["yuca", "ocumo", "name", "apio-criollo"]]`.
  - **Varios grupos** en la misma línea = hacen falta todos: «1 yuca y 1 ocumo o ñame» → `[["yuca"], ["ocumo", "name"]]`.
  - Sin alimento concreto («fruta madura de temporada») → `[]`.
- **Recomendación:** pon **un ingrediente por línea** y usa alternativas solo cuando de verdad sean intercambiables. Evita líneas como «cebolla, ají dulce y ajo»; sepáralas.
- Los alimentos **básicos** (agua, aceite, hierbas y especias) también se anotan en `foods` cuando aparecen; no hacen falta en la despensa pero sí en el JSON.
- Si usas una **preparación base** como ingrediente, anota los alimentos que lleva: p. ej. «1 cubo de sofrito (P2)» → `[["cebolla"], ["pimenton"], ["aji-dulce"], ["ajo"], ["tomate"], ["cebollin"], ["aceite"]]`. Así, si una familia no consigue ají dulce, la app sabe que esa receta no la puede hacer.
- **Solo slugs del catálogo (sección 5).** Si necesitas uno nuevo, agrégalo en `"foods"` con `slug` (minúsculas con guiones, sin tildes), `name`, `category` y, si contiene un alérgeno, `"allergen": "<slug del alérgeno>"` (p. ej. `"allergen": "lacteos"` para un queso nuevo): una de `proteinas`, `lacteos`, `verduras`, `tuberculos`, `frutas`, `cereales`, `legumbres`, `semillas`, `otros`, o `basicos` (+ `"staple": true`) para hierbas, especias y básicos. Antes de crear uno, comprueba que no exista ya con otro nombre (p. ej. «requesón» es `ricota`, «boniato» es `batata`, «maíz tierno» es `jojoto`).

## 4. Seguridad (los mismos criterios de siempre)

Sin sal, azúcar, miel ni papelón añadidos; respeta las texturas por edad (atragantamiento: uvas, frutos secos enteros, trozos duros, salchichas…); pescados de bajo mercurio y sin espinas; huevo siempre bien cocido; legumbres bien cocidas; yuca bien cocida; arroz con moderación; frutos secos y maní solo en crema fina o diluida; nada de ingredientes que no se den a esa edad. Si una receta lo necesita, ponlo en `note`.

## 5. Catálogo de alimentos (usa estos slugs)

- **Carnes, pescados y huevos**: `pollo` (Pollo), `higado-pollo` (Hígado de pollo), `res` (Carne de res), `pescado-blanco` (Pescado blanco (merluza, pargo, corvina) → pescado), `salmon` (Salmón → pescado), `sardina` (Sardinas → pescado), `atun` (Atún en lata → pescado), `huevo` (Huevo → huevo), `tofu` (Tofu → soya)
- **Lácteos**: `leche-entera` (Leche entera → lacteos), `yogur-natural` (Yogur natural → lacteos), `queso-fresco` (Queso fresco bajo en sal → lacteos), `ricota` (Ricota o requesón → lacteos), `mantequilla` (Mantequilla sin sal → lacteos)
- **Verduras**: `cebolla` (Cebolla), `ajo` (Ajo), `tomate` (Tomate), `pimenton` (Pimentón), `aji-dulce` (Ají dulce), `zanahoria` (Zanahoria), `auyama` (Auyama (calabaza)), `calabacin` (Calabacín), `brocoli` (Brócoli), `vainita` (Vainitas), `arveja` (Arvejas (guisantes)), `chayote` (Chayote), `jojoto` (Jojoto (maíz tierno))
- **Tubérculos y plátano**: `papa` (Papa), `yuca` (Yuca), `ocumo` (Ocumo), `name` (Ñame), `apio-criollo` (Apio criollo), `batata` (Batata (boniato)), `platano` (Plátano)
- **Frutas**: `cambur` (Cambur (banana)), `mango` (Mango), `pera` (Pera), `manzana` (Manzana), `parchita` (Parchita (maracuyá)), `lechosa` (Lechosa (papaya)), `patilla` (Patilla (sandía)), `guayaba` (Guayaba), `mandarina` (Mandarina), `fresa` (Fresas), `limon` (Limón), `aguacate` (Aguacate), `coco-rallado` (Coco rallado sin azúcar)
- **Cereales, harinas y pan**: `avena` (Avena), `harina-maiz` (Harina de maíz precocida), `fororo` (Fororo (harina de maíz tostado)), `quinoa` (Quinoa), `arroz` (Arroz blanco), `pasta` (Pasta → trigo), `cuscus` (Cuscús → trigo), `pan-integral` (Pan integral bajo en sal → trigo), `pan-rallado` (Pan rallado → trigo), `polvo-hornear` (Polvo de hornear)
- **Legumbres**: `caraotas` (Caraotas negras), `lentejas` (Lentejas), `quinchonchos` (Quinchonchos), `garbanzos` (Garbanzos)
- **Semillas y cremas**: `crema-mani` (Crema de maní 100% → mani), `crema-almendra` (Crema de almendras o merey → frutos_secos), `tahini` (Tahini (crema de ajonjolí) → sesamo), `chia-linaza` (Semillas de chía o linaza)
- **Otros**: `leche-coco` (Leche de coco sin azúcar)
- **Básicos** (se asumen siempre disponibles; igual se anotan en las líneas donde aparezcan): `agua`, `aceite`, `leche-materna`, `canela`, `comino`, `oregano`, `curcuma`, `onoto`, `nuez-moscada`, `anis-dulce`, `ajo-polvo`, `albahaca`, `cilantro`, `perejil`, `eneldo`, `cebollin`

## 6. Alérgenos y etiquetas válidos

**Alérgenos** (`slug`): `huevo`, `mani`, `lacteos`, `trigo`, `pescado`, `sesamo`, `frutos_secos`, `soya`, `mariscos`.

**Etiquetas existentes** (`slug` → `name`):

- `2-ingredientes` → 2 ingredientes
- `alternativa-al-arroz` → Alternativa al arroz
- `arroz-con-moderacion` → Arroz con moderación
- `atun-claro` → Atún claro
- `avena-opcional` → Avena opcional
- `avena-puede-contener-gluten` → Avena: puede contener gluten
- `bien-cocidos-siempre` → Bien cocidos siempre
- `calcio` → Calcio
- `dulce-natural` → Dulce natural
- `facil-para-dias-de-dientes` → Fácil para días de dientes
- `grasas-saludables` → Grasas saludables
- `harina-enriquecida` → Harina enriquecida
- `ligera` → Ligera
- `listo-en-15-min-con-sobras` → Listo en 15 min con sobras
- `listo-en-20-min` → Listo en 20 min
- `maiz` → Maíz
- `max-1-vez-por-semana` → Máx. 1 vez por semana
- `olla-de-presion` → Olla de presión
- `omega-3` → Omega-3
- `proteina-magra` → Proteína magra
- `receta-tradicional-venezolana` → Receta tradicional venezolana
- `reemplaza-los-cubitos` → Reemplaza los cubitos
- `sabor-sin-sal` → Sabor sin sal
- `se-congela` → Se congela
- `sin-azucar` → Sin azúcar
- `sin-cazon` → Sin cazón
- `sin-cocinar` → Sin cocinar
- `sin-freir` → Sin freír
- `sin-gluten` → Sin gluten
- `sin-mayonesa` → Sin mayonesa
- `sin-sal` → Sin sal
- `vitamina-a` → Vitamina A
- `vitamina-c` → Vitamina C
- `yuca-bien-cocida` → Yuca bien cocida

## 7. Antes de responder, revisa

- [ ] JSON válido, sin comentarios ni comas sobrantes, y **solo** el bloque de código en la respuesta.
- [ ] Códigos y `sortOrder` consecutivos desde los indicados; ningún código repetido.
- [ ] Todos los slugs de `foods` de los ingredientes existen en el catálogo o están definidos en `"foods"`.
- [ ] Todo alérgeno presente está declarado; el pescado, como no opcional.
- [ ] Cada línea de ingredientes tiene `text`, `optional` y `foods`; las alternativas están en un mismo grupo y lo obligatorio, en grupos distintos.
- [ ] `ageAdaptations` con los tres tramos; cenas con `minAgeMonths` ≥ 8.
- [ ] Aportan al hueco pedido (hierro en desayunos/meriendas, sin huevo ni lácteos, pescado, ingredientes comunes).
