CREATE TYPE "public"."lesson_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."test_question_type" AS ENUM('mc', 'tf', 'rating', 'upload');--> statement-breakpoint
CREATE TYPE "public"."upload_submission_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."user_progress_status" AS ENUM('not_started', 'in_training', 'in_test', 'pending_review', 'passed', 'failed');--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"title_cn" varchar(255),
	"description" text,
	"description_cn" text,
	"order" integer DEFAULT 0 NOT NULL,
	"prerequisite_tag_id" uuid,
	"passing_score" integer DEFAULT 100 NOT NULL,
	"retry_after_hours" integer DEFAULT 24 NOT NULL,
	"tag_id" uuid,
	"status" "lesson_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"type" "test_question_type" NOT NULL,
	"prompt" text NOT NULL,
	"prompt_cn" text,
	"options" jsonb,
	"correct_answers" jsonb,
	"points" integer DEFAULT 25 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainer_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"resources" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_question_id" uuid NOT NULL,
	"user_progress_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"status" "upload_submission_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "user_progress_status" DEFAULT 'not_started' NOT NULL,
	"current_prompt_index" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"cheating_warnings" integer DEFAULT 0 NOT NULL,
	"score" integer,
	"completed_at" timestamp,
	"retry_after" timestamp,
	"conversation_history" jsonb,
	"test_answers" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "deliverable_slots" jsonb;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_prerequisite_tag_id_tags_id_fk" FOREIGN KEY ("prerequisite_tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_prompts" ADD CONSTRAINT "trainer_prompts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_submissions" ADD CONSTRAINT "upload_submissions_test_question_id_test_questions_id_fk" FOREIGN KEY ("test_question_id") REFERENCES "public"."test_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_submissions" ADD CONSTRAINT "upload_submissions_user_progress_id_user_progress_id_fk" FOREIGN KEY ("user_progress_id") REFERENCES "public"."user_progress"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_submissions" ADD CONSTRAINT "upload_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_submissions" ADD CONSTRAINT "upload_submissions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lessons_status_idx" ON "lessons" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lessons_order_idx" ON "lessons" USING btree ("order");--> statement-breakpoint
CREATE INDEX "test_questions_test_id_idx" ON "test_questions" USING btree ("test_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tests_lesson_id_idx" ON "tests" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "trainer_prompts_lesson_id_idx" ON "trainer_prompts" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "upload_submissions_user_progress_idx" ON "upload_submissions" USING btree ("user_progress_id");--> statement-breakpoint
CREATE INDEX "upload_submissions_status_idx" ON "upload_submissions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_progress_user_lesson_idx" ON "user_progress" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE INDEX "user_progress_lesson_id_idx" ON "user_progress" USING btree ("lesson_id");