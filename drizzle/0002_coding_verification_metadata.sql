ALTER TABLE "placement_applications" ADD COLUMN "leetcode_snapshot_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "placement_applications" ADD COLUMN "hackerrank_snapshot_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "placement_applications" ADD COLUMN "github_snapshot_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "coding_sync_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "leetcode_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "hackerrank_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "github_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "leetcode_owner_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "hackerrank_owner_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "github_owner_verified_at" timestamp with time zone;