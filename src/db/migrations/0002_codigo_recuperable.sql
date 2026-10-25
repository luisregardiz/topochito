ALTER TABLE "recetario"."household" ADD COLUMN "access_code_lookup" text NOT NULL;--> statement-breakpoint
ALTER TABLE "recetario"."household" ADD COLUMN "access_code_enc" text NOT NULL;--> statement-breakpoint
ALTER TABLE "recetario"."household" ADD CONSTRAINT "household_access_code_lookup_unique" UNIQUE("access_code_lookup");