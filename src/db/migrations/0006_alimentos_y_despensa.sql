CREATE TYPE "recetario"."food_category" AS ENUM('basicos', 'proteinas', 'lacteos', 'verduras', 'tuberculos', 'frutas', 'cereales', 'legumbres', 'semillas', 'otros');--> statement-breakpoint
CREATE TABLE "recetario"."food" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetario"."food_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "recetario"."food_category" NOT NULL,
	"is_staple" boolean DEFAULT false NOT NULL,
	CONSTRAINT "food_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "recetario"."recipe_ingredient_food" (
	"ingredient_id" integer NOT NULL,
	"food_id" smallint NOT NULL,
	"alt_group" smallint NOT NULL,
	CONSTRAINT "recipe_ingredient_food_ingredient_id_food_id_pk" PRIMARY KEY("ingredient_id","food_id")
);
--> statement-breakpoint
CREATE TABLE "recetario"."household_unavailable_food" (
	"household_id" uuid NOT NULL,
	"food_id" smallint NOT NULL,
	CONSTRAINT "household_unavailable_food_household_id_food_id_pk" PRIMARY KEY("household_id","food_id")
);
--> statement-breakpoint
ALTER TABLE "recetario"."recipe_ingredient" ADD COLUMN "is_optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recetario"."recipe_ingredient_food" ADD CONSTRAINT "recipe_ingredient_food_ingredient_id_recipe_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "recetario"."recipe_ingredient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."recipe_ingredient_food" ADD CONSTRAINT "recipe_ingredient_food_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "recetario"."food"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."household_unavailable_food" ADD CONSTRAINT "household_unavailable_food_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "recetario"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."household_unavailable_food" ADD CONSTRAINT "household_unavailable_food_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "recetario"."food"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_ingredient_food_food_idx" ON "recetario"."recipe_ingredient_food" USING btree ("food_id");