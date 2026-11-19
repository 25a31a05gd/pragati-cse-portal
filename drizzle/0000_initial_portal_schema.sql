CREATE TYPE "public"."difficulty_level" AS ENUM('Easy', 'Medium', 'Hard');--> statement-breakpoint
CREATE TYPE "public"."hiring_type" AS ENUM('On-Campus', 'Off-Campus', 'Internship', 'Full-Time');--> statement-breakpoint
CREATE TYPE "public"."interview_result_status" AS ENUM('Selected / Offered', 'Rejected', 'In Progress / Final Round');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('problem_posted', 'problem_message', 'placement_posted', 'interview_posted', 'spotlight', 'reminder');--> statement-breakpoint
CREATE TYPE "public"."problem_status" AS ENUM('open', 'solved');--> statement-breakpoint
CREATE TYPE "public"."reminder_category" AS ENUM('problem_statement', 'placement', 'hackathon', 'interview', 'exam_lab', 'general');--> statement-breakpoint
CREATE TYPE "public"."reminder_priority" AS ENUM('High', 'Normal', 'Low');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'faculty', 'admin');--> statement-breakpoint
CREATE TABLE "academic_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(240) NOT NULL,
	"resource_type" varchar(100) DEFAULT 'Lab Manual' NOT NULL,
	"subject_or_lab" varchar(160) DEFAULT 'CSE Department' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"resource_link" text NOT NULL,
	"author_id" uuid,
	"author_name_snapshot" varchar(160) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(160) DEFAULT 'College Portal Administrator' NOT NULL,
	"created_by_system_setup" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_name" varchar(200) NOT NULL,
	"used_technologies" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"app_type" varchar(120) DEFAULT 'Web Application' NOT NULL,
	"app_link" text NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_code" varchar(40) NOT NULL,
	"title" varchar(240) NOT NULL,
	"instructor_name" varchar(160) NOT NULL,
	"semester" varchar(80) DEFAULT 'Current Semester' NOT NULL,
	"credits" integer DEFAULT 3 NOT NULL,
	"schedule" varchar(160) DEFAULT 'TBA' NOT NULL,
	"prerequisites" text DEFAULT 'None' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"resource_link" text DEFAULT '' NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faculty_directory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"linked_user_id" uuid,
	"name" varchar(160) NOT NULL,
	"designation" varchar(160) NOT NULL,
	"specialization" text DEFAULT 'Computer Science & Engineering' NOT NULL,
	"email" varchar(255),
	"phone_or_cabin" varchar(120) DEFAULT '' NOT NULL,
	"qualification" varchar(200) DEFAULT '' NOT NULL,
	"experience_years" integer DEFAULT 0 NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faculty_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"designation" varchar(160) NOT NULL,
	"specialization" text DEFAULT 'Computer Science & Engineering' NOT NULL,
	"qualification" varchar(200) DEFAULT 'M.Tech / Ph.D' NOT NULL,
	"experience_years" integer DEFAULT 0 NOT NULL,
	"phone_or_cabin" varchar(120) DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hackathons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hackathon_name" varchar(240) NOT NULL,
	"organizer" varchar(240) DEFAULT '' NOT NULL,
	"event_date" varchar(80) DEFAULT '' NOT NULL,
	"team_and_role" varchar(240) DEFAULT '' NOT NULL,
	"outcome" varchar(160) DEFAULT 'Participant' NOT NULL,
	"technologies" text DEFAULT '' NOT NULL,
	"overall_experience" text NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"round_title" varchar(240) NOT NULL,
	"topics_covered" text DEFAULT '' NOT NULL,
	"questions_asked" text DEFAULT '' NOT NULL,
	"difficulty" "difficulty_level" DEFAULT 'Medium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(160) NOT NULL,
	"role_title" varchar(200) NOT NULL,
	"company_domain" varchar(200) DEFAULT 'Technology & Software' NOT NULL,
	"skills_needed" text DEFAULT '' NOT NULL,
	"hiring_type" "hiring_type" DEFAULT 'On-Campus' NOT NULL,
	"package_or_stipend" varchar(120) DEFAULT '' NOT NULL,
	"interview_date" varchar(80) DEFAULT '' NOT NULL,
	"result_status" "interview_result_status" DEFAULT 'Selected / Offered' NOT NULL,
	"overall_difficulty" "difficulty_level" DEFAULT 'Medium' NOT NULL,
	"overall_experience" text NOT NULL,
	"key_preparation_tips" text DEFAULT '' NOT NULL,
	"resources_used" text DEFAULT '' NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_reads_notification_id_user_id_pk" PRIMARY KEY("notification_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(240) NOT NULL,
	"message" text NOT NULL,
	"target_section" varchar(64) NOT NULL,
	"target_item_id" uuid,
	"recipient_user_id" uuid,
	"actor_id" uuid,
	"actor_name_snapshot" varchar(160) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(240) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"due_date" varchar(32) DEFAULT '' NOT NULL,
	"category" "reminder_category" DEFAULT 'general' NOT NULL,
	"priority" "reminder_priority" DEFAULT 'Normal' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "placement_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"cgpa_snapshot" numeric(4, 2) DEFAULT '0.00' NOT NULL,
	"leetcode_solved_snapshot" integer DEFAULT 0 NOT NULL,
	"hackerrank_five_stars_snapshot" integer DEFAULT 0 NOT NULL,
	"github_projects_snapshot" integer DEFAULT 0 NOT NULL,
	"resume_link" text DEFAULT '' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "placement_drives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(180) NOT NULL,
	"role_title" varchar(200) NOT NULL,
	"package_ctc" varchar(120) NOT NULL,
	"location" varchar(160) DEFAULT 'On-Campus / Hybrid' NOT NULL,
	"deadline" varchar(40) DEFAULT '' NOT NULL,
	"apply_link" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"require_cgpa" boolean DEFAULT false NOT NULL,
	"min_cgpa" numeric(4, 2) DEFAULT '0.00' NOT NULL,
	"require_leetcode" boolean DEFAULT false NOT NULL,
	"min_leetcode_problems" integer DEFAULT 0 NOT NULL,
	"require_hackerrank" boolean DEFAULT false NOT NULL,
	"min_hackerrank_five_stars" integer DEFAULT 0 NOT NULL,
	"require_github" boolean DEFAULT false NOT NULL,
	"min_github_projects" integer DEFAULT 0 NOT NULL,
	"author_id" uuid,
	"author_name_snapshot" varchar(160) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"admin_initialized" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_portal_settings_singleton" CHECK ("portal_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "problem_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"message" text NOT NULL,
	"solution_link" text DEFAULT '' NOT NULL,
	"marks_solved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "problem_solvers" (
	"problem_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"solved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problem_solvers_problem_id_user_id_pk" PRIMARY KEY("problem_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(240) NOT NULL,
	"application_name" varchar(160) DEFAULT 'General Application' NOT NULL,
	"category" varchar(120) DEFAULT 'Software Issue' NOT NULL,
	"description" text NOT NULL,
	"contact_info" varchar(200) NOT NULL,
	"contact_email" varchar(255) DEFAULT '' NOT NULL,
	"status" "problem_status" DEFAULT 'open' NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_name" varchar(200) NOT NULL,
	"website_type" varchar(120) DEFAULT 'Web Application' NOT NULL,
	"project_link" text NOT NULL,
	"technologies" text DEFAULT '' NOT NULL,
	"description" text NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spotlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(120) DEFAULT 'Department Spotlight' NOT NULL,
	"headline_value" varchar(160) NOT NULL,
	"title" varchar(240) NOT NULL,
	"recipients" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"author_id" uuid,
	"author_name_snapshot" varchar(160) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"year" varchar(32) DEFAULT '' NOT NULL,
	"section" varchar(16) DEFAULT '' NOT NULL,
	"cgpa" numeric(4, 2) DEFAULT '0.00' NOT NULL,
	"leetcode_url" text DEFAULT '' NOT NULL,
	"leetcode_username" varchar(120) DEFAULT '' NOT NULL,
	"leetcode_solved" integer DEFAULT 0 NOT NULL,
	"leetcode_easy" integer DEFAULT 0 NOT NULL,
	"leetcode_medium" integer DEFAULT 0 NOT NULL,
	"leetcode_hard" integer DEFAULT 0 NOT NULL,
	"hackerrank_url" text DEFAULT '' NOT NULL,
	"hackerrank_username" varchar(120) DEFAULT '' NOT NULL,
	"hackerrank_five_stars" integer DEFAULT 0 NOT NULL,
	"github_url" text DEFAULT '' NOT NULL,
	"github_username" varchar(120) DEFAULT '' NOT NULL,
	"github_projects" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_student_cgpa_range" CHECK ("student_profiles"."cgpa" >= 0 AND "student_profiles"."cgpa" <= 10)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"member_id" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"department" varchar(120) DEFAULT 'CSE' NOT NULL,
	"batch_or_designation" varchar(200) DEFAULT '' NOT NULL,
	"phone" varchar(40) DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"skills" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"can_manage_spotlights" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academic_resources" ADD CONSTRAINT "academic_resources_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_technologies" ADD CONSTRAINT "app_technologies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculty_directory" ADD CONSTRAINT "faculty_directory_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculty_directory" ADD CONSTRAINT "faculty_directory_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculty_profiles" ADD CONSTRAINT "faculty_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hackathons" ADD CONSTRAINT "hackathons_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_rounds" ADD CONSTRAINT "interview_rounds_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_reminders" ADD CONSTRAINT "personal_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_applications" ADD CONSTRAINT "placement_applications_drive_id_placement_drives_id_fk" FOREIGN KEY ("drive_id") REFERENCES "public"."placement_drives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_applications" ADD CONSTRAINT "placement_applications_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_responses" ADD CONSTRAINT "problem_responses_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_responses" ADD CONSTRAINT "problem_responses_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_solvers" ADD CONSTRAINT "problem_solvers_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_solvers" ADD CONSTRAINT "problem_solvers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlights" ADD CONSTRAINT "spotlights_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_academic_resources_created_at" ON "academic_resources" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_app_technologies_author" ON "app_technologies" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_app_technologies_created_at" ON "app_technologies" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_enrollments_course_student" ON "course_enrollments" USING btree ("course_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_course_enrollments_student" ON "course_enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_courses_code" ON "courses" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX "idx_courses_created_at" ON "courses" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_faculty_dir_linked_user" ON "faculty_directory" USING btree ("linked_user_id") WHERE "faculty_directory"."linked_user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_faculty_dir_email_nonempty" ON "faculty_directory" USING btree (lower("email")) WHERE "faculty_directory"."email" IS NOT NULL AND "faculty_directory"."email" <> '';--> statement-breakpoint
CREATE INDEX "idx_faculty_dir_created_at" ON "faculty_directory" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_hackathons_author" ON "hackathons" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_hackathons_created_at" ON "hackathons" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_interview_rounds_num" ON "interview_rounds" USING btree ("interview_id","round_number");--> statement-breakpoint
CREATE INDEX "idx_interview_rounds_interview" ON "interview_rounds" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "idx_interviews_author" ON "interviews" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_interviews_company_lower" ON "interviews" USING btree (lower("company_name"));--> statement-breakpoint
CREATE INDEX "idx_interviews_created_at" ON "interviews" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reads_user" ON "notification_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient_created" ON "notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_created_at" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_personal_reminders_user_created" ON "personal_reminders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_placement_applications_drive_student" ON "placement_applications" USING btree ("drive_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_placement_applications_student" ON "placement_applications" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_placement_drives_created_at" ON "placement_drives" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_problem_responses_problem_created" ON "problem_responses" USING btree ("problem_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_problem_responses_sender" ON "problem_responses" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_problem_solvers_user" ON "problem_solvers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_problems_author" ON "problems" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_problems_status_created" ON "problems" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_projects_author" ON "projects" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_projects_created_at" ON "projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_spotlights_created_at" ON "spotlights" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_student_profiles_year_section" ON "student_profiles" USING btree ("year","section");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email_lower" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_member_id_upper" ON "users" USING btree (upper("member_id"));--> statement-breakpoint
CREATE INDEX "idx_users_role_active" ON "users" USING btree ("role","is_active");