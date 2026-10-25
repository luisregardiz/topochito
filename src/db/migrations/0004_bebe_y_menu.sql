CREATE TYPE "recetario"."allergen_status" AS ENUM('introduced', 'avoid');--> statement-breakpoint
CREATE TABLE "recetario"."baby_allergen" (
	"household_id" uuid NOT NULL,
	"allergen_id" smallint NOT NULL,
	"status" "recetario"."allergen_status" NOT NULL,
	CONSTRAINT "baby_allergen_household_id_allergen_id_pk" PRIMARY KEY("household_id","allergen_id")
);
--> statement-breakpoint
CREATE TABLE "recetario"."baby_profile" (
	"household_id" uuid PRIMARY KEY NOT NULL,
	"birth_month" smallint NOT NULL,
	"birth_year" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "baby_profile_month_check" CHECK ("recetario"."baby_profile"."birth_month" BETWEEN 1 AND 12),
	CONSTRAINT "baby_profile_year_check" CHECK ("recetario"."baby_profile"."birth_year" BETWEEN 2000 AND 2100)
);
--> statement-breakpoint
CREATE TABLE "recetario"."household_menu_entry" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetario"."household_menu_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"household_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"day_of_week" smallint NOT NULL,
	"meal_type" "recetario"."meal_type" NOT NULL,
	"recipe_id" integer NOT NULL,
	CONSTRAINT "household_menu_entry_slot_key" UNIQUE("household_id","week_start","day_of_week","meal_type"),
	CONSTRAINT "household_menu_entry_day_check" CHECK ("recetario"."household_menu_entry"."day_of_week" BETWEEN 1 AND 7),
	CONSTRAINT "household_menu_entry_meal_check" CHECK ("recetario"."household_menu_entry"."meal_type" <> 'base')
);
--> statement-breakpoint
ALTER TABLE "recetario"."baby_allergen" ADD CONSTRAINT "baby_allergen_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "recetario"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."baby_allergen" ADD CONSTRAINT "baby_allergen_allergen_id_allergen_id_fk" FOREIGN KEY ("allergen_id") REFERENCES "recetario"."allergen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."baby_profile" ADD CONSTRAINT "baby_profile_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "recetario"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."household_menu_entry" ADD CONSTRAINT "household_menu_entry_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "recetario"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."household_menu_entry" ADD CONSTRAINT "household_menu_entry_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "recetario"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "household_menu_entry_week_idx" ON "recetario"."household_menu_entry" USING btree ("household_id","week_start");