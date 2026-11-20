import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// =============================================================================
// PostgreSQL Enums (strictly within public schema)
// =============================================================================

export const userRoleEnum = pgEnum('user_role', ['student', 'faculty', 'admin']);

export const hiringTypeEnum = pgEnum('hiring_type', [
  'On-Campus',
  'Off-Campus',
  'Internship',
  'Full-Time',
]);

export const interviewResultEnum = pgEnum('interview_result_status', [
  'Selected / Offered',
  'Rejected',
  'In Progress / Final Round',
]);

export const difficultyEnum = pgEnum('difficulty_level', ['Easy', 'Medium', 'Hard']);

export const problemStatusEnum = pgEnum('problem_status', ['open', 'solved']);

export const notificationTypeEnum = pgEnum('notification_type', [
  'problem_posted',
  'problem_message',
  'placement_posted',
  'interview_posted',
  'spotlight',
  'reminder',
]);

export const reminderCategoryEnum = pgEnum('reminder_category', [
  'problem_statement',
  'placement',
  'hackathon',
  'interview',
  'exam_lab',
  'general',
]);

export const reminderPriorityEnum = pgEnum('reminder_priority', ['High', 'Normal', 'Low']);

// =============================================================================
// 1. Portal Settings (Singleton Configuration Row)
// =============================================================================

export const portalSettings = pgTable(
  'portal_settings',
  {
    id: integer('id').primaryKey().default(1),
    adminInitialized: boolean('admin_initialized').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('chk_portal_settings_singleton', sql`${t.id} = 1`)]
);

// =============================================================================
// 2–5. Core Users & Role-Specific Profiles (1:1)
// Note: public.users.id references auth.users(id) via explicit migration SQL FK.
// =============================================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    memberId: varchar('member_id', { length: 64 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull(),
    department: varchar('department', { length: 120 }).notNull().default('CSE'),
    batchOrDesignation: varchar('batch_or_designation', { length: 200 }).notNull().default(''),
    phone: varchar('phone', { length: 40 }).notNull().default(''),
    bio: text('bio').notNull().default(''),
    skills: text('skills').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    canManageSpotlights: boolean('can_manage_spotlights').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_users_email_lower').on(sql`lower(${t.email})`),
    uniqueIndex('uq_users_member_id_upper').on(sql`upper(${t.memberId})`),
    index('idx_users_role_active').on(t.role, t.isActive),
  ]
);

export const studentProfiles = pgTable(
  'student_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    year: varchar('year', { length: 32 }).notNull().default(''),
    section: varchar('section', { length: 16 }).notNull().default(''),
    cgpa: numeric('cgpa', { precision: 4, scale: 2 }).notNull().default('0.00'),
    leetcodeUrl: text('leetcode_url').notNull().default(''),
    leetcodeUsername: varchar('leetcode_username', { length: 120 }).notNull().default(''),
    leetcodeSolved: integer('leetcode_solved').notNull().default(0),
    leetcodeEasy: integer('leetcode_easy').notNull().default(0),
    leetcodeMedium: integer('leetcode_medium').notNull().default(0),
    leetcodeHard: integer('leetcode_hard').notNull().default(0),
    hackerrankUrl: text('hackerrank_url').notNull().default(''),
    hackerrankUsername: varchar('hackerrank_username', { length: 120 }).notNull().default(''),
    hackerrankFiveStars: integer('hackerrank_five_stars').notNull().default(0),
    githubUrl: text('github_url').notNull().default(''),
    githubUsername: varchar('github_username', { length: 120 }).notNull().default(''),
    githubProjects: integer('github_projects').notNull().default(0),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    codingSyncAttemptedAt: timestamp('coding_sync_attempted_at', { withTimezone: true }),
    leetcodeVerifiedAt: timestamp('leetcode_verified_at', { withTimezone: true }),
    hackerrankVerifiedAt: timestamp('hackerrank_verified_at', { withTimezone: true }),
    githubVerifiedAt: timestamp('github_verified_at', { withTimezone: true }),
    leetcodeOwnerVerifiedAt: timestamp('leetcode_owner_verified_at', { withTimezone: true }),
    hackerrankOwnerVerifiedAt: timestamp('hackerrank_owner_verified_at', { withTimezone: true }),
    githubOwnerVerifiedAt: timestamp('github_owner_verified_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_student_cgpa_range', sql`${t.cgpa} >= 0 AND ${t.cgpa} <= 10`),
    index('idx_student_profiles_year_section').on(t.year, t.section),
  ]
);

export const facultyProfiles = pgTable('faculty_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  designation: varchar('designation', { length: 160 }).notNull(),
  specialization: text('specialization').notNull().default('Computer Science & Engineering'),
  qualification: varchar('qualification', { length: 200 }).notNull().default('M.Tech / Ph.D'),
  experienceYears: integer('experience_years').notNull().default(0),
  phoneOrCabin: varchar('phone_or_cabin', { length: 120 }).notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminProfiles = pgTable('admin_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 160 }).notNull().default('College Portal Administrator'),
  createdBySystemSetup: boolean('created_by_system_setup').notNull().default(true),
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  adminRoleLabel: varchar('admin_role_label', { length: 120 }).notNull().default('Department Admin'),
  permStudents: boolean('perm_students').notNull().default(false),
  permFaculty: boolean('perm_faculty').notNull().default(false),
  permPlacements: boolean('perm_placements').notNull().default(false),
  permCodingVerification: boolean('perm_coding_verification').notNull().default(false),
  permDashboardAnalytics: boolean('perm_dashboard_analytics').notNull().default(false),
  canCreateAdmins: boolean('can_create_admins').notNull().default(false),
  createdByAdminId: uuid('created_by_admin_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// =============================================================================
// 6–11. Department Spotlights, Experiences, Projects & Apps
// =============================================================================

export const spotlights = pgTable(
  'spotlights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: varchar('category', { length: 120 }).notNull().default('Department Spotlight'),
    headlineValue: varchar('headline_value', { length: 160 }).notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    recipients: text('recipients').notNull().default(''),
    description: text('description').notNull().default(''),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorNameSnapshot: varchar('author_name_snapshot', { length: 160 }).notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_spotlights_created_at').on(t.createdAt)]
);

export const hackathons = pgTable(
  'hackathons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hackathonName: varchar('hackathon_name', { length: 240 }).notNull(),
    organizer: varchar('organizer', { length: 240 }).notNull().default(''),
    eventDate: varchar('event_date', { length: 80 }).notNull().default(''),
    teamAndRole: varchar('team_and_role', { length: 240 }).notNull().default(''),
    outcome: varchar('outcome', { length: 160 }).notNull().default('Participant'),
    technologies: text('technologies').notNull().default(''),
    overallExperience: text('overall_experience').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_hackathons_author').on(t.authorId),
    index('idx_hackathons_created_at').on(t.createdAt),
  ]
);

export const interviews = pgTable(
  'interviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyName: varchar('company_name', { length: 160 }).notNull(),
    roleTitle: varchar('role_title', { length: 200 }).notNull(),
    companyDomain: varchar('company_domain', { length: 200 })
      .notNull()
      .default('Technology & Software'),
    skillsNeeded: text('skills_needed').notNull().default(''),
    hiringType: hiringTypeEnum('hiring_type').notNull().default('On-Campus'),
    packageOrStipend: varchar('package_or_stipend', { length: 120 }).notNull().default(''),
    interviewDate: varchar('interview_date', { length: 80 }).notNull().default(''),
    resultStatus: interviewResultEnum('result_status').notNull().default('Selected / Offered'),
    overallDifficulty: difficultyEnum('overall_difficulty').notNull().default('Medium'),
    overallExperience: text('overall_experience').notNull(),
    keyPreparationTips: text('key_preparation_tips').notNull().default(''),
    resourcesUsed: text('resources_used').notNull().default(''),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_interviews_author').on(t.authorId),
    index('idx_interviews_company_lower').on(sql`lower(${t.companyName})`),
    index('idx_interviews_created_at').on(t.createdAt),
  ]
);

export const interviewRounds = pgTable(
  'interview_rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interviewId: uuid('interview_id')
      .notNull()
      .references(() => interviews.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    roundTitle: varchar('round_title', { length: 240 }).notNull(),
    topicsCovered: text('topics_covered').notNull().default(''),
    questionsAsked: text('questions_asked').notNull().default(''),
    difficulty: difficultyEnum('difficulty').notNull().default('Medium'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_interview_rounds_num').on(t.interviewId, t.roundNumber),
    index('idx_interview_rounds_interview').on(t.interviewId),
  ]
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectName: varchar('project_name', { length: 200 }).notNull(),
    websiteType: varchar('website_type', { length: 120 }).notNull().default('Web Application'),
    projectLink: text('project_link').notNull(),
    technologies: text('technologies').notNull().default(''),
    description: text('description').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_projects_author').on(t.authorId),
    index('idx_projects_created_at').on(t.createdAt),
  ]
);

export const appTechnologies = pgTable(
  'app_technologies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appName: varchar('app_name', { length: 200 }).notNull(),
    usedTechnologies: text('used_technologies').notNull(),
    description: text('description').notNull().default(''),
    appType: varchar('app_type', { length: 120 }).notNull().default('Web Application'),
    appLink: text('app_link').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_app_technologies_author').on(t.authorId),
    index('idx_app_technologies_created_at').on(t.createdAt),
  ]
);

// =============================================================================
// 12–14. Problem Statements, Responses & Solvers
// =============================================================================

export const problems = pgTable(
  'problems',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 240 }).notNull(),
    applicationName: varchar('application_name', { length: 160 })
      .notNull()
      .default('General Application'),
    category: varchar('category', { length: 120 }).notNull().default('Software Issue'),
    description: text('description').notNull(),
    contactInfo: varchar('contact_info', { length: 200 }).notNull(),
    contactEmail: varchar('contact_email', { length: 255 }).notNull().default(''),
    status: problemStatusEnum('status').notNull().default('open'),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_problems_author').on(t.authorId),
    index('idx_problems_status_created').on(t.status, t.createdAt),
  ]
);

export const problemResponses = pgTable(
  'problem_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    problemId: uuid('problem_id')
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    solutionLink: text('solution_link').notNull().default(''),
    marksSolved: boolean('marks_solved').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_problem_responses_problem_created').on(t.problemId, t.createdAt),
    index('idx_problem_responses_sender').on(t.senderId),
  ]
);

export const problemSolvers = pgTable(
  'problem_solvers',
  {
    problemId: uuid('problem_id')
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    solvedAt: timestamp('solved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.problemId, t.userId] }),
    index('idx_problem_solvers_user').on(t.userId),
  ]
);

// =============================================================================
// 15–20. Placements, Courses, Faculty Directory & Academic Resources
// =============================================================================

export const placementDrives = pgTable(
  'placement_drives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyName: varchar('company_name', { length: 180 }).notNull(),
    roleTitle: varchar('role_title', { length: 200 }).notNull(),
    packageCtc: varchar('package_ctc', { length: 120 }).notNull(),
    location: varchar('location', { length: 160 }).notNull().default('On-Campus / Hybrid'),
    deadline: varchar('deadline', { length: 40 }).notNull().default(''),
    applyLink: text('apply_link').notNull().default(''),
    description: text('description').notNull().default(''),
    requireCgpa: boolean('require_cgpa').notNull().default(false),
    minCgpa: numeric('min_cgpa', { precision: 4, scale: 2 }).notNull().default('0.00'),
    requireLeetcode: boolean('require_leetcode').notNull().default(false),
    minLeetcodeProblems: integer('min_leetcode_problems').notNull().default(0),
    requireHackerrank: boolean('require_hackerrank').notNull().default(false),
    minHackerrankFiveStars: integer('min_hackerrank_five_stars').notNull().default(0),
    requireGithub: boolean('require_github').notNull().default(false),
    minGithubProjects: integer('min_github_projects').notNull().default(0),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorNameSnapshot: varchar('author_name_snapshot', { length: 160 }).notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_placement_drives_created_at').on(t.createdAt)]
);

export const placementApplications = pgTable(
  'placement_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driveId: uuid('drive_id')
      .notNull()
      .references(() => placementDrives.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cgpaSnapshot: numeric('cgpa_snapshot', { precision: 4, scale: 2 }).notNull().default('0.00'),
    leetcodeSolvedSnapshot: integer('leetcode_solved_snapshot').notNull().default(0),
    hackerrankFiveStarsSnapshot: integer('hackerrank_five_stars_snapshot').notNull().default(0),
    githubProjectsSnapshot: integer('github_projects_snapshot').notNull().default(0),
    leetcodeSnapshotVerified: boolean('leetcode_snapshot_verified').notNull().default(false),
    hackerrankSnapshotVerified: boolean('hackerrank_snapshot_verified').notNull().default(false),
    githubSnapshotVerified: boolean('github_snapshot_verified').notNull().default(false),
    resumeLink: text('resume_link').notNull().default(''),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_placement_applications_drive_student').on(t.driveId, t.studentId),
    index('idx_placement_applications_student').on(t.studentId),
  ]
);

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseCode: varchar('course_code', { length: 40 }).notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    instructorName: varchar('instructor_name', { length: 160 }).notNull(),
    semester: varchar('semester', { length: 80 }).notNull().default('Current Semester'),
    credits: integer('credits').notNull().default(3),
    schedule: varchar('schedule', { length: 160 }).notNull().default('TBA'),
    prerequisites: text('prerequisites').notNull().default('None'),
    description: text('description').notNull().default(''),
    resourceLink: text('resource_link').notNull().default(''),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_courses_code').on(t.courseCode),
    index('idx_courses_created_at').on(t.createdAt),
  ]
);

export const courseEnrollments = pgTable(
  'course_enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_course_enrollments_course_student').on(t.courseId, t.studentId),
    index('idx_course_enrollments_student').on(t.studentId),
  ]
);

export const facultyDirectory = pgTable(
  'faculty_directory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    linkedUserId: uuid('linked_user_id').references(() => users.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 160 }).notNull(),
    designation: varchar('designation', { length: 160 }).notNull(),
    specialization: text('specialization').notNull().default('Computer Science & Engineering'),
    email: varchar('email', { length: 255 }),
    phoneOrCabin: varchar('phone_or_cabin', { length: 120 }).notNull().default(''),
    qualification: varchar('qualification', { length: 200 }).notNull().default(''),
    experienceYears: integer('experience_years').notNull().default(0),
    bio: text('bio').notNull().default(''),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_faculty_dir_linked_user')
      .on(t.linkedUserId)
      .where(sql`${t.linkedUserId} IS NOT NULL`),
    uniqueIndex('uq_faculty_dir_email_nonempty')
      .on(sql`lower(${t.email})`)
      .where(sql`${t.email} IS NOT NULL AND ${t.email} <> ''`),
    index('idx_faculty_dir_created_at').on(t.createdAt),
  ]
);

export const academicResources = pgTable(
  'academic_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 240 }).notNull(),
    resourceType: varchar('resource_type', { length: 100 }).notNull().default('Lab Manual'),
    subjectOrLab: varchar('subject_or_lab', { length: 160 }).notNull().default('CSE Department'),
    description: text('description').notNull().default(''),
    resourceLink: text('resource_link').notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorNameSnapshot: varchar('author_name_snapshot', { length: 160 }).notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_academic_resources_created_at').on(t.createdAt)]
);

// =============================================================================
// 21–23. Notifications, Read Receipts & Personal Reminders
// =============================================================================

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    message: text('message').notNull(),
    targetSection: varchar('target_section', { length: 64 }).notNull(),
    targetItemId: uuid('target_item_id'),
    recipientUserId: uuid('recipient_user_id').references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorNameSnapshot: varchar('actor_name_snapshot', { length: 160 }).notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_notifications_recipient_created').on(t.recipientUserId, t.createdAt),
    index('idx_notifications_created_at').on(t.createdAt),
  ]
);

export const notificationReads = pgTable(
  'notification_reads',
  {
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.notificationId, t.userId] }),
    index('idx_notification_reads_user').on(t.userId),
  ]
);

export const personalReminders = pgTable(
  'personal_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 240 }).notNull(),
    note: text('note').notNull().default(''),
    dueDate: varchar('due_date', { length: 32 }).notNull().default(''),
    category: reminderCategoryEnum('category').notNull().default('general'),
    priority: reminderPriorityEnum('priority').notNull().default('Normal'),
    completed: boolean('completed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_personal_reminders_user_created').on(t.userId, t.createdAt)]
);

// =============================================================================
// Drizzle Relations
// =============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  studentProfile: one(studentProfiles, {
    fields: [users.id],
    references: [studentProfiles.userId],
  }),
  facultyProfile: one(facultyProfiles, {
    fields: [users.id],
    references: [facultyProfiles.userId],
  }),
  adminProfile: one(adminProfiles, {
    fields: [users.id],
    references: [adminProfiles.userId],
  }),
  linkedDirectoryEntry: one(facultyDirectory, {
    fields: [users.id],
    references: [facultyDirectory.linkedUserId],
  }),
  hackathons: many(hackathons),
  interviews: many(interviews),
  projects: many(projects),
  appTechnologies: many(appTechnologies),
  problems: many(problems),
  problemResponses: many(problemResponses),
  solvedProblems: many(problemSolvers),
  placementApplications: many(placementApplications),
  courseEnrollments: many(courseEnrollments),
  personalReminders: many(personalReminders),
  notificationReads: many(notificationReads),
}));

export const interviewsRelations = relations(interviews, ({ one, many }) => ({
  author: one(users, {
    fields: [interviews.authorId],
    references: [users.id],
  }),
  rounds: many(interviewRounds),
}));

export const interviewRoundsRelations = relations(interviewRounds, ({ one }) => ({
  interview: one(interviews, {
    fields: [interviewRounds.interviewId],
    references: [interviews.id],
  }),
}));

export const problemsRelations = relations(problems, ({ one, many }) => ({
  author: one(users, {
    fields: [problems.authorId],
    references: [users.id],
  }),
  responses: many(problemResponses),
  solvers: many(problemSolvers),
}));

export const problemResponsesRelations = relations(problemResponses, ({ one }) => ({
  problem: one(problems, {
    fields: [problemResponses.problemId],
    references: [problems.id],
  }),
  sender: one(users, {
    fields: [problemResponses.senderId],
    references: [users.id],
  }),
}));

export const problemSolversRelations = relations(problemSolvers, ({ one }) => ({
  problem: one(problems, {
    fields: [problemSolvers.problemId],
    references: [problems.id],
  }),
  user: one(users, {
    fields: [problemSolvers.userId],
    references: [users.id],
  }),
}));

export const placementDrivesRelations = relations(placementDrives, ({ one, many }) => ({
  author: one(users, {
    fields: [placementDrives.authorId],
    references: [users.id],
  }),
  applicants: many(placementApplications),
}));

export const placementApplicationsRelations = relations(placementApplications, ({ one }) => ({
  drive: one(placementDrives, {
    fields: [placementApplications.driveId],
    references: [placementDrives.id],
  }),
  student: one(users, {
    fields: [placementApplications.studentId],
    references: [users.id],
  }),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  author: one(users, {
    fields: [courses.authorId],
    references: [users.id],
  }),
  enrollments: many(courseEnrollments),
}));

export const courseEnrollmentsRelations = relations(courseEnrollments, ({ one }) => ({
  course: one(courses, {
    fields: [courseEnrollments.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [courseEnrollments.studentId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  recipient: one(users, {
    fields: [notifications.recipientUserId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
  }),
  reads: many(notificationReads),
}));

export const notificationReadsRelations = relations(notificationReads, ({ one }) => ({
  notification: one(notifications, {
    fields: [notificationReads.notificationId],
    references: [notifications.id],
  }),
  user: one(users, {
    fields: [notificationReads.userId],
    references: [users.id],
  }),
}));
