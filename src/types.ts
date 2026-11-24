export type UserRole = 'student' | 'faculty' | 'admin';

export type AdminModulePermission =
  | 'students'
  | 'faculty'
  | 'placements'
  | 'coding_verification'
  | 'dashboard_analytics';

export interface AdminPermissions {
  students: boolean;
  faculty: boolean;
  placements: boolean;
  codingVerification: boolean;
  dashboardAnalytics: boolean;
  canCreateAdmins: boolean;
}

export interface AdminAnalyticsSummary {
  totalStudents: number;
  activeStudents: number;
  verifiedCodingStudents: number;
  totalFaculty: number;
  activeFaculty: number;
  totalAdmins: number;
  activeAdmins: number;
  totalPlacements: number;
  totalPlacementApplications: number;
  totalProjects: number;
  totalHackathons: number;
  totalInterviews: number;
  openProblems: number;
  solvedProblems: number;
  totalCourses: number;
  totalResources: number;
  totalSpotlights: number;
}

export type NavSection =
  | 'dashboard'
  | 'admin-control'
  | 'hackathons'
  | 'projects'
  | 'interview-experience'
  | 'problems'
  | 'apps'
  | 'placements'
  | 'courses'
  | 'faculty'
  | 'resources'
  | 'student-search'
  | 'profile';

export interface CodingStats {
  leetcodeUrl: string;
  leetcodeUsername: string;
  leetcodeSolved: number;
  leetcodeEasy: number;
  leetcodeMedium: number;
  leetcodeHard: number;
  leetcodeVerified?: boolean;
  leetcodeVerifiedAt?: string | null;
  leetcodeOwnerVerified?: boolean;
  hackerrankUrl: string;
  hackerrankUsername: string;
  hackerrankFiveStars: number;
  hackerrankVerified?: boolean;
  hackerrankVerifiedAt?: string | null;
  hackerrankOwnerVerified?: boolean;
  githubUrl: string;
  githubUsername: string;
  githubProjects: number;
  githubVerified?: boolean;
  githubVerifiedAt?: string | null;
  githubOwnerVerified?: boolean;
  lastSyncedAt?: string;
}

export interface PublicUserProfile {
  id: string;
  memberId: string;
  name: string;
  email: string;
  role: UserRole;
  batchOrDesignation: string;
  department?: string;
  designation?: string;
  specialization?: string;
  qualification?: string;
  experienceYears?: number;
  year?: string;
  section?: string;
  phone?: string;
  isActive?: boolean;
  cgpa: number;
  bio: string;
  skills: string;
  canManageSpotlights: boolean;
  isSuperAdmin?: boolean;
  adminRoleLabel?: string;
  adminPermissions?: AdminPermissions;
  createdByAdminId?: string | null;
  codingStats: CodingStats;
  createdAt: string;
}

export interface PortalProgress {
  appsUploaded: number;
  problemsSolved: number;
  projectsPublished: number;
  hackathonsShared: number;
  problemsPosted: number;
  placementsApplied: number;
  coursesEnrolled: number;
  interviewsShared: number;
}

export interface StudentDirectoryDetail {
  profile: PublicUserProfile;
  progress: PortalProgress;
  projects: DepartmentProject[];
  apps: AppTechnology[];
  hackathons: HackathonExperience[];
  interviews: InterviewExperience[];
}

export interface SpotlightBanner {
  id: string;
  department?: string;
  category: string;
  headlineValue: string;
  title: string;
  recipients: string;
  description: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface HackathonExperience {
  id: string;
  hackathonName: string;
  organizer: string;
  eventDate: string;
  teamAndRole: string;
  outcome: string;
  technologies: string;
  overallExperience: string;
  authorId: string;
  authorName: string;
  authorMemberId: string;
  authorEmail: string;
  authorBatch: string;
  authorRole: UserRole;
  createdAt: string;
}

export interface InterviewRoundDetail {
  roundNumber: number;
  roundTitle: string; // e.g. "Round 1: Online Assessment", "Round 2: Technical (DSA)"
  topicsCovered: string; // e.g. "Graphs, Dynamic Programming, SQL"
  questionsAsked: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface InterviewExperience {
  id: string;
  companyName: string;
  roleTitle: string;
  companyDomain?: string; // e.g. "Enterprise Software & Cloud", "Financial Technology"
  skillsNeeded?: string; // e.g. "Data Structures, System Design, Concurrency, Java/C++"
  hiringType: 'On-Campus' | 'Off-Campus' | 'Internship' | 'Full-Time';
  packageOrStipend: string;
  interviewDate: string;
  resultStatus: 'Selected / Offered' | 'Rejected' | 'In Progress / Final Round';
  overallDifficulty: 'Easy' | 'Medium' | 'Hard';
  overallExperience: string;
  rounds: InterviewRoundDetail[];
  keyPreparationTips: string;
  resourcesUsed?: string;
  authorId: string;
  authorName: string;
  authorMemberId: string;
  authorEmail: string;
  authorBatch: string;
  authorRole: UserRole;
  createdAt: string;
}

export interface DepartmentProject {
  id: string;
  projectName: string;
  websiteType: string;
  projectLink: string;
  technologies: string;
  description: string;
  authorId: string;
  authorName: string;
  authorMemberId: string;
  authorEmail: string;
  authorBatch: string;
  authorRole: UserRole;
  createdAt: string;
}

export interface ProblemResponse {
  id: string;
  senderId: string;
  senderName: string;
  senderMemberId: string;
  senderEmail: string;
  senderRole: UserRole;
  message: string;
  solutionLink: string;
  marksSolved: boolean;
  createdAt: string;
}

export interface ProblemStatement {
  id: string;
  title: string;
  applicationName: string;
  category: string;
  description: string;
  contactInfo: string;
  contactEmail: string;
  status: 'open' | 'solved';
  authorId: string;
  authorName: string;
  authorMemberId: string;
  authorBatch: string;
  authorRole: UserRole;
  solvedByIds: string[];
  responses: ProblemResponse[];
  createdAt: string;
}

export interface AppTechnology {
  id: string;
  appName: string;
  usedTechnologies: string;
  description: string;
  appType: string;
  appLink: string;
  authorId: string;
  authorName: string;
  authorMemberId: string;
  authorEmail: string;
  authorBatch: string;
  authorRole: UserRole;
  createdAt: string;
}

export interface PlacementCriteria {
  requireCgpa: boolean;
  minCgpa: number;
  requireLeetcode: boolean;
  minLeetcodeProblems: number;
  requireHackerrank: boolean;
  minHackerrankFiveStars: number;
  requireGithub: boolean;
  minGithubProjects: number;
}

export interface PlacementApplicant {
  studentId: string;
  studentMemberId: string;
  studentName: string;
  studentEmail: string;
  cgpa: number;
  leetcodeSolved: number;
  leetcodeVerified?: boolean;
  hackerrankFiveStars: number;
  hackerrankVerified?: boolean;
  githubProjects: number;
  githubVerified?: boolean;
  resumeLink: string;
  appliedAt: string;
}

export interface PlacementDrive {
  id: string;
  companyName: string;
  roleTitle: string;
  packageCtc: string;
  location: string;
  deadline: string;
  applyLink: string;
  description: string;
  criteria: PlacementCriteria;
  applicants: PlacementApplicant[];
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface CourseEnrollment {
  studentId: string;
  studentMemberId: string;
  studentName: string;
  studentEmail: string;
  enrolledAt: string;
}

export interface DepartmentCourse {
  id: string;
  courseCode: string;
  title: string;
  instructorName: string;
  semester: string;
  credits: number;
  schedule: string;
  prerequisites: string;
  description: string;
  resourceLink: string;
  enrollments: CourseEnrollment[];
  authorId: string;
  createdAt: string;
}

export interface FacultyMember {
  id: string;
  linkedUserId?: string | null;
  name: string;
  designation: string; // e.g. "Professor & Head of Department (HOD)", "Professor", "Associate Professor", "Assistant Professor"
  specialization: string; // e.g. "Distributed Systems, Cloud Architecture, Fault-Tolerant Computing"
  email: string;
  phoneOrCabin: string; // e.g. "Cabin LH-302 · Ext 210"
  qualification: string; // e.g. "Ph.D (IIT Madras), M.Tech (IISc)"
  experienceYears: number;
  bio?: string;
  authorId: string;
  createdAt: string;
}

export interface AcademicResource {
  id: string;
  title: string;
  resourceType: string;
  subjectOrLab: string;
  description: string;
  resourceLink: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface PortalReminderItem {
  id: string;
  userId: string;
  title: string;
  note?: string;
  dueDate?: string;
  category: 'problem_statement' | 'placement' | 'hackathon' | 'interview' | 'exam_lab' | 'general';
  priority: 'High' | 'Normal' | 'Low';
  completed: boolean;
  createdAt: string;
}

export interface PortalNotification {
  id: string;
  type:
    | 'problem_posted'
    | 'problem_message'
    | 'placement_posted'
    | 'interview_posted'
    | 'spotlight'
    | 'reminder';
  title: string;
  message: string;
  targetSection: NavSection;
  targetItemId?: string;
  recipientUserId?: string;
  actorId: string;
  actorName: string;
  readByUserIds: string[];
  createdAt: string;
}

export interface PortalPublicCounts {
  hackathons: number;
  projects: number;
  interviews: number;
  problems: number;
  apps: number;
  placements: number;
  courses: number;
  facultyMembers: number;
}

export interface PortalBootstrapPayload {
  spotlights: SpotlightBanner[];
  hackathons: HackathonExperience[];
  projects: DepartmentProject[];
  interviews: InterviewExperience[];
  problems: ProblemStatement[];
  apps: AppTechnology[];
  placements: PlacementDrive[];
  courses: DepartmentCourse[];
  facultyMembers: FacultyMember[];
  resources: AcademicResource[];
  notifications: PortalNotification[];
  personalReminders?: PortalReminderItem[];
  publicCounts?: PortalPublicCounts;
}
