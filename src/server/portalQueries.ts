import { and, count, desc, eq, ilike, inArray, isNull, or, sql, asc } from 'drizzle-orm';
import { type AppDatabase, schema } from '../db/index';
import { isWithinVerificationTtl } from './codingStats';
import type {
  AcademicResource,
  AppTechnology,
  CodingStats,
  CourseEnrollment,
  DepartmentCourse,
  DepartmentProject,
  FacultyMember,
  HackathonExperience,
  InterviewExperience,
  NavSection,
  PlacementApplicant,
  PlacementDrive,
  PortalBootstrapPayload,
  PortalNotification,
  PortalProgress,
  PortalReminderItem,
  ProblemResponse,
  ProblemStatement,
  PublicUserProfile,
  SpotlightBanner,
  StudentDirectoryDetail,
  UserRole,
} from '../types';

export interface HydratedUserRecord {
  user: typeof schema.users.$inferSelect;
  studentProfile: typeof schema.studentProfiles.$inferSelect | null;
  facultyProfile: typeof schema.facultyProfiles.$inferSelect | null;
  adminProfile: typeof schema.adminProfiles.$inferSelect | null;
}

export function createDefaultCodingStats(): CodingStats {
  return {
    leetcodeUrl: '',
    leetcodeUsername: '',
    leetcodeSolved: 0,
    leetcodeEasy: 0,
    leetcodeMedium: 0,
    leetcodeHard: 0,
    leetcodeVerified: false,
    leetcodeVerifiedAt: null,
    leetcodeOwnerVerified: false,
    hackerrankUrl: '',
    hackerrankUsername: '',
    hackerrankFiveStars: 0,
    hackerrankVerified: false,
    hackerrankVerifiedAt: null,
    hackerrankOwnerVerified: false,
    githubUrl: '',
    githubUsername: '',
    githubProjects: 0,
    githubVerified: false,
    githubVerifiedAt: null,
    githubOwnerVerified: false,
  };
}

export function toPublicProfile(
  record: HydratedUserRecord,
  options: { includePhone?: boolean } = {}
): PublicUserProfile {
  const { user, studentProfile, facultyProfile, adminProfile } = record;
  const sp = studentProfile;
  const fp = facultyProfile;
  const ap = adminProfile;
  const resolvedPhone = user.phone || fp?.phoneOrCabin || '';

  const nowMs = Date.now();

  return {
    id: user.id,
    memberId: user.memberId,
    name: user.name,
    email: user.email,
    role: user.role,
    batchOrDesignation: user.batchOrDesignation,
    department: user.department,
    ...(fp
      ? {
          designation: fp.designation,
          specialization: fp.specialization,
          qualification: fp.qualification,
          experienceYears: fp.experienceYears,
        }
      : ap
      ? {
          designation: ap.title,
        }
      : {}),
    ...(sp ? { year: sp.year, section: sp.section } : {}),
    ...(options.includePhone ? { phone: resolvedPhone } : {}),
    isActive: user.isActive,
    cgpa: sp ? Number(sp.cgpa) : 0,
    bio: user.bio,
    skills: user.skills,
    canManageSpotlights: user.canManageSpotlights,
    codingStats: sp
      ? {
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
          hackerrankVerifiedAt: sp.hackerrankVerifiedAt
            ? sp.hackerrankVerifiedAt.toISOString()
            : null,
          hackerrankOwnerVerified: Boolean(sp.hackerrankOwnerVerifiedAt),
          githubUrl: sp.githubUrl,
          githubUsername: sp.githubUsername,
          githubProjects: sp.githubProjects,
          githubVerified: isWithinVerificationTtl(sp.githubVerifiedAt, nowMs),
          githubVerifiedAt: sp.githubVerifiedAt ? sp.githubVerifiedAt.toISOString() : null,
          githubOwnerVerified: Boolean(sp.githubOwnerVerifiedAt),
          lastSyncedAt: sp.lastSyncedAt ? sp.lastSyncedAt.toISOString() : undefined,
        }
      : createDefaultCodingStats(),
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getUserWithProfilesById(
  db: AppDatabase,
  userId: string
): Promise<HydratedUserRecord | null> {
  const [userRow] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!userRow) return null;

  const [studentProfile] =
    userRow.role === 'student'
      ? await db
          .select()
          .from(schema.studentProfiles)
          .where(eq(schema.studentProfiles.userId, userId))
          .limit(1)
      : [undefined];

  const [facultyProfile] =
    userRow.role === 'faculty'
      ? await db
          .select()
          .from(schema.facultyProfiles)
          .where(eq(schema.facultyProfiles.userId, userId))
          .limit(1)
      : [undefined];

  const [adminProfile] =
    userRow.role === 'admin'
      ? await db
          .select()
          .from(schema.adminProfiles)
          .where(eq(schema.adminProfiles.userId, userId))
          .limit(1)
      : [undefined];

  return {
    user: userRow,
    studentProfile: studentProfile ?? null,
    facultyProfile: facultyProfile ?? null,
    adminProfile: adminProfile ?? null,
  };
}

export async function findUserByIdentifierAndRole(
  db: AppDatabase,
  identifier: string,
  role: UserRole
): Promise<typeof schema.users.$inferSelect | null> {
  const clean = identifier.trim();
  if (!clean) return null;

  const [row] = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.role, role),
        or(
          sql`lower(${schema.users.email}) = lower(${clean})`,
          sql`upper(${schema.users.memberId}) = upper(${clean})`
        )
      )
    )
    .limit(1);

  return row ?? null;
}

export async function computeUserProgress(
  db: AppDatabase,
  userId: string
): Promise<PortalProgress> {
  const [
    [appsRow],
    [projRow],
    [hackRow],
    [intRow],
    [probPostedRow],
    [probSolvedRow],
    [placeRow],
    [courseRow],
  ] = await Promise.all([
    db.select({ value: count() }).from(schema.appTechnologies).where(eq(schema.appTechnologies.authorId, userId)),
    db.select({ value: count() }).from(schema.projects).where(eq(schema.projects.authorId, userId)),
    db.select({ value: count() }).from(schema.hackathons).where(eq(schema.hackathons.authorId, userId)),
    db.select({ value: count() }).from(schema.interviews).where(eq(schema.interviews.authorId, userId)),
    db.select({ value: count() }).from(schema.problems).where(eq(schema.problems.authorId, userId)),
    db.select({ value: count() }).from(schema.problemSolvers).where(eq(schema.problemSolvers.userId, userId)),
    db
      .select({ value: count() })
      .from(schema.placementApplications)
      .where(eq(schema.placementApplications.studentId, userId)),
    db
      .select({ value: count() })
      .from(schema.courseEnrollments)
      .where(eq(schema.courseEnrollments.studentId, userId)),
  ]);

  return {
    appsUploaded: Number(appsRow?.value ?? 0),
    projectsPublished: Number(projRow?.value ?? 0),
    hackathonsShared: Number(hackRow?.value ?? 0),
    interviewsShared: Number(intRow?.value ?? 0),
    problemsPosted: Number(probPostedRow?.value ?? 0),
    problemsSolved: Number(probSolvedRow?.value ?? 0),
    placementsApplied: Number(placeRow?.value ?? 0),
    coursesEnrolled: Number(courseRow?.value ?? 0),
  };
}

function mapSpotlightRow(
  row: typeof schema.spotlights.$inferSelect,
  authorName?: string | null
): SpotlightBanner {
  return {
    id: row.id,
    category: row.category,
    headlineValue: row.headlineValue,
    title: row.title,
    recipients: row.recipients,
    description: row.description,
    authorId: row.authorId ?? '',
    authorName: authorName || row.authorNameSnapshot || 'Department Administration',
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getSpotlightsList(db: AppDatabase): Promise<SpotlightBanner[]> {
  const rows = await db
    .select({
      spotlight: schema.spotlights,
      authorName: schema.users.name,
    })
    .from(schema.spotlights)
    .leftJoin(schema.users, eq(schema.spotlights.authorId, schema.users.id))
    .orderBy(desc(schema.spotlights.createdAt));

  return rows.map((r) => mapSpotlightRow(r.spotlight, r.authorName));
}

export async function getSpotlightById(
  db: AppDatabase,
  id: string
): Promise<SpotlightBanner | null> {
  const [row] = await db
    .select({
      spotlight: schema.spotlights,
      authorName: schema.users.name,
    })
    .from(schema.spotlights)
    .leftJoin(schema.users, eq(schema.spotlights.authorId, schema.users.id))
    .where(eq(schema.spotlights.id, id))
    .limit(1);

  return row ? mapSpotlightRow(row.spotlight, row.authorName) : null;
}

export async function getHackathonsList(
  db: AppDatabase,
  authorFilterId?: string
): Promise<HackathonExperience[]> {
  const query = db
    .select({
      hack: schema.hackathons,
      author: schema.users,
    })
    .from(schema.hackathons)
    .innerJoin(schema.users, eq(schema.hackathons.authorId, schema.users.id));

  const rows = authorFilterId
    ? await query.where(eq(schema.hackathons.authorId, authorFilterId)).orderBy(desc(schema.hackathons.createdAt))
    : await query.orderBy(desc(schema.hackathons.createdAt));

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
    createdAt: r.hack.createdAt.toISOString(),
  }));
}

export async function getHackathonById(
  db: AppDatabase,
  id: string
): Promise<HackathonExperience | null> {
  const [r] = await db
    .select({
      hack: schema.hackathons,
      author: schema.users,
    })
    .from(schema.hackathons)
    .innerJoin(schema.users, eq(schema.hackathons.authorId, schema.users.id))
    .where(eq(schema.hackathons.id, id))
    .limit(1);

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
    createdAt: r.hack.createdAt.toISOString(),
  };
}

export async function getInterviewsList(
  db: AppDatabase,
  authorFilterId?: string
): Promise<InterviewExperience[]> {
  const baseQuery = db
    .select({
      interview: schema.interviews,
      author: schema.users,
    })
    .from(schema.interviews)
    .innerJoin(schema.users, eq(schema.interviews.authorId, schema.users.id));

  const interviewRows = authorFilterId
    ? await baseQuery
        .where(eq(schema.interviews.authorId, authorFilterId))
        .orderBy(desc(schema.interviews.createdAt))
    : await baseQuery.orderBy(desc(schema.interviews.createdAt));

  if (interviewRows.length === 0) return [];

  const ids = interviewRows.map((r) => r.interview.id);
  const roundRows = await db
    .select()
    .from(schema.interviewRounds)
    .where(inArray(schema.interviewRounds.interviewId, ids))
    .orderBy(asc(schema.interviewRounds.roundNumber));

  const roundsByInterview = new Map<string, InterviewExperience['rounds']>();
  for (const round of roundRows) {
    const arr = roundsByInterview.get(round.interviewId) ?? [];
    arr.push({
      roundNumber: round.roundNumber,
      roundTitle: round.roundTitle,
      topicsCovered: round.topicsCovered,
      questionsAsked: round.questionsAsked,
      difficulty: round.difficulty,
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
    createdAt: r.interview.createdAt.toISOString(),
  }));
}

export async function getInterviewById(
  db: AppDatabase,
  id: string
): Promise<InterviewExperience | null> {
  const [r] = await db
    .select({
      interview: schema.interviews,
      author: schema.users,
    })
    .from(schema.interviews)
    .innerJoin(schema.users, eq(schema.interviews.authorId, schema.users.id))
    .where(eq(schema.interviews.id, id))
    .limit(1);

  if (!r) return null;

  const roundRows = await db
    .select()
    .from(schema.interviewRounds)
    .where(eq(schema.interviewRounds.interviewId, id))
    .orderBy(asc(schema.interviewRounds.roundNumber));

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
      difficulty: round.difficulty,
    })),
    keyPreparationTips: r.interview.keyPreparationTips,
    resourcesUsed: r.interview.resourcesUsed,
    authorId: r.interview.authorId,
    authorName: r.author.name,
    authorMemberId: r.author.memberId,
    authorEmail: r.author.email,
    authorBatch: r.author.batchOrDesignation,
    authorRole: r.author.role,
    createdAt: r.interview.createdAt.toISOString(),
  };
}

export async function getProjectsList(
  db: AppDatabase,
  authorFilterId?: string
): Promise<DepartmentProject[]> {
  const baseQuery = db
    .select({
      project: schema.projects,
      author: schema.users,
    })
    .from(schema.projects)
    .innerJoin(schema.users, eq(schema.projects.authorId, schema.users.id));

  const rows = authorFilterId
    ? await baseQuery
        .where(eq(schema.projects.authorId, authorFilterId))
        .orderBy(desc(schema.projects.createdAt))
    : await baseQuery.orderBy(desc(schema.projects.createdAt));

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
    createdAt: r.project.createdAt.toISOString(),
  }));
}

export async function getProjectById(
  db: AppDatabase,
  id: string
): Promise<DepartmentProject | null> {
  const [r] = await db
    .select({
      project: schema.projects,
      author: schema.users,
    })
    .from(schema.projects)
    .innerJoin(schema.users, eq(schema.projects.authorId, schema.users.id))
    .where(eq(schema.projects.id, id))
    .limit(1);

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
    createdAt: r.project.createdAt.toISOString(),
  };
}

export async function getAppsList(
  db: AppDatabase,
  authorFilterId?: string
): Promise<AppTechnology[]> {
  const baseQuery = db
    .select({
      app: schema.appTechnologies,
      author: schema.users,
    })
    .from(schema.appTechnologies)
    .innerJoin(schema.users, eq(schema.appTechnologies.authorId, schema.users.id));

  const rows = authorFilterId
    ? await baseQuery
        .where(eq(schema.appTechnologies.authorId, authorFilterId))
        .orderBy(desc(schema.appTechnologies.createdAt))
    : await baseQuery.orderBy(desc(schema.appTechnologies.createdAt));

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
    createdAt: r.app.createdAt.toISOString(),
  }));
}

export async function getAppById(
  db: AppDatabase,
  id: string
): Promise<AppTechnology | null> {
  const [r] = await db
    .select({
      app: schema.appTechnologies,
      author: schema.users,
    })
    .from(schema.appTechnologies)
    .innerJoin(schema.users, eq(schema.appTechnologies.authorId, schema.users.id))
    .where(eq(schema.appTechnologies.id, id))
    .limit(1);

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
    createdAt: r.app.createdAt.toISOString(),
  };
}

export async function getProblemsList(db: AppDatabase): Promise<ProblemStatement[]> {
  const problemRows = await db
    .select({
      problem: schema.problems,
      author: schema.users,
    })
    .from(schema.problems)
    .innerJoin(schema.users, eq(schema.problems.authorId, schema.users.id))
    .orderBy(desc(schema.problems.createdAt));

  if (problemRows.length === 0) return [];
  const ids = problemRows.map((r) => r.problem.id);

  const [responseRows, solverRows] = await Promise.all([
    db
      .select({
        response: schema.problemResponses,
        sender: schema.users,
      })
      .from(schema.problemResponses)
      .innerJoin(schema.users, eq(schema.problemResponses.senderId, schema.users.id))
      .where(inArray(schema.problemResponses.problemId, ids))
      .orderBy(asc(schema.problemResponses.createdAt)),
    db
      .select()
      .from(schema.problemSolvers)
      .where(inArray(schema.problemSolvers.problemId, ids)),
  ]);

  const responsesByProblem = new Map<string, ProblemResponse[]>();
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
      createdAt: row.response.createdAt.toISOString(),
    });
    responsesByProblem.set(row.response.problemId, arr);
  }

  const solversByProblem = new Map<string, string[]>();
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
    createdAt: r.problem.createdAt.toISOString(),
  }));
}

export async function getProblemById(
  db: AppDatabase,
  id: string
): Promise<ProblemStatement | null> {
  const [r] = await db
    .select({
      problem: schema.problems,
      author: schema.users,
    })
    .from(schema.problems)
    .innerJoin(schema.users, eq(schema.problems.authorId, schema.users.id))
    .where(eq(schema.problems.id, id))
    .limit(1);

  if (!r) return null;

  const [responseRows, solverRows] = await Promise.all([
    db
      .select({
        response: schema.problemResponses,
        sender: schema.users,
      })
      .from(schema.problemResponses)
      .innerJoin(schema.users, eq(schema.problemResponses.senderId, schema.users.id))
      .where(eq(schema.problemResponses.problemId, id))
      .orderBy(asc(schema.problemResponses.createdAt)),
    db.select().from(schema.problemSolvers).where(eq(schema.problemSolvers.problemId, id)),
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
      createdAt: row.response.createdAt.toISOString(),
    })),
    createdAt: r.problem.createdAt.toISOString(),
  };
}

function mapPlacementApplicant(
  app: typeof schema.placementApplications.$inferSelect,
  student: typeof schema.users.$inferSelect,
  viewer: typeof schema.users.$inferSelect
): PlacementApplicant {
  const canSeeDetails =
    viewer.role === 'admin' || viewer.role === 'faculty' || app.studentId === viewer.id;

  if (!canSeeDetails) {
    return {
      studentId: '',
      studentMemberId: '',
      studentName: '',
      studentEmail: '',
      cgpa: 0,
      leetcodeSolved: 0,
      leetcodeVerified: false,
      hackerrankFiveStars: 0,
      hackerrankVerified: false,
      githubProjects: 0,
      githubVerified: false,
      resumeLink: '',
      appliedAt: app.appliedAt.toISOString(),
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
    appliedAt: app.appliedAt.toISOString(),
  };
}

export async function getPlacementDrivesList(
  db: AppDatabase,
  viewer: typeof schema.users.$inferSelect
): Promise<PlacementDrive[]> {
  const driveRows = await db
    .select({
      drive: schema.placementDrives,
      authorName: schema.users.name,
    })
    .from(schema.placementDrives)
    .leftJoin(schema.users, eq(schema.placementDrives.authorId, schema.users.id))
    .orderBy(desc(schema.placementDrives.createdAt));

  if (driveRows.length === 0) return [];
  const driveIds = driveRows.map((r) => r.drive.id);

  const applicantRows = await db
    .select({
      app: schema.placementApplications,
      student: schema.users,
    })
    .from(schema.placementApplications)
    .innerJoin(schema.users, eq(schema.placementApplications.studentId, schema.users.id))
    .where(inArray(schema.placementApplications.driveId, driveIds))
    .orderBy(asc(schema.placementApplications.appliedAt));

  const appsByDrive = new Map<string, PlacementApplicant[]>();
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
      minGithubProjects: r.drive.minGithubProjects,
    },
    applicants: appsByDrive.get(r.drive.id) ?? [],
    authorId: r.drive.authorId ?? '',
    authorName: r.authorName || r.drive.authorNameSnapshot || 'Placement Cell',
    createdAt: r.drive.createdAt.toISOString(),
  }));
}

export async function getPlacementDriveById(
  db: AppDatabase,
  id: string,
  viewer: typeof schema.users.$inferSelect
): Promise<PlacementDrive | null> {
  const [r] = await db
    .select({
      drive: schema.placementDrives,
      authorName: schema.users.name,
    })
    .from(schema.placementDrives)
    .leftJoin(schema.users, eq(schema.placementDrives.authorId, schema.users.id))
    .where(eq(schema.placementDrives.id, id))
    .limit(1);

  if (!r) return null;

  const applicantRows = await db
    .select({
      app: schema.placementApplications,
      student: schema.users,
    })
    .from(schema.placementApplications)
    .innerJoin(schema.users, eq(schema.placementApplications.studentId, schema.users.id))
    .where(eq(schema.placementApplications.driveId, id))
    .orderBy(asc(schema.placementApplications.appliedAt));

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
      minGithubProjects: r.drive.minGithubProjects,
    },
    applicants: applicantRows.map((row) =>
      mapPlacementApplicant(row.app, row.student, viewer)
    ),
    authorId: r.drive.authorId ?? '',
    authorName: r.authorName || r.drive.authorNameSnapshot || 'Placement Cell',
    createdAt: r.drive.createdAt.toISOString(),
  };
}

function mapCourseEnrollment(
  en: typeof schema.courseEnrollments.$inferSelect,
  student: typeof schema.users.$inferSelect,
  viewer: typeof schema.users.$inferSelect
): CourseEnrollment {
  const canSeeDetails =
    viewer.role === 'admin' || viewer.role === 'faculty' || en.studentId === viewer.id;

  if (!canSeeDetails) {
    return {
      studentId: '',
      studentMemberId: '',
      studentName: '',
      studentEmail: '',
      enrolledAt: en.enrolledAt.toISOString(),
    };
  }

  return {
    studentId: en.studentId,
    studentMemberId: student.memberId,
    studentName: student.name,
    studentEmail: student.email,
    enrolledAt: en.enrolledAt.toISOString(),
  };
}

export async function getCoursesList(
  db: AppDatabase,
  viewer: typeof schema.users.$inferSelect
): Promise<DepartmentCourse[]> {
  const courseRows = await db
    .select()
    .from(schema.courses)
    .orderBy(desc(schema.courses.createdAt));

  if (courseRows.length === 0) return [];
  const courseIds = courseRows.map((c) => c.id);

  const enrollmentRows = await db
    .select({
      en: schema.courseEnrollments,
      student: schema.users,
    })
    .from(schema.courseEnrollments)
    .innerJoin(schema.users, eq(schema.courseEnrollments.studentId, schema.users.id))
    .where(inArray(schema.courseEnrollments.courseId, courseIds))
    .orderBy(asc(schema.courseEnrollments.enrolledAt));

  const enrollmentsByCourse = new Map<string, CourseEnrollment[]>();
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
    authorId: c.authorId ?? '',
    createdAt: c.createdAt.toISOString(),
  }));
}

export async function getCourseById(
  db: AppDatabase,
  id: string,
  viewer: typeof schema.users.$inferSelect
): Promise<DepartmentCourse | null> {
  const [c] = await db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.id, id))
    .limit(1);

  if (!c) return null;

  const enrollmentRows = await db
    .select({
      en: schema.courseEnrollments,
      student: schema.users,
    })
    .from(schema.courseEnrollments)
    .innerJoin(schema.users, eq(schema.courseEnrollments.studentId, schema.users.id))
    .where(eq(schema.courseEnrollments.courseId, id))
    .orderBy(asc(schema.courseEnrollments.enrolledAt));

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
    enrollments: enrollmentRows.map((row) =>
      mapCourseEnrollment(row.en, row.student, viewer)
    ),
    authorId: c.authorId ?? '',
    createdAt: c.createdAt.toISOString(),
  };
}

export function mapFacultyDirectoryRow(
  row: typeof schema.facultyDirectory.$inferSelect
): FacultyMember {
  return {
    id: row.id,
    linkedUserId: row.linkedUserId ?? null,
    name: row.name,
    designation: row.designation,
    specialization: row.specialization,
    email: row.email ?? '',
    phoneOrCabin: row.phoneOrCabin,
    qualification: row.qualification,
    experienceYears: row.experienceYears,
    bio: row.bio,
    authorId: row.authorId ?? '',
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getFacultyDirectoryList(db: AppDatabase): Promise<FacultyMember[]> {
  const rows = await db
    .select()
    .from(schema.facultyDirectory)
    .orderBy(desc(schema.facultyDirectory.createdAt));

  return rows.map(mapFacultyDirectoryRow);
}

export async function getAcademicResourcesList(
  db: AppDatabase
): Promise<AcademicResource[]> {
  const rows = await db
    .select({
      resource: schema.academicResources,
      authorName: schema.users.name,
    })
    .from(schema.academicResources)
    .leftJoin(schema.users, eq(schema.academicResources.authorId, schema.users.id))
    .orderBy(desc(schema.academicResources.createdAt));

  return rows.map((r) => ({
    id: r.resource.id,
    title: r.resource.title,
    resourceType: r.resource.resourceType,
    subjectOrLab: r.resource.subjectOrLab,
    description: r.resource.description,
    resourceLink: r.resource.resourceLink,
    authorId: r.resource.authorId ?? '',
    authorName: r.authorName || r.resource.authorNameSnapshot || 'Department Faculty',
    createdAt: r.resource.createdAt.toISOString(),
  }));
}

export async function getNotificationsForUser(
  db: AppDatabase,
  userId: string
): Promise<PortalNotification[]> {
  const rows = await db
    .select({
      notif: schema.notifications,
      actorName: schema.users.name,
    })
    .from(schema.notifications)
    .leftJoin(schema.users, eq(schema.notifications.actorId, schema.users.id))
    .where(
      or(
        isNull(schema.notifications.recipientUserId),
        eq(schema.notifications.recipientUserId, userId)
      )
    )
    .orderBy(desc(schema.notifications.createdAt));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.notif.id);

  const readRows = await db
    .select({ notificationId: schema.notificationReads.notificationId })
    .from(schema.notificationReads)
    .where(
      and(
        eq(schema.notificationReads.userId, userId),
        inArray(schema.notificationReads.notificationId, ids)
      )
    );

  const readSet = new Set(readRows.map((r) => r.notificationId));

  return rows.map((r) => ({
    id: r.notif.id,
    type: r.notif.type,
    title: r.notif.title,
    message: r.notif.message,
    targetSection: r.notif.targetSection as NavSection,
    targetItemId: r.notif.targetItemId ?? undefined,
    recipientUserId: r.notif.recipientUserId ?? undefined,
    actorId: r.notif.actorId ?? '',
    actorName: r.actorName || r.notif.actorNameSnapshot || 'Portal Member',
    readByUserIds: readSet.has(r.notif.id) ? [userId] : [],
    createdAt: r.notif.createdAt.toISOString(),
  }));
}

export function mapReminderRow(
  row: typeof schema.personalReminders.$inferSelect
): PortalReminderItem {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    note: row.note,
    dueDate: row.dueDate,
    category: row.category,
    priority: row.priority,
    completed: row.completed,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getPersonalRemindersForUser(
  db: AppDatabase,
  userId: string
): Promise<PortalReminderItem[]> {
  const rows = await db
    .select()
    .from(schema.personalReminders)
    .where(eq(schema.personalReminders.userId, userId))
    .orderBy(desc(schema.personalReminders.createdAt));

  return rows.map(mapReminderRow);
}

export async function getPublicBootstrapPayload(
  db: AppDatabase
): Promise<PortalBootstrapPayload> {
  const [
    spotlightsList,
    [hackCount],
    [projCount],
    [intCount],
    [probCount],
    [appCount],
    [placeCount],
    [courseCount],
    [facCount],
  ] = await Promise.all([
    getSpotlightsList(db),
    db.select({ value: count() }).from(schema.hackathons),
    db.select({ value: count() }).from(schema.projects),
    db.select({ value: count() }).from(schema.interviews),
    db.select({ value: count() }).from(schema.problems),
    db.select({ value: count() }).from(schema.appTechnologies),
    db.select({ value: count() }).from(schema.placementDrives),
    db.select({ value: count() }).from(schema.courses),
    db.select({ value: count() }).from(schema.facultyDirectory),
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
      facultyMembers: Number(facCount?.value ?? 0),
    },
  };
}

export async function getAuthenticatedBootstrapPayload(
  db: AppDatabase,
  viewer: typeof schema.users.$inferSelect
): Promise<PortalBootstrapPayload> {
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
    remindersList,
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
    getPersonalRemindersForUser(db, viewer.id),
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
    personalReminders: remindersList,
  };
}

export async function searchStudentsDirectory(
  db: AppDatabase,
  queryText: string,
  options: { includePhone?: boolean } = {}
): Promise<StudentDirectoryDetail[]> {
  const q = queryText.trim();
  const baseCondition = and(
    eq(schema.users.role, 'student'),
    eq(schema.users.isActive, true)
  );

  const whereClause = q
    ? and(
        baseCondition,
        or(
          ilike(schema.users.memberId, `%${q}%`),
          ilike(schema.users.name, `%${q}%`),
          ilike(schema.users.skills, `%${q}%`)
        )
      )
    : baseCondition;

  const studentRows = await db
    .select({
      user: schema.users,
      studentProfile: schema.studentProfiles,
    })
    .from(schema.users)
    .leftJoin(schema.studentProfiles, eq(schema.users.id, schema.studentProfiles.userId))
    .where(whereClause)
    .orderBy(asc(schema.users.name));

  if (studentRows.length === 0) return [];

  const results = await Promise.all(
    studentRows.map(async (row) => {
      const [progress, studentProjects, studentApps, studentHackathons, studentInterviews] =
        await Promise.all([
          computeUserProgress(db, row.user.id),
          getProjectsList(db, row.user.id),
          getAppsList(db, row.user.id),
          getHackathonsList(db, row.user.id),
          getInterviewsList(db, row.user.id),
        ]);

      return {
        profile: toPublicProfile(
          {
            user: row.user,
            studentProfile: row.studentProfile,
            facultyProfile: null,
            adminProfile: null,
          },
          { includePhone: Boolean(options.includePhone) }
        ),
        progress,
        projects: studentProjects,
        apps: studentApps,
        hackathons: studentHackathons,
        interviews: studentInterviews,
      };
    })
  );

  return results;
}
