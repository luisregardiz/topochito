-- =====================================================================
-- Recetario para bebés desde los 7 meses — edición ampliada
-- Esquema + datos para PostgreSQL 13+   (generado el 2026-10-21)
--
-- 71 recetas (P = base, D = desayuno, A = almuerzo, M = merienda, C = cena),
-- 9 alérgenos, 34 etiquetas, guía de despensa, guía de cortes de fruta
-- y plan de dos semanas.
--
-- Uso:  psql -d <tu_base> -f recetario_bebes.sql
-- El script es re-ejecutable: BORRA y vuelve a crear el esquema "recetario"
-- (no toca ningún otro esquema). Todo corre en una sola transacción.
-- =====================================================================

BEGIN;

DROP SCHEMA IF EXISTS recetario CASCADE;
CREATE SCHEMA recetario;

CREATE TYPE recetario.meal_type AS ENUM ('base', 'desayuno', 'almuerzo', 'merienda', 'cena');

CREATE TABLE recetario.allergen (
  id               smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  how_to_introduce text NOT NULL
);

CREATE TABLE recetario.tag (
  id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE recetario.recipe (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code           varchar(4) NOT NULL UNIQUE,          -- D1, A7, P3...
  title          text NOT NULL,
  meal_type      recetario.meal_type NOT NULL,
  min_age_months smallint CHECK (min_age_months BETWEEN 6 AND 36),  -- NULL en preparaciones base
  is_iron_source boolean NOT NULL DEFAULT false,
  iron_note      text,                                -- p. ej. 'vegetal', 'muslo'
  note           text,
  sort_order     smallint NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recetario.recipe_ingredient (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipe_id   integer NOT NULL REFERENCES recetario.recipe(id) ON DELETE CASCADE,
  position    smallint NOT NULL,
  description text NOT NULL,                          -- texto libre: '½ taza de avena en hojuelas'
  UNIQUE (recipe_id, position)
);

CREATE TABLE recetario.recipe_step (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipe_id   integer NOT NULL REFERENCES recetario.recipe(id) ON DELETE CASCADE,
  position    smallint NOT NULL,
  instruction text NOT NULL,
  UNIQUE (recipe_id, position)
);

CREATE TABLE recetario.recipe_age_adaptation (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipe_id      integer NOT NULL REFERENCES recetario.recipe(id) ON DELETE CASCADE,
  min_age_months smallint NOT NULL,
  max_age_months smallint,                            -- NULL = en adelante
  instructions   text NOT NULL,
  UNIQUE (recipe_id, min_age_months),
  CHECK (max_age_months IS NULL OR max_age_months >= min_age_months)
);

CREATE TABLE recetario.recipe_allergen (
  recipe_id   integer  NOT NULL REFERENCES recetario.recipe(id) ON DELETE CASCADE,
  allergen_id smallint NOT NULL REFERENCES recetario.allergen(id),
  is_optional boolean  NOT NULL DEFAULT false,        -- el alérgeno está en un ingrediente opcional
  condition   text,                                   -- p. ej. 'si usas leche'
  PRIMARY KEY (recipe_id, allergen_id)
);

CREATE TABLE recetario.recipe_tag (
  recipe_id integer  NOT NULL REFERENCES recetario.recipe(id) ON DELETE CASCADE,
  tag_id    smallint NOT NULL REFERENCES recetario.tag(id),
  label     text NOT NULL,                            -- texto original mostrado en el PDF
  PRIMARY KEY (recipe_id, tag_id)
);

-- Recetas que usan otra (p. ej. A7 usa el caldo P1, D10 usa las caraotas P3)
CREATE TABLE recetario.recipe_reference (
  recipe_id            integer NOT NULL REFERENCES recetario.recipe(id) ON DELETE CASCADE,
  referenced_recipe_id integer NOT NULL REFERENCES recetario.recipe(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, referenced_recipe_id),
  CHECK (recipe_id <> referenced_recipe_id)
);

CREATE TABLE recetario.meal_plan_entry (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  week        smallint NOT NULL CHECK (week >= 1),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),   -- 1 = lunes
  meal_type   recetario.meal_type NOT NULL CHECK (meal_type <> 'base'),
  recipe_id   integer NOT NULL REFERENCES recetario.recipe(id),
  label       text NOT NULL,                          -- texto del plan, puede incluir alternativas
  UNIQUE (week, day_of_week, meal_type)
);

-- Guía de la despensa venezolana y latinoamericana
CREATE TABLE recetario.food_guide (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  food        text NOT NULL,
  from_age    text NOT NULL,                          -- '6 m', 'Con cautela', '—'
  preparation text NOT NULL,
  caution     text,
  sort_order  smallint NOT NULL
);

CREATE TABLE recetario.fruit_cut_guide (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fruit       text NOT NULL,
  age_7_8     text NOT NULL,
  age_9_11    text NOT NULL,
  caution     text,
  sort_order  smallint NOT NULL
);

-- Índices
CREATE INDEX recipe_meal_age_idx         ON recetario.recipe (meal_type, min_age_months);
CREATE INDEX recipe_title_fts_idx        ON recetario.recipe USING gin (to_tsvector('spanish', title));
CREATE INDEX recipe_ingredient_fts_idx   ON recetario.recipe_ingredient USING gin (to_tsvector('spanish', description));
CREATE INDEX recipe_allergen_allergen_idx ON recetario.recipe_allergen (allergen_id);
CREATE INDEX recipe_tag_tag_idx          ON recetario.recipe_tag (tag_id);
CREATE INDEX recipe_reference_ref_idx    ON recetario.recipe_reference (referenced_recipe_id);
CREATE INDEX meal_plan_recipe_idx        ON recetario.meal_plan_entry (recipe_id);

-- ---------------------------------------------------------------- alérgenos
INSERT INTO recetario.allergen (slug, name, how_to_introduce) VALUES
  ('huevo', 'Huevo', 'Bien cocido: huevo duro aplastado, tortilla o tortitas bien cuajadas.'),
  ('mani', 'Maní', 'Crema 100% maní, disuelta en avena, yogur o agua tibia (nunca entero ni a cucharadas).'),
  ('lacteos', 'Lácteos', 'Yogur natural entero sin azúcar; leche entera en cocción; queso fresco bajo en sal.'),
  ('trigo', 'Trigo (gluten)', 'Pasta bien cocida, cuscús, pan integral (en tiras).'),
  ('pescado', 'Pescado', 'Blanco (merluza, pargo, corvina) o azul pequeño (sardina, salmón), sin espinas.'),
  ('sesamo', 'Sésamo', 'Tahini (crema de ajonjolí) en hummus o mezclado en yogur.'),
  ('frutos_secos', 'Frutos secos', 'Crema de almendra o merey 100%, en capa muy fina o diluida; o almendra molida en masas.'),
  ('soya', 'Soya', 'Tofu firme en bastones blandos.'),
  ('mariscos', 'Mariscos', 'Camarón bien cocido y picado fino (sin cabeza), mezclado en un guiso o una tortilla.');

-- ---------------------------------------------------------------- etiquetas
INSERT INTO recetario.tag (slug, name) VALUES
  ('2-ingredientes', '2 ingredientes'),
  ('alternativa-al-arroz', 'Alternativa al arroz'),
  ('arroz-con-moderacion', 'Arroz con moderación'),
  ('atun-claro', 'Atún claro'),
  ('avena-opcional', 'Avena opcional'),
  ('avena-puede-contener-gluten', 'Avena: puede contener gluten'),
  ('bien-cocidos-siempre', 'Bien cocidos siempre'),
  ('calcio', 'Calcio'),
  ('dulce-natural', 'Dulce natural'),
  ('facil-para-dias-de-dientes', 'Fácil para días de dientes'),
  ('grasas-saludables', 'Grasas saludables'),
  ('harina-enriquecida', 'Harina enriquecida'),
  ('ligera', 'Ligera'),
  ('listo-en-15-min-con-sobras', 'Listo en 15 min con sobras'),
  ('listo-en-20-min', 'Listo en 20 min'),
  ('maiz', 'Maíz'),
  ('max-1-vez-por-semana', 'Máx. 1 vez por semana'),
  ('olla-de-presion', 'Olla de presión'),
  ('omega-3', 'Omega-3'),
  ('proteina-magra', 'Proteína magra'),
  ('receta-tradicional-venezolana', 'Receta tradicional venezolana'),
  ('reemplaza-los-cubitos', 'Reemplaza los cubitos'),
  ('sabor-sin-sal', 'Sabor sin sal'),
  ('se-congela', 'Se congela'),
  ('sin-azucar', 'Sin azúcar'),
  ('sin-cazon', 'Sin cazón'),
  ('sin-cocinar', 'Sin cocinar'),
  ('sin-freir', 'Sin freír'),
  ('sin-gluten', 'Sin gluten'),
  ('sin-mayonesa', 'Sin mayonesa'),
  ('sin-sal', 'Sin sal'),
  ('vitamina-a', 'Vitamina A'),
  ('vitamina-c', 'Vitamina C'),
  ('yuca-bien-cocida', 'Yuca bien cocida');

-- ---------------------------------------------------------------- recetas
INSERT INTO recetario.recipe (code, title, meal_type, min_age_months, is_iron_source, iron_note, note, sort_order) VALUES
  ('P1', 'Caldo casero sin sal', 'base', NULL, FALSE, NULL, 'El pollo cocido se aprovecha desmechado en otras recetas (A15, C9, C10).', 1),
  ('P2', 'Sofrito base venezolano', 'base', NULL, FALSE, NULL, 'El ají dulce no pica: es un gran aliado. El pimentón rojo y el tomate aportan vitamina C, que ayuda a absorber el hierro de legumbres y cereales.', 2),
  ('P3', 'Caraotas negras base (sin sal)', 'base', NULL, TRUE, 'vegetal', 'Las legumbres crudas o poco cocidas tienen lectinas que se destruyen con una cocción larga a hervor: no uses olla lenta sin hervirlas antes. Lo mismo sirve para frijoles, quinchonchos y garbanzos.', 3),
  ('P4', 'Plátano maduro horneado', 'base', NULL, FALSE, NULL, NULL, 4),
  ('P5', 'Masa de arepitas blandas (sin sal)', 'base', NULL, FALSE, NULL, 'Para el bebé, la costra dura y tostada se retira o se evita. Las arepitas cocidas se congelan y se recalientan tapadas.', 5),
  ('P6', 'Tubérculos base: yuca, ocumo, ñame, apio criollo', 'base', NULL, FALSE, NULL, 'Pelar, trocear y hervir bien en abundante agua elimina la mayor parte de los compuestos cianogénicos de la yuca. La yuca de mercado es la dulce; la amarga solo se usa procesada (casabe, catibía).', 6),
  ('D1', 'Avena cremosa con cambur y maní', 'desayuno', 7, TRUE, 'si usas avena enriquecida', 'La crema de maní nunca se da sola ni a cucharadas: es espesa y pegajosa. Siempre diluida.', 7),
  ('D2', 'Tortitas de cambur y huevo', 'desayuno', 7, FALSE, NULL, NULL, 8),
  ('D3', 'Arepitas blandas de auyama', 'desayuno', 8, FALSE, NULL, 'Los quesos blancos duros o llaneros suelen tener muchísima sal: mejor ricota, requesón o queso fresco bajo en sodio.', 9),
  ('D4', 'Revuelto de huevo con tomate y aguacate', 'desayuno', 7, TRUE, NULL, NULL, 10),
  ('D5', 'Yogur con mango y tahini', 'desayuno', 7, FALSE, NULL, NULL, 11),
  ('D6', 'Gachas de quinoa con pera y canela', 'desayuno', 7, TRUE, 'vegetal', 'Para mejorar la absorción del hierro vegetal, sirve con fruta rica en vitamina C (fresas, lechosa, mandarina).', 12),
  ('D7', 'Tortitas de plátano maduro y huevo', 'desayuno', 7, FALSE, NULL, 'El plátano muy maduro ya es dulce: no necesita azúcar ni papelón.', 13),
  ('D8', 'Fororo sin azúcar con cambur', 'desayuno', 7, FALSE, NULL, 'El fororo tradicional se endulza con papelón o azúcar; aquí el dulzor lo pone el cambur. Revisa la etiqueta: algunos fororos comerciales ya traen azúcar.', 14),
  ('D9', 'Mazamorra de jojoto sin azúcar', 'desayuno', 7, FALSE, NULL, 'Colarla es importante: los granos de maíz enteros y los hollejos son difíciles de manejar y pueden causar atragantamiento.', 15),
  ('D10', 'Arepita dominó: caraotas negras y queso fresco', 'desayuno', 7, TRUE, NULL, 'La harina de maíz precocida venezolana está enriquecida con hierro (50 mg/kg), vitamina A y vitaminas B por norma COVENIN: arepa + caraotas + fruta es un desayuno muy completo.', 16),
  ('D11', 'Panquecas de avena y auyama', 'desayuno', 7, FALSE, NULL, NULL, 17),
  ('D12', 'Arepitas de yuca', 'desayuno', 8, FALSE, NULL, 'La yuca nunca se da cruda ni a medio cocer (ver P6).', 18),
  ('D13', 'Guasacaca suave con huevo duro', 'desayuno', 7, FALSE, NULL, 'La guasacaca tradicional lleva sal, vinagre y a veces ají picante: esta versión no.', 19),
  ('D14', 'Funche cremoso de maíz y auyama', 'desayuno', 7, FALSE, NULL, NULL, 20),
  ('D15', 'Yogur con parchita colada y cambur', 'desayuno', 7, FALSE, NULL, 'El cambur suaviza la acidez de la parchita sin necesidad de azúcar. Retira siempre las semillas.', 21),
  ('D16', 'Torrejas sin azúcar con fresas', 'desayuno', 8, FALSE, NULL, NULL, 22),
  ('A1', 'Pollo guisado con auyama y papa', 'almuerzo', 7, TRUE, 'muslo', NULL, 23),
  ('A2', 'Lentejas rojas con zanahoria y tomate', 'almuerzo', 7, TRUE, 'vegetal', NULL, 24),
  ('A3', 'Pabellón para bebé: carne mechada, caraotas y plátano', 'almuerzo', 7, TRUE, 'res + caraotas', 'El pimentón rojo aporta vitamina C, que ayuda a absorber el hierro de las caraotas.', 25),
  ('A4', 'Pescado blanco con papa y brócoli', 'almuerzo', 7, FALSE, NULL, 'Evita pez espada, tiburón (incluido el cazón), atún rojo y lucio por su mercurio.', 26),
  ('A5', 'Bastones blandos de res y calabacín', 'almuerzo', 7, TRUE, NULL, NULL, 27),
  ('A6', 'Pasta con salmón, brócoli y ricota', 'almuerzo', 7, FALSE, NULL, NULL, 28),
  ('A7', 'Sancocho "seco" de pollo', 'almuerzo', 7, TRUE, 'muslo', 'Un plato de caldo llena el estómago pequeño con pocos nutrientes: la OMS recomienda comidas espesas. Ofrece primero los sólidos; el caldo sobrante es buena base para cocinar (P1).', 29),
  ('A8', 'Picadillo de carne con papa y zanahoria', 'almuerzo', 7, TRUE, NULL, 'La carne molida suelta y seca (en "granitos") cuesta manejarla en la boca: siempre húmeda y mezclada con el puré.', 30),
  ('A9', 'Higaditos encebollados con puré de auyama', 'almuerzo', 7, TRUE, 'muy alto', 'El hígado es la fuente más concentrada de hierro, pero también de vitamina A. Por eso, como máximo una vez por semana y en porción pequeña (1–2 cucharadas), siempre bien cocido.', 31),
  ('A10', 'Lentejas guisadas con plátano maduro', 'almuerzo', 7, TRUE, 'vegetal', NULL, 32),
  ('A11', 'Sardinas con puré de papa y tomate', 'almuerzo', 7, FALSE, NULL, 'La sardina es de los pescados con menos mercurio y más omega-3 ("mejor opción" para la FDA). Las de salsa picante o salsa de tomate comercial suelen tener mucha sal.', 33),
  ('A12', 'Pastel de plátano y pescado (pastel de chucho, versión segura)', 'almuerzo', 8, FALSE, NULL, 'El pastel de chucho tradicional se hace con cazón, que es tiburón: alto en mercurio y desaconsejado en niños pequeños. Con merluza, pargo o corvina queda igual de rico.', 34),
  ('A13', 'Arroz con pollo y vegetales', 'almuerzo', 7, TRUE, 'muslo', 'El arroz acumula más arsénico que otros cereales: no lo des todos los días y alterna con pasta, maíz, avena, papa o yuca. Otra opción: precocerlo 5 min en mucha agua, como la pasta, y escurrirlo antes de añadirlo al guiso; así pierde parte del arsénico.', 35),
  ('A14', 'Carne guisada con papa y vainitas', 'almuerzo', 7, TRUE, NULL, 'Inspirada en el asado negro, pero sin papelón ni salsas saladas (inglesa, soya): la carne queda sabrosa con el sofrito.', 36),
  ('A15', 'Pasta con pollo en salsa de auyama', 'almuerzo', 7, TRUE, NULL, NULL, 37),
  ('A16', 'Ensalada tibia de atún, papa y vainitas', 'almuerzo', 8, FALSE, NULL, 'Elige atún "claro" (light) en agua: el atún blanco o albacora tiene más mercurio. Alterna con sardina, merluza o pargo dentro de las dos raciones semanales de pescado.', 38),
  ('A17', 'Quinchonchos guisados con auyama', 'almuerzo', 7, TRUE, 'vegetal', 'Ofrece de postre una fruta con vitamina C (guayaba, mango, lechosa) para mejorar la absorción del hierro.', 39),
  ('A18', 'Croquetas al horno de pescado y yuca', 'almuerzo', 8, FALSE, NULL, NULL, 40),
  ('M1', 'Fruta lista en 2 minutos: guía de cortes', 'merienda', 7, FALSE, NULL, 'Uvas y cerezas: nunca enteras (en cuartos a lo largo). Manzana cruda en trozos: todavía no; rallada o cocida.', 41),
  ('M2', 'Muffins de avena, manzana y zanahoria (sin azúcar)', 'merienda', 7, FALSE, NULL, 'El dulzor viene solo del cambur maduro: no añadas azúcar, miel ni sirope.', 42),
  ('M3', 'Hummus suave con bastones de batata', 'merienda', 7, TRUE, 'vegetal', NULL, 43),
  ('M4', 'Galletas blandas de cambur y avena', 'merienda', 8, FALSE, NULL, NULL, 44),
  ('M5', 'Pera o manzana asada con yogur y canela', 'merienda', 7, FALSE, NULL, NULL, 45),
  ('M6', 'Tiras de pan integral con crema de almendras y fresa', 'merienda', 7, FALSE, NULL, 'El pan es una fuente de sal oculta: elige uno bajo en sal o hazlo en casa, y no lo des todos los días.', 46),
  ('M7', 'Plátano horneado con queso fresco', 'merienda', 7, FALSE, NULL, 'Los quesos blancos duros, llanero, de mano o telita suelen ser muy salados: para el bebé, mejor ricota o requesón.', 47),
  ('M8', 'Bowl tropical: lechosa, mango y patilla con yogur', 'merienda', 7, FALSE, NULL, NULL, 48),
  ('M9', 'Compota casera de guayaba y manzana', 'merienda', 7, FALSE, NULL, 'La guayaba es de las frutas con más vitamina C. Sírvela junto a comidas con hierro vegetal (caraotas, lentejas) para mejorar su absorción. La pulpa cruda colada conserva aún más vitamina C.', 49),
  ('M10', 'Majarete sin azúcar', 'merienda', 8, FALSE, NULL, 'El majarete tradicional lleva papelón y azúcar; aquí lo endulza el cambur.', 50),
  ('M11', 'Galletas blandas de auyama y avena', 'merienda', 8, FALSE, NULL, NULL, 51),
  ('M12', 'Hummus de caraotas negras con bastones', 'merienda', 7, TRUE, 'vegetal', NULL, 52),
  ('M13', 'Mango con requesón y coco rallado', 'merienda', 7, FALSE, NULL, 'El coco rallado fino no presenta riesgo; los trozos de coco duro sí: no los des.', 53),
  ('M14', 'Huevo duro con aguacate y tomate', 'merienda', 7, FALSE, NULL, NULL, 54),
  ('M15', 'Arepitas dulces sin azúcar (cambur y anís)', 'merienda', 8, FALSE, NULL, 'Las arepitas dulces tradicionales se fríen y llevan papelón; esta versión es cocida y sin azúcar.', 55),
  ('C1', 'Tortilla al horno de papa y calabacín', 'cena', 8, TRUE, NULL, NULL, 56),
  ('C2', 'Crema de auyama con lentejas rojas', 'cena', 8, TRUE, 'vegetal', NULL, 57),
  ('C3', 'Salmón al horno con batata y guisantes', 'cena', 8, TRUE, NULL, NULL, 58),
  ('C4', 'Cachapitas sin azúcar con queso fresco', 'cena', 9, FALSE, NULL, 'Los granos de maíz enteros son un riesgo de atragantamiento: deben quedar bien licuados. La cachapa tradicional lleva azúcar; aquí no hace falta: el maíz tierno ya es dulce.', 59),
  ('C5', 'Cuscús con pollo mechado y verduras', 'cena', 8, TRUE, NULL, NULL, 60),
  ('C6', 'Tortitas de brócoli, garbanzo y queso', 'cena', 8, TRUE, 'vegetal', NULL, 61),
  ('C7', 'Tofu dorado en bastones con verduras', 'cena', 8, TRUE, 'vegetal', NULL, 62),
  ('C8', 'Pisca andina espesa', 'cena', 8, FALSE, NULL, 'Tradicionalmente es un caldo: para el bebé, sirve primero la parte sólida y espesa.', 63),
  ('C9', 'Crema de apio criollo con pollo', 'cena', 8, TRUE, 'muslo', 'El apio criollo es la raíz (arracacha), no el apio España de tallo verde.', 64),
  ('C10', 'Arepita reina pepiada suave', 'cena', 8, TRUE, 'pollo', 'La mayonesa comercial tiene sal y la casera lleva huevo crudo: el aguacate da la cremosidad.', 65),
  ('C11', 'Tortilla de plátano maduro y queso', 'cena', 8, FALSE, NULL, NULL, 66),
  ('C12', 'Crema de jojoto y calabacín con huevo', 'cena', 8, FALSE, NULL, NULL, 67),
  ('C13', 'Pasta boloñesa casera', 'cena', 8, TRUE, NULL, 'La salsa de tomate comercial y la pasta de tomate de lata suelen llevar sal y azúcar: mejor tomate natural.', 68),
  ('C14', 'Bollitos pelones en salsa', 'cena', 9, TRUE, NULL, 'No fritos y con forma alargada: más fáciles de manejar y sin el riesgo de una bolita firme.', 69),
  ('C15', 'Crema de caraotas negras con arepita', 'cena', 8, TRUE, 'vegetal', NULL, 70),
  ('C16', 'Chayote relleno de pollo y queso', 'cena', 8, TRUE, 'pollo', NULL, 71);

-- P1 · Caldo casero sin sal
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), 1, '1 muslo de pollo o huesos de pollo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), 2, '1 cebolla, 2 ajíes dulces, 1 diente de ajo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), 3, '1 zanahoria, ½ pimentón'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), 4, 'Cilantro y cebollín'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), 5, '1,5 litros de agua');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), 1, 'Pon todo en una olla, hierve y cocina tapado a fuego bajo 45 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), 2, 'Cuela, deja enfriar y retira la grasa de la superficie.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), 3, 'Congela en cubitera; usa 2–4 cubos para cocinar arroz, pasta, cremas o guisos.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), (SELECT id FROM recetario.tag WHERE slug = 'reemplaza-los-cubitos'), 'Reemplaza los cubitos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela 3 meses');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), (SELECT id FROM recetario.recipe WHERE code = 'A15')),
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), (SELECT id FROM recetario.recipe WHERE code = 'C9')),
  ((SELECT id FROM recetario.recipe WHERE code = 'P1'), (SELECT id FROM recetario.recipe WHERE code = 'C10'));

-- P2 · Sofrito base venezolano
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), 1, '1 cebolla'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), 2, '1 pimentón rojo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), 3, '4 ajíes dulces sin semillas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), 4, '2 dientes de ajo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), 5, '2 tomates maduros'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), 6, 'Cebollín'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), 7, '2 cdas de aceite de oliva o vegetal');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), 1, 'Pica todo muy fino (o licúa con muy poca agua).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), 2, 'Cocina a fuego bajo 10–15 min, removiendo, hasta que esté blando y fragante.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), 3, 'Enfría y congela en cubitera: 1 cubo = 1 cucharada de sofrito.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), (SELECT id FROM recetario.tag WHERE slug = 'sabor-sin-sal'), 'Sabor sin sal'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P2'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela 3 meses');

-- P3 · Caraotas negras base (sin sal)
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P3'), 1, '1 taza de caraotas negras secas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P3'), 2, 'Agua para remojar y cocinar'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P3'), 3, 'Opcional: 1 cubo de sofrito (P2) al final');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P3'), 1, 'Lávalas y déjalas en remojo 8–12 horas. Desecha el agua del remojo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P3'), 2, 'Cocina en agua nueva: olla de presión 30–40 min, u olla normal 1,5–2 h, hasta que se deshagan al apretarlas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P3'), 3, 'No añadas sal. Guárdalas con su caldo, en porciones.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P3'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congelan 3 meses');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P3'), (SELECT id FROM recetario.recipe WHERE code = 'P2'));

-- P4 · Plátano maduro horneado
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P4'), 1, 'Plátanos bien maduros (concha casi negra)');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P4'), 1, 'Lávalos, córtales las puntas y haz un corte a lo largo en la concha.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P4'), 2, 'Hornea 25–35 min a 200 °C, hasta que estén muy blandos (o hiérvelos con concha 15–20 min).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P4'), 3, 'Pela y sirve en bastones, aplastado o en rodajas según la edad.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P4'), (SELECT id FROM recetario.tag WHERE slug = 'sin-freir'), 'Sin freír'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P4'), (SELECT id FROM recetario.tag WHERE slug = 'dulce-natural'), 'Dulce natural');

-- P5 · Masa de arepitas blandas (sin sal)
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P5'), 1, '1 taza de harina de maíz precocida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P5'), 2, '1¼ taza de agua tibia'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P5'), 3, '1 cdta de aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P5'), 4, 'Opcional: 3 cdas de auyama, zanahoria rallada, plátano o yuca aplastados');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P5'), 1, 'Mezcla y amasa 2 min. Deja reposar 2 min; si se agrieta, añade agua.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P5'), 2, 'Forma arepitas finas (≈1 cm).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P5'), 3, 'Cocina en budare o sartén tapada, a fuego bajo, 6–8 min por lado: quedan cocidas por dentro y sin costra dura.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P5'), (SELECT id FROM recetario.tag WHERE slug = 'harina-enriquecida'), 'Harina enriquecida');

-- P6 · Tubérculos base: yuca, ocumo, ñame, apio criollo
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P6'), 1, 'Yuca, ocumo, ñame o apio criollo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P6'), 2, 'Agua');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P6'), 1, 'Pela bien. En la yuca, retira también la capa interna rosada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P6'), 2, 'Corta en trozos y hierve hasta que estén muy blandos (20–30 min).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P6'), 3, 'Desecha el agua de cocción. En la yuca, retira la hebra central.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P6'), 4, 'Sirve en bastones, aplastados o como base de arepitas y croquetas.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'P6'), (SELECT id FROM recetario.tag WHERE slug = 'bien-cocidos-siempre'), 'Bien cocidos siempre'),
  ((SELECT id FROM recetario.recipe WHERE code = 'P6'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congelan');

-- D1 · Avena cremosa con cambur y maní
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 1, '3 cdas de copos de avena finos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 2, '120 ml de agua (o leche entera, apta en cocción)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 3, '½ cambur (plátano) bien maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 4, '½ cdta de crema de maní 100% (sin sal ni azúcar)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 5, 'Opcional: 2–3 cdas de leche materna o fórmula al final'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 6, 'Pizca de canela');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 1, 'Cocina la avena con el agua 3–5 min, removiendo, hasta que esté cremosa.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 2, 'Retira del fuego. Si usas leche materna o fórmula, añádela ahora (no la hiervas).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 3, 'Aplasta el cambur con un tenedor e incorpóralo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 4, 'Añade la crema de maní a la avena aún caliente y mezcla bien hasta que se disuelva por completo, sin grumos espesos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 5, 'Sirve tibia.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 7, 8, 'Crema espesa con grumos suaves. Cuchara precargada para que el bebé la tome solo, o en su boca cuando la abra.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 9, 11, 'Más espesa, con trocitos de cambur. Se puede dejar enfriar y cortar en cuadritos blandos para comer con la mano.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), 12, NULL, 'Copos normales, fruta en trozos, se puede preparar con leche entera de vaca.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), (SELECT id FROM recetario.allergen WHERE slug = 'mani'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D1'), (SELECT id FROM recetario.tag WHERE slug = 'avena-puede-contener-gluten'), 'Avena: puede contener gluten');

-- D2 · Tortitas de cambur y huevo
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 1, '1 cambur muy maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 2, '1 huevo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 3, '2 cdas de avena molida (opcional, da consistencia)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 4, 'Pizca de canela'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 5, 'Unas gotas de aceite de oliva o de girasol');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 1, 'Aplasta el cambur y bate con el huevo, la avena y la canela.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 2, 'Calienta una sartén antiadherente a fuego medio-bajo con muy poco aceite.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 3, 'Vierte cucharadas pequeñas de mezcla. Cocina 2–3 min por lado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 4, 'Comprueba que el centro esté totalmente cuajado (huevo bien cocido) y deja entibiar.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 7, 8, 'En tiras del ancho de dos dedos, fáciles de agarrar con el puño.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 9, 11, 'En trocitos pequeños para practicar la pinza. Se pueden acompañar con fresas en cuartos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), 12, NULL, 'Tortitas enteras con fruta y yogur.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), (SELECT id FROM recetario.tag WHERE slug = 'avena-opcional'), 'Avena opcional'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D2'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congelan');

-- D3 · Arepitas blandas de auyama
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 1, '½ taza de harina de maíz precocida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 2, '⅓ taza de auyama (calabaza) cocida y aplastada'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 3, '≈ ⅓ taza de agua tibia'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 4, '1 cdta de aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 5, 'Para rellenar: aguacate aplastado, ricota o queso fresco bajo en sal, o huevo revuelto bien cocido');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 1, 'Mezcla la auyama con la harina y añade agua poco a poco hasta tener una masa suave que no se agriete.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 2, 'Forma arepitas finas (≈1 cm).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 3, 'Cocina en budare o sartén con tapa, a fuego bajo, 6–8 min por lado: así quedan cocidas y blandas, sin costra dura.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 4, 'Ábrelas y rellena o unta.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 7, 8, 'Tiras gruesas y blandas, untadas con aguacate. Retira la parte de la costra si quedó dura.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 9, 11, 'Trocitos rellenos de huevo o queso fresco desmenuzado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), 12, NULL, 'Arepita entera rellena de caraotas, pollo mechado o queso, como la familia.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), (SELECT id FROM recetario.tag WHERE slug = 'maiz'), 'Maíz (sin gluten)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-a'), 'Vitamina A'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D3'), (SELECT id FROM recetario.tag WHERE slug = 'sin-sal'), 'Sin sal');

-- D4 · Revuelto de huevo con tomate y aguacate
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), 1, '1 huevo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), 2, '1 tomate pequeño maduro, sin piel ni semillas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), 3, '¼ de aguacate maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), 4, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), 5, 'Opcional: orégano');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), 1, 'Pica el tomate y cocínalo 2 min en el aceite.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), 2, 'Añade el huevo batido y remueve a fuego bajo hasta que esté totalmente cuajado, sin partes líquidas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), 3, 'Sirve con el aguacate al lado.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), 7, 8, 'Revuelto aplastado y mezclado con el aguacate como una crema; o tortilla francesa en tiras + aguacate en gajo grueso.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), 9, 11, 'Trocitos de revuelto y dados de aguacate.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), 12, NULL, 'Con una tira de pan integral o una arepita.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D4'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-c'), 'Vitamina C del tomate');

-- D5 · Yogur con mango y tahini
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D5'), 1, '4 cdas de yogur natural entero, sin azúcar'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D5'), 2, '3 cdas de mango bien maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D5'), 3, '½ cdta de tahini (crema de ajonjolí), o semillas de chía o linaza molidas');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D5'), 1, 'Aplasta el mango con un tenedor.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D5'), 2, 'Disuelve el tahini en una cucharada de yogur y luego mezcla todo.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D5'), 7, 8, 'Todo mezclado; cuchara precargada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D5'), 9, 11, 'Mango en daditos blandos sobre el yogur.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D5'), 12, NULL, 'Añade copos de avena o fruta variada en trozos.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D5'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'D5'), (SELECT id FROM recetario.allergen WHERE slug = 'sesamo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D5'), (SELECT id FROM recetario.tag WHERE slug = 'calcio'), 'Calcio');

-- D6 · Gachas de quinoa con pera y canela
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), 1, '¼ taza de quinoa'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), 2, '¾ taza de agua'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), 3, '½ pera madura'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), 4, 'Pizca de canela'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), 5, 'Opcional: leche materna o fórmula al final');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), 1, 'Lava muy bien la quinoa en un colador (quita el sabor amargo).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), 2, 'Cocínala tapada 15 min con el agua y la pera en trocitos, hasta que los granos estén muy blandos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), 3, 'Tritura parcialmente con el tenedor o la batidora (no del todo liso) y añade la canela.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), 7, 8, 'Triturado grueso, con algo de leche para aflojar.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), 9, 11, 'Grano entero bien cocido y pera en trocitos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), 12, NULL, 'Con leche entera y fruta fresca troceada.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), (SELECT id FROM recetario.tag WHERE slug = 'alternativa-al-arroz'), 'Alternativa al arroz'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D6'), (SELECT id FROM recetario.tag WHERE slug = 'sin-gluten'), 'Sin gluten');

-- D7 · Tortitas de plátano maduro y huevo
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), 1, '½ plátano bien maduro (concha casi negra)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), 2, '1 huevo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), 3, 'Pizca de canela'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), 4, 'Unas gotas de aceite');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), 1, 'Aplasta el plátano (o licúalo con el huevo para una mezcla más lisa).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), 2, 'Mezcla con el huevo batido y la canela.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), 3, 'En sartén antiadherente a fuego medio-bajo, vierte cucharadas de mezcla y cocina 3 min por lado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), 4, 'Comprueba que el centro esté totalmente cuajado.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), 7, 8, 'En tiras del ancho de dos dedos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), 9, 11, 'En trocitos para practicar la pinza.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), 12, NULL, 'Enteras, con yogur y fruta.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), (SELECT id FROM recetario.tag WHERE slug = '2-ingredientes'), '2 ingredientes'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D7'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congelan');

-- D8 · Fororo sin azúcar con cambur
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), 1, '2 cdas de fororo (harina de maíz tostado)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), 2, '150 ml de agua o leche entera (apta en cocción)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), 3, '½ cambur maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), 4, '1 rama de canela o una pizca de canela molida');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), 1, 'Disuelve el fororo en el líquido frío para que no forme grumos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), 2, 'Cocina a fuego bajo 5–7 min, removiendo, hasta que espese. Retira la rama de canela.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), 3, 'Aplasta el cambur e incorpóralo. Sirve tibio.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), 7, 8, 'Espeso, con cuchara precargada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), 9, 11, 'Más espeso, con trocitos de fruta.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), 12, NULL, 'Puede prepararse con leche entera de vaca, igual sin papelón.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), TRUE, 'si usas leche');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), (SELECT id FROM recetario.tag WHERE slug = 'maiz'), 'Maíz tostado'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D8'), (SELECT id FROM recetario.tag WHERE slug = 'sin-gluten'), 'Sin gluten');

-- D9 · Mazamorra de jojoto sin azúcar
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), 1, '1 taza de granos de jojoto tierno'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), 2, '200 ml de agua o leche entera'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), 3, 'Canela'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), 4, 'Opcional: ½ cambur maduro');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), 1, 'Licúa los granos con el líquido.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), 2, 'Cuela para retirar los hollejos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), 3, 'Cocina a fuego bajo 8–10 min, removiendo sin parar, hasta que espese. Añade la canela.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), 4, 'Deja entibiar: espesa más al enfriar.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), 7, 8, 'Con cuchara, tal cual.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), 9, 11, 'Más espesa; fría puede cortarse en cuadritos blandos para comer con la mano.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), 12, NULL, 'Con fruta picada por encima.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), (SELECT id FROM recetario.tag WHERE slug = 'maiz'), 'Maíz tierno'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), (SELECT id FROM recetario.tag WHERE slug = 'sin-gluten'), 'Sin gluten'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D9'), (SELECT id FROM recetario.tag WHERE slug = 'sin-azucar'), 'Sin azúcar');

-- D10 · Arepita dominó: caraotas negras y queso fresco
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), 1, '1–2 arepitas blandas (P5)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), 2, '3 cdas de caraotas negras sin sal (P3), con un poco de su caldo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), 3, '1 cda de queso fresco bajo en sal o ricota'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), 4, 'De acompañante: mango, lechosa o mandarina');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), 1, 'Calienta las caraotas y aplástalas con un tenedor hasta formar una pasta untable.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), 2, 'Abre las arepitas y úntalas con las caraotas; desmenuza el queso encima.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), 3, 'Sirve con la fruta: su vitamina C ayuda a absorber el hierro de las caraotas.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), 7, 8, 'Tiras de arepa untadas, sin costra dura.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), 9, 11, 'Trocitos rellenos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), 12, NULL, 'Arepa dominó entera.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), (SELECT id FROM recetario.tag WHERE slug = 'harina-enriquecida'), 'Harina enriquecida');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), (SELECT id FROM recetario.recipe WHERE code = 'P3')),
  ((SELECT id FROM recetario.recipe WHERE code = 'D10'), (SELECT id FROM recetario.recipe WHERE code = 'P5'));

-- D11 · Panquecas de avena y auyama
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 1, '½ taza de avena en hojuelas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 2, '⅓ taza de auyama cocida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 3, '1 huevo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 4, '¼ taza de leche entera o agua'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 5, '½ cdta de polvo de hornear'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 6, 'Canela'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 7, 'Unas gotas de aceite');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 1, 'Licúa todo hasta tener una mezcla lisa. Deja reposar 5 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 2, 'Cocina cucharadas en sartén antiadherente a fuego medio-bajo, 2 min por lado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 3, 'Comprueba que el centro esté cocido.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 7, 8, 'En tiras.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 9, 11, 'En trocitos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), 12, NULL, 'Enteras con fruta y yogur.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-a'), 'Vitamina A'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D11'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congelan');

-- D12 · Arepitas de yuca
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), 1, '1 taza de yuca cocida y aplastada (P6), sin la hebra central'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), 2, '2–3 cdas de harina de maíz precocida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), 3, '1 cdta de aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), 4, 'Opcional: 1 cda de queso fresco bajo en sal rallado');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), 1, 'Aplasta la yuca aún caliente y mézclala con la harina hasta tener una masa manejable.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), 2, 'Forma arepitas finas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), 3, 'Cocina en budare o sartén tapada, a fuego bajo, 5 min por lado.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), 7, 8, 'Tiras blandas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), 9, 11, 'Trozos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), 12, NULL, 'Enteras, rellenas como la familia.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), (SELECT id FROM recetario.tag WHERE slug = 'sin-gluten'), 'Sin gluten'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), (SELECT id FROM recetario.tag WHERE slug = 'yuca-bien-cocida'), 'Yuca bien cocida');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D12'), (SELECT id FROM recetario.recipe WHERE code = 'P6'));

-- D13 · Guasacaca suave con huevo duro
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), 1, '½ aguacate maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), 2, '½ ají dulce sin semillas, muy picado'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), 3, '1 cdta de cilantro o perejil picado fino'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), 4, 'Unas gotas de limón'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), 5, '1 huevo duro (10–12 min de hervor)');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), 1, 'Aplasta o licúa el aguacate con el ají dulce, el cilantro y el limón.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), 2, 'Aplasta el huevo y mézclalo con la guasacaca, o sírvelo en gajos al lado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), 3, 'Úntala en tiras de arepita o de pan.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), 7, 8, 'Huevo aplastado dentro de la guasacaca, untado en tiras.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), 9, 11, 'Huevo picado; guasacaca para mojar.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), 12, NULL, 'Guasacaca familiar, sin sal ni ají picante en su porción.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D13'), (SELECT id FROM recetario.tag WHERE slug = 'grasas-saludables'), 'Grasas saludables');

-- D14 · Funche cremoso de maíz y auyama
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), 1, '3 cdas de harina de maíz precocida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), 2, '200 ml de agua o leche entera'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), 3, '2 cdas de auyama cocida y aplastada'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), 4, '1 cdta de mantequilla sin sal o aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), 5, 'Canela');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), 1, 'Disuelve la harina en el líquido frío.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), 2, 'Cocina a fuego bajo 5 min, removiendo, hasta que espese.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), 3, 'Añade la auyama, la mantequilla y la canela.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), 7, 8, 'Crema espesa con cuchara.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), 9, 11, 'Extiéndelo en un plato, déjalo enfriar y córtalo en bastones; dóralos en la sartén (tipo polenta).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), 12, NULL, 'Bastones con queso fresco o huevo.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), TRUE, 'si usas leche');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), (SELECT id FROM recetario.tag WHERE slug = 'sin-gluten'), 'Sin gluten'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D14'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-a'), 'Vitamina A');

-- D15 · Yogur con parchita colada y cambur
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), 1, '4 cdas de yogur natural entero, sin azúcar'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), 2, 'Pulpa de ½ parchita, colada (sin semillas)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), 3, '¼ de cambur maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), 4, 'Opcional: 1 cda de avena en hojuelas finas');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), 1, 'Cuela la pulpa de parchita.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), 2, 'Aplasta el cambur y mézclalo todo.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), 7, 8, 'Todo mezclado, con cuchara precargada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), 9, 11, 'Cambur en trocitos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), 12, NULL, 'Con avena y frutas en trozos.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-c'), 'Vitamina C'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D15'), (SELECT id FROM recetario.tag WHERE slug = 'sin-cocinar'), 'Sin cocinar');

-- D16 · Torrejas sin azúcar con fresas
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 1, '1 rebanada de pan integral bajo en sal (mejor del día anterior)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 2, '1 huevo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 3, '2 cdas de leche entera'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 4, 'Canela'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 5, '1 cdta de mantequilla sin sal'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 6, '2–3 fresas maduras');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 1, 'Bate el huevo con la leche y la canela. Empapa el pan por ambos lados.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 2, 'Cocina en sartén a fuego medio-bajo 2–3 min por lado, hasta que el centro no quede húmedo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 3, 'Corta según la edad y pon las fresas aplastadas encima.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 7, 8, 'Tiras de dos dedos de ancho.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 9, 11, 'Cuadritos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), 12, NULL, 'Entera, con fruta.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), (SELECT id FROM recetario.allergen WHERE slug = 'trigo'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'D16'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);

-- A1 · Pollo guisado con auyama y papa
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 1, '1 muslo de pollo sin piel (≈100 g)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 2, '1 taza de auyama en cubos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 3, '1 papa pequeña'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 4, '¼ de cebolla, ½ diente de ajo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 5, '1 tomate maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 6, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 7, 'Comino u orégano (opcional)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 8, 'Agua');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 1, 'Sofríe cebolla, ajo y tomate picados en el aceite, 5 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 2, 'Añade el pollo en trozos y séllalo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 3, 'Agrega auyama, papa y agua hasta cubrir. Cocina 25–30 min a fuego medio, hasta que el pollo se deshaga.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 4, 'Retira huesos y desmecha el pollo muy fino.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 7, 8, 'Aplastado con tenedor (grumoso, no licuado). O pollo muy desmechado + bastones de auyama y papa.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 9, 11, 'Pollo picado pequeño y verduras en dados blandos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), 12, NULL, 'Como la familia: la sal se añade solo en el plato de los adultos.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-a'), 'Vitamina A'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A1'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela 2–3 meses');

-- A2 · Lentejas rojas con zanahoria y tomate
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 1, '⅓ taza de lentejas rojas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 2, '1 zanahoria rallada'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 3, '½ tomate'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 4, '¼ de cebolla'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 5, 'Pizca de comino y de cúrcuma'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 6, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 7, '1 taza de agua');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 1, 'Haz un sofrito con la cebolla y el tomate.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 2, 'Añade las lentejas lavadas, la zanahoria, las especias y el agua.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 3, 'Cocina 15–20 min hasta que las lentejas se deshagan (no necesitan remojo).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 4, 'De postre, fruta con vitamina C: lechosa, mango, fresas o mandarina.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 7, 8, 'Tal cual: queda naturalmente cremoso. También untado en tiras de pan o con bastones de calabacín cocido.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 9, 11, 'Más espeso, con cuscús, quinoa o pasta.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), 12, NULL, 'Con pan pita o arepa, como la familia.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-c'), 'Vitamina C'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A2'), (SELECT id FROM recetario.tag WHERE slug = 'listo-en-20-min'), 'Listo en 20 min');

-- A3 · Pabellón para bebé: carne mechada, caraotas y plátano
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 1, '100 g de falda de res'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 2, '½ taza de caraotas negras cocidas sin sal (si son de lata, bien enjuagadas)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 3, '¼ de plátano maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 4, '2 cdas de arroz blanco cocido'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 5, '¼ de pimentón rojo, ¼ de cebolla, 1 diente de ajo, ½ tomate'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 6, 'Comino');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 1, 'Cocina la falda con cebolla y ajo (30–40 min en olla de presión) hasta que esté muy tierna.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 2, 'Desméchala muy fina y guísala 10 min con un sofrito de pimentón, cebolla y tomate.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 3, 'Calienta las caraotas y aplástalas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 4, 'Hornea el plátano en rodajas o bastones 20 min a 180 °C (sin freír).');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 7, 8, 'Carne mechada muy fina mezclada con las caraotas aplastadas; plátano aplastado o en bastón.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 9, 11, 'Hebras cortas de carne; caraotas ligeramente aplastadas con el dedo; plátano en trozos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), 12, NULL, 'Plato familiar completo, sin sal en su porción.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A3'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');

-- A4 · Pescado blanco con papa y brócoli
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), 1, '80 g de filete de merluza, mero o pargo, sin espinas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), 2, '1 papa pequeña'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), 3, '3 arbolitos de brócoli'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), 4, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), 5, 'Unas gotas de limón (opcional)');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), 1, 'Hierve la papa 15 min. Añade el brócoli en los últimos 7 min y el pescado en los últimos 5–6 min (o todo al vapor).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), 2, 'Desmenuza el pescado con los dedos para detectar cualquier espina.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), 3, 'Aplasta la papa con el aceite.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), 7, 8, 'Pescado desmenuzado dentro del puré grumoso; el brócoli entero como "arbolito" para agarrar por el tallo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), 9, 11, 'Escamas de pescado y brócoli en trocitos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), 12, NULL, 'Porción tipo familiar. Variante: añadir camarón bien cocido y picado fino (alérgeno marisco).');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), (SELECT id FROM recetario.allergen WHERE slug = 'pescado'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), (SELECT id FROM recetario.tag WHERE slug = 'proteina-magra'), 'Proteína magra'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A4'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-c'), 'Vitamina C');

-- A5 · Bastones blandos de res y calabacín
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 1, '150 g de carne molida de res magra'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 2, '½ calabacín rallado y bien escurrido'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 3, '2 cdas de avena molida o pan rallado'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 4, '1 huevo (omítelo si aún no lo has introducido)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 5, 'Orégano y una pizca de ajo en polvo');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 1, 'Mezcla todos los ingredientes.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 2, 'Forma bastones o "deditos" de 6–7 cm (no bolitas).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 3, 'Hornea 18–20 min a 180 °C, o cocínalos tapados 15 min en salsa de tomate casera.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 4, 'Deben quedar blandos y sin rosado por dentro.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 7, 8, 'Bastón entero para agarrar y chupar/morder, o desmenuzado en la salsa con cuchara.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 9, 11, 'En rodajas pequeñas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), 12, NULL, 'Con pasta y salsa de tomate, como la familia.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), TRUE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A5'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congelan');

-- A6 · Pasta con salmón, brócoli y ricota
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 1, '½ taza de pasta (fusilli o penne)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 2, '60 g de salmón sin piel ni espinas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 3, '3 arbolitos de brócoli'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 4, '2 cdas de ricota'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 5, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 6, 'Perejil o eneldo');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 1, 'Cuece la pasta en agua sin sal, unos minutos más de lo habitual (muy blanda).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 2, 'Cocina al vapor el salmón y el brócoli unos 8 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 3, 'Desmenuza el salmón y aplasta el brócoli con la ricota y el aceite: queda una salsa.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 4, 'Mezcla con la pasta.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 7, 8, 'Pasta grande (fusilli, penne) muy cocida para agarrar con la mano, con la salsa pegada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 9, 11, 'Pasta corta; trocitos de salmón y brócoli.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), 12, NULL, 'Plato familiar.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), (SELECT id FROM recetario.allergen WHERE slug = 'trigo'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), (SELECT id FROM recetario.allergen WHERE slug = 'pescado'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A6'), (SELECT id FROM recetario.tag WHERE slug = 'omega-3'), 'Omega-3');

-- A7 · Sancocho "seco" de pollo
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 1, '1 muslo de pollo sin piel'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 2, '1 trozo de yuca (≈80 g) y 1 de ocumo o ñame (≈60 g)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 3, '1 taza de auyama en trozos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 4, '¼ de cebolla, 1 ají dulce, ½ pimentón, 1 diente de ajo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 5, 'Cilantro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 6, 'Agua');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 1, 'Cocina el pollo con los aliños en agua 15 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 2, 'Añade la yuca y el ocumo pelados y en trozos; 15 min más.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 3, 'Agrega la auyama y cocina 10 min, hasta que todo esté muy blando.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 4, 'Saca los sólidos, desmecha el pollo y retira la hebra de la yuca. Sirve los sólidos con un poco de caldo.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 7, 8, 'Aplastado espeso, con muy poco caldo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 9, 11, 'Trozos blandos y pollo picado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), 12, NULL, 'Sopa familiar; el jojoto, desgranado y aplastado.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), (SELECT id FROM recetario.tag WHERE slug = 'receta-tradicional-venezolana'), 'Tubérculos criollos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A7'), (SELECT id FROM recetario.recipe WHERE code = 'P1'));

-- A8 · Picadillo de carne con papa y zanahoria
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 1, '120 g de carne molida magra de res'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 2, '1 papa pequeña y 1 zanahoria en cubitos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 3, '1 cubo de sofrito (P2) o ½ tomate, ¼ de cebolla y 1 ají dulce'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 4, 'Comino'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 5, '1 cdta de aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 6, '½ taza de agua');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 1, 'Sofríe los aliños en el aceite.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 2, 'Añade la carne y desgránala bien hasta que no quede nada rosado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 3, 'Agrega papa, zanahoria y agua. Tapa y cocina 15–20 min, hasta que esté muy blando.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 7, 8, 'Aplástalo todo junto: la papa une la carne en una masa fácil de tragar.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 9, 11, 'Trocitos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), 12, NULL, 'Con arroz o arepa.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A8'), (SELECT id FROM recetario.recipe WHERE code = 'P2'));

-- A9 · Higaditos encebollados con puré de auyama
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 1, '2 higaditos de pollo (≈50 g)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 2, '¼ de cebolla y ½ tomate'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 3, '1 cdta de aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 4, '1 taza de auyama cocida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 5, '½ papa cocida');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 1, 'Limpia los higaditos (quita nervios y cualquier parte verdosa).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 2, 'Sofríe cebolla y tomate; añade el hígado y cocina 6–8 min, hasta que no quede rosado por dentro.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 3, 'Pícalo muy fino o tritúralo con una cucharada del jugo de cocción.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 4, 'Aplasta la auyama con la papa y mezcla.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 7, 8, 'Hígado triturado dentro del puré.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 9, 11, 'Hígado picado fino.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), 12, NULL, 'Encebollado como la familia.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A9'), (SELECT id FROM recetario.tag WHERE slug = 'max-1-vez-por-semana'), 'Máx. 1 vez por semana');

-- A10 · Lentejas guisadas con plátano maduro
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 1, '⅓ taza de lentejas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 2, '½ zanahoria y 1 trozo de auyama'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 3, '1 cubo de sofrito (P2) con pimentón rojo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 4, 'Comino'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 5, '¼ de plátano maduro horneado (P4)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 6, 'Agua');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 1, 'Cocina las lentejas con los vegetales, el sofrito y agua: 30–40 min (12 min en olla de presión), hasta que estén muy blandas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 2, 'Aplasta parte para espesar.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 3, 'Sirve con el plátano al lado.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 7, 8, 'Lentejas aplastadas (pásalas por pasapuré si la piel molesta) y plátano en bastón o aplastado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 9, 11, 'Ligeramente aplastadas; plátano en trozos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), 12, NULL, 'Plato familiar, con arroz.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-c'), 'Vitamina C del pimentón'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), (SELECT id FROM recetario.recipe WHERE code = 'P2')),
  ((SELECT id FROM recetario.recipe WHERE code = 'A10'), (SELECT id FROM recetario.recipe WHERE code = 'P4'));

-- A11 · Sardinas con puré de papa y tomate
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 1, '2 sardinas en lata, en agua o aceite de oliva (sin salsa), o 2 sardinas frescas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 2, '1 papa'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 3, '½ tomate maduro sin piel'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 4, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 5, 'Perejil');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 1, 'De lata: escúrrelas y aplástalas bien con el tenedor. Las espinas de lata son blandas, se deshacen y aportan calcio.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 2, 'Frescas: hornéalas 12 min a 200 °C y retira con cuidado la espina central y todas las espinas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 3, 'Haz un puré con la papa hervida y el aceite. Ralla el tomate y caliéntalo 3 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 4, 'Mezcla la sardina con el puré y el tomate.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 7, 8, 'Sardina aplastada dentro del puré.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 9, 11, 'Escamas de sardina y puré con grumos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), 12, NULL, 'Sardina sobre arepa o pan.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), (SELECT id FROM recetario.allergen WHERE slug = 'pescado'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), (SELECT id FROM recetario.tag WHERE slug = 'omega-3'), 'Omega-3'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A11'), (SELECT id FROM recetario.tag WHERE slug = 'calcio'), 'Calcio');

-- A12 · Pastel de plátano y pescado (pastel de chucho, versión segura)
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 1, '1 plátano maduro (P4)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 2, '100 g de merluza, pargo o corvina sin espinas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 3, '1 cubo de sofrito (P2)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 4, '1 cdta de aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 5, 'Opcional: 2 cdas de queso fresco bajo en sal');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 1, 'Aplasta el plátano.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 2, 'Sofríe el pescado con el sofrito 5 min y desmenúzalo con los dedos, revisando espinas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 3, 'En un molde pequeño, haz capas: plátano, pescado, plátano. Queso encima si lo usas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 4, 'Hornea 15 min a 180 °C.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 7, 8, 'Porción aplastada y mezclada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 9, 11, 'Cuadritos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), 12, NULL, 'Porción familiar.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), (SELECT id FROM recetario.allergen WHERE slug = 'pescado'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), TRUE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), (SELECT id FROM recetario.tag WHERE slug = 'sin-cazon'), 'Sin cazón'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), (SELECT id FROM recetario.recipe WHERE code = 'P2')),
  ((SELECT id FROM recetario.recipe WHERE code = 'A12'), (SELECT id FROM recetario.recipe WHERE code = 'P4'));

-- A13 · Arroz con pollo y vegetales
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 1, '1 muslo de pollo en trozos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 2, '¼ taza de arroz blanco'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 3, '¼ taza de zanahoria, arvejas y pimentón picados'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 4, '1 cubo de sofrito (P2)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 5, 'Pizca de onoto o cúrcuma'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 6, 'Agua o caldo casero (P1)');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 1, 'Sofríe el sofrito con el onoto y dora el pollo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 2, 'Añade el arroz, los vegetales y agua generosa (unas 3 veces el volumen del arroz).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 3, 'Cocina tapado 20–25 min, hasta que el arroz quede blando y meloso.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 4, 'Desmecha el pollo.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 7, 8, 'Meloso y aplastado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 9, 11, 'Arroz suelto con pollo picado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), 12, NULL, 'Plato familiar.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), (SELECT id FROM recetario.tag WHERE slug = 'arroz-con-moderacion'), 'Arroz con moderación');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), (SELECT id FROM recetario.recipe WHERE code = 'P1')),
  ((SELECT id FROM recetario.recipe WHERE code = 'A13'), (SELECT id FROM recetario.recipe WHERE code = 'P2'));

-- A14 · Carne guisada con papa y vainitas
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 1, '120 g de pulpa negra o muchacho de res'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 2, '1 papa'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 3, '6 vainitas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 4, '1 cubo de sofrito (P2)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 5, 'Comino y orégano'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 6, '1 cdta de aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 7, 'Agua');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 1, 'Dora la carne en trozos con el aceite; añade el sofrito y las especias.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 2, 'Cubre con agua y cocina en olla de presión 30–35 min (o 1,5 h en olla normal), hasta que se deshaga.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 3, 'Añade la papa y las vainitas los últimos 15 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 4, 'Desmecha la carne en la salsa.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 7, 8, 'Carne muy mechada en la salsa, papa aplastada; vainitas enteras y blandas para agarrar.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 9, 11, 'Trocitos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), 12, NULL, 'Plato familiar.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), (SELECT id FROM recetario.tag WHERE slug = 'olla-de-presion'), 'Olla de presión'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A14'), (SELECT id FROM recetario.recipe WHERE code = 'P2'));

-- A15 · Pasta con pollo en salsa de auyama
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 1, '½ taza de pasta (fusilli o penne)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 2, '½ taza de auyama cocida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 3, '2–3 cdas de pollo desmechado'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 4, '2 cdas de leche entera o agua de la pasta'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 5, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 6, 'Pizca de nuez moscada');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 1, 'Cuece la pasta en agua sin sal hasta que esté muy blanda.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 2, 'Licúa la auyama con la leche, el aceite y la nuez moscada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 3, 'Mezcla la salsa con la pasta y el pollo.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 7, 8, 'Pasta grande para agarrar, con la salsa pegada; pollo muy fino.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 9, 11, 'Pasta corta.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), 12, NULL, 'Plato familiar.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), (SELECT id FROM recetario.allergen WHERE slug = 'trigo'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A15'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-a'), 'Vitamina A');

-- A16 · Ensalada tibia de atún, papa y vainitas
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 1, '2 cdas de atún claro en lata, en agua, escurrido'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 2, '1 papa pequeña'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 3, '4 vainitas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 4, '¼ de zanahoria'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 5, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 6, 'Unas gotas de limón'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 7, 'Opcional: ½ huevo duro');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 1, 'Hierve papa, zanahoria y vainitas hasta que estén muy blandas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 2, 'Aplasta la papa con el aceite y el limón.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 3, 'Desmenuza el atún y mezcla todo.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 7, 8, 'Atún mezclado con la papa aplastada; vainitas enteras para agarrar.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 9, 11, 'Trocitos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), 12, NULL, 'Ensalada familiar.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), (SELECT id FROM recetario.allergen WHERE slug = 'pescado'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), TRUE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A16'), (SELECT id FROM recetario.tag WHERE slug = 'atun-claro'), 'Atún claro');

-- A17 · Quinchonchos guisados con auyama
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 1, '½ taza de quinchonchos secos (remojados 8–12 h) o 1 taza de frescos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 2, '1 taza de auyama en trozos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 3, '1 cubo de sofrito (P2)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 4, 'Comino'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 5, '1 cdta de aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 6, 'Agua');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 1, 'Cocina los quinchonchos en agua sin sal hasta que estén muy blandos (olla de presión 20–25 min; frescos, 20 min).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 2, 'Añade el sofrito, la auyama, el comino y un poco de su caldo. Cocina 15 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 3, 'Aplasta parte para espesar.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 7, 8, 'Aplastado o pasado por pasapuré (la piel puede molestar).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 9, 11, 'Ligeramente aplastado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), 12, NULL, 'Con arroz y plátano, como la familia.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), (SELECT id FROM recetario.tag WHERE slug = 'receta-tradicional-venezolana'), 'Oriente venezolano'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A17'), (SELECT id FROM recetario.recipe WHERE code = 'P2'));

-- A18 · Croquetas al horno de pescado y yuca
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 1, '100 g de pescado blanco cocido, sin espinas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 2, '1 taza de yuca cocida y aplastada (P6)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 3, '1 huevo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 4, 'Perejil picado'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 5, '2 cdas de harina de maíz para cubrir'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 6, 'Aceite para la bandeja');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 1, 'Mezcla el pescado desmenuzado, la yuca, el huevo y el perejil.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 2, 'Forma croquetas alargadas, del tamaño de un dedo (no bolitas).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 3, 'Pásalas por la harina y colócalas en una bandeja engrasada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 4, 'Hornea 20 min a 200 °C, volteándolas a la mitad.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 7, 8, 'Croqueta entera para agarrar (blanda por dentro).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 9, 11, 'En rodajas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), 12, NULL, 'Con ensalada o vegetales.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), (SELECT id FROM recetario.allergen WHERE slug = 'pescado'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congelan');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'A18'), (SELECT id FROM recetario.recipe WHERE code = 'P6'));

-- M1 · Fruta lista en 2 minutos: guía de cortes
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M1'), 1, 'Fruta madura de temporada (ver guía de cortes por fruta)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M1'), 2, 'Opcional: 2–3 cdas de yogur natural, queso fresco bajo en sal o una tira de pan con crema de frutos secos fina (M6)');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M1'), 1, 'Elige una fruta bien madura y córtala según la edad (tabla de cortes por fruta).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M1'), 2, 'Retira semillas, huesos y pieles duras.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M1'), 3, 'Combínala con una fuente de proteína o grasa para una merienda más completa.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M1'), 7, 8, 'Tiras gruesas y blandas para agarrar con el puño, o fruta aplastada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M1'), 9, 11, 'Dados blandos para practicar la pinza.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M1'), 12, NULL, 'Trozos de bocado, como la familia.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M1'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-c'), 'Vitamina C'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M1'), (SELECT id FROM recetario.tag WHERE slug = 'sin-cocinar'), 'Sin cocinar');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M1'), (SELECT id FROM recetario.recipe WHERE code = 'M6'));

-- M2 · Muffins de avena, manzana y zanahoria (sin azúcar)
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 1, '1 taza de avena molida (o mitad avena, mitad harina integral)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 2, '1 cambur muy maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 3, '1 manzana rallada'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 4, '1 zanahoria rallada fina'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 5, '1 huevo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 6, '2 cdas de aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 7, '1 cdta de polvo de hornear'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 8, 'Canela');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 1, 'Precalienta el horno a 180 °C.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 2, 'Aplasta el cambur y mézclalo con el huevo, el aceite, la manzana y la zanahoria.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 3, 'Añade la avena, el polvo de hornear y la canela.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 4, 'Reparte en un molde de mini-muffins (≈ 12) y hornea 15–18 min, hasta que un palillo salga limpio.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 7, 8, 'Partido por la mitad o en tiras.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 9, 11, 'En trozos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), 12, NULL, 'Entero; perfecto para salidas.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congelan 2 meses'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M2'), (SELECT id FROM recetario.tag WHERE slug = 'avena-puede-contener-gluten'), 'Avena: puede contener gluten');

-- M3 · Hummus suave con bastones de batata
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), 1, '½ taza de garbanzos cocidos sin sal'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), 2, '1 cda de tahini'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), 3, 'Jugo de ½ limón'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), 4, '2–3 cdas de agua'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), 5, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), 6, '1 batata (boniato) mediana');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), 1, 'Corta la batata en bastones de 5–6 cm y hornéala 25 min a 200 °C, hasta que esté muy blanda.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), 2, 'Tritura los garbanzos (mejor sin piel) con el tahini, el limón, el agua y el aceite hasta que quede muy liso.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), 7, 8, 'Bastón de batata untado en hummus, o hummus con cuchara.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), 9, 11, 'Tiras de pan pita o arepita para mojar.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), 12, NULL, 'Con verduras cocidas o pan, en la merienda o el almuerzo.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), (SELECT id FROM recetario.allergen WHERE slug = 'sesamo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M3'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-a'), 'Vitamina A');

-- M4 · Galletas blandas de cambur y avena
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), 1, '1 cambur muy maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), 2, '½ taza de copos de avena finos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), 3, 'Canela (opcional)');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), 1, 'Aplasta el cambur y mezcla con la avena. Deja reposar 5 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), 2, 'Forma galletas planas en una bandeja con papel de horno.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), 3, 'Hornea 12–15 min a 180 °C. Deben quedar blandas: que se deshagan al presionarlas entre los dedos.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), 7, 8, 'En tiras, siempre blandas (no tostadas ni duras).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), 9, 11, 'Enteras pequeñas o en trozos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), 12, NULL, 'Enteras.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), (SELECT id FROM recetario.tag WHERE slug = '2-ingredientes'), '2 ingredientes'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), (SELECT id FROM recetario.tag WHERE slug = 'sin-azucar'), 'Sin azúcar'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M4'), (SELECT id FROM recetario.tag WHERE slug = 'avena-puede-contener-gluten'), 'Avena: puede contener gluten');

-- M5 · Pera o manzana asada con yogur y canela
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M5'), 1, '1 pera o manzana'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M5'), 2, '3 cdas de yogur natural entero'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M5'), 3, 'Canela');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M5'), 1, 'Corta la fruta en gajos, espolvorea canela y hornea 20–25 min a 180 °C (o cocina tapada en sartén con un poco de agua).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M5'), 2, 'Sirve tibia con el yogur.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M5'), 7, 8, 'Gajos blandos para agarrar, o aplastada dentro del yogur.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M5'), 9, 11, 'En dados.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M5'), 12, NULL, 'Con copos de avena o frutos secos molidos por encima.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M5'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M5'), (SELECT id FROM recetario.tag WHERE slug = 'facil-para-dias-de-dientes'), 'Fácil para días de dientes');

-- M6 · Tiras de pan integral con crema de almendras y fresa
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), 1, '1 rebanada de pan integral (sin semillas enteras, bajo en sal)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), 2, '½ cdta de crema de almendras o de merey 100%'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), 3, '1–2 fresas maduras');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), 1, 'Tuesta ligeramente el pan (que quede firme por fuera pero no duro).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), 2, 'Diluye la crema de almendras con unas gotas de agua tibia y úntala en capa muy fina.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), 3, 'Aplasta las fresas encima.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), 7, 8, 'En tiras de dos dedos de ancho.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), 9, 11, 'En cuadritos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), 12, NULL, 'Rebanada entera; fruta en trozos.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), (SELECT id FROM recetario.allergen WHERE slug = 'frutos_secos'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), (SELECT id FROM recetario.allergen WHERE slug = 'trigo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M6'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-c'), 'Vitamina C');

-- M7 · Plátano horneado con queso fresco
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M7'), 1, '½ plátano muy maduro (P4)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M7'), 2, '1–2 cdas de queso fresco bajo en sal, ricota o requesón'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M7'), 3, 'Canela');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M7'), 1, 'Hornea el plátano hasta que esté muy blando.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M7'), 2, 'Ábrelo, espolvorea canela y pon el queso desmenuzado encima.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M7'), 7, 8, 'Bastones con el queso desmenuzado encima.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M7'), 9, 11, 'Trozos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M7'), 12, NULL, '"Plátano con queso" entero.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M7'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M7'), (SELECT id FROM recetario.tag WHERE slug = '2-ingredientes'), '2 ingredientes');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M7'), (SELECT id FROM recetario.recipe WHERE code = 'P4'));

-- M8 · Bowl tropical: lechosa, mango y patilla con yogur
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), 1, '2 cdas de lechosa madura'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), 2, '2 cdas de mango maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), 3, '2 cdas de patilla sin semillas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), 4, '3 cdas de yogur natural entero, sin azúcar');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), 1, 'Retira todas las semillas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), 2, 'Corta o aplasta la fruta según la edad y sirve con el yogur.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), 7, 8, 'Tiras grandes para agarrar, o aplastada dentro del yogur.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), 9, 11, 'Dados blandos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), 12, NULL, 'Dados, con avena por encima.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-c'), 'Vitamina C'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M8'), (SELECT id FROM recetario.tag WHERE slug = 'sin-cocinar'), 'Sin cocinar');

-- M9 · Compota casera de guayaba y manzana
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), 1, '2 guayabas maduras'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), 2, '1 manzana'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), 3, 'Canela'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), 4, '3–4 cdas de agua');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), 1, 'Pela la manzana y córtala junto con las guayabas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), 2, 'Cocina con el agua 10 min, tapado, hasta que esté blando.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), 3, 'Licúa y cuela para retirar las semillas de la guayaba.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), 7, 8, 'Tal cual, o mezclada en avena o yogur.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), 9, 11, 'Más espesa.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), 12, NULL, 'Para untar en pan o arepita.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-c'), 'Vitamina C (muy alta)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), (SELECT id FROM recetario.tag WHERE slug = 'sin-azucar'), 'Sin azúcar'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M9'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');

-- M10 · Majarete sin azúcar
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 1, '½ taza de granos de jojoto tierno (o 3 cdas de harina de maíz precocida)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 2, '½ taza de leche de coco sin azúcar'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 3, '½ taza de agua'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 4, '1 cambur muy maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 5, 'Canela en rama y una pizca de nuez moscada');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 1, 'Licúa el jojoto con la leche de coco y el agua; cuela.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 2, 'Añade el cambur licuado, la canela y la nuez moscada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 3, 'Cocina a fuego bajo 10–12 min, removiendo sin parar, hasta que espese.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 4, 'Vierte en recipientes pequeños y refrigera 1 h.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 7, 8, 'Con cuchara precargada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 9, 11, 'Con cuchara, solo o con fruta.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), 12, NULL, 'En cuadritos, como postre familiar.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), (SELECT id FROM recetario.tag WHERE slug = 'maiz'), 'Maíz y coco'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), (SELECT id FROM recetario.tag WHERE slug = 'receta-tradicional-venezolana'), 'Postre tradicional'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M10'), (SELECT id FROM recetario.tag WHERE slug = 'sin-azucar'), 'Sin azúcar');

-- M11 · Galletas blandas de auyama y avena
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), 1, '½ taza de auyama cocida y aplastada'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), 2, '1 taza de avena en hojuelas finas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), 3, '1 huevo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), 4, 'Canela'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), 5, '1 cda de aceite');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), 1, 'Mezcla todo y deja reposar 10 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), 2, 'Forma galletas planas sobre papel de horno.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), 3, 'Hornea 15 min a 180 °C. Deben quedar blandas, no tostadas.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), 7, 8, 'Tiras blandas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), 9, 11, 'Enteras pequeñas o en trozos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), 12, NULL, 'Enteras.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-a'), 'Vitamina A'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M11'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congelan');

-- M12 · Hummus de caraotas negras con bastones
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 1, '½ taza de caraotas negras sin sal (P3)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 2, '1 cdta de tahini (opcional)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 3, 'Jugo de ½ limón'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 4, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 5, 'Comino'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 6, 'Caldo de las caraotas o agua'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 7, 'Para mojar: bastones de arepita (P5), yuca cocida o batata');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 1, 'Licúa todo hasta que quede muy liso, añadiendo caldo si hace falta.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 2, 'Sirve con los bastones para mojar.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 7, 8, 'Untado en bastones o con cuchara.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 9, 11, 'Para mojar trozos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), 12, NULL, 'Dip familiar.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), (SELECT id FROM recetario.allergen WHERE slug = 'sesamo'), TRUE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-c'), 'Vitamina C del limón');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), (SELECT id FROM recetario.recipe WHERE code = 'P3')),
  ((SELECT id FROM recetario.recipe WHERE code = 'M12'), (SELECT id FROM recetario.recipe WHERE code = 'P5'));

-- M13 · Mango con requesón y coco rallado
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M13'), 1, 'Tiras de mango maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M13'), 2, '2 cdas de requesón o ricota'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M13'), 3, '1 cdta de coco rallado fino, sin azúcar');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M13'), 1, 'Pasa las tiras de mango por el coco rallado: así agarran mejor y no resbalan.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M13'), 2, 'Sirve con el requesón para untar o mojar.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M13'), 7, 8, 'Tiras rebozadas en coco.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M13'), 9, 11, 'Dados.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M13'), 12, NULL, 'Todo mezclado.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M13'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M13'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-c'), 'Vitamina C');

-- M14 · Huevo duro con aguacate y tomate
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M14'), 1, '1 huevo duro (10–12 min de hervor)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M14'), 2, '¼ de aguacate'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M14'), 3, '½ tomate sin piel ni semillas');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M14'), 1, 'Corta el huevo en gajos a lo largo, o aplástalo con el aguacate.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M14'), 2, 'Sirve el tomate picado al lado.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M14'), 7, 8, 'Gajos de huevo o huevo aplastado con aguacate.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M14'), 9, 11, 'Picado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M14'), 12, NULL, 'En rebanadas.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M14'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M14'), (SELECT id FROM recetario.tag WHERE slug = 'grasas-saludables'), 'Grasas saludables');

-- M15 · Arepitas dulces sin azúcar (cambur y anís)
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), 1, '½ taza de harina de maíz precocida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), 2, '½ cambur muy maduro aplastado'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), 3, 'Pizca de anís dulce molido'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), 4, 'Agua tibia (la necesaria)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), 5, '1 cdta de aceite');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), 1, 'Mezcla la harina con el cambur, el anís y el aceite; añade agua hasta tener una masa suave.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), 2, 'Forma arepitas pequeñas y finas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), 3, 'Cocina en budare o sartén tapada, a fuego bajo, 5–6 min por lado.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), 7, 8, 'Tiras blandas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), 9, 11, 'Trozos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), 12, NULL, 'Enteras.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), (SELECT id FROM recetario.tag WHERE slug = 'harina-enriquecida'), 'Harina enriquecida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), (SELECT id FROM recetario.tag WHERE slug = 'sin-freir'), 'Sin freír'),
  ((SELECT id FROM recetario.recipe WHERE code = 'M15'), (SELECT id FROM recetario.tag WHERE slug = 'sin-azucar'), 'Sin azúcar');

-- C1 · Tortilla al horno de papa y calabacín
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), 1, '2 huevos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), 2, '1 papa pequeña cocida, en cubitos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), 3, '½ calabacín rallado y escurrido'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), 4, '¼ de cebolla picada fina (opcional)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), 5, '1 cdta de aceite de oliva');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), 1, 'Sofríe la cebolla y el calabacín 5 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), 2, 'Bate los huevos y mezcla con la papa y el calabacín.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), 3, 'Vierte en un molde pequeño engrasado y hornea 20 min a 180 °C, hasta que el centro esté firme.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), 7, 8, 'Bastones de 5–6 cm.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), 9, 11, 'Cuadritos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), 12, NULL, 'Porción como la familia. Variante: añadir camarón picado bien cocido.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C1'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');

-- C2 · Crema de auyama con lentejas rojas
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 1, '1 taza de auyama en cubos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 2, '2 cdas de lentejas rojas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 3, '¼ de cebolla'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 4, '1 zanahoria'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 5, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 6, 'Agua o caldo casero sin sal');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 1, 'Sofríe la cebolla, añade el resto y cubre con agua.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 2, 'Cocina 20 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 3, 'Tritura dejando algo de textura. De postre, una fruta con vitamina C.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 7, 8, 'Espesa, para tomar con cuchara o mojar tiras de pan o arepita.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 9, 11, 'Menos triturada, con trocitos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), 12, NULL, 'Como crema para toda la familia.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), (SELECT id FROM recetario.tag WHERE slug = 'vitamina-a'), 'Vitamina A'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C2'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');

-- C3 · Salmón al horno con batata y guisantes
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), 1, '60–80 g de salmón sin piel ni espinas'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), 2, '½ batata'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), 3, '2 cdas de guisantes (arvejas) cocidos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), 4, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), 5, 'Eneldo o perejil');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), 1, 'Hornea la batata en bastones 25 min a 200 °C. En los últimos 12 min añade el salmón a la bandeja.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), 2, 'Aplasta los guisantes con el aceite (la piel entera de los guisantes puede ser difícil).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), 3, 'Desmenuza el salmón revisando espinas.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), 7, 8, 'Salmón en escamas grandes y blandas; batata en bastón; guisantes aplastados.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), 9, 11, 'Todo en trocitos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), 12, NULL, 'Porción familiar.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), (SELECT id FROM recetario.allergen WHERE slug = 'pescado'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C3'), (SELECT id FROM recetario.tag WHERE slug = 'omega-3'), 'Omega-3');

-- C4 · Cachapitas sin azúcar con queso fresco
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), 1, '1 taza de granos de maíz tierno (jojoto)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), 2, '2–3 cdas de harina de maíz precocida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), 3, '2–3 cdas de leche entera'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), 4, '1 huevo (opcional)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), 5, 'Queso fresco bajo en sal o ricota');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), 1, 'Licúa el maíz con la leche y el huevo hasta que quede lo más liso posible; añade la harina para espesar.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), 2, 'Cocina cucharadas pequeñas en sartén antiadherente a fuego medio-bajo, 3 min por lado, hasta que estén bien hechas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), 3, 'Unta con queso fresco o ricota.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), 7, 8, '— (desde 9 meses) Si quieres darla antes, en tiras muy finas y bien cocidas.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), 9, 11, 'Tiras o trozos pequeños untados de queso.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), 12, NULL, 'Cachapita entera, como la familia.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), TRUE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C4'), (SELECT id FROM recetario.tag WHERE slug = 'maiz'), 'Maíz');

-- C5 · Cuscús con pollo mechado y verduras
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), 1, '¼ taza de cuscús'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), 2, '¼ taza de agua hirviendo o caldo casero sin sal'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), 3, '2–3 cdas de pollo mechado (sobras de A1)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), 4, 'Calabacín y zanahoria cocidos en dados pequeños'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), 5, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), 6, 'Comino');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), 1, 'Cubre el cuscús con el agua hirviendo, tapa y deja 5 min. Suelta con un tenedor.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), 2, 'Mezcla con el pollo, las verduras, el aceite y el comino.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), 7, 8, 'Con cuchara; o compacta pequeñas porciones alargadas con la mano para que las agarre.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), 9, 11, 'Tal cual, con cuchara o con los dedos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), 12, NULL, 'Como guarnición familiar.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), (SELECT id FROM recetario.allergen WHERE slug = 'trigo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), (SELECT id FROM recetario.tag WHERE slug = 'listo-en-15-min-con-sobras'), 'Listo en 15 min con sobras');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C5'), (SELECT id FROM recetario.recipe WHERE code = 'A1'));

-- C6 · Tortitas de brócoli, garbanzo y queso
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 1, '½ taza de garbanzos cocidos sin sal'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 2, '½ taza de brócoli cocido'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 3, '2 cdas de queso fresco bajo en sal rallado'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 4, '1 huevo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 5, '2 cdas de avena molida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 6, 'Ajo en polvo, una pizca');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 1, 'Tritura los garbanzos y el brócoli (que quede con algo de textura).'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 2, 'Mezcla con el huevo, el queso, la avena y el ajo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 3, 'Forma tortitas planas y hornea 18–20 min a 190 °C, o cocina en sartén 3–4 min por lado.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 7, 8, 'Tiras.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 9, 11, 'Trozos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), 12, NULL, 'Enteras, con yogur o hummus para mojar.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'C6'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL);

-- C7 · Tofu dorado en bastones con verduras
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), 1, '80 g de tofu firme'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), 2, '1 cdta de aceite de oliva'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), 3, 'Pimentón rojo y calabacín'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), 4, 'Orégano o comino'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), 5, 'Acompañamiento: quinoa (D6, sin la pera) o batata');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), 1, 'Escurre el tofu y córtalo en bastones gruesos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), 2, 'Dóralos en una sartén antiadherente con el aceite y las especias, 3–4 min por lado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), 3, 'Saltea el pimentón y el calabacín en tiras hasta que estén blandos.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), 7, 8, 'Bastones de tofu y verduras blandas en tiras.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), 9, 11, 'Dados.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), 12, NULL, 'Salteado familiar (sin salsa de soya: es muy salada).');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), (SELECT id FROM recetario.allergen WHERE slug = 'soya'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), (SELECT id FROM recetario.tag WHERE slug = 'calcio'), 'Calcio');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C7'), (SELECT id FROM recetario.recipe WHERE code = 'D6'));

-- C8 · Pisca andina espesa
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 1, '1 papa mediana en cubitos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 2, 'Cebollín y cilantro picados'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 3, '1 cdta de mantequilla sin sal o aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 4, '150 ml de agua y 50 ml de leche entera'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 5, '1 huevo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 6, '1 cda de queso fresco bajo en sal');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 1, 'Sofríe el cebollín; añade la papa y el agua. Cocina 15 min, hasta que esté muy blanda.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 2, 'Aplasta parte de la papa para espesar y añade la leche.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 3, 'Incorpora el huevo batido en hilo, removiendo, y cocina 3–4 min hasta que esté totalmente cuajado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 4, 'Termina con cilantro y queso.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 7, 8, 'Espesa y aplastada: más papa que caldo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 9, 11, 'Con trocitos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), 12, NULL, 'Como la familia, con arepa (la sal, en el plato de los adultos).');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C8'), (SELECT id FROM recetario.tag WHERE slug = 'receta-tradicional-venezolana'), 'Receta andina');

-- C9 · Crema de apio criollo con pollo
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 1, '1 trozo de apio criollo (≈100 g)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 2, '½ zanahoria'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 3, '¼ de cebolla y ½ diente de ajo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 4, '2–3 cdas de pollo desmechado'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 5, '1 cdta de aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 6, 'Caldo casero sin sal (P1) o agua');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 1, 'Pela y corta el apio criollo y la zanahoria.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 2, 'Sofríe cebolla y ajo; añade los vegetales y cubre con caldo. Cocina 20 min, hasta que estén muy blandos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 3, 'Licúa con poco líquido, para que quede espesa. Añade el pollo desmechado fino.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 7, 8, 'Crema espesa con pollo muy fino.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 9, 11, 'Con trocitos de vegetales.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), 12, NULL, 'Crema familiar.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C9'), (SELECT id FROM recetario.recipe WHERE code = 'P1'));

-- C10 · Arepita reina pepiada suave
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 1, '1–2 arepitas blandas (P5)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 2, '3 cdas de pollo desmechado fino'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 3, '¼ de aguacate maduro'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 4, 'Unas gotas de limón'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 5, 'Cilantro picado fino'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 6, 'Opcional: 1 cda de yogur natural');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 1, 'Aplasta el aguacate con el limón, el cilantro y el yogur.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 2, 'Mezcla con el pollo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 3, 'Rellena o unta las arepitas.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 7, 8, 'Tiras de arepa untadas con el relleno.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 9, 11, 'Trozos rellenos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), 12, NULL, 'Arepa entera.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), TRUE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), (SELECT id FROM recetario.tag WHERE slug = 'sin-mayonesa'), 'Sin mayonesa');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C10'), (SELECT id FROM recetario.recipe WHERE code = 'P5'));

-- C11 · Tortilla de plátano maduro y queso
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 1, '½ plátano maduro (P4)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 2, '2 huevos'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 3, '1 cda de queso fresco bajo en sal rallado'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 4, 'Cebollín picado'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 5, '1 cdta de aceite');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 1, 'Corta el plátano en rodajas finas o aplástalo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 2, 'Bate los huevos con el queso y el cebollín.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 3, 'En una sartén pequeña con el aceite, pon el plátano y vierte el huevo. Tapa y cocina a fuego bajo 6–8 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 4, 'Voltea y cocina 2 min más, hasta que el centro esté firme.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 7, 8, 'Bastones.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 9, 11, 'Cuadritos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), 12, NULL, 'Porción familiar.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL),
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C11'), (SELECT id FROM recetario.recipe WHERE code = 'P4'));

-- C12 · Crema de jojoto y calabacín con huevo
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 1, '1 taza de granos de jojoto'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 2, '½ calabacín'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 3, '¼ de cebolla'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 4, '1 cdta de aceite'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 5, 'Agua o caldo casero (P1)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 6, '1 huevo duro');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 1, 'Sofríe la cebolla; añade el jojoto, el calabacín y el líquido justo para cubrir. Cocina 15 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 2, 'Licúa y cuela para quitar los hollejos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 3, 'Sirve espesa, con el huevo duro rallado o aplastado encima.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 7, 8, 'Espesa, con cuchara o para mojar arepita.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 9, 11, 'Con huevo picado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), 12, NULL, 'Crema familiar.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), (SELECT id FROM recetario.allergen WHERE slug = 'huevo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), (SELECT id FROM recetario.tag WHERE slug = 'ligera'), 'Ligera'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), (SELECT id FROM recetario.tag WHERE slug = 'maiz'), 'Maíz tierno');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C12'), (SELECT id FROM recetario.recipe WHERE code = 'P1'));

-- C13 · Pasta boloñesa casera
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 1, '½ taza de pasta'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 2, '100 g de carne molida de res'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 3, '2 tomates maduros (o 4 cdas de tomate triturado sin sal añadida)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 4, '1 cubo de sofrito (P2)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 5, '½ zanahoria rallada'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 6, 'Orégano o albahaca'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 7, '1 cdta de aceite');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 1, 'Sofríe el sofrito; añade la carne y desgránala hasta que no quede rosada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 2, 'Agrega el tomate y la zanahoria y cocina 20 min a fuego bajo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 3, 'Cuece la pasta en agua sin sal, muy blanda, y mezcla.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 7, 8, 'Fusilli grande con la salsa pegada; carne bien mezclada.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 9, 11, 'Pasta corta.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), 12, NULL, 'Plato familiar.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), (SELECT id FROM recetario.allergen WHERE slug = 'trigo'), FALSE, NULL);
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Salsa congelable');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C13'), (SELECT id FROM recetario.recipe WHERE code = 'P2'));

-- C14 · Bollitos pelones en salsa
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), 1, 'Masa de arepitas (P5), media receta'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), 2, '3 cdas de picadillo de carne (A8) muy fino'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), 3, '2 tomates licuados con 1 ají dulce y ¼ de cebolla');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), 1, 'Forma bollitos alargados (no esferas) con poca masa y un poco de relleno dentro.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), 2, 'Cocina la salsa de tomate 10 min.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), 3, 'Mete los bollitos en la salsa, tapa y cocina a fuego bajo 15 min, hasta que la masa esté cocida y blanda.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), 7, 8, 'Desde 9 meses. Antes, ofrece el picadillo y la masa por separado.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), 9, 11, 'Cortados por la mitad o en trozos, con salsa.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), 12, NULL, 'Enteros.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), (SELECT id FROM recetario.tag WHERE slug = 'receta-tradicional-venezolana'), 'Receta venezolana'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congelan');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), (SELECT id FROM recetario.recipe WHERE code = 'P5')),
  ((SELECT id FROM recetario.recipe WHERE code = 'C14'), (SELECT id FROM recetario.recipe WHERE code = 'A8'));

-- C15 · Crema de caraotas negras con arepita
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), 1, '½ taza de caraotas negras sin sal (P3) con su caldo'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), 2, '1 cubo de sofrito (P2)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), 3, 'Comino'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), 4, '1 arepita blanda (P5)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), 5, 'De acompañante: tomate o mandarina');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), 1, 'Licúa las caraotas con el sofrito y un poco de su caldo hasta tener una crema espesa.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), 2, 'Calienta 5 min con el comino.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), 3, 'Sirve con tiras de arepita para mojar y la fruta o el tomate al lado.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), 7, 8, 'Crema con cuchara o para mojar.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), 9, 11, 'Tal cual.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), 12, NULL, 'Con queso fresco rallado, como la familia.');
INSERT INTO recetario.recipe_tag (recipe_id, tag_id, label) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), (SELECT id FROM recetario.tag WHERE slug = 'harina-enriquecida'), 'Harina enriquecida'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), (SELECT id FROM recetario.tag WHERE slug = 'se-congela'), 'Se congela');
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), (SELECT id FROM recetario.recipe WHERE code = 'P2')),
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), (SELECT id FROM recetario.recipe WHERE code = 'P3')),
  ((SELECT id FROM recetario.recipe WHERE code = 'C15'), (SELECT id FROM recetario.recipe WHERE code = 'P5'));

-- C16 · Chayote relleno de pollo y queso
INSERT INTO recetario.recipe_ingredient (recipe_id, position, description) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), 1, '½ chayote'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), 2, '3 cdas de pollo desmechado'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), 3, '1 cubo de sofrito (P2)'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), 4, '1 cda de ricota o queso fresco bajo en sal');
INSERT INTO recetario.recipe_step (recipe_id, position, instruction) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), 1, 'Hierve el chayote partido 20 min, hasta que esté muy blando.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), 2, 'Saca la pulpa con una cuchara y mézclala con el pollo y el sofrito.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), 3, 'Rellena la concha, pon el queso encima y hornea 10 min a 180 °C.');
INSERT INTO recetario.recipe_age_adaptation (recipe_id, min_age_months, max_age_months, instructions) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), 7, 8, 'Pulpa aplastada con el pollo.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), 9, 11, 'Trozos.'),
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), 12, NULL, 'Medio chayote relleno.');
INSERT INTO recetario.recipe_allergen (recipe_id, allergen_id, is_optional, condition) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), (SELECT id FROM recetario.allergen WHERE slug = 'lacteos'), FALSE, NULL);
INSERT INTO recetario.recipe_reference (recipe_id, referenced_recipe_id) VALUES
  ((SELECT id FROM recetario.recipe WHERE code = 'C16'), (SELECT id FROM recetario.recipe WHERE code = 'P2'));

-- ---------------------------------------------------------------- plan de dos semanas
INSERT INTO recetario.meal_plan_entry (week, day_of_week, meal_type, recipe_id, label) VALUES
  (1, 1, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D1'), 'D1 Avena con cambur y maní'),
  (1, 1, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A1'), 'A1 Pollo con auyama y papa'),
  (1, 1, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M5'), 'M5 Pera asada con yogur'),
  (1, 1, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C1'), 'C1 Tortilla de papa y calabacín'),
  (1, 2, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D2'), 'D2 Tortitas de cambur y huevo'),
  (1, 2, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A2'), 'A2 Lentejas rojas + lechosa'),
  (1, 2, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M3'), 'M3 Hummus con batata'),
  (1, 2, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C3'), 'C3 Salmón con batata'),
  (1, 3, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D6'), 'D6 Gachas de quinoa y pera'),
  (1, 3, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A3'), 'A3 Pabellón para bebé'),
  (1, 3, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M6'), 'M6 Pan con crema de almendras'),
  (1, 3, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C2'), 'C2 Crema de auyama y lentejas'),
  (1, 4, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D4'), 'D4 Revuelto con tomate y aguacate'),
  (1, 4, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A4'), 'A4 Pescado con papa y brócoli'),
  (1, 4, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M2'), 'M2 Muffin de avena y manzana'),
  (1, 4, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C5'), 'C5 Cuscús con pollo'),
  (1, 5, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D5'), 'D5 Yogur con mango y tahini'),
  (1, 5, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A5'), 'A5 Bastones de res y calabacín'),
  (1, 5, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M1'), 'M1 Fruta + queso fresco'),
  (1, 5, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C6'), 'C6 Tortitas de brócoli y garbanzo'),
  (1, 6, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D3'), 'D3 Arepitas de auyama con aguacate'),
  (1, 6, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A6'), 'A6 Pasta con salmón y brócoli'),
  (1, 6, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M4'), 'M4 Galletas de cambur y avena'),
  (1, 6, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C7'), 'C7 Tofu con verduras'),
  (1, 7, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D1'), 'D1 Avena con cambur y maní'),
  (1, 7, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A1'), 'A1 Pollo (porción congelada)'),
  (1, 7, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M1'), 'M1 Fruta + yogur'),
  (1, 7, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C4'), 'C4 Cachapitas (9 m +) o C1'),
  (2, 1, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D10'), 'D10 Arepita dominó'),
  (2, 1, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A7'), 'A7 Sancocho seco de pollo'),
  (2, 1, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M8'), 'M8 Bowl tropical con yogur'),
  (2, 1, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C10'), 'C10 Reina pepiada suave'),
  (2, 2, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D8'), 'D8 Fororo con cambur'),
  (2, 2, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A11'), 'A11 Sardinas con puré'),
  (2, 2, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M12'), 'M12 Hummus de caraotas'),
  (2, 2, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C8'), 'C8 Pisca andina espesa'),
  (2, 3, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D11'), 'D11 Panquecas de avena y auyama'),
  (2, 3, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A9'), 'A9 Higaditos con auyama (1×/sem)'),
  (2, 3, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M7'), 'M7 Plátano con queso'),
  (2, 3, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C13'), 'C13 Pasta boloñesa'),
  (2, 4, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D13'), 'D13 Guasacaca con huevo'),
  (2, 4, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A10'), 'A10 Lentejas con plátano'),
  (2, 4, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M9'), 'M9 Compota de guayaba'),
  (2, 4, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C9'), 'C9 Crema de apio criollo y pollo'),
  (2, 5, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D9'), 'D9 Mazamorra de jojoto'),
  (2, 5, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A12'), 'A12 Pastel de plátano y pescado'),
  (2, 5, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M13'), 'M13 Mango con requesón'),
  (2, 5, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C15'), 'C15 Crema de caraotas + arepita'),
  (2, 6, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D7'), 'D7 Tortitas de plátano y huevo'),
  (2, 6, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A14'), 'A14 Carne guisada con papa'),
  (2, 6, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M15'), 'M15 Arepitas dulces sin azúcar'),
  (2, 6, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C11'), 'C11 Tortilla de plátano y queso'),
  (2, 7, 'desayuno', (SELECT id FROM recetario.recipe WHERE code = 'D12'), 'D12 Arepitas de yuca'),
  (2, 7, 'almuerzo', (SELECT id FROM recetario.recipe WHERE code = 'A15'), 'A15 Pasta con pollo y auyama'),
  (2, 7, 'merienda', (SELECT id FROM recetario.recipe WHERE code = 'M10'), 'M10 Majarete sin azúcar'),
  (2, 7, 'cena', (SELECT id FROM recetario.recipe WHERE code = 'C16'), 'C16 Chayote relleno');

-- ---------------------------------------------------------------- guía de despensa
INSERT INTO recetario.food_guide (food, from_age, preparation, caution, sort_order) VALUES
  ('Harina de maíz precocida', '6 m', 'Arepitas finas y blandas, sin sal (P5), funche, bollitos.', 'En Venezuela está enriquecida por norma con hierro, vitamina A y vitaminas B1, B2 y B3 desde 1993. Buena aliada.', 1),
  ('Caraotas, frijoles, lentejas, quinchonchos, arvejas', '6 m', 'Remojo 8–12 h, cocción larga hasta que se deshagan (P3). Aplastadas o pasadas por pasapuré.', 'Nunca poco cocidas. Las de lata: escurrir y enjuagar para quitar sal. Acompañar con fruta rica en vitamina C.', 2),
  ('Plátano maduro', '6 m', 'Horneado o hervido (P4), aplastado o en bastón.', 'Tostones y tajadas fritas: no (duros, aceitosos).', 3),
  ('Plátano verde', '6 m', 'Hervido hasta muy blando y aplastado.', 'Patacones y tostones: no.', 4),
  ('Yuca', '6 m', 'Pelada (incluida la capa rosada), en trozos, hervida hasta muy blanda; desechar el agua y la hebra central (P6).', 'Nunca cruda ni mal cocida (glucósidos cianogénicos). El casabe es duro: no para bebés.', 5),
  ('Ocumo, ñame, apio criollo, batata', '6 m', 'Pelados y bien cocidos, aplastados o en bastón.', 'Ocumo y ñame crudos irritan la boca (oxalato de calcio): siempre bien cocidos.', 6),
  ('Auyama, chayote, calabacín, zanahoria, papa', '6 m', 'Hervidos, al vapor u horneados.', NULL, 7),
  ('Ají dulce, pimentón, cebolla, ajo, cilantro, cebollín, onoto, comino, orégano', '6 m', 'En el sofrito (P2). Dan sabor sin sal.', 'Ají picante: mejor no al principio.', 8),
  ('Cambur, mango, lechosa, guayaba, patilla, parchita, piña, naranja, mandarina', '6 m', 'Frutas enteras maduras, en tiras o aplastadas.', 'Quitar semillas (guayaba, patilla, parchita). Sin jugos antes del año.', 9),
  ('Aguacate', '6 m', 'En gajo, aplastado o en guasacaca suave.', NULL, 10),
  ('Pollo, carne de res, cerdo magro', '6 m', 'Guisados hasta deshacerse, mechados, molidos y humedecidos.', 'Muslo de pollo: más hierro que la pechuga.', 11),
  ('Hígado de pollo o res', '6 m', 'Bien cocido, triturado en el puré.', 'Muchísimo hierro, pero también vitamina A: máximo una vez por semana, porción pequeña.', 12),
  ('Sardina, merluza, pargo, corvina, atún claro en lata', '6 m', 'Al vapor, horno o guisado, sin espinas.', 'Unas 2 raciones de pescado a la semana, variando. Sardinas y atún en agua o aceite, no en salsas saladas.', 13),
  ('Cazón, carite, pez espada, atún ojo grande', '—', 'No en la infancia.', 'Mercurio alto. El cazón es tiburón: cambia el pastel de chucho por merluza o pargo (A12).', 14),
  ('Huevo', '6 m', 'Siempre bien cuajado: duro, revuelto, tortilla.', NULL, 15),
  ('Queso blanco duro, llanero, de mano, telita, guayanés', 'Con cautela', 'Mejor ricota, requesón o queso fresco bajo en sal. Si lo usas, en poca cantidad.', 'Suelen ser muy salados, y los artesanales a veces no son pasteurizados (listeria).', 16),
  ('Leche en polvo completa o leche líquida entera', '6 m (cocina)', 'Para cocinar: avena, funche, cremas.', 'Como bebida principal, no antes de los 12 meses.', 17),
  ('Papelón, azúcar, miel, melaza', '—', 'No.', 'Sin azúcares añadidos antes de los 2 años; miel nunca antes de 1 año.', 18),
  ('Cubitos, adobo, sazonadores, salsa de soya, salsa inglesa', '—', 'No. Usa el caldo casero (P1) y el sofrito (P2).', 'Muy altos en sodio.', 19),
  ('Malta, refrescos, jugos de caja, chicha comercial, café con leche', '—', 'No.', 'Azúcar y/o cafeína.', 20),
  ('Jamón, mortadela, salchicha, tequeños, empanadas y pastelitos fritos', '—', 'No.', 'Sal, grasas, aditivos; algunos con forma de riesgo de atragantamiento.', 21);

-- ---------------------------------------------------------------- guía de cortes de fruta
INSERT INTO recetario.fruit_cut_guide (fruit, age_7_8, age_9_11, caution, sort_order) VALUES
  ('Aguacate', 'Gajo grueso (pásalo por coco rallado o avena molida para que no resbale)', 'Dados', NULL, 1),
  ('Cambur (plátano)', 'Medio cambur con algo de cáscara como asa, o bastón', 'Rodajas cortadas en cuartos', NULL, 2),
  ('Mango, lechosa', 'Tiras gruesas bien maduras, o el hueso del mango con pulpa para chupar', 'Dados', NULL, 3),
  ('Pera, durazno', 'Maduros y blandos en gajos; si están firmes, cocidos o asados', 'Dados', NULL, 4),
  ('Manzana', 'Cocida o asada, en gajos; o rallada cruda', 'Rallada o cocida', 'Cruda en trozos: no hasta más adelante', 5),
  ('Fresas', 'Enteras si son grandes y maduras, o aplastadas', 'En cuartos', NULL, 6),
  ('Uvas, cerezas', 'Aplastadas', 'En cuartos a lo largo', 'Nunca enteras', 7),
  ('Guayaba', 'Pulpa sin semillas, aplastada o colada', 'Pulpa sin semillas', 'Semillas duras', 8);

-- ---------------------------------------------------------------- vista de resumen
CREATE VIEW recetario.recipe_overview AS
SELECT r.id, r.code, r.title, r.meal_type, r.min_age_months, r.is_iron_source, r.iron_note,
       COALESCE(array_agg(DISTINCT a.slug) FILTER (WHERE a.slug IS NOT NULL), '{}') AS allergens,
       COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags,
       r.sort_order
FROM recetario.recipe r
LEFT JOIN recetario.recipe_allergen ra ON ra.recipe_id = r.id
LEFT JOIN recetario.allergen a        ON a.id = ra.allergen_id
LEFT JOIN recetario.recipe_tag rt     ON rt.recipe_id = r.id
LEFT JOIN recetario.tag t             ON t.id = rt.tag_id
GROUP BY r.id;

COMMIT;

-- =====================================================================
-- Consultas de ejemplo
-- =====================================================================
-- Cenas aptas para un bebé de 8 meses, sin lácteos ni maní (obligatorios):
--   SELECT code, title FROM recetario.recipe_overview
--   WHERE meal_type = 'cena' AND min_age_months <= 8
--     AND NOT EXISTS (
--       SELECT 1 FROM recetario.recipe_allergen ra
--       JOIN recetario.allergen a ON a.id = ra.allergen_id
--       WHERE ra.recipe_id = recipe_overview.id AND a.slug IN ('lacteos', 'mani') AND NOT ra.is_optional)
--   ORDER BY sort_order;
--
-- Recetas que llevan auyama (búsqueda de texto en español):
--   SELECT DISTINCT r.code, r.title FROM recetario.recipe r
--   JOIN recetario.recipe_ingredient i ON i.recipe_id = r.id
--   WHERE to_tsvector('spanish', i.description) @@ plainto_tsquery('spanish', 'auyama');
--
-- Plan de la semana 2 con títulos:
--   SELECT p.day_of_week, p.meal_type, r.code, r.title FROM recetario.meal_plan_entry p
--   JOIN recetario.recipe r ON r.id = p.recipe_id WHERE p.week = 2 ORDER BY 1, 2;
