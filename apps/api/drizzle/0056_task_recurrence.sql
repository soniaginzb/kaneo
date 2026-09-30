CREATE TABLE IF NOT EXISTS "task_recurrence" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"rrule" text NOT NULL,
	"time_zone" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_recurrence_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "task_recurrence" ADD CONSTRAINT "task_recurrence_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
