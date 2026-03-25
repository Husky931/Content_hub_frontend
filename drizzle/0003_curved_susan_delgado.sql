ALTER TABLE "messages" ADD COLUMN "private_to_user_id" uuid;--> statement-breakpoint
ALTER TABLE "task_templates" ADD COLUMN "self_checklist" jsonb;--> statement-breakpoint
ALTER TABLE "task_templates" ADD COLUMN "deliverable_slots" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_private_to_user_id_users_id_fk" FOREIGN KEY ("private_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_private_to_user_id_idx" ON "messages" USING btree ("private_to_user_id");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");