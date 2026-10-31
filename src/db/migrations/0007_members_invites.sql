CREATE TABLE "recetario"."household_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_invite_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "recetario"."household_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "recetario"."baby_profile" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "recetario"."household" ADD COLUMN "time_zone" text DEFAULT 'America/Caracas' NOT NULL;--> statement-breakpoint
ALTER TABLE "recetario"."household" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "recetario"."household" ADD COLUMN "meal_times" jsonb;--> statement-breakpoint
ALTER TABLE "recetario"."household_invite" ADD CONSTRAINT "household_invite_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "recetario"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."household_member" ADD CONSTRAINT "household_member_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "recetario"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "household_invite_household_idx" ON "recetario"."household_invite" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "household_member_household_idx" ON "recetario"."household_member" USING btree ("household_id");