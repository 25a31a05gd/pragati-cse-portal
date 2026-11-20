var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server.ts
import "dotenv/config";
import dns from "dns";
import express from "express";
import crypto from "crypto";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { and as and2, desc as desc2, eq as eq2, isNull as isNull2, or as or2, sql as sql3 } from "drizzle-orm";
import { z } from "zod";

// src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  academicResources: () => academicResources,
  adminProfiles: () => adminProfiles,
  appTechnologies: () => appTechnologies,
  courseEnrollments: () => courseEnrollments,
  courseEnrollmentsRelations: () => courseEnrollmentsRelations,
  courses: () => courses,
  coursesRelations: () => coursesRelations,
  difficultyEnum: () => difficultyEnum,
  facultyDirectory: () => facultyDirectory,
  facultyProfiles: () => facultyProfiles,
  hackathons: () => hackathons,
  hiringTypeEnum: () => hiringTypeEnum,
  interviewResultEnum: () => interviewResultEnum,
  interviewRounds: () => interviewRounds,
  interviewRoundsRelations: () => interviewRoundsRelations,
  interviews: () => interviews,
  interviewsRelations: () => interviewsRelations,
  notificationReads: () => notificationReads,
  notificationReadsRelations: () => notificationReadsRelations,
  notificationTypeEnum: () => notificationTypeEnum,
  notifications: () => notifications,
  notificationsRelations: () => notificationsRelations,
  personalReminders: () => personalReminders,
  placementApplications: () => placementApplications,
  placementApplicationsRelations: () => placementApplicationsRelations,
  placementDrives: () => placementDrives,
  placementDrivesRelations: () => placementDrivesRelations,
  portalSettings: () => portalSettings,
  problemResponses: () => problemResponses,
  problemResponsesRelations: () => problemResponsesRelations,
  problemSolvers: () => problemSolvers,
  problemSolversRelations: () => problemSolversRelations,
  problemStatusEnum: () => problemStatusEnum,
  problems: () => problems,
  problemsRelations: () => problemsRelations,
  projects: () => projects,
  reminderCategoryEnum: () => reminderCategoryEnum,
  reminderPriorityEnum: () => reminderPriorityEnum,
  spotlights: () => spotlights,
  studentProfiles: () => studentProfiles,
  userRoleEnum: () => userRoleEnum,
  users: () => users,
  usersRelations: () => usersRelations
});
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
  check
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
var userRoleEnum = pgEnum("user_role", ["student", "faculty", "admin"]);
var hiringTypeEnum = pgEnum("hiring_type", [
  "On-Campus",
  "Off-Campus",
  "Internship",
  "Full-Time"
]);
var interviewResultEnum = pgEnum("interview_result_status", [
  "Selected / Offered",
  "Rejected",
  "In Progress / Final Round"
]);
var difficultyEnum = pgEnum("difficulty_level", ["Easy", "Medium", "Hard"]);
var problemStatusEnum = pgEnum("problem_status", ["open", "solved"]);
var notificationTypeEnum = pgEnum("notification_type", [
  "problem_posted",
  "problem_message",
  "placement_posted",
  "interview_posted",
  "spotlight",
  "reminder"
]);
var reminderCategoryEnum = pgEnum("reminder_category", [
  "problem_statement",
  "placement",
  "hackathon",
  "interview",
  "exam_lab",
  "general"
]);
var reminderPriorityEnum = pgEnum("reminder_priority", ["High", "Normal", "Low"]);
var portalSettings = pgTable(
  "portal_settings",
  {
    id: integer("id").primaryKey().default(1),
    adminInitialized: boolean("admin_initialized").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check("chk_portal_settings_singleton", sql`${t.id} = 1`)]
);
var users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    memberId: varchar("member_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    department: varchar("department", { length: 120 }).notNull().default("CSE"),
    batchOrDesignation: varchar("batch_or_designation", { length: 200 }).notNull().default(""),
    phone: varchar("phone", { length: 40 }).notNull().default(""),
    bio: text("bio").notNull().default(""),
    skills: text("skills").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    canManageSpotlights: boolean("can_manage_spotlights").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("uq_users_email_lower").on(sql`lower(${t.email})`),
    uniqueIndex("uq_users_member_id_upper").on(sql`upper(${t.memberId})`),
    index("idx_users_role_active").on(t.role, t.isActive)
  ]
);
var studentProfiles = pgTable(
  "student_profiles",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    year: varchar("year", { length: 32 }).notNull().default(""),
    section: varchar("section", { length: 16 }).notNull().default(""),
    cgpa: numeric("cgpa", { precision: 4, scale: 2 }).notNull().default("0.00"),
    leetcodeUrl: text("leetcode_url").notNull().default(""),
    leetcodeUsername: varchar("leetcode_username", { length: 120 }).notNull().default(""),
    leetcodeSolved: integer("leetcode_solved").notNull().default(0),
    leetcodeEasy: integer("leetcode_easy").notNull().default(0),
    leetcodeMedium: integer("leetcode_medium").notNull().default(0),
    leetcodeHard: integer("leetcode_hard").notNull().default(0),
    hackerrankUrl: text("hackerrank_url").notNull().default(""),
    hackerrankUsername: varchar("hackerrank_username", { length: 120 }).notNull().default(""),
    hackerrankFiveStars: integer("hackerrank_five_stars").notNull().default(0),
    githubUrl: text("github_url").notNull().default(""),
    githubUsername: varchar("github_username", { length: 120 }).notNull().default(""),
    githubProjects: integer("github_projects").notNull().default(0),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    codingSyncAttemptedAt: timestamp("coding_sync_attempted_at", { withTimezone: true }),
    leetcodeVerifiedAt: timestamp("leetcode_verified_at", { withTimezone: true }),
    hackerrankVerifiedAt: timestamp("hackerrank_verified_at", { withTimezone: true }),
    githubVerifiedAt: timestamp("github_verified_at", { withTimezone: true }),
    leetcodeOwnerVerifiedAt: timestamp("leetcode_owner_verified_at", { withTimezone: true }),
    hackerrankOwnerVerifiedAt: timestamp("hackerrank_owner_verified_at", { withTimezone: true }),
    githubOwnerVerifiedAt: timestamp("github_owner_verified_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check("chk_student_cgpa_range", sql`${t.cgpa} >= 0 AND ${t.cgpa} <= 10`),
    index("idx_student_profiles_year_section").on(t.year, t.section)
  ]
);
var facultyProfiles = pgTable("faculty_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  designation: varchar("designation", { length: 160 }).notNull(),
  specialization: text("specialization").notNull().default("Computer Science & Engineering"),
  qualification: varchar("qualification", { length: 200 }).notNull().default("M.Tech / Ph.D"),
  experienceYears: integer("experience_years").notNull().default(0),
  phoneOrCabin: varchar("phone_or_cabin", { length: 120 }).notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var adminProfiles = pgTable("admin_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull().default("College Portal Administrator"),
  createdBySystemSetup: boolean("created_by_system_setup").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var spotlights = pgTable(
  "spotlights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: varchar("category", { length: 120 }).notNull().default("Department Spotlight"),
    headlineValue: varchar("headline_value", { length: 160 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    recipients: text("recipients").notNull().default(""),
    description: text("description").notNull().default(""),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    authorNameSnapshot: varchar("author_name_snapshot", { length: 160 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_spotlights_created_at").on(t.createdAt)]
);
var hackathons = pgTable(
  "hackathons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hackathonName: varchar("hackathon_name", { length: 240 }).notNull(),
    organizer: varchar("organizer", { length: 240 }).notNull().default(""),
    eventDate: varchar("event_date", { length: 80 }).notNull().default(""),
    teamAndRole: varchar("team_and_role", { length: 240 }).notNull().default(""),
    outcome: varchar("outcome", { length: 160 }).notNull().default("Participant"),
    technologies: text("technologies").notNull().default(""),
    overallExperience: text("overall_experience").notNull(),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_hackathons_author").on(t.authorId),
    index("idx_hackathons_created_at").on(t.createdAt)
  ]
);
var interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: varchar("company_name", { length: 160 }).notNull(),
    roleTitle: varchar("role_title", { length: 200 }).notNull(),
    companyDomain: varchar("company_domain", { length: 200 }).notNull().default("Technology & Software"),
    skillsNeeded: text("skills_needed").notNull().default(""),
    hiringType: hiringTypeEnum("hiring_type").notNull().default("On-Campus"),
    packageOrStipend: varchar("package_or_stipend", { length: 120 }).notNull().default(""),
    interviewDate: varchar("interview_date", { length: 80 }).notNull().default(""),
    resultStatus: interviewResultEnum("result_status").notNull().default("Selected / Offered"),
    overallDifficulty: difficultyEnum("overall_difficulty").notNull().default("Medium"),
    overallExperience: text("overall_experience").notNull(),
    keyPreparationTips: text("key_preparation_tips").notNull().default(""),
    resourcesUsed: text("resources_used").notNull().default(""),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_interviews_author").on(t.authorId),
    index("idx_interviews_company_lower").on(sql`lower(${t.companyName})`),
    index("idx_interviews_created_at").on(t.createdAt)
  ]
);
var interviewRounds = pgTable(
  "interview_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interviewId: uuid("interview_id").notNull().references(() => interviews.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    roundTitle: varchar("round_title", { length: 240 }).notNull(),
    topicsCovered: text("topics_covered").notNull().default(""),
    questionsAsked: text("questions_asked").notNull().default(""),
    difficulty: difficultyEnum("difficulty").notNull().default("Medium"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("uq_interview_rounds_num").on(t.interviewId, t.roundNumber),
    index("idx_interview_rounds_interview").on(t.interviewId)
  ]
);
var projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectName: varchar("project_name", { length: 200 }).notNull(),
    websiteType: varchar("website_type", { length: 120 }).notNull().default("Web Application"),
    projectLink: text("project_link").notNull(),
    technologies: text("technologies").notNull().default(""),
    description: text("description").notNull(),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_projects_author").on(t.authorId),
    index("idx_projects_created_at").on(t.createdAt)
  ]
);
var appTechnologies = pgTable(
  "app_technologies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appName: varchar("app_name", { length: 200 }).notNull(),
    usedTechnologies: text("used_technologies").notNull(),
    description: text("description").notNull().default(""),
    appType: varchar("app_type", { length: 120 }).notNull().default("Web Application"),
    appLink: text("app_link").notNull(),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_app_technologies_author").on(t.authorId),
    index("idx_app_technologies_created_at").on(t.createdAt)
  ]
);
var problems = pgTable(
  "problems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 240 }).notNull(),
    applicationName: varchar("application_name", { length: 160 }).notNull().default("General Application"),
    category: varchar("category", { length: 120 }).notNull().default("Software Issue"),
    description: text("description").notNull(),
    contactInfo: varchar("contact_info", { length: 200 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }).notNull().default(""),
    status: problemStatusEnum("status").notNull().default("open"),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_problems_author").on(t.authorId),
    index("idx_problems_status_created").on(t.status, t.createdAt)
  ]
);
var problemResponses = pgTable(
  "problem_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    problemId: uuid("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    solutionLink: text("solution_link").notNull().default(""),
    marksSolved: boolean("marks_solved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_problem_responses_problem_created").on(t.problemId, t.createdAt),
    index("idx_problem_responses_sender").on(t.senderId)
  ]
);
var problemSolvers = pgTable(
  "problem_solvers",
  {
    problemId: uuid("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    solvedAt: timestamp("solved_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    primaryKey({ columns: [t.problemId, t.userId] }),
    index("idx_problem_solvers_user").on(t.userId)
  ]
);
var placementDrives = pgTable(
  "placement_drives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: varchar("company_name", { length: 180 }).notNull(),
    roleTitle: varchar("role_title", { length: 200 }).notNull(),
    packageCtc: varchar("package_ctc", { length: 120 }).notNull(),
    location: varchar("location", { length: 160 }).notNull().default("On-Campus / Hybrid"),
    deadline: varchar("deadline", { length: 40 }).notNull().default(""),
    applyLink: text("apply_link").notNull().default(""),
    description: text("description").notNull().default(""),
    requireCgpa: boolean("require_cgpa").notNull().default(false),
    minCgpa: numeric("min_cgpa", { precision: 4, scale: 2 }).notNull().default("0.00"),
    requireLeetcode: boolean("require_leetcode").notNull().default(false),
    minLeetcodeProblems: integer("min_leetcode_problems").notNull().default(0),
    requireHackerrank: boolean("require_hackerrank").notNull().default(false),
    minHackerrankFiveStars: integer("min_hackerrank_five_stars").notNull().default(0),
    requireGithub: boolean("require_github").notNull().default(false),
    minGithubProjects: integer("min_github_projects").notNull().default(0),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    authorNameSnapshot: varchar("author_name_snapshot", { length: 160 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_placement_drives_created_at").on(t.createdAt)]
);
var placementApplications = pgTable(
  "placement_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driveId: uuid("drive_id").notNull().references(() => placementDrives.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    cgpaSnapshot: numeric("cgpa_snapshot", { precision: 4, scale: 2 }).notNull().default("0.00"),
    leetcodeSolvedSnapshot: integer("leetcode_solved_snapshot").notNull().default(0),
    hackerrankFiveStarsSnapshot: integer("hackerrank_five_stars_snapshot").notNull().default(0),
    githubProjectsSnapshot: integer("github_projects_snapshot").notNull().default(0),
    leetcodeSnapshotVerified: boolean("leetcode_snapshot_verified").notNull().default(false),
    hackerrankSnapshotVerified: boolean("hackerrank_snapshot_verified").notNull().default(false),
    githubSnapshotVerified: boolean("github_snapshot_verified").notNull().default(false),
    resumeLink: text("resume_link").notNull().default(""),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("uq_placement_applications_drive_student").on(t.driveId, t.studentId),
    index("idx_placement_applications_student").on(t.studentId)
  ]
);
var courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseCode: varchar("course_code", { length: 40 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    instructorName: varchar("instructor_name", { length: 160 }).notNull(),
    semester: varchar("semester", { length: 80 }).notNull().default("Current Semester"),
    credits: integer("credits").notNull().default(3),
    schedule: varchar("schedule", { length: 160 }).notNull().default("TBA"),
    prerequisites: text("prerequisites").notNull().default("None"),
    description: text("description").notNull().default(""),
    resourceLink: text("resource_link").notNull().default(""),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_courses_code").on(t.courseCode),
    index("idx_courses_created_at").on(t.createdAt)
  ]
);
var courseEnrollments = pgTable(
  "course_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("uq_course_enrollments_course_student").on(t.courseId, t.studentId),
    index("idx_course_enrollments_student").on(t.studentId)
  ]
);
var facultyDirectory = pgTable(
  "faculty_directory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    linkedUserId: uuid("linked_user_id").references(() => users.id, { onDelete: "set null" }),
    name: varchar("name", { length: 160 }).notNull(),
    designation: varchar("designation", { length: 160 }).notNull(),
    specialization: text("specialization").notNull().default("Computer Science & Engineering"),
    email: varchar("email", { length: 255 }),
    phoneOrCabin: varchar("phone_or_cabin", { length: 120 }).notNull().default(""),
    qualification: varchar("qualification", { length: 200 }).notNull().default(""),
    experienceYears: integer("experience_years").notNull().default(0),
    bio: text("bio").notNull().default(""),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("uq_faculty_dir_linked_user").on(t.linkedUserId).where(sql`${t.linkedUserId} IS NOT NULL`),
    uniqueIndex("uq_faculty_dir_email_nonempty").on(sql`lower(${t.email})`).where(sql`${t.email} IS NOT NULL AND ${t.email} <> ''`),
    index("idx_faculty_dir_created_at").on(t.createdAt)
  ]
);
var academicResources = pgTable(
  "academic_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 240 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }).notNull().default("Lab Manual"),
    subjectOrLab: varchar("subject_or_lab", { length: 160 }).notNull().default("CSE Department"),
    description: text("description").notNull().default(""),
    resourceLink: text("resource_link").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    authorNameSnapshot: varchar("author_name_snapshot", { length: 160 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_academic_resources_created_at").on(t.createdAt)]
);
var notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    message: text("message").notNull(),
    targetSection: varchar("target_section", { length: 64 }).notNull(),
    targetItemId: uuid("target_item_id"),
    recipientUserId: uuid("recipient_user_id").references(() => users.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorNameSnapshot: varchar("actor_name_snapshot", { length: 160 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_notifications_recipient_created").on(t.recipientUserId, t.createdAt),
    index("idx_notifications_created_at").on(t.createdAt)
  ]
);
var notificationReads = pgTable(
  "notification_reads",
  {
    notificationId: uuid("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    primaryKey({ columns: [t.notificationId, t.userId] }),
    index("idx_notification_reads_user").on(t.userId)
  ]
);
var personalReminders = pgTable(
  "personal_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 240 }).notNull(),
    note: text("note").notNull().default(""),
    dueDate: varchar("due_date", { length: 32 }).notNull().default(""),
    category: reminderCategoryEnum("category").notNull().default("general"),
    priority: reminderPriorityEnum("priority").notNull().default("Normal"),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_personal_reminders_user_created").on(t.userId, t.createdAt)]
);
var usersRelations = relations(users, ({ one, many }) => ({
  studentProfile: one(studentProfiles, {
    fields: [users.id],
    references: [studentProfiles.userId]
  }),
  facultyProfile: one(facultyProfiles, {
    fields: [users.id],
    references: [facultyProfiles.userId]
  }),
  adminProfile: one(adminProfiles, {
    fields: [users.id],
    references: [adminProfiles.userId]
  }),
  linkedDirectoryEntry: one(facultyDirectory, {
    fields: [users.id],
    references: [facultyDirectory.linkedUserId]
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
  notificationReads: many(notificationReads)
}));
var interviewsRelations = relations(interviews, ({ one, many }) => ({
  author: one(users, {
    fields: [interviews.authorId],
    references: [users.id]
  }),
  rounds: many(interviewRounds)
}));
var interviewRoundsRelations = relations(interviewRounds, ({ one }) => ({
  interview: one(interviews, {
    fields: [interviewRounds.interviewId],
    references: [interviews.id]
  })
}));
var problemsRelations = relations(problems, ({ one, many }) => ({
  author: one(users, {
    fields: [problems.authorId],
    references: [users.id]
  }),
  responses: many(problemResponses),
  solvers: many(problemSolvers)
}));
var problemResponsesRelations = relations(problemResponses, ({ one }) => ({
  problem: one(problems, {
    fields: [problemResponses.problemId],
    references: [problems.id]
  }),
  sender: one(users, {
    fields: [problemResponses.senderId],
    references: [users.id]
  })
}));
var problemSolversRelations = relations(problemSolvers, ({ one }) => ({
  problem: one(problems, {
    fields: [problemSolvers.problemId],
    references: [problems.id]
  }),
  user: one(users, {
    fields: [problemSolvers.userId],
    references: [users.id]
  })
}));
var placementDrivesRelations = relations(placementDrives, ({ one, many }) => ({
  author: one(users, {
    fields: [placementDrives.authorId],
    references: [users.id]
  }),
  applicants: many(placementApplications)
}));
var placementApplicationsRelations = relations(placementApplications, ({ one }) => ({
  drive: one(placementDrives, {
    fields: [placementApplications.driveId],
    references: [placementDrives.id]
  }),
  student: one(users, {
    fields: [placementApplications.studentId],
    references: [users.id]
  })
}));
var coursesRelations = relations(courses, ({ one, many }) => ({
  author: one(users, {
    fields: [courses.authorId],
    references: [users.id]
  }),
  enrollments: many(courseEnrollments)
}));
var courseEnrollmentsRelations = relations(courseEnrollments, ({ one }) => ({
  course: one(courses, {
    fields: [courseEnrollments.courseId],
    references: [courses.id]
  }),
  student: one(users, {
    fields: [courseEnrollments.studentId],
    references: [users.id]
  })
}));
var notificationsRelations = relations(notifications, ({ one, many }) => ({
  recipient: one(users, {
    fields: [notifications.recipientUserId],
    references: [users.id]
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id]
  }),
  reads: many(notificationReads)
}));
var notificationReadsRelations = relations(notificationReads, ({ one }) => ({
  notification: one(notifications, {
    fields: [notificationReads.notificationId],
    references: [notifications.id]
  }),
  user: one(users, {
    fields: [notificationReads.userId],
    references: [users.id]
  })
}));

// src/db/index.ts
function resolveDatabaseConfig(rawUrl) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port || "5432";
  const pgbouncerParam = parsed.searchParams.get("pgbouncer") === "true";
  const sslmodeParam = (parsed.searchParams.get("sslmode") || "").toLowerCase();
  const isPoolerHost = hostname.endsWith(".pooler.supabase.com");
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  let connectionMode;
  if (port === "6543" || pgbouncerParam) {
    connectionMode = "transaction_pooler";
  } else if (isPoolerHost && port === "5432") {
    connectionMode = "session_pooler";
  } else if (hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com")) {
    connectionMode = "direct";
  } else {
    connectionMode = "custom";
  }
  const prepare = connectionMode !== "transaction_pooler";
  let ssl = "require";
  let sslMode = "require";
  if (isLocal || sslmodeParam === "disable") {
    ssl = false;
    sslMode = "disabled";
  } else if (sslmodeParam === "verify-full" || sslmodeParam === "verify-ca") {
    ssl = "verify-full";
    sslMode = "verify-full";
  }
  return {
    connectionString: trimmed,
    prepare,
    ssl,
    metadata: {
      configured: true,
      connectionMode,
      port,
      prepareDisabled: !prepare,
      sslMode,
      ipv4PoolerRecommended: connectionMode === "direct",
      transactionPoolerRecommended: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) && connectionMode === "session_pooler"
    }
  };
}
var cachedSql = null;
var cachedDb = null;
var cachedMetadata = null;
function ensureInitialized() {
  if (cachedDb && cachedSql && cachedMetadata) {
    return true;
  }
  const rawUrl = process.env.DATABASE_URL;
  const resolved = resolveDatabaseConfig(rawUrl);
  if (!resolved) {
    cachedMetadata = {
      configured: Boolean((rawUrl || "").trim()),
      connectionMode: (rawUrl || "").trim() ? "invalid_url" : "unconfigured",
      port: null,
      prepareDisabled: false,
      sslMode: "disabled"
    };
    return false;
  }
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  cachedSql = postgres(resolved.connectionString, {
    prepare: resolved.prepare,
    ssl: resolved.ssl,
    max: isServerless ? 1 : 5,
    idle_timeout: isServerless ? 10 : 20,
    connect_timeout: 10
  });
  cachedDb = drizzle(cachedSql, { schema: schema_exports });
  cachedMetadata = resolved.metadata;
  return true;
}
function getDb() {
  if (!ensureInitialized()) return null;
  return cachedDb;
}
function requireDb() {
  const db = getDb();
  if (!db) {
    throw new Error("Database connection is not configured (DATABASE_URL missing or invalid).");
  }
  return db;
}
function getConnectionMetadata() {
  ensureInitialized();
  return cachedMetadata ?? {
    configured: false,
    connectionMode: "unconfigured",
    port: null,
    prepareDisabled: false,
    sslMode: "disabled"
  };
}
function extractDatabaseErrorCode(err, depth = 0) {
  if (depth > 5 || !err || typeof err !== "object") {
    return void 0;
  }
  const candidate = err;
  if (typeof candidate.code === "string" && candidate.code.trim()) {
    return candidate.code.trim();
  }
  if (Array.isArray(candidate.errors)) {
    for (const inner of candidate.errors) {
      const innerCode = extractDatabaseErrorCode(inner, depth + 1);
      if (innerCode) return innerCode;
    }
  }
  if (candidate.cause) {
    const causeCode = extractDatabaseErrorCode(candidate.cause, depth + 1);
    if (causeCode) return causeCode;
  }
  if (typeof candidate.name === "string" && candidate.name.trim() && candidate.name !== "Error" && candidate.name !== "AggregateError") {
    return candidate.name.trim();
  }
  return void 0;
}
async function checkDatabaseReadiness() {
  const ready = ensureInitialized();
  const metadata = getConnectionMetadata();
  if (!ready || !cachedSql) {
    return {
      ...metadata,
      connected: false,
      errorCode: metadata.configured ? "INVALID_DATABASE_URL" : "DATABASE_URL_MISSING"
    };
  }
  const startedAt = Date.now();
  try {
    await cachedSql`SELECT 1 AS readiness_check`;
    return {
      ...metadata,
      connected: true,
      latencyMs: Date.now() - startedAt
    };
  } catch (err) {
    const errorCode = extractDatabaseErrorCode(err) || "CONNECTION_FAILED";
    return {
      ...metadata,
      connected: false,
      latencyMs: Date.now() - startedAt,
      errorCode
    };
  }
}
async function closeDb() {
  if (cachedSql) {
    const sqlClient = cachedSql;
    cachedSql = null;
    cachedDb = null;
    await sqlClient.end({ timeout: 5 }).catch(() => void 0);
  }
}

// src/server/supabase.ts
import { createClient } from "@supabase/supabase-js";
var cachedAdminClient = null;
function getSupabaseCredentials() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase backend configuration missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    );
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Invalid SUPABASE_URL protocol.");
    }
  } catch {
    throw new Error("Supabase backend configuration invalid: SUPABASE_URL must be a valid URL.");
  }
  return { url, serviceRoleKey };
}
function isSupabaseConfigured() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
function getSupabaseAdmin() {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }
  const { url, serviceRoleKey } = getSupabaseCredentials();
  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
  return cachedAdminClient;
}
function createEphemeralAuthClient() {
  const { url, serviceRoleKey } = getSupabaseCredentials();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}
function isTransientSupabaseError(err) {
  if (!err || typeof err !== "object") return false;
  const candidate = err;
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const status = typeof candidate.status === "number" ? candidate.status : void 0;
  const msg = typeof candidate.message === "string" ? candidate.message : "";
  const code = typeof candidate.code === "string" ? candidate.code : "";
  if (name === "AuthRetryableFetchError") return true;
  if (status === 0 || status !== void 0 && status >= 500) return true;
  return /ENETUNREACH|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|network/i.test(
    `${code} ${msg}`
  );
}
function isSupabaseConfigError(err) {
  return err instanceof Error && /Supabase backend configuration (missing|invalid)/i.test(err.message);
}
async function verifySupabaseJwt(accessToken) {
  if (!accessToken || !isSupabaseConfigured()) {
    return null;
  }
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(accessToken);
    if (error) {
      if (isTransientSupabaseError(error)) {
        console.warn("[Supabase Auth] Transient error during JWT verification.");
      }
      return null;
    }
    if (!data?.user) {
      return null;
    }
    return data.user;
  } catch (err) {
    if (isTransientSupabaseError(err)) {
      console.warn("[Supabase Auth] Network error during JWT verification.");
    }
    return null;
  }
}
async function signInSupabasePassword(email, password) {
  try {
    const authClient = createEphemeralAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      if (isTransientSupabaseError(error)) {
        console.warn("[Supabase Auth] Authentication service unreachable during password sign-in.");
        return {
          error: "Authentication service is temporarily unreachable. Please try again shortly.",
          unavailable: true
        };
      }
      return { error: error.message || "Invalid login credentials." };
    }
    if (!data.session?.access_token || !data.user) {
      return { error: "Invalid login credentials." };
    }
    return {
      accessToken: data.session.access_token,
      user: data.user
    };
  } catch (err) {
    if (isSupabaseConfigError(err)) {
      console.error("[Supabase Auth] Backend environment configuration missing or invalid.");
      return {
        error: "Authentication service is not configured on the backend server. Please verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
        unavailable: true
      };
    }
    if (isTransientSupabaseError(err)) {
      console.warn("[Supabase Auth] Network exception during password sign-in.");
      return {
        error: "Authentication service is temporarily unreachable. Please try again shortly.",
        unavailable: true
      };
    }
    return {
      error: "Authentication service failed while verifying credentials.",
      unavailable: true
    };
  }
}
async function createSupabaseAuthUser(params) {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
      app_metadata: {
        role: params.role
      },
      user_metadata: {
        name: params.name,
        memberId: params.memberId
      }
    });
    if (error || !data?.user) {
      if (error && isTransientSupabaseError(error)) {
        console.warn("[Supabase Auth] Transient failure while creating user account.");
        return {
          error: "Authentication service is temporarily unreachable. Please try again shortly.",
          status: 503
        };
      }
      const msg = error?.message || "Unable to create authentication account.";
      const status = /already|exists|registered/i.test(msg) ? 409 : 400;
      return { error: msg, status };
    }
    return { user: data.user };
  } catch (err) {
    console.warn("[Supabase Auth] Failed to create user account.");
    return {
      error: isTransientSupabaseError(err) ? "Authentication service is temporarily unreachable. Please try again shortly." : err instanceof Error ? err.message : "Unable to create authentication account.",
      status: 503
    };
  }
}
async function updateSupabaseAuthUser(userId, updates) {
  try {
    const admin = getSupabaseAdmin();
    const payload = {};
    if (updates.email !== void 0) {
      payload.email = updates.email;
      payload.email_confirm = true;
    }
    if (updates.password !== void 0) {
      payload.password = updates.password;
    }
    if (updates.role !== void 0) {
      payload.app_metadata = { role: updates.role };
    }
    if (updates.name !== void 0 || updates.memberId !== void 0) {
      payload.user_metadata = {
        ...updates.name !== void 0 ? { name: updates.name } : {},
        ...updates.memberId !== void 0 ? { memberId: updates.memberId } : {}
      };
    }
    if (updates.banned !== void 0) {
      payload.ban_duration = updates.banned ? "876000h" : "none";
    }
    const { error } = await admin.auth.admin.updateUserById(userId, payload);
    if (error) {
      if (isTransientSupabaseError(error)) {
        return {
          error: "Authentication service is temporarily unreachable. Please try again shortly."
        };
      }
      return { error: error.message };
    }
    return {};
  } catch (err) {
    return {
      error: isTransientSupabaseError(err) ? "Authentication service is temporarily unreachable. Please try again shortly." : err instanceof Error ? err.message : "Failed to update authentication account."
    };
  }
}
async function deleteSupabaseAuthUser(userId) {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      const status = error.status;
      const isNotFound = status === 404 || /user not found/i.test(error.message);
      return {
        error: error.message || "Failed to delete Supabase Auth user.",
        notFound: isNotFound
      };
    }
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete Supabase Auth user."
    };
  }
}
async function signOutSupabaseJwt(accessToken) {
  if (!accessToken || !isSupabaseConfigured()) return;
  try {
    const admin = getSupabaseAdmin();
    await admin.auth.admin.signOut(accessToken, "global");
  } catch {
  }
}

// src/server/codingStats.ts
var PLATFORM_META = {
  leetcode: {
    label: "LeetCode",
    hosts: ["leetcode.com", "www.leetcode.com"],
    example: "https://leetcode.com/u/username",
    reservedSegments: /* @__PURE__ */ new Set([
      "u",
      "profile",
      "problems",
      "problemset",
      "explore",
      "discuss",
      "contest",
      "submissions",
      "login",
      "accounts",
      "graphql"
    ])
  },
  hackerrank: {
    label: "HackerRank",
    hosts: ["hackerrank.com", "www.hackerrank.com"],
    example: "https://www.hackerrank.com/profile/username",
    reservedSegments: /* @__PURE__ */ new Set([
      "profile",
      "domains",
      "challenges",
      "contests",
      "leaderboard",
      "jobs",
      "dashboard",
      "auth",
      "login",
      "rest"
    ])
  },
  github: {
    label: "GitHub",
    hosts: ["github.com", "www.github.com"],
    example: "https://github.com/username",
    reservedSegments: /* @__PURE__ */ new Set([
      "settings",
      "features",
      "marketplace",
      "explore",
      "topics",
      "orgs",
      "login",
      "signup",
      "apps",
      "sponsors",
      "notifications",
      "pulls",
      "issues"
    ])
  }
};
function isValidUsernameFormat(username, platform) {
  if (!username) return false;
  if (platform === "github") {
    return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username);
  }
  if (platform === "leetcode") {
    return /^[a-zA-Z0-9_-]{1,64}$/.test(username);
  }
  return username !== "." && !username.includes("..") && /^[a-zA-Z0-9_.-]{1,64}$/.test(username);
}
function parseCodingPlatformInput(input, platform) {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return { ok: true, username: "" };
  }
  const meta = PLATFORM_META[platform];
  const looksLikeUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) || trimmed.includes("/") || /\.(com|org|net|io|dev|in)(?:$|[/?#])/i.test(trimmed);
  if (!looksLikeUrl) {
    const candidate = trimmed.replace(/^@/, "");
    if (!isValidUsernameFormat(candidate, platform)) {
      return {
        ok: false,
        error: `Please enter a valid ${meta.label} username or profile URL (e.g. ${meta.example}).`
      };
    }
    return { ok: true, username: candidate };
  }
  let parsed;
  try {
    const withProto = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsed = new URL(withProto);
  } catch {
    return {
      ok: false,
      error: `Please enter a valid ${meta.label} profile URL (e.g. ${meta.example}).`
    };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      error: `${meta.label} URL must use http:// or https://.`
    };
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!meta.hosts.includes(hostname)) {
    return {
      ok: false,
      error: `Invalid ${meta.label} URL host "${hostname}". Expected ${meta.hosts[0]}.`
    };
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return {
      ok: false,
      error: `Please include your ${meta.label} username in the URL (e.g. ${meta.example}).`
    };
  }
  let username = "";
  if (platform === "leetcode") {
    if ((segments[0] === "u" || segments[0] === "profile") && segments.length === 2) {
      username = segments[1];
    } else if (segments.length === 1 && !meta.reservedSegments.has(segments[0].toLowerCase())) {
      username = segments[0];
    }
  } else if (platform === "hackerrank") {
    if (segments[0] === "profile" && segments.length === 2) {
      username = segments[1];
    } else if (segments.length === 1 && !meta.reservedSegments.has(segments[0].toLowerCase())) {
      username = segments[0];
    }
  } else if (segments.length === 1 && !meta.reservedSegments.has(segments[0].toLowerCase())) {
    username = segments[0];
  }
  username = username.replace(/^@/, "");
  if (!isValidUsernameFormat(username, platform)) {
    return {
      ok: false,
      error: `Could not extract a valid ${meta.label} username from URL (expected e.g. ${meta.example}).`
    };
  }
  return { ok: true, username };
}
var CODING_STATS_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1e3;
var CODING_STATS_CACHE_TTL_MS = 60 * 1e3;
var CODING_SYNC_COOLDOWN_MS = 15 * 1e3;
var MAX_CACHE_ENTRIES = 500;
var leetcodeOkCache = /* @__PURE__ */ new Map();
var scalarOkCache = /* @__PURE__ */ new Map();
function getCachedValue(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return { ...entry.value };
}
function setCachedOkValue(cache, key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== void 0) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, {
    expiresAt: Date.now() + CODING_STATS_CACHE_TTL_MS,
    value: { ...value }
  });
}
function isWithinVerificationTtl(verifiedAt, nowMs = Date.now()) {
  if (!verifiedAt) return false;
  const verifiedMs = verifiedAt.getTime();
  return Number.isFinite(verifiedMs) && nowMs - verifiedMs >= 0 && nowMs - verifiedMs <= CODING_STATS_VERIFICATION_TTL_MS;
}
function buildGithubApiHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "CSE-Department-Portal"
  };
  const githubToken = (process.env.GITHUB_TOKEN || "").trim();
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }
  return headers;
}
var RETRYABLE_NETWORK_CODES = /* @__PURE__ */ new Set([
  "ENETUNREACH",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "TimeoutError",
  "AbortError"
]);
function extractNetworkErrorCode(err, depth = 0) {
  if (depth > 4 || !err || typeof err !== "object") {
    return "NETWORK_ERROR";
  }
  const candidate = err;
  if (typeof candidate.code === "string" && candidate.code.trim()) {
    return candidate.code.trim();
  }
  if (Array.isArray(candidate.errors)) {
    for (const inner of candidate.errors) {
      const innerCode = extractNetworkErrorCode(inner, depth + 1);
      if (innerCode !== "NETWORK_ERROR") return innerCode;
    }
  }
  if (candidate.cause) {
    const causeCode = extractNetworkErrorCode(candidate.cause, depth + 1);
    if (causeCode !== "NETWORK_ERROR") return causeCode;
  }
  if (typeof candidate.name === "string" && candidate.name.trim()) {
    return candidate.name.trim();
  }
  return "NETWORK_ERROR";
}
async function fetchWithRetry(url, init, timeoutMs, label) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (attempt === 0 && (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504)) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      if (!res.ok && res.status !== 404) {
        console.warn(`[CodingStats:${label}] Upstream HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      lastError = err;
      const code = extractNetworkErrorCode(err);
      if (attempt === 0 && (RETRYABLE_NETWORK_CODES.has(code) || err instanceof TypeError)) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      console.warn(`[CodingStats:${label}] Network request failed (${code})`);
      throw err;
    }
  }
  console.warn(`[CodingStats:${label}] Network request failed (${extractNetworkErrorCode(lastError)})`);
  throw lastError;
}
async function fetchGithubRepoCount(username) {
  if (!username) {
    return { status: "empty", count: 0 };
  }
  const cacheKey = `github:${username.toLowerCase()}`;
  const cached = getCachedValue(scalarOkCache, cacheKey);
  if (cached) return cached;
  try {
    const res = await fetchWithRetry(
      `https://api.github.com/users/${encodeURIComponent(username)}`,
      {
        headers: buildGithubApiHeaders()
      },
      4500,
      "github_stats"
    );
    if (res.status === 404) {
      return { status: "not_found", count: 0 };
    }
    if (!res.ok) {
      return { status: "unavailable", count: 0 };
    }
    const data = await res.json();
    if (typeof data.public_repos === "number" && Number.isFinite(data.public_repos)) {
      const result = {
        status: "ok",
        count: Math.max(0, Math.trunc(data.public_repos))
      };
      setCachedOkValue(scalarOkCache, cacheKey, result);
      return result;
    }
    return { status: "unavailable", count: 0 };
  } catch {
    return { status: "unavailable", count: 0 };
  }
}
async function fetchLeetcodeCounts(username) {
  if (!username) {
    return { status: "empty", total: 0, easy: 0, medium: 0, hard: 0 };
  }
  const cacheKey = `leetcode:${username.toLowerCase()}`;
  const cached = getCachedValue(leetcodeOkCache, cacheKey);
  if (cached) return cached;
  try {
    const query = `
      query userProblemsSolved($username: String!) {
        matchedUser(username: $username) {
          submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }
    `;
    const res = await fetchWithRetry(
      "https://leetcode.com/graphql",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: "https://leetcode.com",
          "User-Agent": "CSE-Department-Portal"
        },
        body: JSON.stringify({ query, variables: { username } })
      },
      4500,
      "leetcode_stats"
    );
    if (res.status === 404) {
      return { status: "not_found", total: 0, easy: 0, medium: 0, hard: 0 };
    }
    if (!res.ok) {
      return { status: "unavailable", total: 0, easy: 0, medium: 0, hard: 0 };
    }
    const payload = await res.json();
    if (payload?.data && payload.data.matchedUser === null) {
      return { status: "not_found", total: 0, easy: 0, medium: 0, hard: 0 };
    }
    const arr = payload?.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum;
    if (!Array.isArray(arr)) {
      return { status: "unavailable", total: 0, easy: 0, medium: 0, hard: 0 };
    }
    const findDiff = (d) => Math.max(0, Math.trunc(Number(arr.find((x) => x.difficulty === d)?.count ?? 0) || 0));
    const result = {
      status: "ok",
      total: findDiff("All"),
      easy: findDiff("Easy"),
      medium: findDiff("Medium"),
      hard: findDiff("Hard")
    };
    setCachedOkValue(leetcodeOkCache, cacheKey, result);
    return result;
  } catch {
    return { status: "unavailable", total: 0, easy: 0, medium: 0, hard: 0 };
  }
}
async function fetchHackerrankFiveStars(username) {
  if (!username) {
    return { status: "empty", count: 0 };
  }
  const cacheKey = `hackerrank:${username.toLowerCase()}`;
  const cached = getCachedValue(scalarOkCache, cacheKey);
  if (cached) return cached;
  try {
    const res = await fetchWithRetry(
      `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/badges`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "CSE-Department-Portal"
        }
      },
      4500,
      "hackerrank_stats"
    );
    if (res.status === 404) {
      return { status: "not_found", count: 0 };
    }
    if (!res.ok) {
      return { status: "unavailable", count: 0 };
    }
    const data = await res.json();
    if (!Array.isArray(data.models)) {
      return { status: "unavailable", count: 0 };
    }
    const result = {
      status: "ok",
      count: data.models.filter((b) => (b.stars ?? 0) >= 5).length
    };
    setCachedOkValue(scalarOkCache, cacheKey, result);
    return result;
  } catch {
    return { status: "unavailable", count: 0 };
  }
}
async function fetchCodingProfileBio(platform, username) {
  if (!username) {
    return { status: "empty", bioText: "" };
  }
  try {
    if (platform === "github") {
      const res2 = await fetchWithRetry(
        `https://api.github.com/users/${encodeURIComponent(username)}`,
        {
          headers: buildGithubApiHeaders()
        },
        4500,
        "github_bio"
      );
      if (res2.status === 404) {
        return { status: "not_found", bioText: "" };
      }
      if (!res2.ok) {
        return { status: "unavailable", bioText: "" };
      }
      const data = await res2.json();
      const combined2 = [
        typeof data.bio === "string" ? data.bio : "",
        typeof data.blog === "string" ? data.blog : ""
      ].filter(Boolean).join("\n");
      return { status: "ok", bioText: combined2 };
    }
    if (platform === "leetcode") {
      const query = `
        query userPublicBio($username: String!) {
          matchedUser(username: $username) {
            username
            profile {
              aboutMe
              websites
            }
          }
        }
      `;
      const res2 = await fetchWithRetry(
        "https://leetcode.com/graphql",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Referer: "https://leetcode.com",
            "User-Agent": "CSE-Department-Portal"
          },
          body: JSON.stringify({ query, variables: { username } })
        },
        4500,
        "leetcode_bio"
      );
      if (res2.status === 404) {
        return { status: "not_found", bioText: "" };
      }
      if (!res2.ok) {
        return { status: "unavailable", bioText: "" };
      }
      const payload2 = await res2.json();
      if (payload2?.data && payload2.data.matchedUser === null) {
        return { status: "not_found", bioText: "" };
      }
      const matched = payload2?.data?.matchedUser;
      if (!matched) {
        return { status: "unavailable", bioText: "" };
      }
      const combined2 = [
        typeof matched.profile?.aboutMe === "string" ? matched.profile.aboutMe : "",
        ...Array.isArray(matched.profile?.websites) ? matched.profile.websites.filter((w) => typeof w === "string") : []
      ].filter(Boolean).join("\n");
      return { status: "ok", bioText: combined2 };
    }
    const res = await fetchWithRetry(
      `https://www.hackerrank.com/rest/contests/master/hackers/${encodeURIComponent(username)}/profile`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "CSE-Department-Portal"
        }
      },
      4500,
      "hackerrank_bio"
    );
    if (res.status === 404) {
      return { status: "not_found", bioText: "" };
    }
    if (!res.ok) {
      return { status: "unavailable", bioText: "" };
    }
    const payload = await res.json();
    if (!payload?.model) {
      return { status: "unavailable", bioText: "" };
    }
    const combined = [
      typeof payload.model.short_bio === "string" ? payload.model.short_bio : "",
      typeof payload.model.jobs_headline === "string" ? payload.model.jobs_headline : "",
      typeof payload.model.website === "string" ? payload.model.website : ""
    ].filter(Boolean).join("\n");
    return { status: "ok", bioText: combined };
  } catch {
    return { status: "unavailable", bioText: "" };
  }
}

// src/server/portalQueries.ts
import { and, count, desc, eq, ilike, inArray, isNull, or, sql as sql2, asc } from "drizzle-orm";
function createDefaultCodingStats() {
  return {
    leetcodeUrl: "",
    leetcodeUsername: "",
    leetcodeSolved: 0,
    leetcodeEasy: 0,
    leetcodeMedium: 0,
    leetcodeHard: 0,
    leetcodeVerified: false,
    leetcodeVerifiedAt: null,
    leetcodeOwnerVerified: false,
    hackerrankUrl: "",
    hackerrankUsername: "",
    hackerrankFiveStars: 0,
    hackerrankVerified: false,
    hackerrankVerifiedAt: null,
    hackerrankOwnerVerified: false,
    githubUrl: "",
    githubUsername: "",
    githubProjects: 0,
    githubVerified: false,
    githubVerifiedAt: null,
    githubOwnerVerified: false
  };
}
function toPublicProfile(record, options = {}) {
  const { user, studentProfile, facultyProfile, adminProfile } = record;
  const sp = studentProfile;
  const fp = facultyProfile;
  const ap = adminProfile;
  const resolvedPhone = user.phone || fp?.phoneOrCabin || "";
  const nowMs = Date.now();
  return {
    id: user.id,
    memberId: user.memberId,
    name: user.name,
    email: user.email,
    role: user.role,
    batchOrDesignation: user.batchOrDesignation,
    department: user.department,
    ...fp ? {
      designation: fp.designation,
      specialization: fp.specialization,
      qualification: fp.qualification,
      experienceYears: fp.experienceYears
    } : ap ? {
      designation: ap.title
    } : {},
    ...sp ? { year: sp.year, section: sp.section } : {},
    ...options.includePhone ? { phone: resolvedPhone } : {},
    isActive: user.isActive,
    cgpa: sp ? Number(sp.cgpa) : 0,
    bio: user.bio,
    skills: user.skills,
    canManageSpotlights: user.canManageSpotlights,
    codingStats: sp ? {
      leetcodeUrl: sp.leetcodeUrl,
      leetcodeUsername: sp.leetcodeUsername,
      leetcodeSolved: sp.leetcodeSolved,
      leetcodeEasy: sp.leetcodeEasy,
      leetcodeMedium: sp.leetcodeMedium,
      leetcodeHard: sp.leetcodeHard,
      leetcodeVerified: isWithinVerificationTtl(sp.leetcodeVerifiedAt, nowMs),
      leetcodeVerifiedAt: sp.leetcodeVerifiedAt ? sp.leetcodeVerifiedAt.toISOString() : null,
      leetcodeOwnerVerified: Boolean(sp.leetcodeOwnerVerifiedAt),
      hackerrankUrl: sp.hackerrankUrl,
      hackerrankUsername: sp.hackerrankUsername,
      hackerrankFiveStars: sp.hackerrankFiveStars,
      hackerrankVerified: isWithinVerificationTtl(sp.hackerrankVerifiedAt, nowMs),
      hackerrankVerifiedAt: sp.hackerrankVerifiedAt ? sp.hackerrankVerifiedAt.toISOString() : null,
      hackerrankOwnerVerified: Boolean(sp.hackerrankOwnerVerifiedAt),
      githubUrl: sp.githubUrl,
      githubUsername: sp.githubUsername,
      githubProjects: sp.githubProjects,
      githubVerified: isWithinVerificationTtl(sp.githubVerifiedAt, nowMs),
      githubVerifiedAt: sp.githubVerifiedAt ? sp.githubVerifiedAt.toISOString() : null,
      githubOwnerVerified: Boolean(sp.githubOwnerVerifiedAt),
      lastSyncedAt: sp.lastSyncedAt ? sp.lastSyncedAt.toISOString() : void 0
    } : createDefaultCodingStats(),
    createdAt: user.createdAt.toISOString()
  };
}
async function getUserWithProfilesById(db, userId) {
  const [userRow] = await db.select().from(schema_exports.users).where(eq(schema_exports.users.id, userId)).limit(1);
  if (!userRow) return null;
  const [studentProfile] = userRow.role === "student" ? await db.select().from(schema_exports.studentProfiles).where(eq(schema_exports.studentProfiles.userId, userId)).limit(1) : [void 0];
  const [facultyProfile] = userRow.role === "faculty" ? await db.select().from(schema_exports.facultyProfiles).where(eq(schema_exports.facultyProfiles.userId, userId)).limit(1) : [void 0];
  const [adminProfile] = userRow.role === "admin" ? await db.select().from(schema_exports.adminProfiles).where(eq(schema_exports.adminProfiles.userId, userId)).limit(1) : [void 0];
  return {
    user: userRow,
    studentProfile: studentProfile ?? null,
    facultyProfile: facultyProfile ?? null,
    adminProfile: adminProfile ?? null
  };
}
async function findUserByIdentifierAndRole(db, identifier, role) {
  const clean = identifier.trim();
  if (!clean) return null;
  const [row] = await db.select().from(schema_exports.users).where(
    and(
      eq(schema_exports.users.role, role),
      or(
        sql2`lower(${schema_exports.users.email}) = lower(${clean})`,
        sql2`upper(${schema_exports.users.memberId}) = upper(${clean})`
      )
    )
  ).limit(1);
  return row ?? null;
}
async function computeUserProgress(db, userId) {
  const [
    [appsRow],
    [projRow],
    [hackRow],
    [intRow],
    [probPostedRow],
    [probSolvedRow],
    [placeRow],
    [courseRow]
  ] = await Promise.all([
    db.select({ value: count() }).from(schema_exports.appTechnologies).where(eq(schema_exports.appTechnologies.authorId, userId)),
    db.select({ value: count() }).from(schema_exports.projects).where(eq(schema_exports.projects.authorId, userId)),
    db.select({ value: count() }).from(schema_exports.hackathons).where(eq(schema_exports.hackathons.authorId, userId)),
    db.select({ value: count() }).from(schema_exports.interviews).where(eq(schema_exports.interviews.authorId, userId)),
    db.select({ value: count() }).from(schema_exports.problems).where(eq(schema_exports.problems.authorId, userId)),
    db.select({ value: count() }).from(schema_exports.problemSolvers).where(eq(schema_exports.problemSolvers.userId, userId)),
    db.select({ value: count() }).from(schema_exports.placementApplications).where(eq(schema_exports.placementApplications.studentId, userId)),
    db.select({ value: count() }).from(schema_exports.courseEnrollments).where(eq(schema_exports.courseEnrollments.studentId, userId))
  ]);
  return {
    appsUploaded: Number(appsRow?.value ?? 0),
    projectsPublished: Number(projRow?.value ?? 0),
    hackathonsShared: Number(hackRow?.value ?? 0),
    interviewsShared: Number(intRow?.value ?? 0),
    problemsPosted: Number(probPostedRow?.value ?? 0),
    problemsSolved: Number(probSolvedRow?.value ?? 0),
    placementsApplied: Number(placeRow?.value ?? 0),
    coursesEnrolled: Number(courseRow?.value ?? 0)
  };
}
function mapSpotlightRow(row, authorName) {
  return {
    id: row.id,
    category: row.category,
    headlineValue: row.headlineValue,
    title: row.title,
    recipients: row.recipients,
    description: row.description,
    authorId: row.authorId ?? "",
    authorName: authorName || row.authorNameSnapshot || "Department Administration",
    createdAt: row.createdAt.toISOString()
  };
}
async function getSpotlightsList(db) {
  const rows = await db.select({
    spotlight: schema_exports.spotlights,
    authorName: schema_exports.users.name
  }).from(schema_exports.spotlights).leftJoin(schema_exports.users, eq(schema_exports.spotlights.authorId, schema_exports.users.id)).orderBy(desc(schema_exports.spotlights.createdAt));
  return rows.map((r) => mapSpotlightRow(r.spotlight, r.authorName));
}
async function getSpotlightById(db, id) {
  const [row] = await db.select({
    spotlight: schema_exports.spotlights,
    authorName: schema_exports.users.name
  }).from(schema_exports.spotlights).leftJoin(schema_exports.users, eq(schema_exports.spotlights.authorId, schema_exports.users.id)).where(eq(schema_exports.spotlights.id, id)).limit(1);
  return row ? mapSpotlightRow(row.spotlight, row.authorName) : null;
}
async function getHackathonsList(db, authorFilterId) {
  const query = db.select({
    hack: schema_exports.hackathons,
    author: schema_exports.users
  }).from(schema_exports.hackathons).innerJoin(schema_exports.users, eq(schema_exports.hackathons.authorId, schema_exports.users.id));
  const rows = authorFilterId ? await query.where(eq(schema_exports.hackathons.authorId, authorFilterId)).orderBy(desc(schema_exports.hackathons.createdAt)) : await query.orderBy(desc(schema_exports.hackathons.createdAt));
  return rows.map((r) => ({
    id: r.hack.id,
    hackathonName: r.hack.hackathonName,
    organizer: r.hack.organizer,
    eventDate: r.hack.eventDate,
    teamAndRole: r.hack.teamAndRole,
    outcome: r.hack.outcome,
    technologies: r.hack.technologies,
    overallExperience: r.hack.overallExperience,
    authorId: r.hack.authorId,
    authorName: r.author.name,
    authorMemberId: r.author.memberId,
    authorEmail: r.author.email,
    authorBatch: r.author.batchOrDesignation,
    authorRole: r.author.role,
    createdAt: r.hack.createdAt.toISOString()
  }));
}
async function getHackathonById(db, id) {
  const [r] = await db.select({
    hack: schema_exports.hackathons,
    author: schema_exports.users
  }).from(schema_exports.hackathons).innerJoin(schema_exports.users, eq(schema_exports.hackathons.authorId, schema_exports.users.id)).where(eq(schema_exports.hackathons.id, id)).limit(1);
  if (!r) return null;
  return {
    id: r.hack.id,
    hackathonName: r.hack.hackathonName,
    organizer: r.hack.organizer,
    eventDate: r.hack.eventDate,
    teamAndRole: r.hack.teamAndRole,
    outcome: r.hack.outcome,
    technologies: r.hack.technologies,
    overallExperience: r.hack.overallExperience,
    authorId: r.hack.authorId,
    authorName: r.author.name,
    authorMemberId: r.author.memberId,
    authorEmail: r.author.email,
    authorBatch: r.author.batchOrDesignation,
    authorRole: r.author.role,
    createdAt: r.hack.createdAt.toISOString()
  };
}
async function getInterviewsList(db, authorFilterId) {
  const baseQuery = db.select({
    interview: schema_exports.interviews,
    author: schema_exports.users
  }).from(schema_exports.interviews).innerJoin(schema_exports.users, eq(schema_exports.interviews.authorId, schema_exports.users.id));
  const interviewRows = authorFilterId ? await baseQuery.where(eq(schema_exports.interviews.authorId, authorFilterId)).orderBy(desc(schema_exports.interviews.createdAt)) : await baseQuery.orderBy(desc(schema_exports.interviews.createdAt));
  if (interviewRows.length === 0) return [];
  const ids = interviewRows.map((r) => r.interview.id);
  const roundRows = await db.select().from(schema_exports.interviewRounds).where(inArray(schema_exports.interviewRounds.interviewId, ids)).orderBy(asc(schema_exports.interviewRounds.roundNumber));
  const roundsByInterview = /* @__PURE__ */ new Map();
  for (const round of roundRows) {
    const arr = roundsByInterview.get(round.interviewId) ?? [];
    arr.push({
      roundNumber: round.roundNumber,
      roundTitle: round.roundTitle,
      topicsCovered: round.topicsCovered,
      questionsAsked: round.questionsAsked,
      difficulty: round.difficulty
    });
    roundsByInterview.set(round.interviewId, arr);
  }
  return interviewRows.map((r) => ({
    id: r.interview.id,
    companyName: r.interview.companyName,
    roleTitle: r.interview.roleTitle,
    companyDomain: r.interview.companyDomain,
    skillsNeeded: r.interview.skillsNeeded,
    hiringType: r.interview.hiringType,
    packageOrStipend: r.interview.packageOrStipend,
    interviewDate: r.interview.interviewDate,
    resultStatus: r.interview.resultStatus,
    overallDifficulty: r.interview.overallDifficulty,
    overallExperience: r.interview.overallExperience,
    rounds: roundsByInterview.get(r.interview.id) ?? [],
    keyPreparationTips: r.interview.keyPreparationTips,
    resourcesUsed: r.interview.resourcesUsed,
    authorId: r.interview.authorId,
    authorName: r.author.name,
    authorMemberId: r.author.memberId,
    authorEmail: r.author.email,
    authorBatch: r.author.batchOrDesignation,
    authorRole: r.author.role,
    createdAt: r.interview.createdAt.toISOString()
  }));
}
async function getInterviewById(db, id) {
  const [r] = await db.select({
    interview: schema_exports.interviews,
    author: schema_exports.users
  }).from(schema_exports.interviews).innerJoin(schema_exports.users, eq(schema_exports.interviews.authorId, schema_exports.users.id)).where(eq(schema_exports.interviews.id, id)).limit(1);
  if (!r) return null;
  const roundRows = await db.select().from(schema_exports.interviewRounds).where(eq(schema_exports.interviewRounds.interviewId, id)).orderBy(asc(schema_exports.interviewRounds.roundNumber));
  return {
    id: r.interview.id,
    companyName: r.interview.companyName,
    roleTitle: r.interview.roleTitle,
    companyDomain: r.interview.companyDomain,
    skillsNeeded: r.interview.skillsNeeded,
    hiringType: r.interview.hiringType,
    packageOrStipend: r.interview.packageOrStipend,
    interviewDate: r.interview.interviewDate,
    resultStatus: r.interview.resultStatus,
    overallDifficulty: r.interview.overallDifficulty,
    overallExperience: r.interview.overallExperience,
    rounds: roundRows.map((round) => ({
      roundNumber: round.roundNumber,
      roundTitle: round.roundTitle,
      topicsCovered: round.topicsCovered,
      questionsAsked: round.questionsAsked,
      difficulty: round.difficulty
    })),
    keyPreparationTips: r.interview.keyPreparationTips,
    resourcesUsed: r.interview.resourcesUsed,
    authorId: r.interview.authorId,
    authorName: r.author.name,
    authorMemberId: r.author.memberId,
    authorEmail: r.author.email,
    authorBatch: r.author.batchOrDesignation,
    authorRole: r.author.role,
    createdAt: r.interview.createdAt.toISOString()
  };
}
async function getProjectsList(db, authorFilterId) {
  const baseQuery = db.select({
    project: schema_exports.projects,
    author: schema_exports.users
  }).from(schema_exports.projects).innerJoin(schema_exports.users, eq(schema_exports.projects.authorId, schema_exports.users.id));
  const rows = authorFilterId ? await baseQuery.where(eq(schema_exports.projects.authorId, authorFilterId)).orderBy(desc(schema_exports.projects.createdAt)) : await baseQuery.orderBy(desc(schema_exports.projects.createdAt));
  return rows.map((r) => ({
    id: r.project.id,
    projectName: r.project.projectName,
    websiteType: r.project.websiteType,
    projectLink: r.project.projectLink,
    technologies: r.project.technologies,
    description: r.project.description,
    authorId: r.project.authorId,
    authorName: r.author.name,
    authorMemberId: r.author.memberId,
    authorEmail: r.author.email,
    authorBatch: r.author.batchOrDesignation,
    authorRole: r.author.role,
    createdAt: r.project.createdAt.toISOString()
  }));
}
async function getProjectById(db, id) {
  const [r] = await db.select({
    project: schema_exports.projects,
    author: schema_exports.users
  }).from(schema_exports.projects).innerJoin(schema_exports.users, eq(schema_exports.projects.authorId, schema_exports.users.id)).where(eq(schema_exports.projects.id, id)).limit(1);
  if (!r) return null;
  return {
    id: r.project.id,
    projectName: r.project.projectName,
    websiteType: r.project.websiteType,
    projectLink: r.project.projectLink,
    technologies: r.project.technologies,
    description: r.project.description,
    authorId: r.project.authorId,
    authorName: r.author.name,
    authorMemberId: r.author.memberId,
    authorEmail: r.author.email,
    authorBatch: r.author.batchOrDesignation,
    authorRole: r.author.role,
    createdAt: r.project.createdAt.toISOString()
  };
}
async function getAppsList(db, authorFilterId) {
  const baseQuery = db.select({
    app: schema_exports.appTechnologies,
    author: schema_exports.users
  }).from(schema_exports.appTechnologies).innerJoin(schema_exports.users, eq(schema_exports.appTechnologies.authorId, schema_exports.users.id));
  const rows = authorFilterId ? await baseQuery.where(eq(schema_exports.appTechnologies.authorId, authorFilterId)).orderBy(desc(schema_exports.appTechnologies.createdAt)) : await baseQuery.orderBy(desc(schema_exports.appTechnologies.createdAt));
  return rows.map((r) => ({
    id: r.app.id,
    appName: r.app.appName,
    usedTechnologies: r.app.usedTechnologies,
    description: r.app.description,
    appType: r.app.appType,
    appLink: r.app.appLink,
    authorId: r.app.authorId,
    authorName: r.author.name,
    authorMemberId: r.author.memberId,
    authorEmail: r.author.email,
    authorBatch: r.author.batchOrDesignation,
    authorRole: r.author.role,
    createdAt: r.app.createdAt.toISOString()
  }));
}
async function getAppById(db, id) {
  const [r] = await db.select({
    app: schema_exports.appTechnologies,
    author: schema_exports.users
  }).from(schema_exports.appTechnologies).innerJoin(schema_exports.users, eq(schema_exports.appTechnologies.authorId, schema_exports.users.id)).where(eq(schema_exports.appTechnologies.id, id)).limit(1);
  if (!r) return null;
  return {
    id: r.app.id,
    appName: r.app.appName,
    usedTechnologies: r.app.usedTechnologies,
    description: r.app.description,
    appType: r.app.appType,
    appLink: r.app.appLink,
    authorId: r.app.authorId,
    authorName: r.author.name,
    authorMemberId: r.author.memberId,
    authorEmail: r.author.email,
    authorBatch: r.author.batchOrDesignation,
    authorRole: r.author.role,
    createdAt: r.app.createdAt.toISOString()
  };
}
async function getProblemsList(db) {
  const problemRows = await db.select({
    problem: schema_exports.problems,
    author: schema_exports.users
  }).from(schema_exports.problems).innerJoin(schema_exports.users, eq(schema_exports.problems.authorId, schema_exports.users.id)).orderBy(desc(schema_exports.problems.createdAt));
  if (problemRows.length === 0) return [];
  const ids = problemRows.map((r) => r.problem.id);
  const [responseRows, solverRows] = await Promise.all([
    db.select({
      response: schema_exports.problemResponses,
      sender: schema_exports.users
    }).from(schema_exports.problemResponses).innerJoin(schema_exports.users, eq(schema_exports.problemResponses.senderId, schema_exports.users.id)).where(inArray(schema_exports.problemResponses.problemId, ids)).orderBy(asc(schema_exports.problemResponses.createdAt)),
    db.select().from(schema_exports.problemSolvers).where(inArray(schema_exports.problemSolvers.problemId, ids))
  ]);
  const responsesByProblem = /* @__PURE__ */ new Map();
  for (const row of responseRows) {
    const arr = responsesByProblem.get(row.response.problemId) ?? [];
    arr.push({
      id: row.response.id,
      senderId: row.response.senderId,
      senderName: row.sender.name,
      senderMemberId: row.sender.memberId,
      senderEmail: row.sender.email,
      senderRole: row.sender.role,
      message: row.response.message,
      solutionLink: row.response.solutionLink,
      marksSolved: row.response.marksSolved,
      createdAt: row.response.createdAt.toISOString()
    });
    responsesByProblem.set(row.response.problemId, arr);
  }
  const solversByProblem = /* @__PURE__ */ new Map();
  for (const solver of solverRows) {
    const arr = solversByProblem.get(solver.problemId) ?? [];
    arr.push(solver.userId);
    solversByProblem.set(solver.problemId, arr);
  }
  return problemRows.map((r) => ({
    id: r.problem.id,
    title: r.problem.title,
    applicationName: r.problem.applicationName,
    category: r.problem.category,
    description: r.problem.description,
    contactInfo: r.problem.contactInfo,
    contactEmail: r.problem.contactEmail,
    status: r.problem.status,
    authorId: r.problem.authorId,
    authorName: r.author.name,
    authorMemberId: r.author.memberId,
    authorBatch: r.author.batchOrDesignation,
    authorRole: r.author.role,
    solvedByIds: solversByProblem.get(r.problem.id) ?? [],
    responses: responsesByProblem.get(r.problem.id) ?? [],
    createdAt: r.problem.createdAt.toISOString()
  }));
}
async function getProblemById(db, id) {
  const [r] = await db.select({
    problem: schema_exports.problems,
    author: schema_exports.users
  }).from(schema_exports.problems).innerJoin(schema_exports.users, eq(schema_exports.problems.authorId, schema_exports.users.id)).where(eq(schema_exports.problems.id, id)).limit(1);
  if (!r) return null;
  const [responseRows, solverRows] = await Promise.all([
    db.select({
      response: schema_exports.problemResponses,
      sender: schema_exports.users
    }).from(schema_exports.problemResponses).innerJoin(schema_exports.users, eq(schema_exports.problemResponses.senderId, schema_exports.users.id)).where(eq(schema_exports.problemResponses.problemId, id)).orderBy(asc(schema_exports.problemResponses.createdAt)),
    db.select().from(schema_exports.problemSolvers).where(eq(schema_exports.problemSolvers.problemId, id))
  ]);
  return {
    id: r.problem.id,
    title: r.problem.title,
    applicationName: r.problem.applicationName,
    category: r.problem.category,
    description: r.problem.description,
    contactInfo: r.problem.contactInfo,
    contactEmail: r.problem.contactEmail,
    status: r.problem.status,
    authorId: r.problem.authorId,
    authorName: r.author.name,
    authorMemberId: r.author.memberId,
    authorBatch: r.author.batchOrDesignation,
    authorRole: r.author.role,
    solvedByIds: solverRows.map((s) => s.userId),
    responses: responseRows.map((row) => ({
      id: row.response.id,
      senderId: row.response.senderId,
      senderName: row.sender.name,
      senderMemberId: row.sender.memberId,
      senderEmail: row.sender.email,
      senderRole: row.sender.role,
      message: row.response.message,
      solutionLink: row.response.solutionLink,
      marksSolved: row.response.marksSolved,
      createdAt: row.response.createdAt.toISOString()
    })),
    createdAt: r.problem.createdAt.toISOString()
  };
}
function mapPlacementApplicant(app, student, viewer) {
  const canSeeDetails = viewer.role === "admin" || viewer.role === "faculty" || app.studentId === viewer.id;
  if (!canSeeDetails) {
    return {
      studentId: "",
      studentMemberId: "",
      studentName: "",
      studentEmail: "",
      cgpa: 0,
      leetcodeSolved: 0,
      leetcodeVerified: false,
      hackerrankFiveStars: 0,
      hackerrankVerified: false,
      githubProjects: 0,
      githubVerified: false,
      resumeLink: "",
      appliedAt: app.appliedAt.toISOString()
    };
  }
  return {
    studentId: app.studentId,
    studentMemberId: student.memberId,
    studentName: student.name,
    studentEmail: student.email,
    cgpa: Number(app.cgpaSnapshot),
    leetcodeSolved: app.leetcodeSolvedSnapshot,
    leetcodeVerified: app.leetcodeSnapshotVerified,
    hackerrankFiveStars: app.hackerrankFiveStarsSnapshot,
    hackerrankVerified: app.hackerrankSnapshotVerified,
    githubProjects: app.githubProjectsSnapshot,
    githubVerified: app.githubSnapshotVerified,
    resumeLink: app.resumeLink,
    appliedAt: app.appliedAt.toISOString()
  };
}
async function getPlacementDrivesList(db, viewer) {
  const driveRows = await db.select({
    drive: schema_exports.placementDrives,
    authorName: schema_exports.users.name
  }).from(schema_exports.placementDrives).leftJoin(schema_exports.users, eq(schema_exports.placementDrives.authorId, schema_exports.users.id)).orderBy(desc(schema_exports.placementDrives.createdAt));
  if (driveRows.length === 0) return [];
  const driveIds = driveRows.map((r) => r.drive.id);
  const applicantRows = await db.select({
    app: schema_exports.placementApplications,
    student: schema_exports.users
  }).from(schema_exports.placementApplications).innerJoin(schema_exports.users, eq(schema_exports.placementApplications.studentId, schema_exports.users.id)).where(inArray(schema_exports.placementApplications.driveId, driveIds)).orderBy(asc(schema_exports.placementApplications.appliedAt));
  const appsByDrive = /* @__PURE__ */ new Map();
  for (const row of applicantRows) {
    const arr = appsByDrive.get(row.app.driveId) ?? [];
    arr.push(mapPlacementApplicant(row.app, row.student, viewer));
    appsByDrive.set(row.app.driveId, arr);
  }
  return driveRows.map((r) => ({
    id: r.drive.id,
    companyName: r.drive.companyName,
    roleTitle: r.drive.roleTitle,
    packageCtc: r.drive.packageCtc,
    location: r.drive.location,
    deadline: r.drive.deadline,
    applyLink: r.drive.applyLink,
    description: r.drive.description,
    criteria: {
      requireCgpa: r.drive.requireCgpa,
      minCgpa: Number(r.drive.minCgpa),
      requireLeetcode: r.drive.requireLeetcode,
      minLeetcodeProblems: r.drive.minLeetcodeProblems,
      requireHackerrank: r.drive.requireHackerrank,
      minHackerrankFiveStars: r.drive.minHackerrankFiveStars,
      requireGithub: r.drive.requireGithub,
      minGithubProjects: r.drive.minGithubProjects
    },
    applicants: appsByDrive.get(r.drive.id) ?? [],
    authorId: r.drive.authorId ?? "",
    authorName: r.authorName || r.drive.authorNameSnapshot || "Placement Cell",
    createdAt: r.drive.createdAt.toISOString()
  }));
}
async function getPlacementDriveById(db, id, viewer) {
  const [r] = await db.select({
    drive: schema_exports.placementDrives,
    authorName: schema_exports.users.name
  }).from(schema_exports.placementDrives).leftJoin(schema_exports.users, eq(schema_exports.placementDrives.authorId, schema_exports.users.id)).where(eq(schema_exports.placementDrives.id, id)).limit(1);
  if (!r) return null;
  const applicantRows = await db.select({
    app: schema_exports.placementApplications,
    student: schema_exports.users
  }).from(schema_exports.placementApplications).innerJoin(schema_exports.users, eq(schema_exports.placementApplications.studentId, schema_exports.users.id)).where(eq(schema_exports.placementApplications.driveId, id)).orderBy(asc(schema_exports.placementApplications.appliedAt));
  return {
    id: r.drive.id,
    companyName: r.drive.companyName,
    roleTitle: r.drive.roleTitle,
    packageCtc: r.drive.packageCtc,
    location: r.drive.location,
    deadline: r.drive.deadline,
    applyLink: r.drive.applyLink,
    description: r.drive.description,
    criteria: {
      requireCgpa: r.drive.requireCgpa,
      minCgpa: Number(r.drive.minCgpa),
      requireLeetcode: r.drive.requireLeetcode,
      minLeetcodeProblems: r.drive.minLeetcodeProblems,
      requireHackerrank: r.drive.requireHackerrank,
      minHackerrankFiveStars: r.drive.minHackerrankFiveStars,
      requireGithub: r.drive.requireGithub,
      minGithubProjects: r.drive.minGithubProjects
    },
    applicants: applicantRows.map(
      (row) => mapPlacementApplicant(row.app, row.student, viewer)
    ),
    authorId: r.drive.authorId ?? "",
    authorName: r.authorName || r.drive.authorNameSnapshot || "Placement Cell",
    createdAt: r.drive.createdAt.toISOString()
  };
}
function mapCourseEnrollment(en, student, viewer) {
  const canSeeDetails = viewer.role === "admin" || viewer.role === "faculty" || en.studentId === viewer.id;
  if (!canSeeDetails) {
    return {
      studentId: "",
      studentMemberId: "",
      studentName: "",
      studentEmail: "",
      enrolledAt: en.enrolledAt.toISOString()
    };
  }
  return {
    studentId: en.studentId,
    studentMemberId: student.memberId,
    studentName: student.name,
    studentEmail: student.email,
    enrolledAt: en.enrolledAt.toISOString()
  };
}
async function getCoursesList(db, viewer) {
  const courseRows = await db.select().from(schema_exports.courses).orderBy(desc(schema_exports.courses.createdAt));
  if (courseRows.length === 0) return [];
  const courseIds = courseRows.map((c) => c.id);
  const enrollmentRows = await db.select({
    en: schema_exports.courseEnrollments,
    student: schema_exports.users
  }).from(schema_exports.courseEnrollments).innerJoin(schema_exports.users, eq(schema_exports.courseEnrollments.studentId, schema_exports.users.id)).where(inArray(schema_exports.courseEnrollments.courseId, courseIds)).orderBy(asc(schema_exports.courseEnrollments.enrolledAt));
  const enrollmentsByCourse = /* @__PURE__ */ new Map();
  for (const row of enrollmentRows) {
    const arr = enrollmentsByCourse.get(row.en.courseId) ?? [];
    arr.push(mapCourseEnrollment(row.en, row.student, viewer));
    enrollmentsByCourse.set(row.en.courseId, arr);
  }
  return courseRows.map((c) => ({
    id: c.id,
    courseCode: c.courseCode,
    title: c.title,
    instructorName: c.instructorName,
    semester: c.semester,
    credits: c.credits,
    schedule: c.schedule,
    prerequisites: c.prerequisites,
    description: c.description,
    resourceLink: c.resourceLink,
    enrollments: enrollmentsByCourse.get(c.id) ?? [],
    authorId: c.authorId ?? "",
    createdAt: c.createdAt.toISOString()
  }));
}
async function getCourseById(db, id, viewer) {
  const [c] = await db.select().from(schema_exports.courses).where(eq(schema_exports.courses.id, id)).limit(1);
  if (!c) return null;
  const enrollmentRows = await db.select({
    en: schema_exports.courseEnrollments,
    student: schema_exports.users
  }).from(schema_exports.courseEnrollments).innerJoin(schema_exports.users, eq(schema_exports.courseEnrollments.studentId, schema_exports.users.id)).where(eq(schema_exports.courseEnrollments.courseId, id)).orderBy(asc(schema_exports.courseEnrollments.enrolledAt));
  return {
    id: c.id,
    courseCode: c.courseCode,
    title: c.title,
    instructorName: c.instructorName,
    semester: c.semester,
    credits: c.credits,
    schedule: c.schedule,
    prerequisites: c.prerequisites,
    description: c.description,
    resourceLink: c.resourceLink,
    enrollments: enrollmentRows.map(
      (row) => mapCourseEnrollment(row.en, row.student, viewer)
    ),
    authorId: c.authorId ?? "",
    createdAt: c.createdAt.toISOString()
  };
}
function mapFacultyDirectoryRow(row) {
  return {
    id: row.id,
    linkedUserId: row.linkedUserId ?? null,
    name: row.name,
    designation: row.designation,
    specialization: row.specialization,
    email: row.email ?? "",
    phoneOrCabin: row.phoneOrCabin,
    qualification: row.qualification,
    experienceYears: row.experienceYears,
    bio: row.bio,
    authorId: row.authorId ?? "",
    createdAt: row.createdAt.toISOString()
  };
}
async function getFacultyDirectoryList(db) {
  const rows = await db.select().from(schema_exports.facultyDirectory).orderBy(desc(schema_exports.facultyDirectory.createdAt));
  return rows.map(mapFacultyDirectoryRow);
}
async function getAcademicResourcesList(db) {
  const rows = await db.select({
    resource: schema_exports.academicResources,
    authorName: schema_exports.users.name
  }).from(schema_exports.academicResources).leftJoin(schema_exports.users, eq(schema_exports.academicResources.authorId, schema_exports.users.id)).orderBy(desc(schema_exports.academicResources.createdAt));
  return rows.map((r) => ({
    id: r.resource.id,
    title: r.resource.title,
    resourceType: r.resource.resourceType,
    subjectOrLab: r.resource.subjectOrLab,
    description: r.resource.description,
    resourceLink: r.resource.resourceLink,
    authorId: r.resource.authorId ?? "",
    authorName: r.authorName || r.resource.authorNameSnapshot || "Department Faculty",
    createdAt: r.resource.createdAt.toISOString()
  }));
}
async function getNotificationsForUser(db, userId) {
  const rows = await db.select({
    notif: schema_exports.notifications,
    actorName: schema_exports.users.name
  }).from(schema_exports.notifications).leftJoin(schema_exports.users, eq(schema_exports.notifications.actorId, schema_exports.users.id)).where(
    or(
      isNull(schema_exports.notifications.recipientUserId),
      eq(schema_exports.notifications.recipientUserId, userId)
    )
  ).orderBy(desc(schema_exports.notifications.createdAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.notif.id);
  const readRows = await db.select({ notificationId: schema_exports.notificationReads.notificationId }).from(schema_exports.notificationReads).where(
    and(
      eq(schema_exports.notificationReads.userId, userId),
      inArray(schema_exports.notificationReads.notificationId, ids)
    )
  );
  const readSet = new Set(readRows.map((r) => r.notificationId));
  return rows.map((r) => ({
    id: r.notif.id,
    type: r.notif.type,
    title: r.notif.title,
    message: r.notif.message,
    targetSection: r.notif.targetSection,
    targetItemId: r.notif.targetItemId ?? void 0,
    recipientUserId: r.notif.recipientUserId ?? void 0,
    actorId: r.notif.actorId ?? "",
    actorName: r.actorName || r.notif.actorNameSnapshot || "Portal Member",
    readByUserIds: readSet.has(r.notif.id) ? [userId] : [],
    createdAt: r.notif.createdAt.toISOString()
  }));
}
function mapReminderRow(row) {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    note: row.note,
    dueDate: row.dueDate,
    category: row.category,
    priority: row.priority,
    completed: row.completed,
    createdAt: row.createdAt.toISOString()
  };
}
async function getPersonalRemindersForUser(db, userId) {
  const rows = await db.select().from(schema_exports.personalReminders).where(eq(schema_exports.personalReminders.userId, userId)).orderBy(desc(schema_exports.personalReminders.createdAt));
  return rows.map(mapReminderRow);
}
async function getPublicBootstrapPayload(db) {
  const [
    spotlightsList,
    [hackCount],
    [projCount],
    [intCount],
    [probCount],
    [appCount],
    [placeCount],
    [courseCount],
    [facCount]
  ] = await Promise.all([
    getSpotlightsList(db),
    db.select({ value: count() }).from(schema_exports.hackathons),
    db.select({ value: count() }).from(schema_exports.projects),
    db.select({ value: count() }).from(schema_exports.interviews),
    db.select({ value: count() }).from(schema_exports.problems),
    db.select({ value: count() }).from(schema_exports.appTechnologies),
    db.select({ value: count() }).from(schema_exports.placementDrives),
    db.select({ value: count() }).from(schema_exports.courses),
    db.select({ value: count() }).from(schema_exports.facultyDirectory)
  ]);
  return {
    spotlights: spotlightsList,
    hackathons: [],
    interviews: [],
    projects: [],
    problems: [],
    apps: [],
    placements: [],
    courses: [],
    facultyMembers: [],
    resources: [],
    notifications: [],
    personalReminders: [],
    publicCounts: {
      hackathons: Number(hackCount?.value ?? 0),
      projects: Number(projCount?.value ?? 0),
      interviews: Number(intCount?.value ?? 0),
      problems: Number(probCount?.value ?? 0),
      apps: Number(appCount?.value ?? 0),
      placements: Number(placeCount?.value ?? 0),
      courses: Number(courseCount?.value ?? 0),
      facultyMembers: Number(facCount?.value ?? 0)
    }
  };
}
async function getAuthenticatedBootstrapPayload(db, viewer) {
  const [
    spotlightsList,
    hackathonsList,
    interviewsList,
    projectsList,
    problemsList,
    appsList,
    placementsList,
    coursesList,
    facultyMembersList,
    resourcesList,
    notificationsList,
    remindersList
  ] = await Promise.all([
    getSpotlightsList(db),
    getHackathonsList(db),
    getInterviewsList(db),
    getProjectsList(db),
    getProblemsList(db),
    getAppsList(db),
    getPlacementDrivesList(db, viewer),
    getCoursesList(db, viewer),
    getFacultyDirectoryList(db),
    getAcademicResourcesList(db),
    getNotificationsForUser(db, viewer.id),
    getPersonalRemindersForUser(db, viewer.id)
  ]);
  return {
    spotlights: spotlightsList,
    hackathons: hackathonsList,
    interviews: interviewsList,
    projects: projectsList,
    problems: problemsList,
    apps: appsList,
    placements: placementsList,
    courses: coursesList,
    facultyMembers: facultyMembersList,
    resources: resourcesList,
    notifications: notificationsList,
    personalReminders: remindersList
  };
}
async function searchStudentsDirectory(db, queryText, options = {}) {
  const q = queryText.trim();
  const baseCondition = and(
    eq(schema_exports.users.role, "student"),
    eq(schema_exports.users.isActive, true)
  );
  const whereClause = q ? and(
    baseCondition,
    or(
      ilike(schema_exports.users.memberId, `%${q}%`),
      ilike(schema_exports.users.name, `%${q}%`),
      ilike(schema_exports.users.skills, `%${q}%`)
    )
  ) : baseCondition;
  const studentRows = await db.select({
    user: schema_exports.users,
    studentProfile: schema_exports.studentProfiles
  }).from(schema_exports.users).leftJoin(schema_exports.studentProfiles, eq(schema_exports.users.id, schema_exports.studentProfiles.userId)).where(whereClause).orderBy(asc(schema_exports.users.name));
  if (studentRows.length === 0) return [];
  const results = await Promise.all(
    studentRows.map(async (row) => {
      const [progress, studentProjects, studentApps, studentHackathons, studentInterviews] = await Promise.all([
        computeUserProgress(db, row.user.id),
        getProjectsList(db, row.user.id),
        getAppsList(db, row.user.id),
        getHackathonsList(db, row.user.id),
        getInterviewsList(db, row.user.id)
      ]);
      return {
        profile: toPublicProfile(
          {
            user: row.user,
            studentProfile: row.studentProfile,
            facultyProfile: null,
            adminProfile: null
          },
          { includePhone: Boolean(options.includePhone) }
        ),
        progress,
        projects: studentProjects,
        apps: studentApps,
        hackathons: studentHackathons,
        interviews: studentInterviews
      };
    })
  );
  return results;
}

// server.ts
dns.setDefaultResultOrder("ipv4first");
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var uuidSchema = z.string().uuid("Invalid record identifier.");
var EPHEMERAL_HMAC_FALLBACK = crypto.randomBytes(32).toString("hex");
var CODING_OWNER_CODE_TTL_SEC = 30 * 60;
var MAX_CONSUMED_CHALLENGES = 2e3;
var consumedCodingChallenges = /* @__PURE__ */ new Map();
function pruneConsumedCodingChallenges(nowMs = Date.now()) {
  for (const [key, expiresAtMs] of consumedCodingChallenges.entries()) {
    if (expiresAtMs <= nowMs) {
      consumedCodingChallenges.delete(key);
    }
  }
}
function getConsumedChallengeKey(userId, platform, normalizedCode) {
  return `${userId}:${platform}:${normalizedCode}`;
}
function isCodingChallengeConsumed(userId, platform, normalizedCode) {
  const nowMs = Date.now();
  pruneConsumedCodingChallenges(nowMs);
  const expiresAtMs = consumedCodingChallenges.get(
    getConsumedChallengeKey(userId, platform, normalizedCode)
  );
  return typeof expiresAtMs === "number" && expiresAtMs > nowMs;
}
function markCodingChallengeConsumed(userId, platform, normalizedCode, expSec) {
  const nowMs = Date.now();
  pruneConsumedCodingChallenges(nowMs);
  if (consumedCodingChallenges.size >= MAX_CONSUMED_CHALLENGES) {
    const oldestKey = consumedCodingChallenges.keys().next().value;
    if (oldestKey !== void 0) {
      consumedCodingChallenges.delete(oldestKey);
    }
  }
  consumedCodingChallenges.set(
    getConsumedChallengeKey(userId, platform, normalizedCode),
    expSec * 1e3
  );
}
function getCodingVerifyHmacKey() {
  const persistentSeed = (process.env.CODING_VERIFY_HMAC_SECRET || "").trim() || (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() || (process.env.DATABASE_URL || "").trim();
  if (!persistentSeed && process.env.NODE_ENV === "production") {
    throw new Error(
      "Coding verification HMAC secret is unavailable in production environment."
    );
  }
  return crypto.createHmac("sha256", persistentSeed || EPHEMERAL_HMAC_FALLBACK).update("cse-portal-coding-ownership-v1").digest();
}
function signCodingOwnershipCode(userId, platform, username, expSec, nonce = crypto.randomBytes(3).toString("hex").toUpperCase()) {
  const payload = `${userId}|${platform}|${username.toLowerCase()}|${expSec}|${nonce}`;
  const mac = crypto.createHmac("sha256", getCodingVerifyHmacKey()).update(payload).digest("hex").slice(0, 16).toUpperCase();
  return `CSE-VERIFY-${expSec.toString(36).toUpperCase()}-${nonce}-${mac}`;
}
function verifyCodingOwnershipCodeSignature(userId, platform, username, rawCode) {
  if (typeof rawCode !== "string" || !rawCode.trim()) {
    return { ok: false, error: "Verification code is required." };
  }
  const normalized = rawCode.trim().toUpperCase();
  const match = /^CSE-VERIFY-([A-Z0-9]+)-([A-F0-9]{6})-([A-F0-9]{16})$/.exec(normalized);
  if (!match) {
    return { ok: false, error: "Invalid verification code format." };
  }
  const expSec = Number.parseInt(match[1], 36);
  const nonce = match[2];
  const nowSec = Math.floor(Date.now() / 1e3);
  if (!Number.isFinite(expSec) || expSec < nowSec || expSec > nowSec + CODING_OWNER_CODE_TTL_SEC + 300) {
    return { ok: false, error: "Verification code has expired. Please generate a fresh code." };
  }
  const expected = signCodingOwnershipCode(userId, platform, username, expSec, nonce);
  const a = Buffer.from(normalized, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return {
      ok: false,
      error: "Verification code does not match your account or current profile handle."
    };
  }
  if (isCodingChallengeConsumed(userId, platform, normalized)) {
    return {
      ok: false,
      error: "This verification code has already been used. Please generate a fresh verification code."
    };
  }
  return { ok: true, expSec, normalizedCode: normalized };
}
function normalizeHttpUrlInput(raw, options) {
  if (raw === void 0 || raw === null) {
    if (options.required) {
      return { ok: false, error: `${options.label} is required.` };
    }
    return { ok: true, value: "" };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: `${options.label} must be a valid URL text string.` };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    if (options.required) {
      return { ok: false, error: `${options.label} is required.` };
    }
    return { ok: true, value: "" };
  }
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        ok: false,
        error: `${options.label} must use an http:// or https:// web address.`
      };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return {
      ok: false,
      error: `Please enter a valid ${options.label} URL (e.g. https://...).`
    };
  }
}
function asNonEmptyTrimmedString(raw, fallback = "") {
  if (raw === void 0) return fallback;
  if (typeof raw !== "string") return null;
  return raw.trim();
}
function parseUuidParam(raw) {
  const val = Array.isArray(raw) ? raw[0] : raw;
  const parsed = uuidSchema.safeParse((val || "").trim());
  return parsed.success ? parsed.data : null;
}
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
function getPgErrorCode(err, depth = 0) {
  if (depth > 5 || !err || typeof err !== "object") {
    return void 0;
  }
  const candidate = err;
  if (typeof candidate.code === "string" && candidate.code.trim()) {
    return candidate.code.trim();
  }
  if (Array.isArray(candidate.errors)) {
    for (const inner of candidate.errors) {
      const innerCode = getPgErrorCode(inner, depth + 1);
      if (innerCode) return innerCode;
    }
  }
  if (candidate.cause) {
    return getPgErrorCode(candidate.cause, depth + 1);
  }
  return void 0;
}
var TRANSIENT_DB_ERROR_CODES = /* @__PURE__ */ new Set([
  "ENETUNREACH",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
  "EHOSTUNREACH"
]);
function isDbConnectivityError(err) {
  const code = getPgErrorCode(err);
  if (code && TRANSIENT_DB_ERROR_CODES.has(code)) {
    return true;
  }
  if (err instanceof Error && /Database connection is not configured/i.test(err.message)) {
    return true;
  }
  return false;
}
function isUniqueViolation(err) {
  return getPgErrorCode(err) === "23505";
}
function getPgConstraintName(err) {
  let current = err;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const candidate = current;
    if (typeof candidate.constraint_name === "string" && candidate.constraint_name.trim()) {
      return candidate.constraint_name;
    }
    if (typeof candidate.constraint === "string" && candidate.constraint.trim()) {
      return candidate.constraint;
    }
    current = candidate.cause;
  }
  return void 0;
}
function isMissingTableOrRelation(err) {
  const code = getPgErrorCode(err);
  return code === "42P01" || code === "42703";
}
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
}
async function attachUser(req, _res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const authUser = await verifySupabaseJwt(token);
    if (!authUser) {
      next();
      return;
    }
    const db = requireDb();
    const record = await getUserWithProfilesById(db, authUser.id);
    if (record && record.user.isActive) {
      req.userRecord = record;
      req.accessToken = token;
    }
  } catch {
  }
  next();
}
function requireAuth(req, res, next) {
  if (!req.userRecord) {
    res.status(401).json({
      error: "Please sign in at the top right to perform this action."
    });
    return;
  }
  next();
}
function requireAdmin(req, res, next) {
  if (!req.userRecord) {
    res.status(401).json({
      error: "Please sign in as Administrator to perform this action."
    });
    return;
  }
  if (req.userRecord.user.role !== "admin") {
    res.status(403).json({
      error: "Access denied: Administrator privileges required."
    });
    return;
  }
  next();
}
var cachedAppPromise = null;
async function buildExpressApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );
  app.use(express.json({ limit: "2mb" }));
  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many authentication requests. Please try again shortly." }
  });
  const apiRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1e3,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Rate limit exceeded. Please slow down requests." }
  });
  const codingVerificationRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1e3,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const authedReq = req;
      if (authedReq.userRecord?.user.id) {
        return `user:${authedReq.userRecord.user.id}`;
      }
      return ipKeyGenerator(req.ip || "unknown");
    },
    skip: (req) => {
      const authedReq = req;
      if (authedReq.userRecord?.user.role !== "student") return true;
      if (req.method === "PUT") {
        const body = req.body;
        if (body?.syncCodingLinks) return false;
        const sp = authedReq.userRecord.studentProfile;
        const lcChanged = typeof body?.leetcodeUrl === "string" && body.leetcodeUrl.trim() !== (sp?.leetcodeUrl || "");
        const hrChanged = typeof body?.hackerrankUrl === "string" && body.hackerrankUrl.trim() !== (sp?.hackerrankUrl || "");
        const ghChanged = typeof body?.githubUrl === "string" && body.githubUrl.trim() !== (sp?.githubUrl || "");
        return !lcChanged && !hrChanged && !ghChanged;
      }
      return false;
    },
    message: {
      error: "Too many coding verification requests. Please wait a few minutes before retrying."
    }
  });
  app.use("/api/auth", authRateLimiter);
  app.use("/api", apiRateLimiter);
  app.use(attachUser);
  app.get(
    "/api/health",
    asyncHandler(async (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const dbReadiness = await checkDatabaseReadiness();
      const supabaseConfigured = isSupabaseConfigured();
      const initialAdminEmailConfigured = Boolean(
        (process.env.INITIAL_ADMIN_EMAIL || "").replace(/^['"]+|['"]+$/g, "").trim()
      );
      if (process.env.NODE_ENV === "production") {
        const allReady = dbReadiness.connected && supabaseConfigured;
        res.status(allReady ? 200 : 503).json({
          ok: allReady,
          status: allReady ? "ok" : "degraded",
          environment: "production",
          supabaseConfigured,
          initialAdminEmailConfigured,
          database: dbReadiness
        });
        return;
      }
      res.json({
        ok: dbReadiness.connected && supabaseConfigured,
        status: dbReadiness.connected && supabaseConfigured ? "ok" : "degraded",
        environment: process.env.NODE_ENV || "development",
        databaseConfigured: Boolean(process.env.DATABASE_URL),
        supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL),
        supabaseSecretConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        supabaseConfigured,
        initialAdminEmailConfigured,
        codingVerifySecretConfigured: Boolean(
          (process.env.CODING_VERIFY_HMAC_SECRET || "").trim()
        ),
        githubTokenConfigured: Boolean((process.env.GITHUB_TOKEN || "").trim()),
        database: dbReadiness
      });
    })
  );
  app.get(
    "/api/bootstrap",
    asyncHandler(async (req, res) => {
      const db = requireDb();
      if (!req.userRecord) {
        const publicPayload = await getPublicBootstrapPayload(db);
        res.json(publicPayload);
        return;
      }
      const payload = await getAuthenticatedBootstrapPayload(db, req.userRecord.user);
      res.json(payload);
    })
  );
  app.get(
    "/api/auth/admin-status",
    asyncHandler(async (_req, res) => {
      const db = requireDb();
      const [settings] = await db.select().from(schema_exports.portalSettings).where(eq2(schema_exports.portalSettings.id, 1)).limit(1);
      if (settings?.adminInitialized) {
        res.json({ initialized: true });
        return;
      }
      const [existingAdmin] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq2(schema_exports.users.role, "admin")).limit(1);
      res.json({ initialized: Boolean(existingAdmin) });
    })
  );
  app.post(
    "/api/auth/admin-setup",
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const allowedAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || "").replace(/^['"]+|['"]+$/g, "").trim().toLowerCase();
      if (!allowedAdminEmail) {
        res.status(403).json({
          error: "Administrator bootstrap is locked. Configure INITIAL_ADMIN_EMAIL in backend environment secrets to authorize initial setup."
        });
        return;
      }
      const parsed = z.object({
        name: z.string().trim().min(1),
        memberId: z.string().trim().min(1),
        email: z.string().trim().email(),
        password: z.string().min(6),
        confirmPassword: z.string()
      }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "All fields (Admin Full Name, Admin ID, valid Email Address, Password min 6 chars, Confirm Password) are compulsory."
        });
        return;
      }
      const cleanName = parsed.data.name;
      const cleanMemberId = parsed.data.memberId.toUpperCase();
      const cleanEmail = parsed.data.email.toLowerCase();
      const cleanPassword = parsed.data.password;
      if (cleanPassword !== parsed.data.confirmPassword) {
        res.status(400).json({ error: "Password and Confirm Password do not match." });
        return;
      }
      if (cleanEmail !== allowedAdminEmail) {
        res.status(403).json({
          error: "This email address is not authorized for initial administrator setup."
        });
        return;
      }
      const [settingsPre] = await db.select().from(schema_exports.portalSettings).where(eq2(schema_exports.portalSettings.id, 1)).limit(1);
      const [existingAdminPre] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq2(schema_exports.users.role, "admin")).limit(1);
      if (settingsPre?.adminInitialized || existingAdminPre) {
        res.status(400).json({
          error: "Admin account has already been initialized. Please use Admin Login."
        });
        return;
      }
      const [dupUser] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(
        or2(
          sql3`lower(${schema_exports.users.email}) = lower(${cleanEmail})`,
          sql3`upper(${schema_exports.users.memberId}) = upper(${cleanMemberId})`
        )
      ).limit(1);
      if (dupUser) {
        res.status(409).json({ error: "An account with this email or Admin ID already exists." });
        return;
      }
      const authResult = await createSupabaseAuthUser({
        email: cleanEmail,
        password: cleanPassword,
        role: "admin",
        name: cleanName,
        memberId: cleanMemberId
      });
      if ("error" in authResult) {
        res.status(authResult.status ?? 400).json({ error: authResult.error });
        return;
      }
      const newUserId = authResult.user.id;
      try {
        await db.transaction(async (tx) => {
          await tx.insert(schema_exports.portalSettings).values({ id: 1, adminInitialized: false }).onConflictDoNothing();
          const lockedRows = await tx.execute(
            sql3`SELECT id, admin_initialized FROM public.portal_settings WHERE id = 1 FOR UPDATE`
          );
          const lockedRow = lockedRows[0];
          if (lockedRow?.admin_initialized) {
            throw new Error("ADMIN_ALREADY_INITIALIZED");
          }
          const [adminCheck] = await tx.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq2(schema_exports.users.role, "admin")).limit(1);
          if (adminCheck) {
            throw new Error("ADMIN_ALREADY_INITIALIZED");
          }
          await tx.insert(schema_exports.users).values({
            id: newUserId,
            memberId: cleanMemberId,
            name: cleanName,
            email: cleanEmail,
            role: "admin",
            department: "Administration",
            batchOrDesignation: "University Portal Administrator",
            phone: "",
            bio: "Chief Administrator for Pragati University Portal.",
            skills: "Portal Administration, Faculty Management, Security",
            isActive: true,
            canManageSpotlights: true
          });
          await tx.insert(schema_exports.adminProfiles).values({
            userId: newUserId,
            title: "University Portal Administrator",
            createdBySystemSetup: true
          });
          await tx.update(schema_exports.portalSettings).set({ adminInitialized: true }).where(eq2(schema_exports.portalSettings.id, 1));
        });
      } catch (err) {
        const authCleanup = await deleteSupabaseAuthUser(newUserId);
        if (authCleanup.error && !authCleanup.notFound) {
          console.error("[Admin Setup] Rollback Auth cleanup failed:", newUserId, authCleanup.error);
        }
        if (err instanceof Error && err.message === "ADMIN_ALREADY_INITIALIZED") {
          res.status(400).json({
            error: "Admin account has already been initialized. Please use Admin Login."
          });
          return;
        }
        throw err;
      }
      const sessionResult = await signInSupabasePassword(cleanEmail, cleanPassword);
      if ("error" in sessionResult) {
        const status = sessionResult.unavailable ? 503 : 500;
        res.status(status).json({
          error: sessionResult.unavailable ? sessionResult.error : "Admin created, but session initialization failed. Please log in."
        });
        return;
      }
      const record = await getUserWithProfilesById(db, newUserId);
      const progress = await computeUserProgress(db, newUserId);
      res.status(201).json({
        token: sessionResult.accessToken,
        profile: toPublicProfile(record, { includePhone: true }),
        progress,
        message: "Admin account created and initialized successfully."
      });
    })
  );
  app.post(
    "/api/auth/admin/change-password",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const user = req.userRecord.user;
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const cleanCurrent = typeof currentPassword === "string" ? currentPassword : "";
      const cleanNew = typeof newPassword === "string" ? newPassword : "";
      const cleanConfirm = typeof confirmPassword === "string" ? confirmPassword : "";
      if (!cleanCurrent || !cleanNew || !cleanConfirm) {
        res.status(400).json({
          error: "Current Password, New Password, and Confirm New Password are all compulsory."
        });
        return;
      }
      if (cleanNew.length < 6) {
        res.status(400).json({ error: "New password must be at least 6 characters in length." });
        return;
      }
      if (cleanNew !== cleanConfirm) {
        res.status(400).json({ error: "New Password and Confirm New Password do not match." });
        return;
      }
      if (cleanNew === cleanCurrent) {
        res.status(400).json({ error: "New password must be different from your current password." });
        return;
      }
      const verifyCurrent = await signInSupabasePassword(user.email, cleanCurrent);
      if ("error" in verifyCurrent) {
        if (verifyCurrent.unavailable) {
          res.status(503).json({ error: verifyCurrent.error });
          return;
        }
        res.status(401).json({ error: "Incorrect current password. Please verify and try again." });
        return;
      }
      const updated = await updateSupabaseAuthUser(user.id, { password: cleanNew });
      if (updated.error) {
        res.status(400).json({ error: updated.error });
        return;
      }
      res.json({ ok: true, message: "Admin password changed successfully." });
    })
  );
  async function handleStudentRegistration(req, res) {
    const db = requireDb();
    const {
      name,
      memberId,
      email,
      department = "Computer Science & Engineering (CSE)",
      year = "1st Year",
      section = "A",
      password,
      confirmPassword
    } = req.body;
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanMemberId = typeof memberId === "string" ? memberId.trim().toUpperCase() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanDept = typeof department === "string" ? department.trim() : "";
    const cleanYear = typeof year === "string" ? year.trim() : "";
    const cleanSection = typeof section === "string" ? section.trim().toUpperCase() : "";
    const cleanPassword = typeof password === "string" ? password : "";
    const cleanConfirm = confirmPassword !== void 0 ? typeof confirmPassword === "string" ? confirmPassword : "" : cleanPassword;
    if (!cleanName || !cleanMemberId || !cleanEmail || !cleanDept || !cleanYear || !cleanSection || !cleanPassword) {
      res.status(400).json({
        error: "All fields (Full Name, Student ID / Roll Number, Email, Department, Year, Section, Password, Confirm Password) are compulsory."
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    if (cleanPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters in length." });
      return;
    }
    if (cleanPassword !== cleanConfirm) {
      res.status(400).json({ error: "Password and Confirm Password do not match." });
      return;
    }
    const [dupEmail] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(sql3`lower(${schema_exports.users.email}) = lower(${cleanEmail})`).limit(1);
    if (dupEmail) {
      res.status(409).json({
        error: "An account with this Email Address already exists. Please log in."
      });
      return;
    }
    const [dupMember] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(sql3`upper(${schema_exports.users.memberId}) = upper(${cleanMemberId})`).limit(1);
    if (dupMember) {
      res.status(409).json({
        error: "An account with this Student ID / Roll Number already exists. Please log in."
      });
      return;
    }
    const authResult = await createSupabaseAuthUser({
      email: cleanEmail,
      password: cleanPassword,
      role: "student",
      name: cleanName,
      memberId: cleanMemberId
    });
    if ("error" in authResult) {
      res.status(authResult.status ?? 400).json({ error: authResult.error });
      return;
    }
    const newUserId = authResult.user.id;
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema_exports.users).values({
          id: newUserId,
          memberId: cleanMemberId,
          name: cleanName,
          email: cleanEmail,
          role: "student",
          department: cleanDept,
          batchOrDesignation: `${cleanYear} B.Tech ${cleanDept} \xB7 Section ${cleanSection}`,
          phone: "",
          bio: `Student at Pragati University, ${cleanDept}.`,
          skills: "",
          isActive: true,
          canManageSpotlights: false
        });
        await tx.insert(schema_exports.studentProfiles).values({
          userId: newUserId,
          year: cleanYear,
          section: cleanSection,
          cgpa: "0.00"
        });
      });
    } catch (err) {
      const authCleanup = await deleteSupabaseAuthUser(newUserId);
      if (authCleanup.error && !authCleanup.notFound) {
        console.error("[Student Register] Rollback Auth cleanup failed:", newUserId, authCleanup.error);
      }
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: "Student Email or Student ID already exists." });
        return;
      }
      throw err;
    }
    const sessionResult = await signInSupabasePassword(cleanEmail, cleanPassword);
    if ("error" in sessionResult) {
      const status = sessionResult.unavailable ? 503 : 500;
      res.status(status).json({
        error: sessionResult.unavailable ? sessionResult.error : "Account created, but auto-login failed. Please sign in."
      });
      return;
    }
    const record = await getUserWithProfilesById(db, newUserId);
    const progress = await computeUserProgress(db, newUserId);
    res.status(201).json({
      token: sessionResult.accessToken,
      profile: toPublicProfile(record, { includePhone: true }),
      progress,
      message: "Student account created successfully! Welcome to Pragati University Portal."
    });
  }
  app.post("/api/auth/student-register", asyncHandler(handleStudentRegistration));
  app.post(
    "/api/auth/register",
    asyncHandler(async (req, res) => {
      const { role } = req.body;
      if (role === "faculty") {
        res.status(403).json({
          error: "Faculty accounts cannot be self-registered. Please contact the University Administrator to obtain your faculty credentials."
        });
        return;
      }
      if (role === "admin") {
        res.status(403).json({
          error: "Admin accounts cannot be registered publicly. If this is first-time setup, use the initial Admin setup flow."
        });
        return;
      }
      await handleStudentRegistration(req, res);
    })
  );
  app.post(
    "/api/auth/login",
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const { identifier, password, role } = req.body;
      const cleanId = typeof identifier === "string" ? identifier.trim() : "";
      const cleanPassword = typeof password === "string" ? password : "";
      const expectedRole = role === "admin" ? "admin" : role === "faculty" ? "faculty" : "student";
      if (!cleanId || !cleanPassword) {
        res.status(400).json({ error: "Please enter your ID / Email and password." });
        return;
      }
      const userRow = await findUserByIdentifierAndRole(db, cleanId, expectedRole);
      if (!userRow) {
        if (expectedRole === "faculty") {
          res.status(401).json({
            error: "No faculty account found with these credentials. Faculty accounts must be created by the University Administrator."
          });
          return;
        }
        res.status(401).json({
          error: `No ${expectedRole} account matched those credentials. Please check your details or sign up.`
        });
        return;
      }
      if (!userRow.isActive) {
        res.status(403).json({
          error: "Your account has been deactivated by the portal administrator. Please contact university admin."
        });
        return;
      }
      const authResult = await signInSupabasePassword(userRow.email, cleanPassword);
      if ("error" in authResult) {
        if (authResult.unavailable) {
          res.status(503).json({ error: authResult.error });
          return;
        }
        res.status(401).json({ error: "Invalid password. Please try again." });
        return;
      }
      const record = await getUserWithProfilesById(db, userRow.id);
      const progress = await computeUserProgress(db, userRow.id);
      res.json({
        token: authResult.accessToken,
        profile: toPublicProfile(record, { includePhone: true }),
        progress
      });
    })
  );
  app.get(
    "/api/admin/faculty",
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const db = requireDb();
      const facultyRows = await db.select().from(schema_exports.users).where(eq2(schema_exports.users.role, "faculty")).orderBy(desc2(schema_exports.users.createdAt));
      const profiles = await db.select().from(schema_exports.facultyProfiles);
      const profileMap = new Map(profiles.map((p) => [p.userId, p]));
      const list = facultyRows.map(
        (u) => toPublicProfile(
          {
            user: u,
            studentProfile: null,
            facultyProfile: profileMap.get(u.id) ?? null,
            adminProfile: null
          },
          { includePhone: true }
        )
      );
      res.json({ faculty: list });
    })
  );
  app.post(
    "/api/admin/faculty",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const adminUser = req.userRecord.user;
      const {
        name,
        memberId,
        email,
        department,
        designation,
        phone,
        password,
        confirmPassword
      } = req.body;
      const cleanName = typeof name === "string" ? name.trim() : "";
      const cleanMemberId = typeof memberId === "string" ? memberId.trim().toUpperCase() : "";
      const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      const cleanDept = typeof department === "string" ? department.trim() : "";
      const cleanDesignation = typeof designation === "string" ? designation.trim() : "";
      const cleanPhone = typeof phone === "string" ? phone.trim() : "";
      const cleanPassword = typeof password === "string" ? password : "";
      const cleanConfirm = typeof confirmPassword === "string" ? confirmPassword : "";
      if (!cleanName || !cleanMemberId || !cleanEmail || !cleanDept || !cleanDesignation || !cleanPhone || !cleanPassword || !cleanConfirm) {
        res.status(400).json({
          error: "All fields (Faculty Full Name, Faculty ID, Email Address, Department, Designation, Phone Number, Password, Confirm Password) are compulsory."
        });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: "Please enter a valid email address." });
        return;
      }
      if (cleanPassword.length < 6) {
        res.status(400).json({
          error: "Faculty password must be at least 6 characters in length."
        });
        return;
      }
      if (cleanPassword !== cleanConfirm) {
        res.status(400).json({ error: "Password and Confirm Password do not match." });
        return;
      }
      const [dupEmail] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(sql3`lower(${schema_exports.users.email}) = lower(${cleanEmail})`).limit(1);
      if (dupEmail) {
        res.status(409).json({
          error: "A user account with this email address already exists."
        });
        return;
      }
      const [dupMember] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(sql3`upper(${schema_exports.users.memberId}) = upper(${cleanMemberId})`).limit(1);
      if (dupMember) {
        res.status(409).json({
          error: "A user account with this Faculty ID already exists."
        });
        return;
      }
      const authResult = await createSupabaseAuthUser({
        email: cleanEmail,
        password: cleanPassword,
        role: "faculty",
        name: cleanName,
        memberId: cleanMemberId
      });
      if ("error" in authResult) {
        res.status(authResult.status ?? 400).json({ error: authResult.error });
        return;
      }
      const newFacultyId = authResult.user.id;
      try {
        await db.transaction(async (tx) => {
          await tx.insert(schema_exports.users).values({
            id: newFacultyId,
            memberId: cleanMemberId,
            name: cleanName,
            email: cleanEmail,
            role: "faculty",
            department: cleanDept,
            phone: cleanPhone,
            batchOrDesignation: `${cleanDesignation}, ${cleanDept}`,
            bio: `${cleanDesignation} in ${cleanDept} at Pragati University.`,
            skills: cleanDept,
            isActive: true,
            canManageSpotlights: true
          });
          await tx.insert(schema_exports.facultyProfiles).values({
            userId: newFacultyId,
            designation: cleanDesignation,
            specialization: cleanDept,
            qualification: "M.Tech / Ph.D",
            experienceYears: 5,
            phoneOrCabin: cleanPhone
          });
          const [existingDir] = await tx.select().from(schema_exports.facultyDirectory).where(sql3`lower(${schema_exports.facultyDirectory.email}) = lower(${cleanEmail})`).limit(1);
          if (!existingDir) {
            await tx.insert(schema_exports.facultyDirectory).values({
              linkedUserId: newFacultyId,
              name: cleanName,
              designation: cleanDesignation,
              specialization: cleanDept,
              email: cleanEmail,
              phoneOrCabin: cleanPhone,
              qualification: "M.Tech / Ph.D",
              experienceYears: 5,
              bio: `${cleanDesignation} in ${cleanDept}`,
              authorId: adminUser.id
            });
          } else if (existingDir.linkedUserId === null) {
            await tx.update(schema_exports.facultyDirectory).set({
              linkedUserId: newFacultyId,
              authorId: newFacultyId,
              name: cleanName,
              designation: cleanDesignation,
              specialization: cleanDept,
              phoneOrCabin: cleanPhone
            }).where(eq2(schema_exports.facultyDirectory.id, existingDir.id));
          } else {
            throw new Error("FACULTY_DIRECTORY_EMAIL_CONFLICT");
          }
        });
      } catch (err) {
        const authCleanup = await deleteSupabaseAuthUser(newFacultyId);
        if (authCleanup.error && !authCleanup.notFound) {
          console.error("[Admin Create Faculty] Rollback Auth cleanup failed:", newFacultyId, authCleanup.error);
        }
        if (err instanceof Error && err.message === "FACULTY_DIRECTORY_EMAIL_CONFLICT") {
          res.status(409).json({
            error: "A faculty directory profile linked to another account already uses this email."
          });
          return;
        }
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: "Faculty account with this email or ID already exists." });
          return;
        }
        throw err;
      }
      const record = await getUserWithProfilesById(db, newFacultyId);
      res.status(201).json({
        ok: true,
        message: `Faculty account created successfully for ${cleanName} (${cleanMemberId}).`,
        faculty: toPublicProfile(record, { includePhone: true })
      });
    })
  );
  app.put(
    "/api/admin/faculty/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Faculty account not found." });
        return;
      }
      const db = requireDb();
      const existing = await getUserWithProfilesById(db, id);
      if (!existing || existing.user.role !== "faculty") {
        res.status(404).json({ error: "Faculty account not found." });
        return;
      }
      const {
        name,
        email,
        department,
        designation,
        phone,
        bio,
        skills,
        qualification,
        experienceYears
      } = req.body;
      const nextName = typeof name === "string" && name.trim() ? name.trim() : existing.user.name;
      const nextEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : existing.user.email;
      const nextDept = typeof department === "string" ? department.trim() : existing.user.department;
      if (phone !== void 0 && typeof phone !== "string") {
        res.status(400).json({ error: "Phone must be a valid text string." });
        return;
      }
      if (qualification !== void 0 && typeof qualification !== "string") {
        res.status(400).json({ error: "Qualification must be a valid text string." });
        return;
      }
      if (bio !== void 0 && typeof bio !== "string") {
        res.status(400).json({ error: "Bio must be a valid text string." });
        return;
      }
      if (skills !== void 0 && typeof skills !== "string") {
        res.status(400).json({ error: "Skills must be a valid text string." });
        return;
      }
      const nextPhone = typeof phone === "string" ? phone.trim() : existing.user.phone;
      const nextDesignation = typeof designation === "string" && designation.trim() ? designation.trim() : existing.facultyProfile?.designation || existing.user.batchOrDesignation.split(",")[0] || "Faculty";
      const nextSpecialization = nextDept || existing.facultyProfile?.specialization || "CSE";
      const nextQualification = typeof qualification === "string" ? qualification.trim() : existing.facultyProfile?.qualification || "M.Tech / Ph.D";
      const nextExperienceYears = experienceYears !== void 0 ? Math.max(0, Math.min(60, Number(experienceYears) || 0)) : existing.facultyProfile?.experienceYears ?? 5;
      const nextBio = typeof bio === "string" ? bio.trim() : existing.user.bio;
      const nextSkills = typeof skills === "string" ? skills.trim() : existing.user.skills;
      const nextBatchOrDesignation = designation !== void 0 || department !== void 0 ? `${nextDesignation}, ${nextDept || "CSE"}` : existing.user.batchOrDesignation;
      if (nextEmail !== existing.user.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
          res.status(400).json({ error: "Please enter a valid email address." });
          return;
        }
        const [dupEmail] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(
          and2(
            sql3`lower(${schema_exports.users.email}) = lower(${nextEmail})`,
            sql3`${schema_exports.users.id} <> ${id}`
          )
        ).limit(1);
        if (dupEmail) {
          res.status(409).json({ error: "Another user account already uses this email address." });
          return;
        }
        const authUpdate = await updateSupabaseAuthUser(id, {
          email: nextEmail,
          name: nextName,
          memberId: existing.user.memberId
        });
        if (authUpdate.error) {
          res.status(400).json({ error: authUpdate.error });
          return;
        }
      } else if (nextName !== existing.user.name) {
        const authUpdate = await updateSupabaseAuthUser(id, {
          name: nextName,
          memberId: existing.user.memberId
        });
        if (authUpdate.error) {
          res.status(400).json({ error: authUpdate.error });
          return;
        }
      }
      try {
        await db.transaction(async (tx) => {
          await tx.update(schema_exports.users).set({
            name: nextName,
            email: nextEmail,
            department: nextDept,
            phone: nextPhone,
            bio: nextBio,
            skills: nextSkills,
            batchOrDesignation: nextBatchOrDesignation
          }).where(eq2(schema_exports.users.id, id));
          await tx.insert(schema_exports.facultyProfiles).values({
            userId: id,
            designation: nextDesignation,
            specialization: nextSpecialization,
            qualification: nextQualification,
            experienceYears: nextExperienceYears,
            phoneOrCabin: nextPhone
          }).onConflictDoUpdate({
            target: schema_exports.facultyProfiles.userId,
            set: {
              designation: nextDesignation,
              specialization: nextSpecialization,
              qualification: nextQualification,
              experienceYears: nextExperienceYears,
              phoneOrCabin: nextPhone
            }
          });
          await tx.update(schema_exports.facultyDirectory).set({
            name: nextName,
            email: nextEmail,
            designation: nextDesignation,
            specialization: nextSpecialization,
            phoneOrCabin: nextPhone,
            qualification: nextQualification,
            experienceYears: nextExperienceYears,
            bio: nextBio
          }).where(eq2(schema_exports.facultyDirectory.linkedUserId, id));
        });
      } catch (err) {
        if (nextEmail !== existing.user.email || nextName !== existing.user.name) {
          await updateSupabaseAuthUser(id, {
            email: existing.user.email,
            name: existing.user.name,
            memberId: existing.user.memberId
          });
        }
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: "Another user or faculty profile already uses this email." });
          return;
        }
        throw err;
      }
      const updated = await getUserWithProfilesById(db, id);
      res.json({
        ok: true,
        faculty: toPublicProfile(updated, { includePhone: true })
      });
    })
  );
  app.post(
    "/api/admin/faculty/:id/change-password",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Faculty account not found." });
        return;
      }
      const db = requireDb();
      const [target] = await db.select().from(schema_exports.users).where(and2(eq2(schema_exports.users.id, id), eq2(schema_exports.users.role, "faculty"))).limit(1);
      if (!target) {
        res.status(404).json({ error: "Faculty account not found." });
        return;
      }
      const { newPassword, confirmPassword } = req.body;
      const cleanNew = typeof newPassword === "string" ? newPassword : "";
      const cleanConfirm = typeof confirmPassword === "string" ? confirmPassword : "";
      if (!cleanNew || !cleanConfirm) {
        res.status(400).json({ error: "Both New Password and Confirm Password are required." });
        return;
      }
      if (cleanNew.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters in length." });
        return;
      }
      if (cleanNew !== cleanConfirm) {
        res.status(400).json({ error: "Passwords do not match." });
        return;
      }
      const updated = await updateSupabaseAuthUser(target.id, { password: cleanNew });
      if (updated.error) {
        res.status(400).json({ error: updated.error });
        return;
      }
      res.json({ ok: true, message: `Password updated successfully for ${target.name}.` });
    })
  );
  app.post(
    "/api/admin/faculty/:id/toggle-status",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Faculty account not found." });
        return;
      }
      const db = requireDb();
      const [target] = await db.select().from(schema_exports.users).where(and2(eq2(schema_exports.users.id, id), eq2(schema_exports.users.role, "faculty"))).limit(1);
      if (!target) {
        res.status(404).json({ error: "Faculty account not found." });
        return;
      }
      const nextActive = !target.isActive;
      await db.update(schema_exports.users).set({ isActive: nextActive }).where(eq2(schema_exports.users.id, id));
      await updateSupabaseAuthUser(id, { banned: !nextActive });
      res.json({
        ok: true,
        isActive: nextActive,
        message: `Faculty account ${nextActive ? "activated" : "deactivated"} successfully.`
      });
    })
  );
  app.delete(
    "/api/admin/faculty/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Faculty account not found." });
        return;
      }
      const db = requireDb();
      const deletionResult = await db.transaction(async (tx) => {
        const [target] = await tx.select({
          id: schema_exports.users.id,
          name: schema_exports.users.name,
          role: schema_exports.users.role
        }).from(schema_exports.users).where(and2(eq2(schema_exports.users.id, id), eq2(schema_exports.users.role, "faculty"))).limit(1);
        if (!target) {
          return null;
        }
        const deletedDirRows = await tx.delete(schema_exports.facultyDirectory).where(eq2(schema_exports.facultyDirectory.linkedUserId, id)).returning({ id: schema_exports.facultyDirectory.id });
        const deletedProfileRows = await tx.delete(schema_exports.facultyProfiles).where(eq2(schema_exports.facultyProfiles.userId, id)).returning({ userId: schema_exports.facultyProfiles.userId });
        const deletedUserRows = await tx.delete(schema_exports.users).where(and2(eq2(schema_exports.users.id, id), eq2(schema_exports.users.role, "faculty"))).returning({ id: schema_exports.users.id, name: schema_exports.users.name });
        if (deletedUserRows.length === 0) {
          return null;
        }
        return {
          deletedUser: deletedUserRows[0],
          deletedDirectoryIds: deletedDirRows.map((row) => row.id),
          deletedProfileCount: deletedProfileRows.length
        };
      });
      if (!deletionResult) {
        res.status(404).json({ error: "Faculty account not found." });
        return;
      }
      const authDeleteResult = await deleteSupabaseAuthUser(id);
      if (authDeleteResult.error && !authDeleteResult.notFound) {
        console.error(
          "[Admin Delete Faculty] Supabase Auth cleanup failed for user:",
          id,
          authDeleteResult.error
        );
        res.status(502).json({
          error: `Portal account records for ${deletionResult.deletedUser.name} were deleted, but Supabase Auth cleanup failed: ${authDeleteResult.error}`,
          deletedUserId: deletionResult.deletedUser.id,
          deletedDirectoryIds: deletionResult.deletedDirectoryIds
        });
        return;
      }
      res.json({
        ok: true,
        message: `Faculty account for ${deletionResult.deletedUser.name} has been removed.`,
        deletedUserId: deletionResult.deletedUser.id,
        deletedDirectoryIds: deletionResult.deletedDirectoryIds
      });
    })
  );
  app.get(
    "/api/admin/students",
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const db = requireDb();
      const rows = await db.select({
        user: schema_exports.users,
        studentProfile: schema_exports.studentProfiles
      }).from(schema_exports.users).leftJoin(schema_exports.studentProfiles, eq2(schema_exports.users.id, schema_exports.studentProfiles.userId)).where(eq2(schema_exports.users.role, "student")).orderBy(desc2(schema_exports.users.createdAt));
      const students = rows.map(
        (r) => toPublicProfile(
          {
            user: r.user,
            studentProfile: r.studentProfile,
            facultyProfile: null,
            adminProfile: null
          },
          { includePhone: true }
        )
      );
      res.json({ students });
    })
  );
  async function handleStaffStudentUpdate(req, res) {
    const actor = req.userRecord.user;
    if (actor.role !== "faculty" && actor.role !== "admin") {
      res.status(403).json({
        error: "Only Faculty or Administrator accounts can update student profiles."
      });
      return;
    }
    const id = parseUuidParam(req.params.id);
    if (!id) {
      res.status(404).json({ error: "Student account not found." });
      return;
    }
    const db = requireDb();
    const existing = await getUserWithProfilesById(db, id);
    if (!existing || existing.user.role !== "student") {
      res.status(404).json({ error: "Student account not found." });
      return;
    }
    const {
      name,
      email,
      department,
      year,
      section,
      phone,
      cgpa,
      skills,
      bio,
      batchOrDesignation,
      isActive
    } = req.body;
    const nextEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : existing.user.email;
    const nextIsActive = typeof isActive === "boolean" ? isActive : existing.user.isActive;
    if (actor.role !== "admin" && (nextEmail !== existing.user.email || nextIsActive !== existing.user.isActive)) {
      res.status(403).json({
        error: "Only an Administrator can modify a student login email or account status."
      });
      return;
    }
    if (typeof name === "string" && !name.trim()) {
      res.status(400).json({ error: "Student full name cannot be empty." });
      return;
    }
    for (const [fieldVal, label] of [
      [department, "Department"],
      [year, "Year"],
      [section, "Section"],
      [phone, "Phone"],
      [bio, "Bio"],
      [skills, "Skills"]
    ]) {
      if (fieldVal !== void 0 && typeof fieldVal !== "string") {
        res.status(400).json({ error: `${label} must be a valid text string.` });
        return;
      }
    }
    const nextName = typeof name === "string" && name.trim() ? name.trim() : existing.user.name;
    const nextDept = typeof department === "string" ? department.trim() : existing.user.department;
    const nextYear = typeof year === "string" ? year.trim() : existing.studentProfile?.year || "";
    const nextSection = typeof section === "string" ? section.trim().toUpperCase() : existing.studentProfile?.section || "";
    const nextPhone = typeof phone === "string" ? phone.trim() : existing.user.phone;
    const nextBio = typeof bio === "string" ? bio.trim() : existing.user.bio;
    const nextSkills = typeof skills === "string" ? skills.trim() : existing.user.skills;
    const nextCgpaNum = cgpa !== void 0 ? Math.max(0, Math.min(10, Number(cgpa) || 0)) : existing.studentProfile ? Number(existing.studentProfile.cgpa) : 0;
    let nextBatch = existing.user.batchOrDesignation;
    if (typeof batchOrDesignation === "string" && batchOrDesignation.trim()) {
      nextBatch = batchOrDesignation.trim();
    } else if (year !== void 0 || section !== void 0 || department !== void 0) {
      const deptLabel = nextDept || "CSE";
      nextBatch = nextYear ? `${nextYear} B.Tech ${deptLabel}${nextSection ? ` \xB7 Section ${nextSection}` : ""}` : deptLabel;
    }
    const emailChanged = nextEmail !== existing.user.email;
    const nameChanged = nextName !== existing.user.name;
    const activeChanged = nextIsActive !== existing.user.isActive;
    if (emailChanged) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        res.status(400).json({ error: "Please enter a valid email address." });
        return;
      }
      const [dupEmail] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(
        and2(
          sql3`lower(${schema_exports.users.email}) = lower(${nextEmail})`,
          sql3`${schema_exports.users.id} <> ${id}`
        )
      ).limit(1);
      if (dupEmail) {
        res.status(409).json({ error: "Another user account already uses this email address." });
        return;
      }
    }
    if (emailChanged || nameChanged || activeChanged) {
      const authUpdate = await updateSupabaseAuthUser(id, {
        ...emailChanged ? { email: nextEmail } : {},
        ...nameChanged ? { name: nextName, memberId: existing.user.memberId } : {},
        ...activeChanged ? { banned: !nextIsActive } : {}
      });
      if (authUpdate.error) {
        res.status(400).json({ error: authUpdate.error });
        return;
      }
    }
    try {
      await db.transaction(async (tx) => {
        await tx.update(schema_exports.users).set({
          name: nextName,
          email: nextEmail,
          department: nextDept,
          phone: nextPhone,
          bio: nextBio,
          skills: nextSkills,
          batchOrDesignation: nextBatch,
          isActive: nextIsActive
        }).where(and2(eq2(schema_exports.users.id, id), eq2(schema_exports.users.role, "student")));
        await tx.insert(schema_exports.studentProfiles).values({
          userId: id,
          year: nextYear,
          section: nextSection,
          cgpa: nextCgpaNum.toFixed(2)
        }).onConflictDoUpdate({
          target: schema_exports.studentProfiles.userId,
          set: {
            year: nextYear,
            section: nextSection,
            cgpa: nextCgpaNum.toFixed(2)
          }
        });
      });
    } catch (err) {
      if (emailChanged || nameChanged || activeChanged) {
        await updateSupabaseAuthUser(id, {
          email: existing.user.email,
          name: existing.user.name,
          memberId: existing.user.memberId,
          banned: !existing.user.isActive
        });
      }
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: "Another user account already uses this email address." });
        return;
      }
      throw err;
    }
    const updatedRecord = await getUserWithProfilesById(db, id);
    res.json({
      ok: true,
      student: toPublicProfile(updatedRecord, { includePhone: true })
    });
  }
  app.put(
    "/api/admin/students/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      await handleStaffStudentUpdate(req, res);
    })
  );
  app.put(
    "/api/students/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      await handleStaffStudentUpdate(req, res);
    })
  );
  app.post(
    "/api/students/:id/verify-coding-owner",
    requireAuth,
    asyncHandler(async (req, res) => {
      const actor = req.userRecord.user;
      if (actor.role !== "faculty" && actor.role !== "admin") {
        res.status(403).json({
          error: "Only Faculty or Administrator coordinators can verify coding handle ownership."
        });
        return;
      }
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Student account not found." });
        return;
      }
      const { platform, verified } = req.body;
      if (platform !== "leetcode" && platform !== "hackerrank" && platform !== "github") {
        res.status(400).json({ error: "Platform must be leetcode, hackerrank, or github." });
        return;
      }
      if (typeof verified !== "boolean") {
        res.status(400).json({ error: "Verified status must be a boolean." });
        return;
      }
      const db = requireDb();
      const existing = await getUserWithProfilesById(db, id);
      if (!existing || existing.user.role !== "student") {
        res.status(404).json({ error: "Student account not found." });
        return;
      }
      const sp = existing.studentProfile;
      const handleForPlatform = platform === "leetcode" ? sp?.leetcodeUsername || "" : platform === "hackerrank" ? sp?.hackerrankUsername || "" : sp?.githubUsername || "";
      if (verified && !handleForPlatform) {
        res.status(400).json({
          error: `Student has not linked a valid ${platform} handle yet.`
        });
        return;
      }
      const nextTimestamp = verified ? /* @__PURE__ */ new Date() : null;
      const updateFields = platform === "leetcode" ? { leetcodeOwnerVerifiedAt: nextTimestamp } : platform === "hackerrank" ? { hackerrankOwnerVerifiedAt: nextTimestamp } : { githubOwnerVerifiedAt: nextTimestamp };
      await db.update(schema_exports.studentProfiles).set(updateFields).where(eq2(schema_exports.studentProfiles.userId, id));
      const updatedRecord = await getUserWithProfilesById(db, id);
      res.json({
        ok: true,
        student: toPublicProfile(updatedRecord, { includePhone: true })
      });
    })
  );
  app.post(
    "/api/auth/logout",
    asyncHandler(async (req, res) => {
      const token = extractBearerToken(req);
      if (token) {
        await signOutSupabaseJwt(token);
      }
      res.json({ ok: true });
    })
  );
  app.get(
    "/api/auth/me",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const record = req.userRecord;
      const progress = await computeUserProgress(db, record.user.id);
      res.json({
        profile: toPublicProfile(record, { includePhone: true }),
        progress
      });
    })
  );
  app.get("/api/auth/staff-accounts", (_req, res) => {
    res.status(410).json({ error: "Legacy staff account directory disabled. Please use role-based login." });
  });
  app.post("/api/auth/staff-login", (_req, res) => {
    res.status(410).json({ error: "Legacy PIN login disabled. Please sign in with your registered credentials." });
  });
  app.post("/api/auth/setup-admin-pin", (_req, res) => {
    res.status(410).json({ error: "Legacy PIN setup disabled. Please use Admin Login / One-Time Setup." });
  });
  app.post("/api/auth/add-coordinator", (_req, res) => {
    res.status(410).json({ error: "Legacy endpoint disabled. Manage faculty from the Admin Dashboard." });
  });
  app.post("/api/auth/remove-coordinator", (_req, res) => {
    res.status(410).json({ error: "Legacy endpoint disabled. Manage faculty from the Admin Dashboard." });
  });
  app.put(
    "/api/profile",
    requireAuth,
    codingVerificationRateLimiter,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const record = req.userRecord;
      const user = record.user;
      const sp = record.studentProfile;
      const fp = record.facultyProfile;
      const ap = record.adminProfile;
      const {
        name,
        email,
        department,
        phone,
        batchOrDesignation,
        year,
        section,
        cgpa,
        designation,
        specialization,
        qualification,
        experienceYears,
        bio,
        skills,
        leetcodeUrl,
        hackerrankUrl,
        githubUrl,
        syncCodingLinks
      } = req.body;
      if (typeof name === "string" && !name.trim()) {
        res.status(400).json({ error: "Full Name cannot be empty." });
        return;
      }
      const nextName = typeof name === "string" && name.trim() ? name.trim() : user.name;
      const nextDept = typeof department === "string" ? department.trim() : user.department;
      const nextPhone = typeof phone === "string" ? phone.trim() : user.phone;
      const nextBio = typeof bio === "string" ? bio.trim() : user.bio;
      const nextSkills = typeof skills === "string" ? skills.trim() : user.skills;
      let nextEmail = user.email;
      if (typeof email === "string" && email.trim() && email.trim().toLowerCase() !== user.email) {
        if (user.role !== "admin") {
          res.status(403).json({
            error: "Only Administrators can change their own login email from profile settings."
          });
          return;
        }
        nextEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
          res.status(400).json({ error: "Please enter a valid email address." });
          return;
        }
        const [dupEmail] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(
          and2(
            sql3`lower(${schema_exports.users.email}) = lower(${nextEmail})`,
            sql3`${schema_exports.users.id} <> ${user.id}`
          )
        ).limit(1);
        if (dupEmail) {
          res.status(409).json({ error: "Another account already uses this email address." });
          return;
        }
      }
      if (year !== void 0 && typeof year !== "string") {
        res.status(400).json({ error: "Year must be a valid text string." });
        return;
      }
      if (section !== void 0 && typeof section !== "string") {
        res.status(400).json({ error: "Section must be a valid text string." });
        return;
      }
      if (leetcodeUrl !== void 0 && typeof leetcodeUrl !== "string") {
        res.status(400).json({ error: "LeetCode URL must be a valid text string." });
        return;
      }
      if (hackerrankUrl !== void 0 && typeof hackerrankUrl !== "string") {
        res.status(400).json({ error: "HackerRank URL must be a valid text string." });
        return;
      }
      if (githubUrl !== void 0 && typeof githubUrl !== "string") {
        res.status(400).json({ error: "GitHub URL must be a valid text string." });
        return;
      }
      if (specialization !== void 0 && typeof specialization !== "string") {
        res.status(400).json({ error: "Specialization must be a valid text string." });
        return;
      }
      if (qualification !== void 0 && typeof qualification !== "string") {
        res.status(400).json({ error: "Qualification must be a valid text string." });
        return;
      }
      if (designation !== void 0 && typeof designation !== "string") {
        res.status(400).json({ error: "Designation must be a valid text string." });
        return;
      }
      if (batchOrDesignation !== void 0 && typeof batchOrDesignation !== "string") {
        res.status(400).json({ error: "Batch or designation must be a valid text string." });
        return;
      }
      const nextYear = typeof year === "string" ? year.trim() : sp?.year || "";
      const nextSection = typeof section === "string" ? section.trim().toUpperCase() : sp?.section || "";
      const nextDesignation = typeof designation === "string" && designation.trim() ? designation.trim() : fp?.designation || ap?.title || user.batchOrDesignation.split(",")[0]?.trim() || (user.role === "faculty" ? "Faculty" : "System Administrator");
      const nextSpecialization = typeof specialization === "string" ? specialization.trim() : fp?.specialization || nextDept || "CSE";
      const nextQualification = typeof qualification === "string" ? qualification.trim() : fp?.qualification || "M.Tech / Ph.D";
      const parsedExp = Number(experienceYears);
      const nextExperienceYears = experienceYears !== void 0 ? Math.max(0, Math.min(60, Number.isFinite(parsedExp) ? parsedExp : 0)) : fp?.experienceYears ?? 5;
      let nextBatch = typeof batchOrDesignation === "string" && batchOrDesignation.trim() ? batchOrDesignation.trim() : user.batchOrDesignation;
      if (user.role === "student") {
        if (typeof batchOrDesignation !== "string" && (year !== void 0 || section !== void 0 || department !== void 0)) {
          const deptLabel = nextDept || "CSE";
          nextBatch = nextYear ? `${nextYear} B.Tech ${deptLabel}${nextSection ? ` \xB7 Section ${nextSection}` : ""}` : deptLabel;
        }
      } else if (user.role === "faculty") {
        if (typeof batchOrDesignation !== "string" && (designation !== void 0 || department !== void 0)) {
          nextBatch = `${nextDesignation}, ${nextDept || "CSE"}`;
        } else if (typeof batchOrDesignation === "string" && batchOrDesignation.trim() && designation === void 0) {
        }
      }
      let studentProfileUpdatePayload = null;
      let syncWarnings = [];
      if (user.role === "student") {
        if (cgpa !== void 0) {
          res.status(403).json({
            error: "Students cannot modify their own CGPA. Please contact Faculty or Admin to update verified CGPA."
          });
          return;
        }
        const preservedCgpa = sp ? sp.cgpa : "0.00";
        const currentLeetUrl = sp?.leetcodeUrl || "";
        const currentHrUrl = sp?.hackerrankUrl || "";
        const currentGhUrl = sp?.githubUrl || "";
        const nextLeetUrl = typeof leetcodeUrl === "string" ? leetcodeUrl.trim() : currentLeetUrl;
        const nextHrUrl = typeof hackerrankUrl === "string" ? hackerrankUrl.trim() : currentHrUrl;
        const nextGhUrl = typeof githubUrl === "string" ? githubUrl.trim() : currentGhUrl;
        const urlsChanged = nextLeetUrl !== currentLeetUrl || nextHrUrl !== currentHrUrl || nextGhUrl !== currentGhUrl;
        let leetcodeUsername = sp?.leetcodeUsername || "";
        let hackerrankUsername = sp?.hackerrankUsername || "";
        let githubUsername = sp?.githubUsername || "";
        let leetcodeSolved = sp?.leetcodeSolved || 0;
        let leetcodeEasy = sp?.leetcodeEasy || 0;
        let leetcodeMedium = sp?.leetcodeMedium || 0;
        let leetcodeHard = sp?.leetcodeHard || 0;
        let hackerrankFiveStars = sp?.hackerrankFiveStars || 0;
        let githubProjects = sp?.githubProjects || 0;
        let lastSyncedAt = sp?.lastSyncedAt || null;
        let leetcodeVerifiedAt = sp?.leetcodeVerifiedAt ?? null;
        let hackerrankVerifiedAt = sp?.hackerrankVerifiedAt ?? null;
        let githubVerifiedAt = sp?.githubVerifiedAt ?? null;
        let leetcodeOwnerVerifiedAt = sp?.leetcodeOwnerVerifiedAt ?? null;
        let hackerrankOwnerVerifiedAt = sp?.hackerrankOwnerVerifiedAt ?? null;
        let githubOwnerVerifiedAt = sp?.githubOwnerVerifiedAt ?? null;
        if (leetcodeUrl !== void 0 || urlsChanged || syncCodingLinks) {
          const parsedLeet = parseCodingPlatformInput(nextLeetUrl, "leetcode");
          if (!parsedLeet.ok && (leetcodeUrl !== void 0 || syncCodingLinks)) {
            res.status(400).json({ error: parsedLeet.error });
            return;
          }
          const parsedHr = parseCodingPlatformInput(nextHrUrl, "hackerrank");
          if (!parsedHr.ok && (hackerrankUrl !== void 0 || syncCodingLinks)) {
            res.status(400).json({ error: parsedHr.error });
            return;
          }
          const parsedGh = parseCodingPlatformInput(nextGhUrl, "github");
          if (!parsedGh.ok && (githubUrl !== void 0 || syncCodingLinks)) {
            res.status(400).json({ error: parsedGh.error });
            return;
          }
          if (syncCodingLinks || urlsChanged) {
            const nextLeetUsername = parsedLeet.ok ? parsedLeet.username : "";
            const nextHrUsername = parsedHr.ok ? parsedHr.username : "";
            const nextGhUsername = parsedGh.ok ? parsedGh.username : "";
            const lcHandleChanged = nextLeetUsername.toLowerCase() !== (sp?.leetcodeUsername || "").toLowerCase();
            const hrHandleChanged = nextHrUsername.toLowerCase() !== (sp?.hackerrankUsername || "").toLowerCase();
            const ghHandleChanged = nextGhUsername.toLowerCase() !== (sp?.githubUsername || "").toLowerCase();
            const hasAnyHandleToSync = Boolean(
              nextLeetUsername || nextHrUsername || nextGhUsername
            );
            if (!hasAnyHandleToSync) {
              leetcodeUsername = "";
              hackerrankUsername = "";
              githubUsername = "";
              leetcodeSolved = 0;
              leetcodeEasy = 0;
              leetcodeMedium = 0;
              leetcodeHard = 0;
              hackerrankFiveStars = 0;
              githubProjects = 0;
              lastSyncedAt = null;
              leetcodeVerifiedAt = null;
              hackerrankVerifiedAt = null;
              githubVerifiedAt = null;
              leetcodeOwnerVerifiedAt = null;
              hackerrankOwnerVerifiedAt = null;
              githubOwnerVerifiedAt = null;
            } else {
              const cooldownCutoff = new Date(Date.now() - CODING_SYNC_COOLDOWN_MS);
              const syncAttemptNow = /* @__PURE__ */ new Date();
              if (!sp) {
                await db.insert(schema_exports.studentProfiles).values({
                  userId: user.id,
                  year: nextYear,
                  section: nextSection,
                  cgpa: preservedCgpa
                }).onConflictDoNothing({ target: schema_exports.studentProfiles.userId });
              }
              const claimedSyncRows = await db.update(schema_exports.studentProfiles).set({ codingSyncAttemptedAt: syncAttemptNow }).where(
                and2(
                  eq2(schema_exports.studentProfiles.userId, user.id),
                  or2(
                    isNull2(schema_exports.studentProfiles.codingSyncAttemptedAt),
                    sql3`${schema_exports.studentProfiles.codingSyncAttemptedAt} <= ${cooldownCutoff}`
                  )
                )
              ).returning({ userId: schema_exports.studentProfiles.userId });
              const canPerformLiveSync = claimedSyncRows.length > 0;
              const isPureCodingSyncRequest = name === void 0 && department === void 0 && phone === void 0 && bio === void 0 && skills === void 0 && year === void 0 && section === void 0;
              if (!canPerformLiveSync) {
                if (urlsChanged || isPureCodingSyncRequest) {
                  res.status(429).json({
                    error: "Please wait 15 seconds before syncing coding profiles again."
                  });
                  return;
                }
                syncWarnings.push(
                  "Coding stats were not re-synced because a sync ran less than 15 seconds ago; existing stats were preserved."
                );
              } else {
                leetcodeUsername = nextLeetUsername;
                hackerrankUsername = nextHrUsername;
                githubUsername = nextGhUsername;
                if (lcHandleChanged) {
                  leetcodeVerifiedAt = null;
                  leetcodeOwnerVerifiedAt = null;
                }
                if (hrHandleChanged) {
                  hackerrankVerifiedAt = null;
                  hackerrankOwnerVerifiedAt = null;
                }
                if (ghHandleChanged) {
                  githubVerifiedAt = null;
                  githubOwnerVerifiedAt = null;
                }
                const [liveLc, liveHr, liveGh] = await Promise.all([
                  leetcodeUsername ? fetchLeetcodeCounts(leetcodeUsername) : Promise.resolve({
                    status: "empty",
                    total: 0,
                    easy: 0,
                    medium: 0,
                    hard: 0
                  }),
                  hackerrankUsername ? fetchHackerrankFiveStars(hackerrankUsername) : Promise.resolve({ status: "empty", count: 0 }),
                  githubUsername ? fetchGithubRepoCount(githubUsername) : Promise.resolve({ status: "empty", count: 0 })
                ]);
                const verifiedAtNow = /* @__PURE__ */ new Date();
                let anyLiveVerified = false;
                if (liveLc.status === "empty") {
                  leetcodeSolved = 0;
                  leetcodeEasy = 0;
                  leetcodeMedium = 0;
                  leetcodeHard = 0;
                  leetcodeVerifiedAt = null;
                  leetcodeOwnerVerifiedAt = null;
                } else if (liveLc.status === "ok") {
                  leetcodeSolved = liveLc.total;
                  leetcodeEasy = liveLc.easy;
                  leetcodeMedium = liveLc.medium;
                  leetcodeHard = liveLc.hard;
                  leetcodeVerifiedAt = verifiedAtNow;
                  anyLiveVerified = true;
                } else if (liveLc.status === "not_found") {
                  leetcodeSolved = 0;
                  leetcodeEasy = 0;
                  leetcodeMedium = 0;
                  leetcodeHard = 0;
                  leetcodeVerifiedAt = null;
                  leetcodeOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `LeetCode profile "@${leetcodeUsername}" was not found; LeetCode stats set to 0.`
                  );
                } else if (lcHandleChanged) {
                  leetcodeSolved = 0;
                  leetcodeEasy = 0;
                  leetcodeMedium = 0;
                  leetcodeHard = 0;
                  leetcodeVerifiedAt = null;
                  leetcodeOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `LeetCode verification is temporarily unavailable for "@${leetcodeUsername}"; stats set to 0 until verified.`
                  );
                } else {
                  leetcodeVerifiedAt = sp?.leetcodeVerifiedAt ?? null;
                  leetcodeOwnerVerifiedAt = sp?.leetcodeOwnerVerifiedAt ?? null;
                  syncWarnings.push(
                    `LeetCode is temporarily unavailable; existing stats for "@${leetcodeUsername}" were preserved.`
                  );
                }
                if (liveHr.status === "empty") {
                  hackerrankFiveStars = 0;
                  hackerrankVerifiedAt = null;
                  hackerrankOwnerVerifiedAt = null;
                } else if (liveHr.status === "ok") {
                  hackerrankFiveStars = liveHr.count;
                  hackerrankVerifiedAt = verifiedAtNow;
                  anyLiveVerified = true;
                } else if (liveHr.status === "not_found") {
                  hackerrankFiveStars = 0;
                  hackerrankVerifiedAt = null;
                  hackerrankOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `HackerRank profile "@${hackerrankUsername}" was not found; HackerRank 5-star badges set to 0.`
                  );
                } else if (hrHandleChanged) {
                  hackerrankFiveStars = 0;
                  hackerrankVerifiedAt = null;
                  hackerrankOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `HackerRank verification is temporarily unavailable for "@${hackerrankUsername}"; badge count set to 0 until verified.`
                  );
                } else {
                  hackerrankVerifiedAt = sp?.hackerrankVerifiedAt ?? null;
                  hackerrankOwnerVerifiedAt = sp?.hackerrankOwnerVerifiedAt ?? null;
                  syncWarnings.push(
                    `HackerRank is temporarily unavailable; existing badge count for "@${hackerrankUsername}" was preserved.`
                  );
                }
                if (liveGh.status === "empty") {
                  githubProjects = 0;
                  githubVerifiedAt = null;
                  githubOwnerVerifiedAt = null;
                } else if (liveGh.status === "ok") {
                  githubProjects = liveGh.count;
                  githubVerifiedAt = verifiedAtNow;
                  anyLiveVerified = true;
                } else if (liveGh.status === "not_found") {
                  githubProjects = 0;
                  githubVerifiedAt = null;
                  githubOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `GitHub profile "@${githubUsername}" was not found; GitHub project count set to 0.`
                  );
                } else if (ghHandleChanged) {
                  githubProjects = 0;
                  githubVerifiedAt = null;
                  githubOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `GitHub verification is temporarily unavailable for "@${githubUsername}"; project count set to 0 until verified.`
                  );
                } else {
                  githubVerifiedAt = sp?.githubVerifiedAt ?? null;
                  githubOwnerVerifiedAt = sp?.githubOwnerVerifiedAt ?? null;
                  syncWarnings.push(
                    `GitHub is temporarily unavailable; existing project count for "@${githubUsername}" was preserved.`
                  );
                }
                if (anyLiveVerified) {
                  lastSyncedAt = verifiedAtNow;
                }
              }
            }
          }
        }
        studentProfileUpdatePayload = {
          year: nextYear,
          section: nextSection,
          cgpa: preservedCgpa,
          leetcodeUrl: nextLeetUrl,
          leetcodeUsername,
          leetcodeSolved,
          leetcodeEasy,
          leetcodeMedium,
          leetcodeHard,
          hackerrankUrl: nextHrUrl,
          hackerrankUsername,
          hackerrankFiveStars,
          githubUrl: nextGhUrl,
          githubUsername,
          githubProjects,
          lastSyncedAt,
          leetcodeVerifiedAt,
          hackerrankVerifiedAt,
          githubVerifiedAt,
          leetcodeOwnerVerifiedAt,
          hackerrankOwnerVerifiedAt,
          githubOwnerVerifiedAt
        };
      }
      const authEmailChanged = nextEmail !== user.email;
      const authNameChanged = nextName !== user.name;
      if (authEmailChanged || authNameChanged) {
        const authUpdate = await updateSupabaseAuthUser(user.id, {
          ...authEmailChanged ? { email: nextEmail } : {},
          ...authNameChanged ? { name: nextName, memberId: user.memberId } : {}
        });
        if (authUpdate.error) {
          res.status(400).json({ error: authUpdate.error });
          return;
        }
      }
      try {
        await db.transaction(async (tx) => {
          await tx.update(schema_exports.users).set({
            name: nextName,
            email: nextEmail,
            department: nextDept,
            phone: nextPhone,
            batchOrDesignation: nextBatch,
            bio: nextBio,
            skills: nextSkills
          }).where(eq2(schema_exports.users.id, user.id));
          if (user.role === "student" && studentProfileUpdatePayload) {
            await tx.insert(schema_exports.studentProfiles).values({
              userId: user.id,
              ...studentProfileUpdatePayload
            }).onConflictDoUpdate({
              target: schema_exports.studentProfiles.userId,
              set: studentProfileUpdatePayload
            });
          } else if (user.role === "faculty") {
            await tx.insert(schema_exports.facultyProfiles).values({
              userId: user.id,
              designation: nextDesignation,
              specialization: nextSpecialization,
              qualification: nextQualification,
              experienceYears: nextExperienceYears,
              phoneOrCabin: nextPhone
            }).onConflictDoUpdate({
              target: schema_exports.facultyProfiles.userId,
              set: {
                designation: nextDesignation,
                specialization: nextSpecialization,
                qualification: nextQualification,
                experienceYears: nextExperienceYears,
                phoneOrCabin: nextPhone
              }
            });
            await tx.update(schema_exports.facultyDirectory).set({
              name: nextName,
              designation: nextDesignation,
              specialization: nextSpecialization,
              phoneOrCabin: nextPhone,
              qualification: nextQualification,
              experienceYears: nextExperienceYears,
              bio: nextBio
            }).where(eq2(schema_exports.facultyDirectory.linkedUserId, user.id));
          } else if (user.role === "admin") {
            await tx.insert(schema_exports.adminProfiles).values({
              userId: user.id,
              title: nextBatch || nextDesignation
            }).onConflictDoUpdate({
              target: schema_exports.adminProfiles.userId,
              set: {
                title: nextBatch || nextDesignation
              }
            });
          }
        });
      } catch (err) {
        if (authEmailChanged || authNameChanged) {
          await updateSupabaseAuthUser(user.id, {
            email: user.email,
            name: user.name,
            memberId: user.memberId
          });
        }
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: "Another account already uses this email address." });
          return;
        }
        throw err;
      }
      const refreshed = await getUserWithProfilesById(db, user.id);
      const progress = await computeUserProgress(db, user.id);
      res.json({
        profile: toPublicProfile(refreshed, { includePhone: true }),
        progress,
        ...syncWarnings.length > 0 ? { syncWarnings } : {}
      });
    })
  );
  app.post(
    "/api/profile/coding-ownership/challenge",
    requireAuth,
    codingVerificationRateLimiter,
    asyncHandler(async (req, res) => {
      const record = req.userRecord;
      const user = record.user;
      if (user.role !== "student") {
        res.status(403).json({
          error: "Coding profile ownership verification applies only to Student accounts."
        });
        return;
      }
      const { platform } = req.body;
      if (platform !== "leetcode" && platform !== "hackerrank" && platform !== "github") {
        res.status(400).json({ error: "Platform must be leetcode, hackerrank, or github." });
        return;
      }
      const sp = record.studentProfile;
      const storedUrl = platform === "leetcode" ? sp?.leetcodeUrl || "" : platform === "hackerrank" ? sp?.hackerrankUrl || "" : sp?.githubUrl || "";
      const storedHandle = platform === "leetcode" ? sp?.leetcodeUsername || "" : platform === "hackerrank" ? sp?.hackerrankUsername || "" : sp?.githubUsername || "";
      const parsed = storedUrl ? parseCodingPlatformInput(storedUrl, platform) : storedHandle ? parseCodingPlatformInput(storedHandle, platform) : { ok: true, username: "" };
      const handle = parsed.ok ? parsed.username : "";
      if (!handle) {
        res.status(400).json({
          error: `Please save and sync a valid ${platform} profile URL in Edit Profile first.`
        });
        return;
      }
      const expSec = Math.floor(Date.now() / 1e3) + CODING_OWNER_CODE_TTL_SEC;
      const verificationCode = signCodingOwnershipCode(user.id, platform, handle, expSec);
      const instructions = platform === "github" ? `Add "${verificationCode}" anywhere in your GitHub profile Bio (github.com/settings/profile), save it, and click Check Bio & Verify.` : platform === "leetcode" ? `Add "${verificationCode}" anywhere in your LeetCode Summary / Bio (leetcode.com/profile), save it, and click Check Bio & Verify.` : `Add "${verificationCode}" to your HackerRank public About / Bio or Website headline, save it, and click Check Bio & Verify. (If HackerRank rate-limits automated checks, ask Faculty/Admin to verify your handle.)`;
      res.json({
        platform,
        username: handle,
        verificationCode,
        expiresAt: new Date(expSec * 1e3).toISOString(),
        instructions
      });
    })
  );
  app.post(
    "/api/profile/coding-ownership/verify",
    requireAuth,
    codingVerificationRateLimiter,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const record = req.userRecord;
      const user = record.user;
      if (user.role !== "student") {
        res.status(403).json({
          error: "Coding profile ownership verification applies only to Student accounts."
        });
        return;
      }
      const { platform, verificationCode } = req.body;
      if (platform !== "leetcode" && platform !== "hackerrank" && platform !== "github") {
        res.status(400).json({ error: "Platform must be leetcode, hackerrank, or github." });
        return;
      }
      const sp = record.studentProfile;
      const storedUrl = platform === "leetcode" ? sp?.leetcodeUrl || "" : platform === "hackerrank" ? sp?.hackerrankUrl || "" : sp?.githubUrl || "";
      const storedHandle = platform === "leetcode" ? sp?.leetcodeUsername || "" : platform === "hackerrank" ? sp?.hackerrankUsername || "" : sp?.githubUsername || "";
      const parsed = storedUrl ? parseCodingPlatformInput(storedUrl, platform) : storedHandle ? parseCodingPlatformInput(storedHandle, platform) : { ok: true, username: "" };
      const handle = parsed.ok ? parsed.username : "";
      if (!handle) {
        res.status(400).json({
          error: `Please save and sync a valid ${platform} profile URL before verifying ownership.`
        });
        return;
      }
      const sigCheck = verifyCodingOwnershipCodeSignature(
        user.id,
        platform,
        handle,
        verificationCode
      );
      if (!sigCheck.ok) {
        res.status(400).json({ error: sigCheck.error });
        return;
      }
      const cleanCode = sigCheck.normalizedCode;
      const bioResult = await fetchCodingProfileBio(platform, handle);
      if (bioResult.status === "not_found") {
        const clearFields = platform === "leetcode" ? {
          leetcodeSolved: 0,
          leetcodeEasy: 0,
          leetcodeMedium: 0,
          leetcodeHard: 0,
          leetcodeVerifiedAt: null,
          leetcodeOwnerVerifiedAt: null
        } : platform === "hackerrank" ? {
          hackerrankFiveStars: 0,
          hackerrankVerifiedAt: null,
          hackerrankOwnerVerifiedAt: null
        } : {
          githubProjects: 0,
          githubVerifiedAt: null,
          githubOwnerVerifiedAt: null
        };
        await db.update(schema_exports.studentProfiles).set(clearFields).where(eq2(schema_exports.studentProfiles.userId, user.id));
        res.status(404).json({
          error: `Public ${platform} profile "@${handle}" was not found. Please check your URL in My Profile.`
        });
        return;
      }
      if (bioResult.status !== "ok") {
        res.status(503).json({
          error: `Could not retrieve your public ${platform} bio right now. Please retry shortly or request Faculty/Admin coordinator verification.`
        });
        return;
      }
      if (!bioResult.bioText.toUpperCase().includes(cleanCode)) {
        res.status(400).json({
          error: `Verification code "${cleanCode}" was not found in "@${handle}"'s public ${platform} bio yet. Save the bio publicly, wait a few seconds, and retry.`
        });
        return;
      }
      const verifiedNow = /* @__PURE__ */ new Date();
      const ownerFields = platform === "leetcode" ? { leetcodeUsername: handle, leetcodeOwnerVerifiedAt: verifiedNow } : platform === "hackerrank" ? { hackerrankUsername: handle, hackerrankOwnerVerifiedAt: verifiedNow } : { githubUsername: handle, githubOwnerVerifiedAt: verifiedNow };
      await db.update(schema_exports.studentProfiles).set(ownerFields).where(eq2(schema_exports.studentProfiles.userId, user.id));
      markCodingChallengeConsumed(user.id, platform, cleanCode, sigCheck.expSec);
      const refreshed = await getUserWithProfilesById(db, user.id);
      const progress = await computeUserProgress(db, user.id);
      res.json({
        ok: true,
        platform,
        message: `${platform} handle "@${handle}" ownership verified! You can remove the code from your bio now if you wish.`,
        profile: toPublicProfile(refreshed, { includePhone: true }),
        progress
      });
    })
  );
  app.get(
    "/api/students/search",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const query = String(req.query.q || "");
      const actorRole = req.userRecord.user.role;
      const results = await searchStudentsDirectory(db, query, {
        includePhone: actorRole === "faculty" || actorRole === "admin"
      });
      res.json({ results });
    })
  );
  app.post(
    "/api/notifications/read",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const userId = req.userRecord.user.id;
      const { notificationId } = req.body;
      if (notificationId) {
        const validId = parseUuidParam(notificationId);
        if (!validId) {
          res.status(400).json({ error: "Invalid notification ID." });
          return;
        }
        const [visibleNotif] = await db.select({ id: schema_exports.notifications.id }).from(schema_exports.notifications).where(
          and2(
            eq2(schema_exports.notifications.id, validId),
            or2(
              isNull2(schema_exports.notifications.recipientUserId),
              eq2(schema_exports.notifications.recipientUserId, userId)
            )
          )
        ).limit(1);
        if (!visibleNotif) {
          res.status(404).json({ error: "Notification not found." });
          return;
        }
        await db.insert(schema_exports.notificationReads).values({ notificationId: validId, userId }).onConflictDoNothing();
      } else {
        const visible = await db.select({ id: schema_exports.notifications.id }).from(schema_exports.notifications).where(
          or2(
            isNull2(schema_exports.notifications.recipientUserId),
            eq2(schema_exports.notifications.recipientUserId, userId)
          )
        );
        if (visible.length > 0) {
          await db.insert(schema_exports.notificationReads).values(visible.map((n) => ({ notificationId: n.id, userId }))).onConflictDoNothing();
        }
      }
      res.json({ ok: true });
    })
  );
  app.get(
    "/api/reminders",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const reminders = await getPersonalRemindersForUser(db, req.userRecord.user.id);
      res.json({ reminders });
    })
  );
  app.post(
    "/api/reminders",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const user = req.userRecord.user;
      const { title, note, dueDate, category, priority } = req.body;
      if (typeof title !== "string" || !title.trim()) {
        res.status(400).json({ error: "Reminder title is required." });
        return;
      }
      const validCategories = [
        "problem_statement",
        "placement",
        "hackathon",
        "interview",
        "exam_lab",
        "general"
      ];
      const safeCategory = validCategories.includes(
        typeof category === "string" ? category : ""
      ) ? category : "general";
      const safePriority = priority === "High" ? "High" : priority === "Low" ? "Low" : "Normal";
      const [created] = await db.insert(schema_exports.personalReminders).values({
        userId: user.id,
        title: title.trim(),
        note: typeof note === "string" ? note.trim() : "",
        dueDate: typeof dueDate === "string" ? dueDate.trim() : "",
        category: safeCategory,
        priority: safePriority,
        completed: false
      }).returning();
      res.status(201).json(mapReminderRow(created));
    })
  );
  app.patch(
    "/api/reminders/:id/toggle",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Reminder not found." });
        return;
      }
      const db = requireDb();
      const userId = req.userRecord.user.id;
      const [existing] = await db.select().from(schema_exports.personalReminders).where(
        and2(
          eq2(schema_exports.personalReminders.id, id),
          eq2(schema_exports.personalReminders.userId, userId)
        )
      ).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Reminder not found." });
        return;
      }
      const [updated] = await db.update(schema_exports.personalReminders).set({ completed: !existing.completed }).where(eq2(schema_exports.personalReminders.id, id)).returning();
      res.json(mapReminderRow(updated));
    })
  );
  app.delete(
    "/api/reminders/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Reminder not found." });
        return;
      }
      const db = requireDb();
      const deleted = await db.delete(schema_exports.personalReminders).where(
        and2(
          eq2(schema_exports.personalReminders.id, id),
          eq2(schema_exports.personalReminders.userId, req.userRecord.user.id)
        )
      ).returning({ id: schema_exports.personalReminders.id });
      if (deleted.length === 0) {
        res.status(404).json({ error: "Reminder not found." });
        return;
      }
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/spotlights",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.userRecord.user;
      if (user.role !== "admin" && !(user.role === "faculty" && user.canManageSpotlights)) {
        res.status(403).json({
          error: "Only Admin and authorized Faculty coordinators can publish Dashboard Spotlights."
        });
        return;
      }
      const { category, headlineValue, title, recipients, description } = req.body;
      if (typeof headlineValue !== "string" || !headlineValue.trim() || typeof title !== "string" || !title.trim()) {
        res.status(400).json({ error: "Headline amount/prize and title are required." });
        return;
      }
      const db = requireDb();
      const [inserted] = await db.insert(schema_exports.spotlights).values({
        category: typeof category === "string" && category.trim() ? category.trim() : "Department Spotlight",
        headlineValue: headlineValue.trim(),
        title: title.trim(),
        recipients: typeof recipients === "string" ? recipients.trim() : "",
        description: typeof description === "string" ? description.trim() : "",
        authorId: user.id,
        authorNameSnapshot: user.name
      }).returning();
      const item = await getSpotlightById(db, inserted.id);
      res.status(201).json(item);
    })
  );
  app.put(
    "/api/spotlights/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.userRecord.user;
      if (user.role !== "admin" && !(user.role === "faculty" && user.canManageSpotlights)) {
        res.status(403).json({ error: "Not authorized to edit Dashboard Spotlights." });
        return;
      }
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Spotlight not found." });
        return;
      }
      const { category, headlineValue, title, recipients, description } = req.body;
      const db = requireDb();
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx.select().from(schema_exports.spotlights).where(eq2(schema_exports.spotlights.id, id)).limit(1);
        if (!existing) {
          return { status: 404, error: "Spotlight not found." };
        }
        if (user.role !== "admin" && existing.authorId !== user.id) {
          return {
            status: 403,
            error: "Only the original author or Admin can edit this Dashboard Spotlight."
          };
        }
        const nextCategory = asNonEmptyTrimmedString(category, existing.category);
        const nextHeadline = asNonEmptyTrimmedString(headlineValue, existing.headlineValue);
        const nextTitle = asNonEmptyTrimmedString(title, existing.title);
        const nextRecipients = asNonEmptyTrimmedString(recipients, existing.recipients);
        const nextDescription = asNonEmptyTrimmedString(description, existing.description);
        if (nextCategory === null || nextHeadline === null || nextTitle === null || nextRecipients === null || nextDescription === null) {
          return { status: 400, error: "Spotlight fields must be valid text strings." };
        }
        const updatedRows = await tx.update(schema_exports.spotlights).set({
          category: nextCategory || existing.category,
          headlineValue: nextHeadline || existing.headlineValue,
          title: nextTitle || existing.title,
          recipients: nextRecipients,
          description: nextDescription
        }).where(eq2(schema_exports.spotlights.id, id)).returning({ id: schema_exports.spotlights.id });
        if (updatedRows.length === 0) {
          return { status: 404, error: "Spotlight not found." };
        }
        return { status: 200 };
      });
      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      const updated = await getSpotlightById(db, id);
      res.json(updated);
    })
  );
  app.delete(
    "/api/spotlights/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.userRecord.user;
      if (user.role !== "admin" && !(user.role === "faculty" && user.canManageSpotlights)) {
        res.status(403).json({ error: "Not authorized to remove Dashboard Spotlights." });
        return;
      }
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Spotlight not found." });
        return;
      }
      const db = requireDb();
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx.select({ id: schema_exports.spotlights.id, authorId: schema_exports.spotlights.authorId }).from(schema_exports.spotlights).where(eq2(schema_exports.spotlights.id, id)).limit(1);
        if (!existing) {
          return { status: 404, error: "Spotlight not found." };
        }
        if (user.role !== "admin" && existing.authorId !== user.id) {
          return {
            status: 403,
            error: "Only the original author or Admin can delete this Dashboard Spotlight."
          };
        }
        const deletedRows = await tx.delete(schema_exports.spotlights).where(eq2(schema_exports.spotlights.id, id)).returning({ id: schema_exports.spotlights.id });
        if (deletedRows.length === 0) {
          return { status: 404, error: "Spotlight not found." };
        }
        return { status: 200 };
      });
      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/hackathons",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.userRecord.user;
      const {
        hackathonName,
        organizer,
        eventDate,
        teamAndRole,
        outcome,
        technologies,
        overallExperience
      } = req.body;
      if (typeof hackathonName !== "string" || !hackathonName.trim() || typeof overallExperience !== "string" || !overallExperience.trim()) {
        res.status(400).json({
          error: "Hackathon name and overall experience are required."
        });
        return;
      }
      const db = requireDb();
      const [inserted] = await db.insert(schema_exports.hackathons).values({
        hackathonName: hackathonName.trim(),
        organizer: typeof organizer === "string" ? organizer.trim() : "",
        eventDate: typeof eventDate === "string" ? eventDate.trim() : "",
        teamAndRole: typeof teamAndRole === "string" ? teamAndRole.trim() : "",
        outcome: typeof outcome === "string" && outcome.trim() ? outcome.trim() : "Participant",
        technologies: typeof technologies === "string" ? technologies.trim() : "",
        overallExperience: overallExperience.trim(),
        authorId: user.id
      }).returning();
      const item = await getHackathonById(db, inserted.id);
      res.status(201).json(item);
    })
  );
  app.put(
    "/api/hackathons/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Hackathon experience not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      const [existing] = await db.select().from(schema_exports.hackathons).where(eq2(schema_exports.hackathons.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Hackathon experience not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the original author or Admin can edit this experience."
        });
        return;
      }
      const {
        hackathonName,
        organizer,
        eventDate,
        teamAndRole,
        outcome,
        technologies,
        overallExperience
      } = req.body;
      const nextHackName = asNonEmptyTrimmedString(hackathonName, existing.hackathonName);
      const nextOrg = asNonEmptyTrimmedString(organizer, existing.organizer);
      const nextDate = asNonEmptyTrimmedString(eventDate, existing.eventDate);
      const nextTeam = asNonEmptyTrimmedString(teamAndRole, existing.teamAndRole);
      const nextOutcome = asNonEmptyTrimmedString(outcome, existing.outcome);
      const nextTech = asNonEmptyTrimmedString(technologies, existing.technologies);
      const nextExp = asNonEmptyTrimmedString(overallExperience, existing.overallExperience);
      if (nextHackName === null || nextOrg === null || nextDate === null || nextTeam === null || nextOutcome === null || nextTech === null || nextExp === null) {
        res.status(400).json({ error: "Hackathon fields must be valid text strings." });
        return;
      }
      await db.update(schema_exports.hackathons).set({
        hackathonName: nextHackName || existing.hackathonName,
        organizer: nextOrg,
        eventDate: nextDate,
        teamAndRole: nextTeam,
        outcome: nextOutcome || existing.outcome,
        technologies: nextTech,
        overallExperience: nextExp || existing.overallExperience
      }).where(eq2(schema_exports.hackathons.id, id));
      const updated = await getHackathonById(db, id);
      res.json(updated);
    })
  );
  app.delete(
    "/api/hackathons/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      const [existing] = await db.select().from(schema_exports.hackathons).where(eq2(schema_exports.hackathons.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the original author or Admin can delete this entry."
        });
        return;
      }
      await db.delete(schema_exports.hackathons).where(eq2(schema_exports.hackathons.id, id));
      res.json({ ok: true });
    })
  );
  app.get(
    "/api/interviews",
    requireAuth,
    asyncHandler(async (_req, res) => {
      const db = requireDb();
      const list = await getInterviewsList(db);
      res.json({ interviews: list });
    })
  );
  app.post(
    "/api/interviews",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const user = req.userRecord.user;
      const {
        companyName,
        roleTitle,
        companyDomain,
        skillsNeeded,
        hiringType,
        packageOrStipend,
        interviewDate,
        resultStatus,
        overallDifficulty,
        overallExperience,
        rounds,
        keyPreparationTips,
        resourcesUsed
      } = req.body;
      if (typeof companyName !== "string" || !companyName.trim() || typeof roleTitle !== "string" || !roleTitle.trim() || typeof overallExperience !== "string" || !overallExperience.trim()) {
        res.status(400).json({
          error: "Company Name, Role Title, and Overall Experience are required."
        });
        return;
      }
      const validHiringTypes = ["On-Campus", "Off-Campus", "Internship", "Full-Time"];
      const safeHiringType = validHiringTypes.includes(
        typeof hiringType === "string" ? hiringType : ""
      ) ? hiringType : "On-Campus";
      const validResults = [
        "Selected / Offered",
        "Rejected",
        "In Progress / Final Round"
      ];
      const safeResult = validResults.includes(
        typeof resultStatus === "string" ? resultStatus : ""
      ) ? resultStatus : "Selected / Offered";
      const validDiff = ["Easy", "Medium", "Hard"];
      const safeDifficulty = validDiff.includes(
        typeof overallDifficulty === "string" ? overallDifficulty : ""
      ) ? overallDifficulty : "Medium";
      const createdId = await db.transaction(async (tx) => {
        const [inserted] = await tx.insert(schema_exports.interviews).values({
          companyName: companyName.trim(),
          roleTitle: roleTitle.trim(),
          companyDomain: typeof companyDomain === "string" && companyDomain.trim() ? companyDomain.trim() : "Technology & Software",
          skillsNeeded: typeof skillsNeeded === "string" ? skillsNeeded.trim() : "",
          hiringType: safeHiringType,
          packageOrStipend: typeof packageOrStipend === "string" ? packageOrStipend.trim() : "",
          interviewDate: typeof interviewDate === "string" && interviewDate.trim() ? interviewDate.trim() : "2026",
          resultStatus: safeResult,
          overallDifficulty: safeDifficulty,
          overallExperience: overallExperience.trim(),
          keyPreparationTips: typeof keyPreparationTips === "string" ? keyPreparationTips.trim() : "",
          resourcesUsed: typeof resourcesUsed === "string" ? resourcesUsed.trim() : "",
          authorId: user.id
        }).returning();
        if (Array.isArray(rounds) && rounds.length > 0) {
          await tx.insert(schema_exports.interviewRounds).values(
            rounds.map((r, idx) => ({
              interviewId: inserted.id,
              roundNumber: Number(r.roundNumber) || idx + 1,
              roundTitle: typeof r.roundTitle === "string" && r.roundTitle.trim() ? r.roundTitle.trim() : `Round ${idx + 1}`,
              topicsCovered: typeof r.topicsCovered === "string" ? r.topicsCovered.trim() : "",
              questionsAsked: typeof r.questionsAsked === "string" ? r.questionsAsked.trim() : "",
              difficulty: validDiff.includes(
                typeof r.difficulty === "string" ? r.difficulty : ""
              ) ? r.difficulty : "Medium"
            }))
          );
        }
        const [notif] = await tx.insert(schema_exports.notifications).values({
          type: "interview_posted",
          title: `Interview Experience Shared: ${inserted.companyName} (${inserted.roleTitle})`,
          message: `${user.name} (${user.memberId}) shared an interview breakdown for ${inserted.companyName} [${inserted.resultStatus}].`,
          targetSection: "interview-experience",
          targetItemId: inserted.id,
          actorId: user.id,
          actorNameSnapshot: user.name
        }).returning();
        await tx.insert(schema_exports.notificationReads).values({ notificationId: notif.id, userId: user.id }).onConflictDoNothing();
        return inserted.id;
      });
      const item = await getInterviewById(db, createdId);
      res.status(201).json(item);
    })
  );
  app.put(
    "/api/interviews/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Interview experience not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      const [existing] = await db.select().from(schema_exports.interviews).where(eq2(schema_exports.interviews.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Interview experience not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the author or Admin can edit this interview experience."
        });
        return;
      }
      const {
        companyName,
        roleTitle,
        companyDomain,
        skillsNeeded,
        hiringType,
        packageOrStipend,
        interviewDate,
        resultStatus,
        overallDifficulty,
        overallExperience,
        rounds,
        keyPreparationTips,
        resourcesUsed
      } = req.body;
      const validHiringTypes = ["On-Campus", "Off-Campus", "Internship", "Full-Time"];
      const validResults = [
        "Selected / Offered",
        "Rejected",
        "In Progress / Final Round"
      ];
      const validDiff = ["Easy", "Medium", "Hard"];
      if (hiringType !== void 0 && !validHiringTypes.includes(String(hiringType))) {
        res.status(400).json({ error: "Invalid hiringType selection." });
        return;
      }
      if (resultStatus !== void 0 && !validResults.includes(String(resultStatus))) {
        res.status(400).json({ error: "Invalid resultStatus selection." });
        return;
      }
      if (overallDifficulty !== void 0 && !validDiff.includes(String(overallDifficulty))) {
        res.status(400).json({ error: "Invalid overallDifficulty selection." });
        return;
      }
      const nextCompanyName = asNonEmptyTrimmedString(companyName, existing.companyName);
      const nextRoleTitle = asNonEmptyTrimmedString(roleTitle, existing.roleTitle);
      const nextCompanyDomain = asNonEmptyTrimmedString(companyDomain, existing.companyDomain);
      const nextSkillsNeeded = asNonEmptyTrimmedString(skillsNeeded, existing.skillsNeeded);
      const nextPackage = asNonEmptyTrimmedString(packageOrStipend, existing.packageOrStipend);
      const nextDate = asNonEmptyTrimmedString(interviewDate, existing.interviewDate);
      const nextOverallExp = asNonEmptyTrimmedString(overallExperience, existing.overallExperience);
      const nextTips = asNonEmptyTrimmedString(keyPreparationTips, existing.keyPreparationTips);
      const nextResUsed = asNonEmptyTrimmedString(resourcesUsed, existing.resourcesUsed);
      if (nextCompanyName === null || nextRoleTitle === null || nextCompanyDomain === null || nextSkillsNeeded === null || nextPackage === null || nextDate === null || nextOverallExp === null || nextTips === null || nextResUsed === null) {
        res.status(400).json({ error: "All text fields must be valid text strings." });
        return;
      }
      await db.transaction(async (tx) => {
        await tx.update(schema_exports.interviews).set({
          companyName: nextCompanyName || existing.companyName,
          roleTitle: nextRoleTitle || existing.roleTitle,
          companyDomain: nextCompanyDomain,
          skillsNeeded: nextSkillsNeeded,
          hiringType: hiringType ?? existing.hiringType,
          packageOrStipend: nextPackage,
          interviewDate: nextDate,
          resultStatus: resultStatus ?? existing.resultStatus,
          overallDifficulty: overallDifficulty ?? existing.overallDifficulty,
          overallExperience: nextOverallExp || existing.overallExperience,
          keyPreparationTips: nextTips,
          resourcesUsed: nextResUsed
        }).where(eq2(schema_exports.interviews.id, id));
        if (Array.isArray(rounds)) {
          await tx.delete(schema_exports.interviewRounds).where(eq2(schema_exports.interviewRounds.interviewId, id));
          if (rounds.length > 0) {
            await tx.insert(schema_exports.interviewRounds).values(
              rounds.map((r, idx) => ({
                interviewId: id,
                roundNumber: Number(r.roundNumber) || idx + 1,
                roundTitle: typeof r.roundTitle === "string" && r.roundTitle.trim() || `Round ${idx + 1}`,
                topicsCovered: typeof r.topicsCovered === "string" ? r.topicsCovered.trim() : "",
                questionsAsked: typeof r.questionsAsked === "string" ? r.questionsAsked.trim() : "",
                difficulty: validDiff.includes(r.difficulty || "") ? r.difficulty : "Medium"
              }))
            );
          }
        }
      });
      const updated = await getInterviewById(db, id);
      res.json(updated);
    })
  );
  app.delete(
    "/api/interviews/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Interview experience not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      const [existing] = await db.select().from(schema_exports.interviews).where(eq2(schema_exports.interviews.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Interview experience not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the author or Admin can delete this entry."
        });
        return;
      }
      await db.delete(schema_exports.interviews).where(eq2(schema_exports.interviews.id, id));
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/projects",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const user = req.userRecord.user;
      const { projectName, websiteType, projectLink, technologies, description } = req.body;
      if (typeof projectName !== "string" || !projectName.trim() || typeof description !== "string" || !description.trim()) {
        res.status(400).json({
          error: "Project name, link, and description are required."
        });
        return;
      }
      const safeLink = normalizeHttpUrlInput(projectLink, {
        required: true,
        label: "Project Link"
      });
      if (!safeLink.ok) {
        res.status(400).json({ error: safeLink.error });
        return;
      }
      const [inserted] = await db.insert(schema_exports.projects).values({
        projectName: projectName.trim(),
        websiteType: typeof websiteType === "string" && websiteType.trim() ? websiteType.trim() : "Web Application",
        projectLink: safeLink.value,
        technologies: typeof technologies === "string" ? technologies.trim() : "",
        description: description.trim(),
        authorId: user.id
      }).returning();
      const item = await getProjectById(db, inserted.id);
      res.status(201).json(item);
    })
  );
  app.put(
    "/api/projects/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Project not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      const [existing] = await db.select().from(schema_exports.projects).where(eq2(schema_exports.projects.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Project not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the original author or Admin can edit this project."
        });
        return;
      }
      const { projectName, websiteType, projectLink, technologies, description } = req.body;
      let nextProjectLink = existing.projectLink;
      if (projectLink !== void 0) {
        const safeLink = normalizeHttpUrlInput(projectLink, {
          required: true,
          label: "Project Link"
        });
        if (!safeLink.ok) {
          res.status(400).json({ error: safeLink.error });
          return;
        }
        nextProjectLink = safeLink.value;
      }
      const nextName = asNonEmptyTrimmedString(projectName, existing.projectName);
      const nextType = asNonEmptyTrimmedString(websiteType, existing.websiteType);
      const nextTech = asNonEmptyTrimmedString(technologies, existing.technologies);
      const nextDesc = asNonEmptyTrimmedString(description, existing.description);
      if (nextName === null || nextType === null || nextTech === null || nextDesc === null) {
        res.status(400).json({ error: "Project fields must be valid text strings." });
        return;
      }
      await db.update(schema_exports.projects).set({
        projectName: nextName || existing.projectName,
        websiteType: nextType,
        projectLink: nextProjectLink,
        technologies: nextTech,
        description: nextDesc || existing.description
      }).where(eq2(schema_exports.projects.id, id));
      const updated = await getProjectById(db, id);
      res.json(updated);
    })
  );
  app.delete(
    "/api/projects/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Project not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      const [existing] = await db.select().from(schema_exports.projects).where(eq2(schema_exports.projects.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Project not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the original author or Admin can delete this project."
        });
        return;
      }
      await db.delete(schema_exports.projects).where(eq2(schema_exports.projects.id, id));
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/problems",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const user = req.userRecord.user;
      const { title, applicationName, category, description, contactInfo, contactEmail } = req.body;
      if (typeof title !== "string" || !title.trim() || typeof description !== "string" || !description.trim() || typeof contactInfo !== "string" || !contactInfo.trim()) {
        res.status(400).json({
          error: "Problem title, description, and contact information are required."
        });
        return;
      }
      const createdId = await db.transaction(async (tx) => {
        const [inserted] = await tx.insert(schema_exports.problems).values({
          title: title.trim(),
          applicationName: typeof applicationName === "string" && applicationName.trim() ? applicationName.trim() : "General Application",
          category: typeof category === "string" && category.trim() ? category.trim() : "Software Issue",
          description: description.trim(),
          contactInfo: contactInfo.trim(),
          contactEmail: typeof contactEmail === "string" && contactEmail.trim() ? contactEmail.trim() : user.email,
          status: "open",
          authorId: user.id
        }).returning();
        const [notif] = await tx.insert(schema_exports.notifications).values({
          type: "problem_posted",
          title: `New Problem Statement: ${inserted.title}`,
          message: `${user.name} (${user.memberId}) posted a problem in ${inserted.applicationName}. Open to message or propose a fix.`,
          targetSection: "problems",
          targetItemId: inserted.id,
          actorId: user.id,
          actorNameSnapshot: user.name
        }).returning();
        await tx.insert(schema_exports.notificationReads).values({ notificationId: notif.id, userId: user.id }).onConflictDoNothing();
        return inserted.id;
      });
      const item = await getProblemById(db, createdId);
      res.status(201).json(item);
    })
  );
  app.put(
    "/api/problems/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Problem statement not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      const [existing] = await db.select().from(schema_exports.problems).where(eq2(schema_exports.problems.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Problem statement not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the original author or Admin can edit this problem statement."
        });
        return;
      }
      const {
        title,
        applicationName,
        category,
        description,
        contactInfo,
        contactEmail,
        status
      } = req.body;
      const nextTitle = asNonEmptyTrimmedString(title, existing.title);
      const nextAppName = asNonEmptyTrimmedString(applicationName, existing.applicationName);
      const nextCat = asNonEmptyTrimmedString(category, existing.category);
      const nextDesc = asNonEmptyTrimmedString(description, existing.description);
      const nextContactInfo = asNonEmptyTrimmedString(contactInfo, existing.contactInfo);
      const nextContactEmail = asNonEmptyTrimmedString(contactEmail, existing.contactEmail);
      if (nextTitle === null || nextAppName === null || nextCat === null || nextDesc === null || nextContactInfo === null || nextContactEmail === null) {
        res.status(400).json({ error: "Problem fields must be valid text strings." });
        return;
      }
      await db.update(schema_exports.problems).set({
        title: nextTitle || existing.title,
        applicationName: nextAppName || existing.applicationName,
        category: nextCat || existing.category,
        description: nextDesc || existing.description,
        contactInfo: nextContactInfo || existing.contactInfo,
        contactEmail: nextContactEmail || existing.contactEmail,
        status: status === "open" || status === "solved" ? status : existing.status
      }).where(eq2(schema_exports.problems.id, id));
      const updated = await getProblemById(db, id);
      res.json(updated);
    })
  );
  app.delete(
    "/api/problems/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Problem statement not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      const [existing] = await db.select().from(schema_exports.problems).where(eq2(schema_exports.problems.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Problem statement not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the original author or Admin can delete this post."
        });
        return;
      }
      await db.delete(schema_exports.problems).where(eq2(schema_exports.problems.id, id));
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/problems/:id/respond",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Problem statement not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      const [existing] = await db.select().from(schema_exports.problems).where(eq2(schema_exports.problems.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Problem statement not found." });
        return;
      }
      const { message, solutionLink, marksSolved } = req.body;
      if (typeof message !== "string" || !message.trim()) {
        res.status(400).json({ error: "Please enter a message or solution note." });
        return;
      }
      const safeSolLink = normalizeHttpUrlInput(solutionLink, {
        required: false,
        label: "Solution Link"
      });
      if (!safeSolLink.ok) {
        res.status(400).json({ error: safeSolLink.error });
        return;
      }
      const trimmedMessage = message.trim();
      const solvedFlag = Boolean(marksSolved);
      const canMarkProblemSolved = user.role === "admin" || existing.authorId === user.id;
      await db.transaction(async (tx) => {
        await tx.insert(schema_exports.problemResponses).values({
          problemId: id,
          senderId: user.id,
          message: trimmedMessage,
          solutionLink: safeSolLink.value,
          marksSolved: solvedFlag
        });
        if (solvedFlag) {
          if (canMarkProblemSolved) {
            await tx.update(schema_exports.problems).set({ status: "solved" }).where(eq2(schema_exports.problems.id, id));
          }
          if (user.role === "student" && user.isActive) {
            await tx.insert(schema_exports.problemSolvers).values({ problemId: id, userId: user.id }).onConflictDoNothing();
          }
        }
        if (existing.authorId !== user.id) {
          await tx.insert(schema_exports.notifications).values({
            type: "problem_message",
            title: `Message on "${existing.title}"`,
            message: `${user.name} (${user.memberId}) sent a ${solvedFlag ? "working solution" : "direct message"}: "${trimmedMessage.slice(0, 90)}"`,
            targetSection: "problems",
            targetItemId: id,
            recipientUserId: existing.authorId,
            actorId: user.id,
            actorNameSnapshot: user.name
          });
        }
      });
      const [problem, progress] = await Promise.all([
        getProblemById(db, id),
        computeUserProgress(db, user.id)
      ]);
      res.status(201).json({ problem, progress });
    })
  );
  app.post(
    "/api/apps",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const user = req.userRecord.user;
      const { appName, usedTechnologies, description, appType, appLink } = req.body;
      if (typeof appName !== "string" || !appName.trim() || typeof usedTechnologies !== "string" || !usedTechnologies.trim()) {
        res.status(400).json({
          error: "App Name, Used Technologies, and App Link are required."
        });
        return;
      }
      const safeAppLink = normalizeHttpUrlInput(appLink, {
        required: true,
        label: "App Link"
      });
      if (!safeAppLink.ok) {
        res.status(400).json({ error: safeAppLink.error });
        return;
      }
      const [inserted] = await db.insert(schema_exports.appTechnologies).values({
        appName: appName.trim(),
        usedTechnologies: usedTechnologies.trim(),
        description: typeof description === "string" ? description.trim() : "",
        appType: typeof appType === "string" && appType.trim() ? appType.trim() : "Web Application",
        appLink: safeAppLink.value,
        authorId: user.id
      }).returning();
      const item = await getAppById(db, inserted.id);
      res.status(201).json(item);
    })
  );
  app.put(
    "/api/apps/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "App entry not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      const [existing] = await db.select().from(schema_exports.appTechnologies).where(eq2(schema_exports.appTechnologies.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "App entry not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the original uploader or Admin can edit this app."
        });
        return;
      }
      const { appName, usedTechnologies, description, appType, appLink } = req.body;
      let nextAppLink = existing.appLink;
      if (appLink !== void 0) {
        const safeAppLink = normalizeHttpUrlInput(appLink, {
          required: true,
          label: "App Link"
        });
        if (!safeAppLink.ok) {
          res.status(400).json({ error: safeAppLink.error });
          return;
        }
        nextAppLink = safeAppLink.value;
      }
      const nextAppName = asNonEmptyTrimmedString(appName, existing.appName);
      const nextUsedTech = asNonEmptyTrimmedString(usedTechnologies, existing.usedTechnologies);
      const nextDesc = asNonEmptyTrimmedString(description, existing.description);
      const nextType = asNonEmptyTrimmedString(appType, existing.appType);
      if (nextAppName === null || nextUsedTech === null || nextDesc === null || nextType === null) {
        res.status(400).json({ error: "App fields must be valid text strings." });
        return;
      }
      await db.update(schema_exports.appTechnologies).set({
        appName: nextAppName || existing.appName,
        usedTechnologies: nextUsedTech || existing.usedTechnologies,
        description: nextDesc,
        appType: nextType,
        appLink: nextAppLink
      }).where(eq2(schema_exports.appTechnologies.id, id));
      const updated = await getAppById(db, id);
      res.json(updated);
    })
  );
  app.delete(
    "/api/apps/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "App entry not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      const [existing] = await db.select().from(schema_exports.appTechnologies).where(eq2(schema_exports.appTechnologies.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "App entry not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the original uploader or Admin can delete this app."
        });
        return;
      }
      await db.delete(schema_exports.appTechnologies).where(eq2(schema_exports.appTechnologies.id, id));
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/placements",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const user = req.userRecord.user;
      if (user.role !== "faculty" && user.role !== "admin") {
        res.status(403).json({
          error: "Students do not have permission to add Placement Drives."
        });
        return;
      }
      const {
        companyName,
        roleTitle,
        packageCtc,
        location,
        deadline,
        applyLink,
        description,
        criteria
      } = req.body;
      if (typeof companyName !== "string" || !companyName.trim() || typeof roleTitle !== "string" || !roleTitle.trim() || typeof packageCtc !== "string" || !packageCtc.trim()) {
        res.status(400).json({
          error: "Company name, role title, and package CTC are required."
        });
        return;
      }
      const safeApplyLink = normalizeHttpUrlInput(applyLink, {
        required: false,
        label: "Apply / Company Notice Link"
      });
      if (!safeApplyLink.ok) {
        res.status(400).json({ error: safeApplyLink.error });
        return;
      }
      const createdId = await db.transaction(async (tx) => {
        const [inserted] = await tx.insert(schema_exports.placementDrives).values({
          companyName: companyName.trim(),
          roleTitle: roleTitle.trim(),
          packageCtc: packageCtc.trim(),
          location: typeof location === "string" && location.trim() ? location.trim() : "On-Campus / Hybrid",
          deadline: typeof deadline === "string" && deadline.trim() ? deadline.trim() : "2026-12-15",
          applyLink: safeApplyLink.value,
          description: typeof description === "string" ? description.trim() : "",
          requireCgpa: Boolean(criteria?.requireCgpa),
          minCgpa: Math.max(0, Math.min(10, Number(criteria?.minCgpa) || 0)).toFixed(2),
          requireLeetcode: Boolean(criteria?.requireLeetcode),
          minLeetcodeProblems: Math.max(0, Number(criteria?.minLeetcodeProblems) || 0),
          requireHackerrank: Boolean(criteria?.requireHackerrank),
          minHackerrankFiveStars: Math.max(0, Number(criteria?.minHackerrankFiveStars) || 0),
          requireGithub: Boolean(criteria?.requireGithub),
          minGithubProjects: Math.max(0, Number(criteria?.minGithubProjects) || 0),
          authorId: user.id,
          authorNameSnapshot: user.name
        }).returning();
        const [notif] = await tx.insert(schema_exports.notifications).values({
          type: "placement_posted",
          title: `New Placement Drive: ${inserted.companyName} (${inserted.packageCtc})`,
          message: `${inserted.roleTitle} applications are open until ${inserted.deadline}. Check your eligibility criteria.`,
          targetSection: "placements",
          targetItemId: inserted.id,
          actorId: user.id,
          actorNameSnapshot: user.name
        }).returning();
        await tx.insert(schema_exports.notificationReads).values({ notificationId: notif.id, userId: user.id }).onConflictDoNothing();
        return inserted.id;
      });
      const item = await getPlacementDriveById(db, createdId, user);
      res.status(201).json(item);
    })
  );
  app.put(
    "/api/placements/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.userRecord.user;
      if (user.role !== "faculty" && user.role !== "admin") {
        res.status(403).json({ error: "Only Faculty and Admin can modify Placement Drives." });
        return;
      }
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Placement drive not found." });
        return;
      }
      const db = requireDb();
      const [existing] = await db.select().from(schema_exports.placementDrives).where(eq2(schema_exports.placementDrives.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Placement drive not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the posting Faculty coordinator or Admin can edit this drive."
        });
        return;
      }
      const {
        companyName,
        roleTitle,
        packageCtc,
        location,
        deadline,
        applyLink,
        description,
        criteria
      } = req.body;
      let nextApplyLink = existing.applyLink;
      if (applyLink !== void 0) {
        const safeApplyLink = normalizeHttpUrlInput(applyLink, {
          required: false,
          label: "Apply / Company Notice Link"
        });
        if (!safeApplyLink.ok) {
          res.status(400).json({ error: safeApplyLink.error });
          return;
        }
        nextApplyLink = safeApplyLink.value;
      }
      const nextCompany = asNonEmptyTrimmedString(companyName, existing.companyName);
      const nextRole = asNonEmptyTrimmedString(roleTitle, existing.roleTitle);
      const nextCtc = asNonEmptyTrimmedString(packageCtc, existing.packageCtc);
      const nextLoc = asNonEmptyTrimmedString(location, existing.location);
      const nextDeadline = asNonEmptyTrimmedString(deadline, existing.deadline);
      const nextDesc = asNonEmptyTrimmedString(description, existing.description);
      if (nextCompany === null || nextRole === null || nextCtc === null || nextLoc === null || nextDeadline === null || nextDesc === null) {
        res.status(400).json({ error: "Placement fields must be valid text strings." });
        return;
      }
      await db.update(schema_exports.placementDrives).set({
        companyName: nextCompany || existing.companyName,
        roleTitle: nextRole || existing.roleTitle,
        packageCtc: nextCtc || existing.packageCtc,
        location: nextLoc,
        deadline: nextDeadline,
        applyLink: nextApplyLink,
        description: nextDesc,
        ...criteria !== void 0 ? {
          requireCgpa: Boolean(criteria.requireCgpa),
          minCgpa: Math.max(0, Math.min(10, Number(criteria.minCgpa) || 0)).toFixed(2),
          requireLeetcode: Boolean(criteria.requireLeetcode),
          minLeetcodeProblems: Math.max(0, Number(criteria.minLeetcodeProblems) || 0),
          requireHackerrank: Boolean(criteria.requireHackerrank),
          minHackerrankFiveStars: Math.max(
            0,
            Number(criteria.minHackerrankFiveStars) || 0
          ),
          requireGithub: Boolean(criteria.requireGithub),
          minGithubProjects: Math.max(0, Number(criteria.minGithubProjects) || 0)
        } : {}
      }).where(eq2(schema_exports.placementDrives.id, id));
      const updated = await getPlacementDriveById(db, id, user);
      res.json(updated);
    })
  );
  app.delete(
    "/api/placements/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.userRecord.user;
      if (user.role !== "faculty" && user.role !== "admin") {
        res.status(403).json({ error: "Only Faculty and Admin can delete Placement Drives." });
        return;
      }
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Placement drive not found." });
        return;
      }
      const db = requireDb();
      const [existing] = await db.select().from(schema_exports.placementDrives).where(eq2(schema_exports.placementDrives.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Placement drive not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the posting Faculty coordinator or Admin can delete this drive."
        });
        return;
      }
      await db.delete(schema_exports.placementDrives).where(eq2(schema_exports.placementDrives.id, id));
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/placements/:id/apply",
    requireAuth,
    codingVerificationRateLimiter,
    asyncHandler(async (req, res) => {
      const record = req.userRecord;
      const user = record.user;
      const sp = record.studentProfile;
      if (user.role !== "student") {
        res.status(403).json({
          error: "Placement applications are strictly for Student accounts."
        });
        return;
      }
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Placement drive not found." });
        return;
      }
      const db = requireDb();
      const [driveRow] = await db.select().from(schema_exports.placementDrives).where(eq2(schema_exports.placementDrives.id, id)).limit(1);
      if (!driveRow) {
        res.status(404).json({ error: "Placement drive not found." });
        return;
      }
      const [existingApp] = await db.select({ id: schema_exports.placementApplications.id }).from(schema_exports.placementApplications).where(
        and2(
          eq2(schema_exports.placementApplications.driveId, id),
          eq2(schema_exports.placementApplications.studentId, user.id)
        )
      ).limit(1);
      if (existingApp) {
        res.status(409).json({ error: "You have already applied to this placement drive." });
        return;
      }
      const studentCgpa = sp ? Number(sp.cgpa) : 0;
      const parsedLcInput = sp?.leetcodeUrl ? parseCodingPlatformInput(sp.leetcodeUrl, "leetcode") : sp?.leetcodeUsername ? parseCodingPlatformInput(sp.leetcodeUsername, "leetcode") : { ok: true, username: "" };
      const parsedHrInput = sp?.hackerrankUrl ? parseCodingPlatformInput(sp.hackerrankUrl, "hackerrank") : sp?.hackerrankUsername ? parseCodingPlatformInput(sp.hackerrankUsername, "hackerrank") : { ok: true, username: "" };
      const parsedGhInput = sp?.githubUrl ? parseCodingPlatformInput(sp.githubUrl, "github") : sp?.githubUsername ? parseCodingPlatformInput(sp.githubUsername, "github") : { ok: true, username: "" };
      const lcHandle = parsedLcInput.ok ? parsedLcInput.username : "";
      const hrHandle = parsedHrInput.ok ? parsedHrInput.username : "";
      const ghHandle = parsedGhInput.ok ? parsedGhInput.username : "";
      const nowMs = Date.now();
      let lcStatsVerified = Boolean(
        lcHandle && sp?.leetcodeVerifiedAt && isWithinVerificationTtl(sp.leetcodeVerifiedAt, nowMs) && sp.leetcodeUsername.toLowerCase() === lcHandle.toLowerCase()
      );
      let hrStatsVerified = Boolean(
        hrHandle && sp?.hackerrankVerifiedAt && isWithinVerificationTtl(sp.hackerrankVerifiedAt, nowMs) && sp.hackerrankUsername.toLowerCase() === hrHandle.toLowerCase()
      );
      let ghStatsVerified = Boolean(
        ghHandle && sp?.githubVerifiedAt && isWithinVerificationTtl(sp.githubVerifiedAt, nowMs) && sp.githubUsername.toLowerCase() === ghHandle.toLowerCase()
      );
      let lcOwnerVerified = Boolean(
        lcHandle && sp?.leetcodeOwnerVerifiedAt && sp.leetcodeUsername.toLowerCase() === lcHandle.toLowerCase()
      );
      let hrOwnerVerified = Boolean(
        hrHandle && sp?.hackerrankOwnerVerifiedAt && sp.hackerrankUsername.toLowerCase() === hrHandle.toLowerCase()
      );
      let ghOwnerVerified = Boolean(
        ghHandle && sp?.githubOwnerVerifiedAt && sp.githubUsername.toLowerCase() === ghHandle.toLowerCase()
      );
      let studentLc = lcStatsVerified ? sp?.leetcodeSolved ?? 0 : 0;
      let studentHr = hrStatsVerified ? sp?.hackerrankFiveStars ?? 0 : 0;
      let studentGh = ghStatsVerified ? sp?.githubProjects ?? 0 : 0;
      const shouldFetchLc = driveRow.requireLeetcode && Boolean(lcHandle) && lcOwnerVerified && !(lcStatsVerified && sp?.leetcodeVerifiedAt && nowMs - sp.leetcodeVerifiedAt.getTime() <= CODING_STATS_CACHE_TTL_MS);
      const shouldFetchHr = driveRow.requireHackerrank && Boolean(hrHandle) && hrOwnerVerified && !(hrStatsVerified && sp?.hackerrankVerifiedAt && nowMs - sp.hackerrankVerifiedAt.getTime() <= CODING_STATS_CACHE_TTL_MS);
      const shouldFetchGh = driveRow.requireGithub && Boolean(ghHandle) && ghOwnerVerified && !(ghStatsVerified && sp?.githubVerifiedAt && nowMs - sp.githubVerifiedAt.getTime() <= CODING_STATS_CACHE_TTL_MS);
      let canPerformLiveSync = false;
      if (sp && (shouldFetchLc || shouldFetchHr || shouldFetchGh)) {
        const cooldownCutoff = new Date(nowMs - CODING_SYNC_COOLDOWN_MS);
        const claimedRows = await db.update(schema_exports.studentProfiles).set({ codingSyncAttemptedAt: new Date(nowMs) }).where(
          and2(
            eq2(schema_exports.studentProfiles.userId, user.id),
            or2(
              isNull2(schema_exports.studentProfiles.codingSyncAttemptedAt),
              sql3`${schema_exports.studentProfiles.codingSyncAttemptedAt} <= ${cooldownCutoff}`
            )
          )
        ).returning({ userId: schema_exports.studentProfiles.userId });
        canPerformLiveSync = claimedRows.length > 0;
      }
      const [liveLcCheck, liveHrCheck, liveGhCheck] = await Promise.all([
        shouldFetchLc && canPerformLiveSync ? fetchLeetcodeCounts(lcHandle) : Promise.resolve(null),
        shouldFetchHr && canPerformLiveSync ? fetchHackerrankFiveStars(hrHandle) : Promise.resolve(null),
        shouldFetchGh && canPerformLiveSync ? fetchGithubRepoCount(ghHandle) : Promise.resolve(null)
      ]);
      if (sp) {
        const verifiedAtNow = /* @__PURE__ */ new Date();
        const profileRefreshFields = {};
        if (liveLcCheck?.status === "ok") {
          studentLc = liveLcCheck.total;
          lcStatsVerified = true;
          profileRefreshFields.leetcodeUsername = lcHandle;
          profileRefreshFields.leetcodeSolved = liveLcCheck.total;
          profileRefreshFields.leetcodeEasy = liveLcCheck.easy;
          profileRefreshFields.leetcodeMedium = liveLcCheck.medium;
          profileRefreshFields.leetcodeHard = liveLcCheck.hard;
          profileRefreshFields.leetcodeVerifiedAt = verifiedAtNow;
          profileRefreshFields.lastSyncedAt = verifiedAtNow;
        } else if (liveLcCheck?.status === "not_found") {
          studentLc = 0;
          lcStatsVerified = false;
          lcOwnerVerified = false;
          profileRefreshFields.leetcodeSolved = 0;
          profileRefreshFields.leetcodeEasy = 0;
          profileRefreshFields.leetcodeMedium = 0;
          profileRefreshFields.leetcodeHard = 0;
          profileRefreshFields.leetcodeVerifiedAt = null;
          profileRefreshFields.leetcodeOwnerVerifiedAt = null;
        }
        if (liveHrCheck?.status === "ok") {
          studentHr = liveHrCheck.count;
          hrStatsVerified = true;
          profileRefreshFields.hackerrankUsername = hrHandle;
          profileRefreshFields.hackerrankFiveStars = liveHrCheck.count;
          profileRefreshFields.hackerrankVerifiedAt = verifiedAtNow;
          profileRefreshFields.lastSyncedAt = verifiedAtNow;
        } else if (liveHrCheck?.status === "not_found") {
          studentHr = 0;
          hrStatsVerified = false;
          hrOwnerVerified = false;
          profileRefreshFields.hackerrankFiveStars = 0;
          profileRefreshFields.hackerrankVerifiedAt = null;
          profileRefreshFields.hackerrankOwnerVerifiedAt = null;
        }
        if (liveGhCheck?.status === "ok") {
          studentGh = liveGhCheck.count;
          ghStatsVerified = true;
          profileRefreshFields.githubUsername = ghHandle;
          profileRefreshFields.githubProjects = liveGhCheck.count;
          profileRefreshFields.githubVerifiedAt = verifiedAtNow;
          profileRefreshFields.lastSyncedAt = verifiedAtNow;
        } else if (liveGhCheck?.status === "not_found") {
          studentGh = 0;
          ghStatsVerified = false;
          ghOwnerVerified = false;
          profileRefreshFields.githubProjects = 0;
          profileRefreshFields.githubVerifiedAt = null;
          profileRefreshFields.githubOwnerVerifiedAt = null;
        }
        if (Object.keys(profileRefreshFields).length > 0) {
          await db.update(schema_exports.studentProfiles).set(profileRefreshFields).where(eq2(schema_exports.studentProfiles.userId, user.id));
        }
      }
      const unmet = [];
      if (driveRow.requireCgpa && studentCgpa < Number(driveRow.minCgpa)) {
        unmet.push(`CGPA ${Number(driveRow.minCgpa)}+ required (yours: ${studentCgpa})`);
      }
      if (driveRow.requireLeetcode) {
        if (!lcHandle) {
          unmet.push(
            `LeetCode ${driveRow.minLeetcodeProblems}+ problems required (no valid LeetCode profile linked)`
          );
        } else if (!lcOwnerVerified) {
          unmet.push(
            `LeetCode profile "@${lcHandle}" ownership verification is required before applying to LeetCode-gated drives`
          );
        } else if (liveLcCheck?.status === "not_found") {
          unmet.push(
            `LeetCode profile "@${lcHandle}" could not be found; please update a valid URL in My Profile`
          );
        } else if (shouldFetchLc && (!liveLcCheck || liveLcCheck.status === "unavailable")) {
          if (lcStatsVerified && isWithinVerificationTtl(sp?.leetcodeVerifiedAt, nowMs)) {
            if (studentLc < driveRow.minLeetcodeProblems) {
              unmet.push(
                `LeetCode ${driveRow.minLeetcodeProblems}+ problems required (verified: ${studentLc})`
              );
            }
          } else {
            unmet.push(
              canPerformLiveSync || !shouldFetchLc ? `LeetCode live verification is currently unavailable for "@${lcHandle}"; please try again shortly` : `LeetCode verification cooldown is active; please wait 15 seconds and try again`
            );
          }
        } else if (!lcStatsVerified || studentLc < driveRow.minLeetcodeProblems) {
          unmet.push(
            `LeetCode ${driveRow.minLeetcodeProblems}+ problems required (verified: ${studentLc})`
          );
        }
      }
      if (driveRow.requireHackerrank) {
        if (!hrHandle) {
          unmet.push(
            `HackerRank ${driveRow.minHackerrankFiveStars}+ 5-star badges required (no valid HackerRank profile linked)`
          );
        } else if (!hrOwnerVerified) {
          unmet.push(
            `HackerRank profile "@${hrHandle}" ownership verification is required before applying to HackerRank-gated drives`
          );
        } else if (liveHrCheck?.status === "not_found") {
          unmet.push(
            `HackerRank profile "@${hrHandle}" could not be found; please update a valid URL in My Profile`
          );
        } else if (shouldFetchHr && (!liveHrCheck || liveHrCheck.status === "unavailable")) {
          if (hrStatsVerified && isWithinVerificationTtl(sp?.hackerrankVerifiedAt, nowMs)) {
            if (studentHr < driveRow.minHackerrankFiveStars) {
              unmet.push(
                `HackerRank ${driveRow.minHackerrankFiveStars}+ 5-star badges required (verified: ${studentHr})`
              );
            }
          } else {
            unmet.push(
              canPerformLiveSync || !shouldFetchHr ? `HackerRank live verification is currently unavailable for "@${hrHandle}"; please try again shortly` : `HackerRank verification cooldown is active; please wait 15 seconds and try again`
            );
          }
        } else if (!hrStatsVerified || studentHr < driveRow.minHackerrankFiveStars) {
          unmet.push(
            `HackerRank ${driveRow.minHackerrankFiveStars}+ 5-star badges required (verified: ${studentHr})`
          );
        }
      }
      if (driveRow.requireGithub) {
        if (!ghHandle) {
          unmet.push(
            `GitHub ${driveRow.minGithubProjects}+ projects required (no valid GitHub profile linked)`
          );
        } else if (!ghOwnerVerified) {
          unmet.push(
            `GitHub profile "@${ghHandle}" ownership verification is required before applying to GitHub-gated drives`
          );
        } else if (liveGhCheck?.status === "not_found") {
          unmet.push(
            `GitHub profile "@${ghHandle}" could not be found; please update a valid URL in My Profile`
          );
        } else if (shouldFetchGh && (!liveGhCheck || liveGhCheck.status === "unavailable")) {
          if (ghStatsVerified && isWithinVerificationTtl(sp?.githubVerifiedAt, nowMs)) {
            if (studentGh < driveRow.minGithubProjects) {
              unmet.push(
                `GitHub ${driveRow.minGithubProjects}+ projects required (verified: ${studentGh})`
              );
            }
          } else {
            unmet.push(
              canPerformLiveSync || !shouldFetchGh ? `GitHub live verification is currently unavailable for "@${ghHandle}"; please try again shortly` : `GitHub verification cooldown is active; please wait 15 seconds and try again`
            );
          }
        } else if (!ghStatsVerified || studentGh < driveRow.minGithubProjects) {
          unmet.push(
            `GitHub ${driveRow.minGithubProjects}+ projects required (verified: ${studentGh})`
          );
        }
      }
      if (unmet.length > 0) {
        res.status(400).json({
          error: `Eligibility criteria not met: ${unmet.join(" \xB7 ")}. Sync your coding links in My Profile or contact Faculty/Admin to update your verified CGPA.`
        });
        return;
      }
      const { resumeLink } = req.body;
      const safeResumeLink = normalizeHttpUrlInput(resumeLink, {
        required: false,
        label: "Resume Link"
      });
      if (!safeResumeLink.ok) {
        res.status(400).json({ error: safeResumeLink.error });
        return;
      }
      try {
        await db.insert(schema_exports.placementApplications).values({
          driveId: id,
          studentId: user.id,
          cgpaSnapshot: studentCgpa.toFixed(2),
          leetcodeSolvedSnapshot: lcStatsVerified ? studentLc : 0,
          hackerrankFiveStarsSnapshot: hrStatsVerified ? studentHr : 0,
          githubProjectsSnapshot: ghStatsVerified ? studentGh : 0,
          leetcodeSnapshotVerified: Boolean(lcStatsVerified && lcOwnerVerified),
          hackerrankSnapshotVerified: Boolean(hrStatsVerified && hrOwnerVerified),
          githubSnapshotVerified: Boolean(ghStatsVerified && ghOwnerVerified),
          resumeLink: safeResumeLink.value || sp?.githubUrl || ""
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: "You have already applied to this placement drive." });
          return;
        }
        throw err;
      }
      const [drive, progress] = await Promise.all([
        getPlacementDriveById(db, id, user),
        computeUserProgress(db, user.id)
      ]);
      res.status(201).json({ drive, progress });
    })
  );
  app.post(
    "/api/courses",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const user = req.userRecord.user;
      if (user.role !== "faculty" && user.role !== "admin") {
        res.status(403).json({
          error: "Students do not have permission to create Department Courses."
        });
        return;
      }
      const {
        courseCode,
        title,
        instructorName,
        semester,
        credits,
        schedule,
        prerequisites,
        description,
        resourceLink
      } = req.body;
      if (typeof courseCode !== "string" || !courseCode.trim() || typeof title !== "string" || !title.trim()) {
        res.status(400).json({ error: "Course code and course title are required." });
        return;
      }
      const safeResLink = normalizeHttpUrlInput(resourceLink, {
        required: false,
        label: "Course Resource Link"
      });
      if (!safeResLink.ok) {
        res.status(400).json({ error: safeResLink.error });
        return;
      }
      const [inserted] = await db.insert(schema_exports.courses).values({
        courseCode: courseCode.trim().toUpperCase(),
        title: title.trim(),
        instructorName: typeof instructorName === "string" && instructorName.trim() ? instructorName.trim() : user.name,
        semester: typeof semester === "string" && semester.trim() ? semester.trim() : "Current Semester",
        credits: Math.max(1, Math.min(12, Number(credits) || 3)),
        schedule: typeof schedule === "string" && schedule.trim() ? schedule.trim() : "TBA",
        prerequisites: typeof prerequisites === "string" && prerequisites.trim() ? prerequisites.trim() : "None",
        description: typeof description === "string" ? description.trim() : "",
        resourceLink: safeResLink.value,
        authorId: user.id
      }).returning();
      const item = await getCourseById(db, inserted.id, user);
      res.status(201).json(item);
    })
  );
  app.put(
    "/api/courses/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.userRecord.user;
      if (user.role !== "faculty" && user.role !== "admin") {
        res.status(403).json({ error: "Only Faculty and Admin can edit Courses." });
        return;
      }
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Course not found." });
        return;
      }
      const db = requireDb();
      const [existing] = await db.select().from(schema_exports.courses).where(eq2(schema_exports.courses.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Course not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the course instructor or Admin can edit this course."
        });
        return;
      }
      const {
        courseCode,
        title,
        instructorName,
        semester,
        credits,
        schedule,
        prerequisites,
        description,
        resourceLink
      } = req.body;
      let nextResLink = existing.resourceLink;
      if (resourceLink !== void 0) {
        const safeResLink = normalizeHttpUrlInput(resourceLink, {
          required: false,
          label: "Course Resource Link"
        });
        if (!safeResLink.ok) {
          res.status(400).json({ error: safeResLink.error });
          return;
        }
        nextResLink = safeResLink.value;
      }
      const nextCode = asNonEmptyTrimmedString(courseCode, existing.courseCode);
      const nextTitle = asNonEmptyTrimmedString(title, existing.title);
      const nextInstructor = asNonEmptyTrimmedString(instructorName, existing.instructorName);
      const nextSemester = asNonEmptyTrimmedString(semester, existing.semester);
      const nextSchedule = asNonEmptyTrimmedString(schedule, existing.schedule);
      const nextPrereq = asNonEmptyTrimmedString(prerequisites, existing.prerequisites);
      const nextDesc = asNonEmptyTrimmedString(description, existing.description);
      if (nextCode === null || nextTitle === null || nextInstructor === null || nextSemester === null || nextSchedule === null || nextPrereq === null || nextDesc === null) {
        res.status(400).json({ error: "Course fields must be valid text strings." });
        return;
      }
      await db.update(schema_exports.courses).set({
        courseCode: (nextCode || existing.courseCode).toUpperCase(),
        title: nextTitle || existing.title,
        instructorName: nextInstructor,
        semester: nextSemester,
        credits: credits !== void 0 ? Math.max(1, Math.min(12, Number(credits) || 3)) : existing.credits,
        schedule: nextSchedule,
        prerequisites: nextPrereq,
        description: nextDesc,
        resourceLink: nextResLink
      }).where(eq2(schema_exports.courses.id, id));
      const updated = await getCourseById(db, id, user);
      res.json(updated);
    })
  );
  app.delete(
    "/api/courses/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.userRecord.user;
      if (user.role !== "faculty" && user.role !== "admin") {
        res.status(403).json({ error: "Only Faculty and Admin can delete Courses." });
        return;
      }
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Course not found." });
        return;
      }
      const db = requireDb();
      const [existing] = await db.select().from(schema_exports.courses).where(eq2(schema_exports.courses.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Course not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the course instructor or Admin can delete this course."
        });
        return;
      }
      await db.delete(schema_exports.courses).where(eq2(schema_exports.courses.id, id));
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/courses/:id/enroll",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.userRecord.user;
      if (user.role !== "student") {
        res.status(403).json({
          error: "Course enrollment is strictly for Student accounts."
        });
        return;
      }
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Course not found." });
        return;
      }
      const db = requireDb();
      const [existingCourse] = await db.select({ id: schema_exports.courses.id }).from(schema_exports.courses).where(eq2(schema_exports.courses.id, id)).limit(1);
      if (!existingCourse) {
        res.status(404).json({ error: "Course not found." });
        return;
      }
      try {
        await db.insert(schema_exports.courseEnrollments).values({
          courseId: id,
          studentId: user.id
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: "You are already enrolled in this course." });
          return;
        }
        throw err;
      }
      const [course, progress] = await Promise.all([
        getCourseById(db, id, user),
        computeUserProgress(db, user.id)
      ]);
      res.status(201).json({ course, progress });
    })
  );
  app.get(
    "/api/faculty",
    requireAuth,
    asyncHandler(async (_req, res) => {
      const db = requireDb();
      const facultyMembers = await getFacultyDirectoryList(db);
      res.json({ facultyMembers });
    })
  );
  app.post(
    "/api/faculty",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const user = req.userRecord.user;
      if (user.role === "student") {
        res.status(403).json({
          error: "Faculty directory editing is disabled for student accounts."
        });
        return;
      }
      const {
        linkedUserId,
        name,
        designation,
        specialization,
        email,
        phoneOrCabin,
        qualification,
        experienceYears,
        bio
      } = req.body;
      if (typeof name !== "string" || !name.trim() || typeof designation !== "string" || !designation.trim()) {
        res.status(400).json({
          error: "Faculty name and designation (e.g. Professor, HOD) are required."
        });
        return;
      }
      const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      let resolvedLinkedUserId = null;
      if (linkedUserId !== void 0 && linkedUserId !== null && linkedUserId !== "") {
        const parsedLinkedId = parseUuidParam(linkedUserId);
        if (!parsedLinkedId) {
          res.status(400).json({ error: "Invalid linked faculty user ID." });
          return;
        }
        if (user.role !== "admin" && parsedLinkedId !== user.id) {
          res.status(403).json({
            error: "Faculty members can only link a directory listing to their own account."
          });
          return;
        }
        const [linkedFaculty] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(and2(eq2(schema_exports.users.id, parsedLinkedId), eq2(schema_exports.users.role, "faculty"))).limit(1);
        if (!linkedFaculty) {
          res.status(404).json({ error: "Linked faculty account not found." });
          return;
        }
        const [existingLink] = await db.select({ id: schema_exports.facultyDirectory.id }).from(schema_exports.facultyDirectory).where(eq2(schema_exports.facultyDirectory.linkedUserId, parsedLinkedId)).limit(1);
        if (existingLink) {
          res.status(409).json({
            error: "This faculty account already has a linked directory profile."
          });
          return;
        }
        resolvedLinkedUserId = parsedLinkedId;
      } else if (cleanEmail) {
        const [matchedFaculty] = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(
          and2(
            sql3`lower(${schema_exports.users.email}) = lower(${cleanEmail})`,
            eq2(schema_exports.users.role, "faculty")
          )
        ).limit(1);
        if (matchedFaculty && (user.role === "admin" || matchedFaculty.id === user.id)) {
          const [existingLink] = await db.select({ id: schema_exports.facultyDirectory.id }).from(schema_exports.facultyDirectory).where(eq2(schema_exports.facultyDirectory.linkedUserId, matchedFaculty.id)).limit(1);
          if (!existingLink) {
            resolvedLinkedUserId = matchedFaculty.id;
          }
        }
      }
      try {
        const [inserted] = await db.insert(schema_exports.facultyDirectory).values({
          linkedUserId: resolvedLinkedUserId,
          name: name.trim(),
          designation: designation.trim(),
          specialization: typeof specialization === "string" && specialization.trim() || "Computer Science & Engineering",
          email: cleanEmail || null,
          phoneOrCabin: typeof phoneOrCabin === "string" ? phoneOrCabin.trim() : "",
          qualification: typeof qualification === "string" ? qualification.trim() : "",
          experienceYears: experienceYears !== void 0 ? Math.max(0, Math.min(60, Number(experienceYears) || 0)) : 0,
          bio: typeof bio === "string" ? bio.trim() : "",
          authorId: user.id
        }).returning();
        res.status(201).json(mapFacultyDirectoryRow(inserted));
      } catch (err) {
        if (isUniqueViolation(err)) {
          const constraint = getPgConstraintName(err);
          res.status(409).json({
            error: constraint === "uq_faculty_dir_linked_user" ? "This faculty account already has a linked directory profile." : "A faculty directory profile with this email already exists."
          });
          return;
        }
        throw err;
      }
    })
  );
  app.put(
    "/api/faculty/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.userRecord.user;
      if (user.role === "student") {
        res.status(403).json({ error: "Students cannot modify faculty details." });
        return;
      }
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Faculty member not found." });
        return;
      }
      const {
        linkedUserId,
        name,
        designation,
        specialization,
        email,
        phoneOrCabin,
        qualification,
        experienceYears,
        bio
      } = req.body;
      const db = requireDb();
      try {
        const result = await db.transaction(async (tx) => {
          const [existing] = await tx.select().from(schema_exports.facultyDirectory).where(eq2(schema_exports.facultyDirectory.id, id)).limit(1);
          if (!existing) {
            return { status: 404, error: "Faculty member not found." };
          }
          const isAuthorized = user.role === "admin" || (existing.linkedUserId ? existing.linkedUserId === user.id : existing.authorId === user.id);
          if (!isAuthorized) {
            return {
              status: 403,
              error: "Faculty members cannot modify profiles of other faculty members."
            };
          }
          if (name !== void 0 && typeof name !== "string" || designation !== void 0 && typeof designation !== "string" || specialization !== void 0 && typeof specialization !== "string" || email !== void 0 && typeof email !== "string" || phoneOrCabin !== void 0 && typeof phoneOrCabin !== "string" || qualification !== void 0 && typeof qualification !== "string" || bio !== void 0 && typeof bio !== "string") {
            return { status: 400, error: "Faculty text fields must be valid strings." };
          }
          const nextEmail = typeof email === "string" ? email.trim().toLowerCase() || null : existing.email;
          let nextLinkedUserId = existing.linkedUserId ?? null;
          if (linkedUserId !== void 0) {
            if (user.role !== "admin") {
              return {
                status: 403,
                error: "Only Admin can change the linked faculty login account."
              };
            }
            if (linkedUserId === null || linkedUserId === "") {
              nextLinkedUserId = null;
            } else {
              const parsedLinkedId = parseUuidParam(linkedUserId);
              if (!parsedLinkedId) {
                return { status: 400, error: "Invalid linked faculty user ID." };
              }
              const [linkedFaculty] = await tx.select({ id: schema_exports.users.id }).from(schema_exports.users).where(and2(eq2(schema_exports.users.id, parsedLinkedId), eq2(schema_exports.users.role, "faculty"))).limit(1);
              if (!linkedFaculty) {
                return { status: 404, error: "Linked faculty account not found." };
              }
              const [existingLink] = await tx.select({ id: schema_exports.facultyDirectory.id }).from(schema_exports.facultyDirectory).where(
                and2(
                  eq2(schema_exports.facultyDirectory.linkedUserId, parsedLinkedId),
                  sql3`${schema_exports.facultyDirectory.id} <> ${id}`
                )
              ).limit(1);
              if (existingLink) {
                return {
                  status: 409,
                  error: "This faculty account is already linked to another directory profile."
                };
              }
              nextLinkedUserId = parsedLinkedId;
            }
          } else if (!nextLinkedUserId && nextEmail) {
            const [matchedFaculty] = await tx.select({ id: schema_exports.users.id }).from(schema_exports.users).where(
              and2(
                sql3`lower(${schema_exports.users.email}) = lower(${nextEmail})`,
                eq2(schema_exports.users.role, "faculty")
              )
            ).limit(1);
            if (matchedFaculty && (user.role === "admin" || matchedFaculty.id === user.id)) {
              const [existingLink] = await tx.select({ id: schema_exports.facultyDirectory.id }).from(schema_exports.facultyDirectory).where(
                and2(
                  eq2(schema_exports.facultyDirectory.linkedUserId, matchedFaculty.id),
                  sql3`${schema_exports.facultyDirectory.id} <> ${id}`
                )
              ).limit(1);
              if (!existingLink) {
                nextLinkedUserId = matchedFaculty.id;
              }
            }
          }
          const nextAuthorId = nextLinkedUserId ?? existing.authorId;
          const [row] = await tx.update(schema_exports.facultyDirectory).set({
            linkedUserId: nextLinkedUserId,
            authorId: nextAuthorId,
            name: typeof name === "string" && name.trim() ? name.trim() : existing.name,
            designation: typeof designation === "string" && designation.trim() ? designation.trim() : existing.designation,
            specialization: typeof specialization === "string" ? specialization.trim() : existing.specialization,
            email: nextEmail,
            phoneOrCabin: typeof phoneOrCabin === "string" ? phoneOrCabin.trim() : existing.phoneOrCabin,
            qualification: typeof qualification === "string" ? qualification.trim() : existing.qualification,
            experienceYears: experienceYears !== void 0 ? Math.max(0, Math.min(60, Number(experienceYears) || 0)) : existing.experienceYears,
            bio: typeof bio === "string" ? bio.trim() : existing.bio
          }).where(eq2(schema_exports.facultyDirectory.id, id)).returning();
          if (!row) {
            return { status: 404, error: "Faculty member not found." };
          }
          if (row.linkedUserId) {
            const [linkedAccount] = await tx.select({
              id: schema_exports.users.id,
              department: schema_exports.users.department,
              memberId: schema_exports.users.memberId,
              name: schema_exports.users.name
            }).from(schema_exports.users).where(
              and2(
                eq2(schema_exports.users.id, row.linkedUserId),
                eq2(schema_exports.users.role, "faculty")
              )
            ).limit(1);
            if (linkedAccount) {
              const deptForBatch = linkedAccount.department || row.specialization || "CSE";
              await tx.update(schema_exports.users).set({
                name: row.name,
                phone: row.phoneOrCabin,
                bio: row.bio,
                batchOrDesignation: `${row.designation}, ${deptForBatch}`
              }).where(eq2(schema_exports.users.id, linkedAccount.id));
              await tx.insert(schema_exports.facultyProfiles).values({
                userId: linkedAccount.id,
                designation: row.designation,
                specialization: row.specialization,
                qualification: row.qualification,
                experienceYears: row.experienceYears,
                phoneOrCabin: row.phoneOrCabin
              }).onConflictDoUpdate({
                target: schema_exports.facultyProfiles.userId,
                set: {
                  designation: row.designation,
                  specialization: row.specialization,
                  qualification: row.qualification,
                  experienceYears: row.experienceYears,
                  phoneOrCabin: row.phoneOrCabin
                }
              });
            }
          }
          return {
            status: 200,
            updated: row,
            nameChanged: row.name !== existing.name
          };
        });
        if (result.status !== 200) {
          res.status(result.status).json({ error: result.error });
          return;
        }
        if (result.updated.linkedUserId && result.nameChanged) {
          const [linkedUserMeta] = await db.select({ memberId: schema_exports.users.memberId }).from(schema_exports.users).where(eq2(schema_exports.users.id, result.updated.linkedUserId)).limit(1);
          if (linkedUserMeta) {
            await updateSupabaseAuthUser(result.updated.linkedUserId, {
              name: result.updated.name,
              memberId: linkedUserMeta.memberId
            });
          }
        }
        res.json(mapFacultyDirectoryRow(result.updated));
      } catch (err) {
        if (isUniqueViolation(err)) {
          const constraint = getPgConstraintName(err);
          res.status(409).json({
            error: constraint === "uq_faculty_dir_linked_user" ? "This faculty account is already linked to another directory profile." : "Another faculty directory record already uses this email."
          });
          return;
        }
        throw err;
      }
    })
  );
  app.delete(
    "/api/faculty/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Faculty member not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      if (user.role !== "faculty" && user.role !== "admin") {
        res.status(403).json({
          error: "Students cannot delete Faculty Directory profiles."
        });
        return;
      }
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx.select().from(schema_exports.facultyDirectory).where(eq2(schema_exports.facultyDirectory.id, id)).limit(1);
        if (!existing) {
          return { status: 404, error: "Faculty member not found." };
        }
        const isAuthorized = user.role === "admin" || (existing.linkedUserId ? existing.linkedUserId === user.id : existing.authorId === user.id);
        if (!isAuthorized) {
          return {
            status: 403,
            error: "Only the linked faculty member, unlinked entry author, or Admin can remove this record."
          };
        }
        const deletedRows = await tx.delete(schema_exports.facultyDirectory).where(eq2(schema_exports.facultyDirectory.id, id)).returning({ id: schema_exports.facultyDirectory.id });
        if (deletedRows.length === 0) {
          return { status: 404, error: "Faculty member not found." };
        }
        return { status: 200, deletedId: deletedRows[0].id };
      });
      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({ ok: true, deletedId: result.deletedId });
    })
  );
  app.post(
    "/api/resources",
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = requireDb();
      const user = req.userRecord.user;
      if (user.role !== "faculty" && user.role !== "admin") {
        res.status(403).json({
          error: "Only Faculty and Admin can publish official Academic Resources."
        });
        return;
      }
      const { title, resourceType, subjectOrLab, description, resourceLink } = req.body;
      if (typeof title !== "string" || !title.trim()) {
        res.status(400).json({ error: "Resource title and link are required." });
        return;
      }
      const safeResLink = normalizeHttpUrlInput(resourceLink, {
        required: true,
        label: "Resource Link"
      });
      if (!safeResLink.ok) {
        res.status(400).json({ error: safeResLink.error });
        return;
      }
      const [inserted] = await db.insert(schema_exports.academicResources).values({
        title: title.trim(),
        resourceType: typeof resourceType === "string" && resourceType.trim() ? resourceType.trim() : "Lab Manual",
        subjectOrLab: typeof subjectOrLab === "string" && subjectOrLab.trim() ? subjectOrLab.trim() : "CSE Department",
        description: typeof description === "string" ? description.trim() : "",
        resourceLink: safeResLink.value,
        authorId: user.id,
        authorNameSnapshot: user.name
      }).returning();
      res.status(201).json({
        id: inserted.id,
        title: inserted.title,
        resourceType: inserted.resourceType,
        subjectOrLab: inserted.subjectOrLab,
        description: inserted.description,
        resourceLink: inserted.resourceLink,
        authorId: inserted.authorId ?? "",
        authorName: user.name,
        createdAt: inserted.createdAt.toISOString()
      });
    })
  );
  app.delete(
    "/api/resources/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: "Resource not found." });
        return;
      }
      const db = requireDb();
      const user = req.userRecord.user;
      if (user.role !== "faculty" && user.role !== "admin") {
        res.status(403).json({
          error: "Only Faculty and Admin can delete Academic Resources."
        });
        return;
      }
      const [existing] = await db.select().from(schema_exports.academicResources).where(eq2(schema_exports.academicResources.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Resource not found." });
        return;
      }
      if (user.role !== "admin" && existing.authorId !== user.id) {
        res.status(403).json({
          error: "Only the uploader or Admin can remove this resource."
        });
        return;
      }
      await db.delete(schema_exports.academicResources).where(eq2(schema_exports.academicResources.id, id));
      res.json({ ok: true });
    })
  );
  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (!req.path.startsWith("/api")) {
      next(err);
      return;
    }
    if (isMissingTableOrRelation(err)) {
      res.status(503).json({
        error: "Database schema migrations have not been applied to Supabase PostgreSQL yet."
      });
      return;
    }
    if (isDbConnectivityError(err)) {
      const dbCode = getPgErrorCode(err) || "DB_UNAVAILABLE";
      console.error("[API DB Connectivity Error]", dbCode);
      res.status(503).json({
        error: "Database service is temporarily unreachable. Please verify database configuration and try again shortly."
      });
      return;
    }
    const pgCode = getPgErrorCode(err);
    const message = err instanceof Error && !/failed query|postgres|supabase|key|password|secret/i.test(err.message) ? err.message : "Internal server error while processing database request.";
    console.error("[API Error]", pgCode || "UNHANDLED");
    res.status(500).json({ error: message });
  });
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(__dirname, "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }
  return app;
}
function getExpressApp() {
  if (!cachedAppPromise) {
    cachedAppPromise = buildExpressApp().catch((err) => {
      cachedAppPromise = null;
      throw err;
    });
  }
  return cachedAppPromise;
}
async function startServer() {
  const app = await getExpressApp();
  const PORT = Number(process.env.PORT) || 3e3;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pragati University CSE Portal server running on http://0.0.0.0:${PORT}`);
    if (!isSupabaseConfigured()) {
      console.warn(
        "[Startup Notice] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment."
      );
    }
    const dbMeta = getConnectionMetadata();
    if (!dbMeta.configured || dbMeta.connectionMode === "invalid_url") {
      console.warn(
        "[Startup Notice] DATABASE_URL is missing or invalid in environment."
      );
    } else if (dbMeta.ipv4PoolerRecommended) {
      console.warn(
        "[Startup Warning] DATABASE_URL points to a direct Supabase host (*.supabase.co). Switch to the Supabase Session Pooler (port 5432) or Transaction Pooler (port 6543, *.pooler.supabase.com) to avoid IPv4 ENETUNREACH errors."
      );
    }
    if (process.env.NODE_ENV === "production" && !(process.env.CODING_VERIFY_HMAC_SECRET || "").trim()) {
      console.warn(
        "[Startup Notice] CODING_VERIFY_HMAC_SECRET is not set; using derived service key for coding ownership verification."
      );
    }
  });
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Shutdown] Received ${signal}; closing HTTP server and database pool...`);
    const forceTimer = setTimeout(() => {
      console.error("[Shutdown] Timed out waiting for connections; exiting.");
      process.exit(1);
    }, 1e4);
    forceTimer.unref();
    server.close(async () => {
      await closeDb();
      clearTimeout(forceTimer);
      process.exit(0);
    });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
process.on("unhandledRejection", (reason) => {
  const code = getPgErrorCode(reason);
  const label = code || (reason instanceof Error ? reason.name : "UnknownRejection");
  console.error("[Process Warning] Unhandled promise rejection:", label);
});
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    const code = getPgErrorCode(err);
    console.error("[Fatal Startup Error]", code || (err instanceof Error ? err.name : "StartupError"));
    process.exit(1);
  });
}
export {
  getExpressApp
};
