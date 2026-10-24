CREATE SCHEMA "recetario";
--> statement-breakpoint
CREATE TYPE "recetario"."meal_type" AS ENUM('base', 'desayuno', 'almuerzo', 'merienda', 'cena');--> statement-breakpoint
CREATE TABLE "recetario"."allergen" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetario"."allergen_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"how_to_introduce" text NOT NULL,
	CONSTRAINT "allergen_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "recetario"."food_guide" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetario"."food_guide_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"food" text NOT NULL,
	"from_age" text NOT NULL,
	"preparation" text NOT NULL,
	"caution" text,
	"sort_order" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recetario"."fruit_cut_guide" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetario"."fruit_cut_guide_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"fruit" text NOT NULL,
	"age_7_8" text NOT NULL,
	"age_9_11" text NOT NULL,
	"caution" text,
	"sort_order" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recetario"."meal_plan_entry" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetario"."meal_plan_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"week" smallint NOT NULL,
	"day_of_week" smallint NOT NULL,
	"meal_type" "recetario"."meal_type" NOT NULL,
	"recipe_id" integer NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "meal_plan_entry_week_day_of_week_meal_type_key" UNIQUE("week","day_of_week","meal_type"),
	CONSTRAINT "meal_plan_entry_week_check" CHECK ("recetario"."meal_plan_entry"."week" >= 1),
	CONSTRAINT "meal_plan_entry_day_check" CHECK ("recetario"."meal_plan_entry"."day_of_week" BETWEEN 1 AND 7),
	CONSTRAINT "meal_plan_entry_meal_type_check" CHECK ("recetario"."meal_plan_entry"."meal_type" <> 'base')
);
--> statement-breakpoint
CREATE TABLE "recetario"."recipe" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetario"."recipe_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(4) NOT NULL,
	"title" text NOT NULL,
	"meal_type" "recetario"."meal_type" NOT NULL,
	"min_age_months" smallint,
	"is_iron_source" boolean DEFAULT false NOT NULL,
	"iron_note" text,
	"note" text,
	"sort_order" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_code_unique" UNIQUE("code"),
	CONSTRAINT "recipe_min_age_months_check" CHECK ("recetario"."recipe"."min_age_months" BETWEEN 6 AND 36)
);
--> statement-breakpoint
CREATE TABLE "recetario"."recipe_age_adaptation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetario"."recipe_age_adaptation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"recipe_id" integer NOT NULL,
	"min_age_months" smallint NOT NULL,
	"max_age_months" smallint,
	"instructions" text NOT NULL,
	CONSTRAINT "recipe_age_adaptation_recipe_id_min_age_months_key" UNIQUE("recipe_id","min_age_months"),
	CONSTRAINT "recipe_age_adaptation_max_check" CHECK ("recetario"."recipe_age_adaptation"."max_age_months" IS NULL OR "recetario"."recipe_age_adaptation"."max_age_months" >= "recetario"."recipe_age_adaptation"."min_age_months")
);
--> statement-breakpoint
CREATE TABLE "recetario"."recipe_allergen" (
	"recipe_id" integer NOT NULL,
	"allergen_id" smallint NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"condition" text,
	CONSTRAINT "recipe_allergen_recipe_id_allergen_id_pk" PRIMARY KEY("recipe_id","allergen_id")
);
--> statement-breakpoint
CREATE TABLE "recetario"."recipe_ingredient" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetario"."recipe_ingredient_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"recipe_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "recipe_ingredient_recipe_id_position_key" UNIQUE("recipe_id","position")
);
--> statement-breakpoint
CREATE TABLE "recetario"."recipe_reference" (
	"recipe_id" integer NOT NULL,
	"referenced_recipe_id" integer NOT NULL,
	CONSTRAINT "recipe_reference_recipe_id_referenced_recipe_id_pk" PRIMARY KEY("recipe_id","referenced_recipe_id"),
	CONSTRAINT "recipe_reference_check" CHECK ("recetario"."recipe_reference"."recipe_id" <> "recetario"."recipe_reference"."referenced_recipe_id")
);
--> statement-breakpoint
CREATE TABLE "recetario"."recipe_step" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetario"."recipe_step_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"recipe_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"instruction" text NOT NULL,
	CONSTRAINT "recipe_step_recipe_id_position_key" UNIQUE("recipe_id","position")
);
--> statement-breakpoint
CREATE TABLE "recetario"."recipe_tag" (
	"recipe_id" integer NOT NULL,
	"tag_id" smallint NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "recipe_tag_recipe_id_tag_id_pk" PRIMARY KEY("recipe_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "recetario"."tag" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetario"."tag_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tag_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "recetario"."household" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"access_code_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recetario"."meal_plan_entry" ADD CONSTRAINT "meal_plan_entry_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "recetario"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."recipe_age_adaptation" ADD CONSTRAINT "recipe_age_adaptation_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "recetario"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."recipe_allergen" ADD CONSTRAINT "recipe_allergen_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "recetario"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."recipe_allergen" ADD CONSTRAINT "recipe_allergen_allergen_id_allergen_id_fk" FOREIGN KEY ("allergen_id") REFERENCES "recetario"."allergen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "recetario"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."recipe_reference" ADD CONSTRAINT "recipe_reference_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "recetario"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."recipe_reference" ADD CONSTRAINT "recipe_reference_referenced_recipe_id_recipe_id_fk" FOREIGN KEY ("referenced_recipe_id") REFERENCES "recetario"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."recipe_step" ADD CONSTRAINT "recipe_step_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "recetario"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."recipe_tag" ADD CONSTRAINT "recipe_tag_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "recetario"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."recipe_tag" ADD CONSTRAINT "recipe_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "recetario"."tag"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_plan_recipe_idx" ON "recetario"."meal_plan_entry" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_meal_age_idx" ON "recetario"."recipe" USING btree ("meal_type","min_age_months");--> statement-breakpoint
CREATE INDEX "recipe_title_fts_idx" ON "recetario"."recipe" USING gin (to_tsvector('spanish', "title"));--> statement-breakpoint
CREATE INDEX "recipe_allergen_allergen_idx" ON "recetario"."recipe_allergen" USING btree ("allergen_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredient_fts_idx" ON "recetario"."recipe_ingredient" USING gin (to_tsvector('spanish', "description"));--> statement-breakpoint
CREATE INDEX "recipe_reference_ref_idx" ON "recetario"."recipe_reference" USING btree ("referenced_recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_tag_tag_idx" ON "recetario"."recipe_tag" USING btree ("tag_id");