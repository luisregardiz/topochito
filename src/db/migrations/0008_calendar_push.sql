CREATE TABLE "recetario"."push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "recetario"."reminder_delivery" (
	"member_id" uuid NOT NULL,
	"reminder_key" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_delivery_member_id_reminder_key_pk" PRIMARY KEY("member_id","reminder_key")
);
--> statement-breakpoint
ALTER TABLE "recetario"."household" ADD COLUMN "calendar_token_hash" text;--> statement-breakpoint
ALTER TABLE "recetario"."household" ADD COLUMN "calendar_alarm_minutes" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recetario"."household_member" ADD COLUMN "push_lead_minutes" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recetario"."push_subscription" ADD CONSTRAINT "push_subscription_member_id_household_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "recetario"."household_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetario"."reminder_delivery" ADD CONSTRAINT "reminder_delivery_member_id_household_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "recetario"."household_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscription_member_idx" ON "recetario"."push_subscription" USING btree ("member_id");--> statement-breakpoint
ALTER TABLE "recetario"."household" ADD CONSTRAINT "household_calendar_token_hash_unique" UNIQUE("calendar_token_hash");