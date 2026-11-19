-- =============================================================================
-- Migration 0001: Cross-schema Auth FK, Triggers, Security Helpers & RLS
-- Scope: Strictly targets public schema objects (never alters auth/storage/realtime)
-- =============================================================================

-- 1. Link public.users.id 1:1 to Supabase auth.users(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_auth_users'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE "public"."users"
      ADD CONSTRAINT "fk_users_auth_users"
      FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END
$$;
--> statement-breakpoint

-- 2. Initialize singleton portal_settings row (id = 1, admin_initialized = false)
INSERT INTO "public"."portal_settings" ("id", "admin_initialized")
VALUES (1, false)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- 3. Automatic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- 4. Security helper functions (SECURITY DEFINER to prevent recursive RLS evaluation)
CREATE OR REPLACE FUNCTION "public"."is_active_member"()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_active = true
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."current_portal_role"()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.role
  FROM public.users u
  WHERE u.id = auth.uid()
    AND u.is_active = true
  LIMIT 1;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."can_manage_spotlights"()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND (
        u.role = 'admin'::public.user_role
        OR (u.role = 'faculty'::public.user_role AND u.can_manage_spotlights = true)
      )
  );
$$;
--> statement-breakpoint

-- Public Dashboard aggregate counts only (returns 8 integers, zero PII)
CREATE OR REPLACE FUNCTION "public"."get_public_portal_counts"()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'hackathons', (SELECT pg_catalog.count(*)::int FROM public.hackathons),
    'projects', (SELECT pg_catalog.count(*)::int FROM public.projects),
    'interviews', (SELECT pg_catalog.count(*)::int FROM public.interviews),
    'problems', (SELECT pg_catalog.count(*)::int FROM public.problems),
    'apps', (SELECT pg_catalog.count(*)::int FROM public.app_technologies),
    'placements', (SELECT pg_catalog.count(*)::int FROM public.placement_drives),
    'courses', (SELECT pg_catalog.count(*)::int FROM public.courses),
    'facultyMembers', (SELECT pg_catalog.count(*)::int FROM public.faculty_directory)
  );
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION "public"."is_active_member"() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."current_portal_role"() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."can_manage_spotlights"() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."get_public_portal_counts"() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION "public"."is_active_member"() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."current_portal_role"() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."can_manage_spotlights"() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."get_public_portal_counts"() TO anon, authenticated;
--> statement-breakpoint

-- 5. Anti-privilege-escalation trigger on public.users (SECURITY INVOKER, fail-closed)
-- Only trusted backend/admin DB sessions (postgres, supabase_admin, service_role, or DB superuser
-- without anon/authenticated JWT claims) may insert users or modify protected columns.
CREATE OR REPLACE FUNCTION "public"."guard_users_privilege_columns"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  jwt_claims_raw text := NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '');
  jwt_claims_json jsonb := '{}'::jsonb;
  jwt_role text := '';
  jwt_sub text := '';
  is_trusted_backend boolean := false;
BEGIN
  IF jwt_claims_raw IS NOT NULL THEN
    BEGIN
      jwt_claims_json := jwt_claims_raw::jsonb;
    EXCEPTION WHEN OTHERS THEN
      jwt_claims_json := '{}'::jsonb;
    END;
  END IF;

  jwt_role := pg_catalog.lower(COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    NULLIF(jwt_claims_json ->> 'role', ''),
    ''
  ));

  jwt_sub := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(jwt_claims_json ->> 'sub', ''),
    ''
  );

  is_trusted_backend := (
    (
      current_user IN ('postgres', 'supabase_admin', 'service_role')
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.pg_roles r
        WHERE r.rolname = current_user
          AND r.rolsuper = true
      )
    )
    AND current_user NOT IN ('anon', 'authenticated', 'authenticator')
    AND jwt_role NOT IN ('anon', 'authenticated')
    AND jwt_sub = ''
    AND auth.uid() IS NULL
  );

  IF TG_OP = 'INSERT' THEN
    IF NOT is_trusted_backend THEN
      RAISE EXCEPTION 'Insufficient privilege to create portal user records directly'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_active IS DISTINCT FROM OLD.is_active
    OR NEW.can_manage_spotlights IS DISTINCT FROM OLD.can_manage_spotlights
    OR NEW.member_id IS DISTINCT FROM OLD.member_id
    OR NEW.email IS DISTINCT FROM OLD.email
  ) THEN
    IF NOT is_trusted_backend THEN
      RAISE EXCEPTION 'Insufficient privilege to modify protected account fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION "public"."guard_users_privilege_columns"() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_users_guard_privileges" ON "public"."users";
--> statement-breakpoint
CREATE TRIGGER "trg_users_guard_privileges"
  BEFORE INSERT OR UPDATE ON "public"."users"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."guard_users_privilege_columns"();
--> statement-breakpoint

-- Attach updated_at triggers to mutable tables
DROP TRIGGER IF EXISTS "trg_portal_settings_updated_at" ON "public"."portal_settings";
--> statement-breakpoint
CREATE TRIGGER "trg_portal_settings_updated_at" BEFORE UPDATE ON "public"."portal_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_users_updated_at" ON "public"."users";
--> statement-breakpoint
CREATE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_student_profiles_updated_at" ON "public"."student_profiles";
--> statement-breakpoint
CREATE TRIGGER "trg_student_profiles_updated_at" BEFORE UPDATE ON "public"."student_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_faculty_profiles_updated_at" ON "public"."faculty_profiles";
--> statement-breakpoint
CREATE TRIGGER "trg_faculty_profiles_updated_at" BEFORE UPDATE ON "public"."faculty_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_admin_profiles_updated_at" ON "public"."admin_profiles";
--> statement-breakpoint
CREATE TRIGGER "trg_admin_profiles_updated_at" BEFORE UPDATE ON "public"."admin_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_spotlights_updated_at" ON "public"."spotlights";
--> statement-breakpoint
CREATE TRIGGER "trg_spotlights_updated_at" BEFORE UPDATE ON "public"."spotlights" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_hackathons_updated_at" ON "public"."hackathons";
--> statement-breakpoint
CREATE TRIGGER "trg_hackathons_updated_at" BEFORE UPDATE ON "public"."hackathons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_interviews_updated_at" ON "public"."interviews";
--> statement-breakpoint
CREATE TRIGGER "trg_interviews_updated_at" BEFORE UPDATE ON "public"."interviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_projects_updated_at" ON "public"."projects";
--> statement-breakpoint
CREATE TRIGGER "trg_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_app_technologies_updated_at" ON "public"."app_technologies";
--> statement-breakpoint
CREATE TRIGGER "trg_app_technologies_updated_at" BEFORE UPDATE ON "public"."app_technologies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_problems_updated_at" ON "public"."problems";
--> statement-breakpoint
CREATE TRIGGER "trg_problems_updated_at" BEFORE UPDATE ON "public"."problems" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_placement_drives_updated_at" ON "public"."placement_drives";
--> statement-breakpoint
CREATE TRIGGER "trg_placement_drives_updated_at" BEFORE UPDATE ON "public"."placement_drives" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_courses_updated_at" ON "public"."courses";
--> statement-breakpoint
CREATE TRIGGER "trg_courses_updated_at" BEFORE UPDATE ON "public"."courses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_faculty_directory_updated_at" ON "public"."faculty_directory";
--> statement-breakpoint
CREATE TRIGGER "trg_faculty_directory_updated_at" BEFORE UPDATE ON "public"."faculty_directory" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_academic_resources_updated_at" ON "public"."academic_resources";
--> statement-breakpoint
CREATE TRIGGER "trg_academic_resources_updated_at" BEFORE UPDATE ON "public"."academic_resources" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_personal_reminders_updated_at" ON "public"."personal_reminders";
--> statement-breakpoint
CREATE TRIGGER "trg_personal_reminders_updated_at" BEFORE UPDATE ON "public"."personal_reminders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint

-- 6. Enable Row Level Security on ALL 23 public tables
ALTER TABLE "public"."portal_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."student_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."faculty_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."admin_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."spotlights" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."hackathons" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."interviews" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."interview_rounds" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."app_technologies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."problems" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."problem_responses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."problem_solvers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."placement_drives" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."placement_applications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."course_enrollments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."faculty_directory" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."academic_resources" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."notification_reads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."personal_reminders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- 7. RLS Policies (strict anon denial except public.spotlights)

-- portal_settings: Admin read-only via RLS; all writes via Express atomic init
CREATE POLICY "portal_settings_admin_select"
  ON "public"."portal_settings" FOR SELECT TO authenticated
  USING (public.current_portal_role() = 'admin');
--> statement-breakpoint

-- users: Self or Admin SELECT only; all mutations strictly via Express
CREATE POLICY "users_self_or_admin_select"
  ON "public"."users" FOR SELECT TO authenticated
  USING (
    public.is_active_member()
    AND (id = auth.uid() OR public.current_portal_role() = 'admin')
  );
--> statement-breakpoint

-- student_profiles: Self, Faculty, or Admin read; Self or Admin update (active members only)
CREATE POLICY "student_profiles_select"
  ON "public"."student_profiles" FOR SELECT TO authenticated
  USING (
    public.is_active_member()
    AND (user_id = auth.uid() OR public.current_portal_role() IN ('faculty', 'admin'))
  );
--> statement-breakpoint
CREATE POLICY "student_profiles_update"
  ON "public"."student_profiles" FOR UPDATE TO authenticated
  USING (
    public.is_active_member()
    AND (
      (user_id = auth.uid() AND public.current_portal_role() = 'student')
      OR public.current_portal_role() = 'admin'
    )
  )
  WITH CHECK (
    public.is_active_member()
    AND (
      (user_id = auth.uid() AND public.current_portal_role() = 'student')
      OR public.current_portal_role() = 'admin'
    )
  );
--> statement-breakpoint

-- faculty_profiles & admin_profiles: Self or Admin read (active members only); Express-only mutations
CREATE POLICY "faculty_profiles_select"
  ON "public"."faculty_profiles" FOR SELECT TO authenticated
  USING (
    public.is_active_member()
    AND (user_id = auth.uid() OR public.current_portal_role() = 'admin')
  );
--> statement-breakpoint
CREATE POLICY "admin_profiles_select"
  ON "public"."admin_profiles" FOR SELECT TO authenticated
  USING (
    public.is_active_member()
    AND (user_id = auth.uid() OR public.current_portal_role() = 'admin')
  );
--> statement-breakpoint

-- spotlights: Public read; Admin or authorized Faculty coordinator write
CREATE POLICY "spotlights_public_select"
  ON "public"."spotlights" FOR SELECT TO anon, authenticated
  USING (true);
--> statement-breakpoint
CREATE POLICY "spotlights_authorized_insert"
  ON "public"."spotlights" FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_spotlights());
--> statement-breakpoint
CREATE POLICY "spotlights_authorized_update"
  ON "public"."spotlights" FOR UPDATE TO authenticated
  USING (public.can_manage_spotlights())
  WITH CHECK (public.can_manage_spotlights());
--> statement-breakpoint
CREATE POLICY "spotlights_authorized_delete"
  ON "public"."spotlights" FOR DELETE TO authenticated
  USING (public.can_manage_spotlights());
--> statement-breakpoint

-- hackathons
CREATE POLICY "hackathons_member_select"
  ON "public"."hackathons" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "hackathons_member_insert"
  ON "public"."hackathons" FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND author_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "hackathons_owner_or_admin_update"
  ON "public"."hackathons" FOR UPDATE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'))
  WITH CHECK (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint
CREATE POLICY "hackathons_owner_or_admin_delete"
  ON "public"."hackathons" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- interviews
CREATE POLICY "interviews_member_select"
  ON "public"."interviews" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "interviews_member_insert"
  ON "public"."interviews" FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND author_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "interviews_owner_or_admin_update"
  ON "public"."interviews" FOR UPDATE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'))
  WITH CHECK (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint
CREATE POLICY "interviews_owner_or_admin_delete"
  ON "public"."interviews" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- interview_rounds (scoped to owning interview author or Admin)
CREATE POLICY "interview_rounds_member_select"
  ON "public"."interview_rounds" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "interview_rounds_owner_or_admin_insert"
  ON "public"."interview_rounds" FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_member()
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id
        AND (i.author_id = auth.uid() OR public.current_portal_role() = 'admin')
    )
  );
--> statement-breakpoint
CREATE POLICY "interview_rounds_owner_or_admin_update"
  ON "public"."interview_rounds" FOR UPDATE TO authenticated
  USING (
    public.is_active_member()
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id
        AND (i.author_id = auth.uid() OR public.current_portal_role() = 'admin')
    )
  )
  WITH CHECK (
    public.is_active_member()
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id
        AND (i.author_id = auth.uid() OR public.current_portal_role() = 'admin')
    )
  );
--> statement-breakpoint
CREATE POLICY "interview_rounds_owner_or_admin_delete"
  ON "public"."interview_rounds" FOR DELETE TO authenticated
  USING (
    public.is_active_member()
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id
        AND (i.author_id = auth.uid() OR public.current_portal_role() = 'admin')
    )
  );
--> statement-breakpoint

-- projects
CREATE POLICY "projects_member_select"
  ON "public"."projects" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "projects_member_insert"
  ON "public"."projects" FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND author_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "projects_owner_or_admin_update"
  ON "public"."projects" FOR UPDATE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'))
  WITH CHECK (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint
CREATE POLICY "projects_owner_or_admin_delete"
  ON "public"."projects" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- app_technologies
CREATE POLICY "app_technologies_member_select"
  ON "public"."app_technologies" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "app_technologies_member_insert"
  ON "public"."app_technologies" FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND author_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "app_technologies_owner_or_admin_update"
  ON "public"."app_technologies" FOR UPDATE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'))
  WITH CHECK (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint
CREATE POLICY "app_technologies_owner_or_admin_delete"
  ON "public"."app_technologies" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- problems
CREATE POLICY "problems_member_select"
  ON "public"."problems" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "problems_member_insert"
  ON "public"."problems" FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND author_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "problems_owner_or_admin_update"
  ON "public"."problems" FOR UPDATE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'))
  WITH CHECK (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint
CREATE POLICY "problems_owner_or_admin_delete"
  ON "public"."problems" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- problem_responses
CREATE POLICY "problem_responses_member_select"
  ON "public"."problem_responses" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "problem_responses_member_insert"
  ON "public"."problem_responses" FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND sender_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "problem_responses_owner_or_admin_update"
  ON "public"."problem_responses" FOR UPDATE TO authenticated
  USING (public.is_active_member() AND (sender_id = auth.uid() OR public.current_portal_role() = 'admin'))
  WITH CHECK (public.is_active_member() AND (sender_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint
CREATE POLICY "problem_responses_owner_or_admin_delete"
  ON "public"."problem_responses" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (sender_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- problem_solvers (active student accounts only for INSERT)
CREATE POLICY "problem_solvers_member_select"
  ON "public"."problem_solvers" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "problem_solvers_student_insert"
  ON "public"."problem_solvers" FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_member()
    AND public.current_portal_role() = 'student'
    AND user_id = auth.uid()
  );
--> statement-breakpoint
CREATE POLICY "problem_solvers_admin_delete"
  ON "public"."problem_solvers" FOR DELETE TO authenticated
  USING (public.current_portal_role() = 'admin');
--> statement-breakpoint

-- placement_drives (Faculty or Admin write)
CREATE POLICY "placement_drives_member_select"
  ON "public"."placement_drives" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "placement_drives_staff_insert"
  ON "public"."placement_drives" FOR INSERT TO authenticated
  WITH CHECK (public.current_portal_role() IN ('faculty', 'admin') AND author_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "placement_drives_owner_or_admin_update"
  ON "public"."placement_drives" FOR UPDATE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'))
  WITH CHECK (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint
CREATE POLICY "placement_drives_owner_or_admin_delete"
  ON "public"."placement_drives" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- placement_applications (Student self, owning drive Faculty, or Admin)
CREATE POLICY "placement_applications_scoped_select"
  ON "public"."placement_applications" FOR SELECT TO authenticated
  USING (
    public.is_active_member()
    AND (
      student_id = auth.uid()
      OR public.current_portal_role() = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.placement_drives d
        WHERE d.id = drive_id
          AND d.author_id = auth.uid()
          AND public.current_portal_role() = 'faculty'
      )
    )
  );
--> statement-breakpoint
CREATE POLICY "placement_applications_student_insert"
  ON "public"."placement_applications" FOR INSERT TO authenticated
  WITH CHECK (public.current_portal_role() = 'student' AND student_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "placement_applications_admin_update"
  ON "public"."placement_applications" FOR UPDATE TO authenticated
  USING (public.current_portal_role() = 'admin')
  WITH CHECK (public.current_portal_role() = 'admin');
--> statement-breakpoint
CREATE POLICY "placement_applications_owner_or_admin_delete"
  ON "public"."placement_applications" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (student_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- courses (Faculty or Admin write)
CREATE POLICY "courses_member_select"
  ON "public"."courses" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "courses_staff_insert"
  ON "public"."courses" FOR INSERT TO authenticated
  WITH CHECK (public.current_portal_role() IN ('faculty', 'admin') AND author_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "courses_owner_or_admin_update"
  ON "public"."courses" FOR UPDATE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'))
  WITH CHECK (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint
CREATE POLICY "courses_owner_or_admin_delete"
  ON "public"."courses" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- course_enrollments (Student self, owning course Faculty, or Admin)
CREATE POLICY "course_enrollments_scoped_select"
  ON "public"."course_enrollments" FOR SELECT TO authenticated
  USING (
    public.is_active_member()
    AND (
      student_id = auth.uid()
      OR public.current_portal_role() = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_id
          AND c.author_id = auth.uid()
          AND public.current_portal_role() = 'faculty'
      )
    )
  );
--> statement-breakpoint
CREATE POLICY "course_enrollments_student_insert"
  ON "public"."course_enrollments" FOR INSERT TO authenticated
  WITH CHECK (public.current_portal_role() = 'student' AND student_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "course_enrollments_owner_or_admin_delete"
  ON "public"."course_enrollments" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (student_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- faculty_directory
CREATE POLICY "faculty_directory_member_select"
  ON "public"."faculty_directory" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "faculty_directory_staff_insert"
  ON "public"."faculty_directory" FOR INSERT TO authenticated
  WITH CHECK (
    public.current_portal_role() IN ('faculty', 'admin')
    AND (author_id = auth.uid() OR public.current_portal_role() = 'admin')
  );
--> statement-breakpoint
CREATE POLICY "faculty_directory_owner_or_admin_update"
  ON "public"."faculty_directory" FOR UPDATE TO authenticated
  USING (
    public.is_active_member()
    AND (
      author_id = auth.uid()
      OR linked_user_id = auth.uid()
      OR public.current_portal_role() = 'admin'
    )
  )
  WITH CHECK (
    public.is_active_member()
    AND (
      author_id = auth.uid()
      OR linked_user_id = auth.uid()
      OR public.current_portal_role() = 'admin'
    )
  );
--> statement-breakpoint
CREATE POLICY "faculty_directory_owner_or_admin_delete"
  ON "public"."faculty_directory" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- academic_resources (Faculty or Admin write)
CREATE POLICY "academic_resources_member_select"
  ON "public"."academic_resources" FOR SELECT TO authenticated
  USING (public.is_active_member());
--> statement-breakpoint
CREATE POLICY "academic_resources_staff_insert"
  ON "public"."academic_resources" FOR INSERT TO authenticated
  WITH CHECK (public.current_portal_role() IN ('faculty', 'admin') AND author_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "academic_resources_owner_or_admin_update"
  ON "public"."academic_resources" FOR UPDATE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'))
  WITH CHECK (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint
CREATE POLICY "academic_resources_owner_or_admin_delete"
  ON "public"."academic_resources" FOR DELETE TO authenticated
  USING (public.is_active_member() AND (author_id = auth.uid() OR public.current_portal_role() = 'admin'));
--> statement-breakpoint

-- notifications
CREATE POLICY "notifications_scoped_select"
  ON "public"."notifications" FOR SELECT TO authenticated
  USING (
    public.is_active_member()
    AND (recipient_user_id IS NULL OR recipient_user_id = auth.uid())
  );
--> statement-breakpoint
CREATE POLICY "notifications_member_insert"
  ON "public"."notifications" FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND actor_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "notifications_admin_delete"
  ON "public"."notifications" FOR DELETE TO authenticated
  USING (public.current_portal_role() = 'admin');
--> statement-breakpoint

-- notification_reads
CREATE POLICY "notification_reads_self_select"
  ON "public"."notification_reads" FOR SELECT TO authenticated
  USING (public.is_active_member() AND user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "notification_reads_self_insert"
  ON "public"."notification_reads" FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "notification_reads_self_delete"
  ON "public"."notification_reads" FOR DELETE TO authenticated
  USING (public.is_active_member() AND user_id = auth.uid());
--> statement-breakpoint

-- personal_reminders
CREATE POLICY "personal_reminders_self_select"
  ON "public"."personal_reminders" FOR SELECT TO authenticated
  USING (public.is_active_member() AND user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "personal_reminders_self_insert"
  ON "public"."personal_reminders" FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "personal_reminders_self_update"
  ON "public"."personal_reminders" FOR UPDATE TO authenticated
  USING (public.is_active_member() AND user_id = auth.uid())
  WITH CHECK (public.is_active_member() AND user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "personal_reminders_self_delete"
  ON "public"."personal_reminders" FOR DELETE TO authenticated
  USING (public.is_active_member() AND user_id = auth.uid());