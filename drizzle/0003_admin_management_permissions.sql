ALTER TABLE "admin_profiles" ADD COLUMN IF NOT EXISTS "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN IF NOT EXISTS "admin_role_label" varchar(120) DEFAULT 'Department Admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN IF NOT EXISTS "perm_students" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN IF NOT EXISTS "perm_faculty" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN IF NOT EXISTS "perm_placements" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN IF NOT EXISTS "perm_coding_verification" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN IF NOT EXISTS "perm_dashboard_analytics" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN IF NOT EXISTS "can_create_admins" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN IF NOT EXISTS "created_by_admin_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_admin_profiles_super_admin" ON "admin_profiles" ("is_super_admin");--> statement-breakpoint
UPDATE "admin_profiles"
SET
  "is_super_admin" = true,
  "admin_role_label" = 'Super Administrator',
  "perm_students" = true,
  "perm_faculty" = true,
  "perm_placements" = true,
  "perm_coding_verification" = true,
  "perm_dashboard_analytics" = true,
  "can_create_admins" = true
WHERE "created_by_system_setup" = true;
