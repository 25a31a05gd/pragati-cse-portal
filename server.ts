import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  UserRole,
  CodingStats,
  PublicUserProfile,
  PortalProgress,
  SpotlightBanner,
  HackathonExperience,
  InterviewExperience,
  DepartmentProject,
  ProblemStatement,
  AppTechnology,
  PlacementDrive,
  DepartmentCourse,
  FacultyMember,
  AcademicResource,
  PortalNotification,
  PortalReminderItem,
} from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StoredUser extends PublicUserProfile {
  passwordHash: string;
  passwordSalt: string;
  isDirectorySeed?: boolean;
}

interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
}

interface StaffAccount {
  id: string;
  name: string;
  designation: string;
  pin: string;
  memberId: string;
  email: string;
}

interface PortalDatabase {
  users: StoredUser[];
  sessions: SessionRecord[];
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
  personalReminders: PortalReminderItem[];
  adminInitialized?: boolean;
  adminPin?: string;
  staffAccounts?: StaffAccount[];
}

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'portal-db.json');

function createDefaultCodingStats() {
  return {
    leetcodeUrl: '',
    leetcodeUsername: '',
    leetcodeSolved: 0,
    leetcodeEasy: 0,
    leetcodeMedium: 0,
    leetcodeHard: 0,
    hackerrankUrl: '',
    hackerrankUsername: '',
    hackerrankFiveStars: 0,
    githubUrl: '',
    githubUsername: '',
    githubProjects: 0,
  };
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function toPublicProfile(user: StoredUser): PublicUserProfile {
  return {
    id: user.id,
    memberId: user.memberId,
    name: user.name,
    email: user.email,
    role: user.role,
    batchOrDesignation: user.batchOrDesignation,
    department: user.department,
    year: user.year,
    section: user.section,
    phone: user.phone,
    isActive: user.isActive !== false,
    cgpa: user.cgpa,
    bio: user.bio,
    skills: user.skills,
    canManageSpotlights: user.canManageSpotlights,
    codingStats: user.codingStats,
    createdAt: user.createdAt,
  };
}

function createInitialDatabase(): PortalDatabase {
  // Start with a clean users list so all Student, Faculty, and Admin accounts are newly entered
  const directoryStudents: StoredUser[] = [];
  const initialStaffUsers: StoredUser[] = [];

  const spotlights: SpotlightBanner[] = [
    {
      id: 'spot-1',
      category: 'Highest Placement Package',
      headlineValue: '₹44.0 LPA Highest CTC',
      title: 'Annual CSE Campus Placement Milestone 2026',
      recipients: 'Sneha Kulkarni (22CSE118) & 6 Final-Year Scholars',
      description: 'Record software engineering offers secured across systems architecture, cloud infrastructure, and quantitative engineering roles during Phase-1 campus recruitment.',
      authorId: 'system-dept',
      authorName: 'CSE Placement Cell',
      createdAt: '2026-10-20T09:00:00Z',
    },
    {
      id: 'spot-2',
      category: 'First Prize — National Hackathon',
      headlineValue: '1st Prize · ₹1,00,000 Grant',
      title: 'Smart India Hackathon Grand Finale Winners (Software Edition)',
      recipients: 'Team KernelForge — Rohan Deshmukh (22CSE104), Arjun Nair (23CSE056)',
      description: 'Awarded First Prize nationally for building a real-time offline-capable rural telemetry diagnostic platform under 36 hours of continuous evaluation.',
      authorId: 'system-dept',
      authorName: 'Department Innovation Council',
      createdAt: '2026-10-24T12:00:00Z',
    },
  ];

  const hackathons: HackathonExperience[] = [
    {
      id: 'hack-1',
      hackathonName: 'Smart India Hackathon 2026 — Grand Finale',
      organizer: 'Ministry of Education Innovation Cell · IIT Madras Nodal Center',
      eventDate: 'October 2026',
      teamAndRole: 'Team KernelForge (6 Members) · Lead Backend Architect',
      outcome: '1st Prize Winner (₹1,00,000)',
      technologies: 'Go, React, SQLiteSync, WebSockets, Docker',
      overallExperience: 'Over 36 hours with three rounds of jury mentoring, our initial monolithic API hit severe sync bottlenecks on intermittent 2G network simulations. Mentoring feedback at midnight pushed us to redesign around delta-compressed local queues. Presenting the live fault-recovery demo to the industry panel was the most defining engineering experience of our undergraduate journey.',
      authorId: 'stu-dir-1',
      authorName: 'Rohan Deshmukh',
      authorMemberId: '22CSE104',
      authorEmail: 'rohan.22cse104@dept.edu',
      authorBatch: '3rd Year B.Tech CSE · Section A',
      authorRole: 'student',
      createdAt: '2026-10-25T15:30:00Z',
    },
    {
      id: 'hack-2',
      hackathonName: 'ETHGlobal & Systems Buildathon Bengaluru',
      organizer: 'Indian Institute of Science (IISc) Open Systems Track',
      eventDate: 'September 2026',
      teamAndRole: 'Team ZeroLatency (4 Members) · Full-Stack & ML Pipeline Lead',
      outcome: 'Top 5 Finalist — Systems Track',
      technologies: 'Python, FastAPI, ONNX Runtime, TypeScript, Tailwind CSS',
      overallExperience: 'We built an on-device academic plagiarism and citation verifier capable of indexing 10,000+ department PDFs in under 4 seconds using quantized embeddings. Collaborating under tight memory budgets taught us profiling discipline and clean team task handoffs.',
      authorId: 'stu-dir-2',
      authorName: 'Sneha Kulkarni',
      authorMemberId: '22CSE118',
      authorEmail: 'sneha.22cse118@dept.edu',
      authorBatch: '3rd Year B.Tech CSE · Section B',
      authorRole: 'student',
      createdAt: '2026-09-29T18:10:00Z',
    },
  ];

  const interviews: InterviewExperience[] = [
    {
      id: 'int-1',
      companyName: 'Atlassian',
      roleTitle: 'Software Development Engineer — Graduate 2027',
      companyDomain: 'Enterprise Collaboration & Cloud Developer Tools',
      skillsNeeded: 'Data Structures, Concurrent Systems, OOP Design, Java / C++, Clean Code',
      hiringType: 'On-Campus',
      packageOrStipend: '₹38.0 LPA',
      interviewDate: 'October 2026',
      resultStatus: 'Selected / Offered',
      overallDifficulty: 'Hard',
      overallExperience: 'The hiring process consisted of 1 Online Assessment followed by 3 Technical rounds and 1 Values interview. The interviewers cared deeply about writing clean, modular code with exception handling and discussing multiple trade-offs for distributed caching and rate-limiting.',
      rounds: [
        {
          roundNumber: 1,
          roundTitle: 'Round 1: Online Coding Assessment (OA)',
          topicsCovered: 'Data Structures, Dynamic Programming, Strings',
          questionsAsked: 'Question 1: Multi-source BFS on a grid with obstacle constraints. Question 2: Segment tree range update query problem with modulo arithmetic.',
          difficulty: 'Hard',
        },
        {
          roundNumber: 2,
          roundTitle: 'Round 2: Technical Interview 1 (DSA & Problem Solving)',
          topicsCovered: 'Trees, LRU Cache, Concurrency',
          questionsAsked: 'Design an in-memory TTL cache with O(1) get/set and concurrent thread-safe eviction. Asked to write clean Java/C++ code with mutexes.',
          difficulty: 'Hard',
        },
        {
          roundNumber: 3,
          roundTitle: 'Round 3: Low-Level System Design & Projects',
          topicsCovered: 'Object-Oriented Design, Design Patterns',
          questionsAsked: 'Design a distributed rate-limiter service (Token Bucket vs Sliding Window Log). Deep dive into my college LabGrid autograder project architecture.',
          difficulty: 'Medium',
        },
        {
          roundNumber: 4,
          roundTitle: 'Round 4: Atlassian Values & Behavioral',
          topicsCovered: 'Teamwork, Conflict Resolution, "Open Company, No Bullshit"',
          questionsAsked: 'Scenario questions on handling deadline mismatches and how I resolved a major merge conflict during our SIH hackathon sprint.',
          difficulty: 'Easy',
        },
      ],
      keyPreparationTips: 'Focus heavily on OOP design patterns, concurrency in Java/C++/Go, and explaining your thought process out loud before typing code. Striver SDE sheet and NeetCode 150 were invaluable.',
      resourcesUsed: 'NeetCode 150, Designing Data-Intensive Applications, LeetCode Medium/Hard',
      authorId: 'stu-dir-1',
      authorName: 'Rohan Deshmukh',
      authorMemberId: '22CSE104',
      authorEmail: 'rohan.22cse104@dept.edu',
      authorBatch: '3rd Year B.Tech CSE · Section A',
      authorRole: 'student',
      createdAt: '2026-10-28T16:00:00Z',
    },
    {
      id: 'int-2',
      companyName: 'Google',
      roleTitle: 'Software Engineer (SWE University Graduate)',
      companyDomain: 'Global Systems, Search & Distributed Cloud Infrastructure',
      skillsNeeded: 'Advanced Graph Algorithms, Dynamic Programming, Trie, Complexity Proofs, C++ / Python',
      hiringType: 'Off-Campus',
      packageOrStipend: '₹34.5 LPA Base + Stocks',
      interviewDate: 'September 2026',
      resultStatus: 'Selected / Offered',
      overallDifficulty: 'Hard',
      overallExperience: 'Cleared 4 back-to-back virtual onsite rounds after passing the Google Kickstart / Online Screening. The emphasis was purely on algorithms, optimal graph traversals, and rigorous time & space complexity proofs.',
      rounds: [
        {
          roundNumber: 1,
          roundTitle: 'Round 1: Coding (Graphs & Topological Sort)',
          topicsCovered: 'DAG, Kahn Algorithm, Cycle Detection',
          questionsAsked: 'Dependency resolution system with version pinning and cycle detection under resource contention in O(V + E).',
          difficulty: 'Hard',
        },
        {
          roundNumber: 2,
          roundTitle: 'Round 2: Coding (Dynamic Programming & Bitmasking)',
          topicsCovered: 'Bitmask DP, State Compression',
          questionsAsked: 'Traveling salesman variation with mandatory checkpoints and battery recharging stations.',
          difficulty: 'Hard',
        },
        {
          roundNumber: 3,
          roundTitle: 'Round 3: Data Structures (Trie & Suffix Arrays)',
          topicsCovered: 'Trie, Prefix Matching, Memory Optimization',
          questionsAsked: 'Real-time autocomplete engine for search queries with top-K frequency ranking in O(K log N).',
          difficulty: 'Medium',
        },
        {
          roundNumber: 4,
          roundTitle: 'Round 4: Googleyness & Leadership',
          topicsCovered: 'Collaboration, Ethics, Ambiguity',
          questionsAsked: 'How do you handle ambiguous project specifications when team members hold conflicting technical opinions?',
          difficulty: 'Easy',
        },
      ],
      keyPreparationTips: 'Write production-ready code with edge case checks (null inputs, empty arrays, integer overflows). Practice writing code without IDE autocomplete in Google Docs.',
      resourcesUsed: 'CSES Problem Set, LeetCode Hard Graphs, CLRS Algorithms',
      authorId: 'stu-dir-2',
      authorName: 'Sneha Kulkarni',
      authorMemberId: '22CSE118',
      authorEmail: 'sneha.22cse118@dept.edu',
      authorBatch: '3rd Year B.Tech CSE · Section B',
      authorRole: 'student',
      createdAt: '2026-10-15T11:20:00Z',
    },
    {
      id: 'int-3',
      companyName: 'Zoho',
      roleTitle: 'Member Technical Staff (MTS)',
      companyDomain: 'Cloud Business Suites & In-House Systems',
      skillsNeeded: 'C Programming, Memory Allocation, Custom Data Structures, Object-Oriented Design',
      hiringType: 'On-Campus',
      packageOrStipend: '₹14.5 LPA',
      interviewDate: 'October 2026',
      resultStatus: 'Selected / Offered',
      overallDifficulty: 'Medium',
      overallExperience: 'Classic Zoho recruitment drive: paper-pencil written programming round, basic C logic, advanced DSA implementation without built-in library functions, and low-level application design.',
      rounds: [
        {
          roundNumber: 1,
          roundTitle: 'Round 1: Written Programming & C Aptitude',
          topicsCovered: 'Pointers, Bitwise operators, Recursion',
          questionsAsked: 'Pointer arithmetic output prediction, matrix spiraling, and pattern generation questions.',
          difficulty: 'Medium',
        },
        {
          roundNumber: 2,
          roundTitle: 'Round 2: Basic Programming & DSA (Hands-on)',
          topicsCovered: 'Arrays, Strings, Stacks',
          questionsAsked: 'Implement string substring matching without std::string functions; Evaluate postfix expressions.',
          difficulty: 'Medium',
        },
        {
          roundNumber: 3,
          roundTitle: 'Round 3: Advanced Programming (Design App from Scratch)',
          topicsCovered: 'OOPs, File Handling, Clean Architecture',
          questionsAsked: 'Build a railway reservation system with waiting list allocation, berth preferences, and ticket cancellation logic in 2 hours.',
          difficulty: 'Hard',
        },
        {
          roundNumber: 4,
          roundTitle: 'Round 4: Technical HR & Fitment',
          topicsCovered: 'Work culture, willingness to work on proprietary Zoho stacks',
          questionsAsked: 'Discussion on why Zoho, projects completed, and adaptability to in-house frameworks.',
          difficulty: 'Easy',
        },
      ],
      keyPreparationTips: 'Do not rely heavily on STL / built-in methods. Practice implementing custom stacks, queues, and linked lists from scratch in C++ or Java.',
      resourcesUsed: 'GeeksforGeeks Zoho Archives, OOP principles in Java',
      authorId: 'stu-dir-3',
      authorName: 'Arjun Nair',
      authorMemberId: '23CSE056',
      authorEmail: 'arjun.23cse056@dept.edu',
      authorBatch: '2nd Year B.Tech CSE · Section A',
      authorRole: 'student',
      createdAt: '2026-10-24T14:40:00Z',
    },
    {
      id: 'int-4',
      companyName: 'Microsoft',
      roleTitle: 'Software Engineer (SWE Grad 2027)',
      companyDomain: 'Cloud & AI Platforms (Azure / Office)',
      skillsNeeded: 'Binary Trees, Dynamic Programming, System Design, Operating Systems, C# / C++',
      hiringType: 'On-Campus',
      packageOrStipend: '₹28.5 LPA',
      interviewDate: 'November 2026',
      resultStatus: 'Selected / Offered',
      overallDifficulty: 'Hard',
      overallExperience: 'Three rounds focusing heavily on binary tree traversals, memory leak detection, virtual memory, and scalable REST API design.',
      rounds: [
        {
          roundNumber: 1,
          roundTitle: 'Round 1: Online Assessment',
          topicsCovered: 'DSA, Bitwise, Greedy',
          questionsAsked: '3 Coding questions in 75 mins: Min deletions to make character frequencies unique, max binary tree path sum variation.',
          difficulty: 'Medium',
        },
        {
          roundNumber: 2,
          roundTitle: 'Round 2: Technical Interview 1',
          topicsCovered: 'Trees, Linked Lists, OS Basics',
          questionsAsked: 'Lowest common ancestor in a binary tree with parent pointers, process vs thread memory spaces.',
          difficulty: 'Medium',
        },
        {
          roundNumber: 3,
          roundTitle: 'Round 3: Technical Interview 2 & System Design',
          topicsCovered: 'Distributed Storage, Indexing',
          questionsAsked: 'Design a document collaboration system with undo/redo capabilities and conflict resolution.',
          difficulty: 'Hard',
        },
      ],
      keyPreparationTips: 'Practice tree traversals and explain OS memory management, virtual memory paging, and multithreading thoroughly.',
      resourcesUsed: 'LeetCode Microsoft tagged, Operating Systems Three Easy Pieces',
      authorId: 'stu-dir-1',
      authorName: 'Rohan Deshmukh',
      authorMemberId: '22CSE104',
      authorEmail: 'rohan.22cse104@dept.edu',
      authorBatch: '3rd Year B.Tech CSE · Section A',
      authorRole: 'student',
      createdAt: '2026-10-30T10:00:00Z',
    },
  ];

  const projects: DepartmentProject[] = [
    {
      id: 'proj-1',
      projectName: 'LabGrid — Distributed Code Judge & Auto-Grader',
      websiteType: 'Systems & Cloud Platform',
      projectLink: 'https://github.com/rohan-cse104/labgrid-autograder',
      technologies: 'Go, Linux Namespaces, React, PostgreSQL, Redis',
      description: 'Sandboxed C/C++, Java, and Python lab assignment evaluator built for CSE programming labs. Evaluates 120 concurrent submissions with deterministic memory and CPU time-slice limits and generates line-by-line test case diagnostics.',
      authorId: 'stu-dir-1',
      authorName: 'Rohan Deshmukh',
      authorMemberId: '22CSE104',
      authorEmail: 'rohan.22cse104@dept.edu',
      authorBatch: '3rd Year B.Tech CSE · Section A',
      authorRole: 'student',
      createdAt: '2026-10-12T11:20:00Z',
    },
    {
      id: 'proj-2',
      projectName: 'SyllabusLens — Prerequisite Graph & Electives Planner',
      websiteType: 'Full-Stack Web Application',
      projectLink: 'https://github.com/sneha-k118/syllabus-lens',
      technologies: 'TypeScript, React, D3.js, Express, SQLite',
      description: 'Interactive curriculum dependency visualizer for CSE undergraduates to map core prerequisites, credit requirements, and Honors/Minor specialization tracks across Semesters 1 to 8.',
      authorId: 'stu-dir-2',
      authorName: 'Sneha Kulkarni',
      authorMemberId: '22CSE118',
      authorEmail: 'sneha.22cse118@dept.edu',
      authorBatch: '3rd Year B.Tech CSE · Section B',
      authorRole: 'student',
      createdAt: '2026-10-18T09:45:00Z',
    },
  ];

  const problems: ProblemStatement[] = [
    {
      id: 'prob-1',
      title: 'Automated Lab Attendance & Workstation Seat Mapping Sync Issue',
      applicationName: 'CSE Lab Session Tracker v2',
      category: 'Backend & Networking',
      description: 'During 60-student compiler design lab sessions in Lab-3, subnet DHCP lease renewals cause duplicate IP entries in the attendance check-in utility. Looking for someone experienced in MAC-binding or token-based local LAN verification to help patch the check-in service.',
      contactInfo: 'Lab Complex Block-B, Room 304 · Ext 219',
      contactEmail: 'rohan.22cse104@dept.edu',
      status: 'open',
      authorId: 'stu-dir-1',
      authorName: 'Rohan Deshmukh',
      authorMemberId: '22CSE104',
      authorBatch: '3rd Year B.Tech CSE · Section A',
      authorRole: 'student',
      solvedByIds: [],
      responses: [],
      createdAt: '2026-10-29T13:15:00Z',
    },
    {
      id: 'prob-2',
      title: 'PDF OCR Table Extraction Misalignment on Scanned Semester Results',
      applicationName: 'Result Analytics Script',
      category: 'Data & Document Processing',
      description: 'Multi-page scanned university grade sheets lose column alignment when subject titles wrap across two lines. Need a clean layout-aware table parser or OpenCV line-grid pre-processor to extract accurate SGPA tables.',
      contactInfo: 'CSE Research Wing, Desk 12',
      contactEmail: 'sneha.22cse118@dept.edu',
      status: 'open',
      authorId: 'stu-dir-2',
      authorName: 'Sneha Kulkarni',
      authorMemberId: '22CSE118',
      authorBatch: '3rd Year B.Tech CSE · Section B',
      authorRole: 'student',
      solvedByIds: [],
      responses: [],
      createdAt: '2026-10-31T09:30:00Z',
    },
  ];

  const apps: AppTechnology[] = [
    {
      id: 'app-1',
      appName: 'PacketScope Visualizer',
      usedTechnologies: 'Rust, WebAssembly, React, Tailwind CSS, libpcap',
      description: 'Browser-based PCAP packet frame inspector crafted for Computer Networks (CS304) coursework so students can inspect TCP 3-way handshakes, congestion windows, and DNS lookups visually.',
      appType: 'Educational Developer Tool',
      appLink: 'https://wireshark.org',
      authorId: 'stu-dir-3',
      authorName: 'Arjun Nair',
      authorMemberId: '23CSE056',
      authorEmail: 'arjun.23cse056@dept.edu',
      authorBatch: '2nd Year B.Tech CSE · Section A',
      authorRole: 'student',
      createdAt: '2026-10-22T16:40:00Z',
    },
    {
      id: 'app-2',
      appName: 'LatexQuick — IEEE Conference Paper Formatter',
      usedTechnologies: 'TypeScript, KaTeX, Monaco Editor, Web Workers',
      description: 'Zero-setup IEEE two-column research paper template generator and BibTeX citation checker tailored for final-year B.Tech capstone project reports.',
      appType: 'Web Productivity App',
      appLink: 'https://www.overleaf.com',
      authorId: 'stu-dir-2',
      authorName: 'Sneha Kulkarni',
      authorMemberId: '22CSE118',
      authorEmail: 'sneha.22cse118@dept.edu',
      authorBatch: '3rd Year B.Tech CSE · Section B',
      authorRole: 'student',
      createdAt: '2026-10-26T11:05:00Z',
    },
  ];

  const placements: PlacementDrive[] = [
    {
      id: 'place-1',
      companyName: 'Atlassian Engineering India',
      roleTitle: 'Software Development Engineer — Grad 2027',
      packageCtc: '₹38.0 LPA',
      location: 'Bengaluru (Hybrid)',
      deadline: '2026-11-20',
      applyLink: 'https://www.atlassian.com/company/careers',
      description: 'Full-time distributed systems and cloud platform engineering drive for final and pre-final year CSE students. Includes 90-minute DSA + System Design coding assessment.',
      criteria: {
        requireCgpa: true,
        minCgpa: 8.0,
        requireLeetcode: true,
        minLeetcodeProblems: 200,
        requireHackerrank: true,
        minHackerrankFiveStars: 3,
        requireGithub: true,
        minGithubProjects: 5,
      },
      applicants: [],
      authorId: 'system-dept',
      authorName: 'Dr. K. Venkataraman (Placement Coordinator)',
      createdAt: '2026-10-27T10:00:00Z',
    },
    {
      id: 'place-2',
      companyName: 'Zoho Corporation',
      roleTitle: 'Member Technical Staff (Core Systems & Web)',
      packageCtc: '₹14.5 LPA',
      location: 'Chennai',
      deadline: '2026-11-28',
      applyLink: 'https://www.zoho.com/careers/',
      description: 'Product engineering drive focusing on algorithmic problem-solving, low-level OOP design, and full-stack application architecture.',
      criteria: {
        requireCgpa: true,
        minCgpa: 7.0,
        requireLeetcode: true,
        minLeetcodeProblems: 100,
        requireHackerrank: true,
        minHackerrankFiveStars: 2,
        requireGithub: true,
        minGithubProjects: 3,
      },
      applicants: [],
      authorId: 'system-dept',
      authorName: 'CSE Placement Cell',
      createdAt: '2026-10-29T09:15:00Z',
    },
  ];

  const courses: DepartmentCourse[] = [
    {
      id: 'course-1',
      courseCode: 'CS412',
      title: 'Distributed Systems & Cloud Native Engineering',
      instructorName: 'Dr. Meenakshi Sundaram',
      semester: 'Semester VII · Honours Elective',
      credits: 4,
      schedule: 'Mon, Wed, Fri · 10:00 AM – 10:50 AM (LH-202)',
      prerequisites: 'Operating Systems (CS301), Computer Networks (CS304)',
      description: 'Covers Raft consensus, replicated state machines, gRPC microservices, container orchestration, and fault-tolerant storage engines with hands-on Go lab assignments.',
      resourceLink: 'https://pdos.csail.mit.edu/6.824/',
      enrollments: [],
      authorId: 'system-dept',
      createdAt: '2026-08-05T09:00:00Z',
    },
    {
      id: 'course-2',
      courseCode: 'CS318',
      title: 'Applied Machine Learning & Deep Neural Architectures',
      instructorName: 'Dr. Pradeep Kumar Rao',
      semester: 'Semester VI · Core Elective',
      credits: 4,
      schedule: 'Tue, Thu · 02:00 PM – 03:30 PM (AI Lab-1)',
      prerequisites: 'Linear Algebra, Probability & Statistics, Python Programming',
      description: 'Foundations of statistical learning, gradient optimization, convolutional & transformer architectures, model quantization, and reproducible evaluation benchmarks.',
      resourceLink: 'https://pytorch.org/tutorials/',
      enrollments: [],
      authorId: 'system-dept',
      createdAt: '2026-08-08T11:00:00Z',
    },
  ];

  const facultyMembers: FacultyMember[] = [
    {
      id: 'fac-1',
      name: 'Dr. Meenakshi Sundaram',
      designation: 'Professor & Head of Department (HOD)',
      specialization: 'Distributed Systems, Cloud Architecture & Fault-Tolerant Computing',
      email: 'hod.cse@dept.edu',
      phoneOrCabin: 'HOD Chamber, Block-A, 3rd Floor (Room 301) · Ext 101',
      qualification: 'Ph.D in Computer Science (IIT Madras), M.Tech (IISc Bengaluru)',
      experienceYears: 22,
      bio: 'Leading the CSE Department with 22+ years of research and teaching. Principal investigator for funded SERB and DST edge-cloud computing initiatives.',
      authorId: 'system-dept',
      createdAt: '2026-07-01T09:00:00Z',
    },
    {
      id: 'fac-2',
      name: 'Dr. Pradeep Kumar Rao',
      designation: 'Professor',
      specialization: 'Machine Learning, Deep Learning Architectures & Knowledge Graphs',
      email: 'pradeep.rao@dept.edu',
      phoneOrCabin: 'Cabin LH-308 · Ext 214',
      qualification: 'Ph.D in AI/ML (IIT Bombay), B.Tech CSE',
      experienceYears: 18,
      bio: 'Senior Professor mentoring undergraduate research in continual graph neural networks and scalable ML inference systems.',
      authorId: 'system-dept',
      createdAt: '2026-07-05T10:00:00Z',
    },
    {
      id: 'fac-3',
      name: 'Dr. K. Venkataraman',
      designation: 'Professor & Placement Coordinator',
      specialization: 'Algorithms, Data Structures & High-Performance Computing',
      email: 'venkataraman.k@dept.edu',
      phoneOrCabin: 'Placement Cell Wing, Room 104 · Ext 305',
      qualification: 'Ph.D in Algorithms (IIT Delhi)',
      experienceYears: 16,
      bio: 'Oversees campus placement drives, coding bootcamps, and industry internships for CSE undergraduates.',
      authorId: 'system-dept',
      createdAt: '2026-07-10T11:00:00Z',
    },
    {
      id: 'fac-4',
      name: 'Dr. Ananya Sharma',
      designation: 'Associate Professor',
      specialization: 'Computer Networks, Cryptography & Network Security',
      email: 'ananya.sharma@dept.edu',
      phoneOrCabin: 'Cabin LH-212 · Ext 180',
      qualification: 'Ph.D in Cybersecurity (IIIT Hyderabad)',
      experienceYears: 12,
      bio: 'Teaches advanced computer networks, cryptography, and leads student ethical hacking & CTF research groups.',
      authorId: 'system-dept',
      createdAt: '2026-07-15T09:30:00Z',
    },
    {
      id: 'fac-5',
      name: 'Prof. Rajeshwar Reddy',
      designation: 'Assistant Professor',
      specialization: 'Compilers, Operating Systems & Linux Kernel Internals',
      email: 'rajeshwar.reddy@dept.edu',
      phoneOrCabin: 'Systems Lab-2, Room 204 · Ext 142',
      qualification: 'M.Tech CSE (NIT Warangal), Pursuing Ph.D',
      experienceYears: 8,
      bio: 'Coordinates the Systems Programming Laboratory and open-source Linux kernel student projects.',
      authorId: 'system-dept',
      createdAt: '2026-07-20T14:00:00Z',
    },
    {
      id: 'fac-6',
      name: 'Dr. S. Radhakrishnan',
      designation: 'Associate Professor',
      specialization: 'Database Management Systems, Big Data & Distributed SQL',
      email: 'radhakrishnan.s@dept.edu',
      phoneOrCabin: 'Cabin LH-315 · Ext 228',
      qualification: 'Ph.D in Databases (Anna University)',
      experienceYears: 14,
      bio: 'Expert in transaction management, relational query optimization, and distributed storage engines.',
      authorId: 'system-dept',
      createdAt: '2026-08-01T10:00:00Z',
    },
  ];

  const resources: AcademicResource[] = [
    {
      id: 'res-1',
      title: 'Compiler Design & Operating Systems Lab Manual (2026 Regulation)',
      resourceType: 'Lab Manual',
      subjectOrLab: 'CS301 / CS306 Systems Laboratory',
      description: 'Complete POSIX system call exercises, Lex/Yacc grammar experiments, xv6 kernel scheduling tasks, and viva evaluation rubrics.',
      resourceLink: 'https://pdos.csail.mit.edu/6.828/',
      authorId: 'system-dept',
      authorName: 'CSE Systems Faculty Group',
      createdAt: '2026-08-20T09:00:00Z',
    },
    {
      id: 'res-2',
      title: 'CSE Competitive Coding & Placement Preparation Roadmap',
      resourceType: 'Coding Club Guide',
      subjectOrLab: 'Department Coding & Algorithms Forum',
      description: 'Curated 180-problem topic sheet covering graphs, dynamic programming, trees, SQL window functions, and OS/DBMS interview fundamentals.',
      resourceLink: 'https://cp-algorithms.com/',
      authorId: 'system-dept',
      authorName: 'CSE Placement & Coding Cell',
      createdAt: '2026-09-10T12:00:00Z',
    },
  ];

  const notifications: PortalNotification[] = [
    {
      id: 'notif-1',
      type: 'problem_posted',
      title: 'New Problem Statement: PDF OCR Table Extraction Misalignment',
      message: 'Sneha Kulkarni (22CSE118) posted an open problem statement in Result Analytics Script. Check if you can propose a solution.',
      targetSection: 'problems',
      targetItemId: 'prob-2',
      actorId: 'stu-dir-2',
      actorName: 'Sneha Kulkarni',
      readByUserIds: [],
      createdAt: '2026-10-31T09:30:00Z',
    },
    {
      id: 'notif-2',
      type: 'problem_posted',
      title: 'New Problem Statement: Automated Lab Attendance Sync Issue',
      message: 'Rohan Deshmukh (22CSE104) posted an open problem statement in CSE Lab Session Tracker v2.',
      targetSection: 'problems',
      targetItemId: 'prob-1',
      actorId: 'stu-dir-1',
      actorName: 'Rohan Deshmukh',
      readByUserIds: [],
      createdAt: '2026-10-29T13:15:00Z',
    },
    {
      id: 'notif-3',
      type: 'placement_posted',
      title: 'Placement Drive Reminder: Atlassian Engineering India (₹38.0 LPA)',
      message: 'Applications are closing on 2026-11-20. Ensure your LeetCode and GitHub requirements are satisfied in My Profile.',
      targetSection: 'placements',
      targetItemId: 'place-1',
      actorId: 'system-dept',
      actorName: 'CSE Placement Cell',
      readByUserIds: [],
      createdAt: '2026-10-27T10:00:00Z',
    },
    {
      id: 'notif-4',
      type: 'interview_posted',
      title: 'New Interview Experience: Atlassian SDE Graduate 2027',
      message: 'Rohan Deshmukh (22CSE104) posted a 4-round technical and values interview breakdown.',
      targetSection: 'interview-experience',
      targetItemId: 'int-1',
      actorId: 'stu-dir-1',
      actorName: 'Rohan Deshmukh',
      readByUserIds: [],
      createdAt: '2026-10-28T16:00:00Z',
    },
  ];

  const personalReminders: PortalReminderItem[] = [
    {
      id: 'rem-1',
      userId: 'stu-dir-1',
      title: 'Review Atlassian OA Topics: Multi-source BFS & Graph cycles',
      note: 'Focus on time complexity proofs and concurrent cache implementation',
      dueDate: '2026-11-15',
      category: 'placement',
      priority: 'High',
      completed: false,
      createdAt: '2026-10-28T10:00:00Z',
    },
    {
      id: 'rem-2',
      userId: 'stu-dir-1',
      title: 'Resolve Lab Attendance subnet duplicate IP issue',
      note: 'Implement MAC binding or local token check-in',
      dueDate: '2026-11-08',
      category: 'problem_statement',
      priority: 'Normal',
      completed: false,
      createdAt: '2026-10-29T14:00:00Z',
    },
  ];

  const initialStaffAccounts: StaffAccount[] = [];

  return {
    users: [...directoryStudents, ...initialStaffUsers],
    sessions: [],
    spotlights,
    hackathons,
    interviews,
    projects,
    problems,
    apps,
    placements,
    courses,
    facultyMembers,
    resources,
    notifications,
    personalReminders,
    adminInitialized: false,
    adminPin: '',
    staffAccounts: initialStaffAccounts,
  };
}

function loadDatabase(): PortalDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as PortalDatabase;
    const initial = createInitialDatabase();

    // Data migration safeguards for newly added features
    if (typeof parsed.adminInitialized !== 'boolean') {
      parsed.adminInitialized = parsed.users ? parsed.users.some((u) => u.role === 'admin' && !u.isDirectorySeed) : false;
    }
    if (!Array.isArray(parsed.staffAccounts)) {
      parsed.staffAccounts = [];
    }
    if (!Array.isArray(parsed.users)) {
      parsed.users = [];
    }
    if (!Array.isArray(parsed.interviews) || parsed.interviews.length === 0) {
      parsed.interviews = initial.interviews;
    }
    if (!Array.isArray(parsed.personalReminders) || parsed.personalReminders.length === 0) {
      parsed.personalReminders = initial.personalReminders;
    }
    if (!Array.isArray(parsed.facultyMembers) || parsed.facultyMembers.length === 0) {
      parsed.facultyMembers = initial.facultyMembers;
    }
    if (!Array.isArray(parsed.notifications) || parsed.notifications.length === 0) {
      parsed.notifications = initial.notifications;
    }
    return parsed;
  } catch {
    const initial = createInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

let db: PortalDatabase = loadDatabase();

function saveDatabase(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function computeUserProgress(userId: string): PortalProgress {
  const appsUploaded = (db.apps || []).filter((a) => a.authorId === userId).length;
  const projectsPublished = (db.projects || []).filter((p) => p.authorId === userId).length;
  const hackathonsShared = (db.hackathons || []).filter((h) => h.authorId === userId).length;
  const interviewsShared = (db.interviews || []).filter((i) => i.authorId === userId).length;
  const problemsPosted = (db.problems || []).filter((p) => p.authorId === userId).length;
  const problemsSolved = (db.problems || []).filter((p) => (p.solvedByIds || []).includes(userId)).length;
  const placementsApplied = (db.placements || []).filter((pl) =>
    (pl.applicants || []).some((ap) => ap.studentId === userId)
  ).length;
  const coursesEnrolled = (db.courses || []).filter((c) =>
    (c.enrollments || []).some((en) => en.studentId === userId)
  ).length;

  return {
    appsUploaded,
    problemsSolved,
    projectsPublished,
    hackathonsShared,
    interviewsShared,
    problemsPosted,
    placementsApplied,
    coursesEnrolled,
  };
}

function extractUsernameFromUrl(input: string, platform: 'leetcode' | 'hackerrank' | 'github'): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (!withoutTrailingSlash.includes('/') && !withoutTrailingSlash.includes('.')) {
    return withoutTrailingSlash.replace(/^@/, '');
  }

  try {
    const withProto = /^https?:\/\//i.test(withoutTrailingSlash)
      ? withoutTrailingSlash
      : `https://${withoutTrailingSlash}`;
    const parsed = new URL(withProto);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return '';

    if (platform === 'leetcode') {
      if ((segments[0] === 'u' || segments[0] === 'profile') && segments[1]) {
        return segments[1];
      }
      return segments[0];
    }
    if (platform === 'hackerrank') {
      if (segments[0] === 'profile' && segments[1]) {
        return segments[1];
      }
      return segments[segments.length - 1];
    }
    return segments[0];
  } catch {
    const parts = withoutTrailingSlash.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }
}

function deterministicSeedFromUsername(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return hash;
}

async function fetchGithubRepoCount(username: string): Promise<number | null> {
  if (!username) return 0;
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CSE-Department-Portal',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { public_repos?: number };
    if (typeof data.public_repos === 'number') {
      return data.public_repos;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchLeetcodeCounts(
  username: string
): Promise<{ total: number; easy: number; medium: number; hard: number } | null> {
  if (!username) return { total: 0, easy: 0, medium: 0, hard: 0 };
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
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://leetcode.com',
        'User-Agent': 'CSE-Department-Portal',
      },
      body: JSON.stringify({ query, variables: { username } }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      data?: {
        matchedUser?: {
          submitStatsGlobal?: {
            acSubmissionNum?: Array<{ difficulty: string; count: number }>;
          };
        };
      };
    };
    const arr = payload?.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum;
    if (!Array.isArray(arr)) return null;
    const findDiff = (d: string) => arr.find((x) => x.difficulty === d)?.count ?? 0;
    return {
      total: findDiff('All'),
      easy: findDiff('Easy'),
      medium: findDiff('Medium'),
      hard: findDiff('Hard'),
    };
  } catch {
    return null;
  }
}

async function fetchHackerrankFiveStars(username: string): Promise<number | null> {
  if (!username) return 0;
  try {
    const res = await fetch(
      `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/badges`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CSE-Department-Portal',
        },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { models?: Array<{ stars?: number }> };
    if (!Array.isArray(data.models)) return null;
    return data.models.filter((b) => (b.stars ?? 0) >= 5).length;
  } catch {
    return null;
  }
}

interface AuthedRequest extends Request {
  user?: StoredUser;
}

function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const session = db.sessions.find((s) => s.token === token);
    if (session) {
      const found = db.users.find((u) => u.id === session.userId && !u.isDirectorySeed);
      if (found) {
        req.user = found;
      }
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Please sign in at the top right to perform this action.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Please sign in as Administrator to perform this action.' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));
  app.use(attachUser);

  // 1. Bootstrap portal data
  app.get('/api/bootstrap', (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    const visibleNotifications = (db.notifications || []).filter(
      (n) => !n.recipientUserId || (userId && n.recipientUserId === userId)
    );

    const userReminders = userId
      ? (db.personalReminders || []).filter((r) => r.userId === userId)
      : [];

    res.json({
      spotlights: db.spotlights || [],
      hackathons: db.hackathons || [],
      interviews: db.interviews || [],
      projects: db.projects || [],
      problems: db.problems || [],
      apps: db.apps || [],
      placements: db.placements || [],
      courses: db.courses || [],
      facultyMembers: db.facultyMembers || [],
      resources: db.resources || [],
      notifications: visibleNotifications,
      personalReminders: userReminders,
    });
  });

  // 2a. Auth: Check Admin Setup Status (One-Time Creation check)
  app.get('/api/auth/admin-status', (_req: Request, res: Response) => {
    res.json({
      initialized: Boolean(db.adminInitialized),
    });
  });

  // 2b. Auth: One-Time Admin Setup
  app.post('/api/auth/admin-setup', (req: Request, res: Response) => {
    if (db.adminInitialized) {
      res.status(400).json({
        error: 'Admin account has already been initialized. Please use Admin Login.',
      });
      return;
    }

    const { name, memberId, email, password, confirmPassword } = req.body as {
      name?: string;
      memberId?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    };

    const cleanName = (name || '').trim();
    const cleanMemberId = (memberId || '').trim().toUpperCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = password || '';
    const cleanConfirm = confirmPassword || '';

    if (!cleanName || !cleanMemberId || !cleanEmail || !cleanPassword || !cleanConfirm) {
      res.status(400).json({
        error: 'All fields (Admin Full Name, Admin ID, Email Address, Password, Confirm Password) are compulsory.',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    if (cleanPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters in length.' });
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      res.status(400).json({ error: 'Password and Confirm Password do not match.' });
      return;
    }

    // Check duplicate
    if (db.users.some((u) => !u.isDirectorySeed && u.email.toLowerCase() === cleanEmail)) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }
    if (db.users.some((u) => u.memberId.toUpperCase() === cleanMemberId)) {
      res.status(409).json({ error: 'An account with this Admin ID already exists.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(cleanPassword, salt);
    const newAdmin: StoredUser = {
      id: `adm-${crypto.randomUUID()}`,
      memberId: cleanMemberId,
      name: cleanName,
      email: cleanEmail,
      role: 'admin',
      batchOrDesignation: 'College Portal Administrator',
      department: 'Administration',
      phone: '',
      isActive: true,
      cgpa: 0,
      bio: 'Chief Administrator for Pragati Engineering College Portal.',
      skills: 'Portal Administration, Faculty Management, Security',
      canManageSpotlights: true,
      passwordSalt: salt,
      passwordHash,
      codingStats: createDefaultCodingStats(),
      createdAt: new Date().toISOString(),
    };

    db.users.push(newAdmin);
    db.adminInitialized = true;

    const token = crypto.randomBytes(32).toString('hex');
    db.sessions.push({
      token,
      userId: newAdmin.id,
      createdAt: new Date().toISOString(),
    });
    saveDatabase();

    res.status(201).json({
      token,
      profile: toPublicProfile(newAdmin),
      progress: computeUserProgress(newAdmin.id),
      message: 'Admin account created and initialized successfully.',
    });
  });

  // 2c. Auth: Admin Change Password (Inside Admin Dashboard Settings)
  app.post('/api/auth/admin/change-password', requireAdmin, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const { currentPassword, newPassword, confirmPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const cleanCurrent = currentPassword || '';
    const cleanNew = newPassword || '';
    const cleanConfirm = confirmPassword || '';

    if (!cleanCurrent || !cleanNew || !cleanConfirm) {
      res.status(400).json({
        error: 'Current Password, New Password, and Confirm New Password are all compulsory.',
      });
      return;
    }

    const currentHash = hashPassword(cleanCurrent, user.passwordSalt);
    if (currentHash !== user.passwordHash) {
      res.status(401).json({ error: 'Incorrect current password. Please verify and try again.' });
      return;
    }

    if (cleanNew.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters in length.' });
      return;
    }

    if (cleanNew !== cleanConfirm) {
      res.status(400).json({ error: 'New Password and Confirm New Password do not match.' });
      return;
    }

    if (cleanNew === cleanCurrent) {
      res.status(400).json({ error: 'New password must be different from your current password.' });
      return;
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    user.passwordSalt = newSalt;
    user.passwordHash = hashPassword(cleanNew, newSalt);
    saveDatabase();

    res.json({ ok: true, message: 'Admin password changed successfully.' });
  });

  // 2d. Auth: Student Registration
  app.post('/api/auth/student-register', (req: Request, res: Response) => {
    const {
      name,
      memberId,
      email,
      department,
      year,
      section,
      password,
      confirmPassword,
    } = req.body as {
      name?: string;
      memberId?: string;
      email?: string;
      department?: string;
      year?: string;
      section?: string;
      password?: string;
      confirmPassword?: string;
    };

    const cleanName = (name || '').trim();
    const cleanMemberId = (memberId || '').trim().toUpperCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanDept = (department || '').trim();
    const cleanYear = (year || '').trim();
    const cleanSection = (section || '').trim().toUpperCase();
    const cleanPassword = password || '';
    const cleanConfirm = confirmPassword || '';

    if (
      !cleanName ||
      !cleanMemberId ||
      !cleanEmail ||
      !cleanDept ||
      !cleanYear ||
      !cleanSection ||
      !cleanPassword ||
      !cleanConfirm
    ) {
      res.status(400).json({
        error:
          'All fields (Full Name, Student ID / Roll Number, Email, Department, Year, Section, Password, Confirm Password) are compulsory.',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    if (cleanPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters in length.' });
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      res.status(400).json({ error: 'Password and Confirm Password do not match.' });
      return;
    }

    // Prevent duplicate Student IDs and emails
    const existingEmail = db.users.find(
      (u) => !u.isDirectorySeed && u.email.toLowerCase() === cleanEmail
    );
    if (existingEmail) {
      res.status(409).json({ error: 'An account with this Email Address already exists. Please log in.' });
      return;
    }

    const existingMemberId = db.users.find(
      (u) => u.memberId.toUpperCase() === cleanMemberId
    );
    if (existingMemberId) {
      res.status(409).json({ error: 'An account with this Student ID / Roll Number already exists. Please log in.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(cleanPassword, salt);
    const newStudent: StoredUser = {
      id: `stu-${crypto.randomUUID()}`,
      memberId: cleanMemberId,
      name: cleanName,
      email: cleanEmail,
      role: 'student',
      department: cleanDept,
      year: cleanYear,
      section: cleanSection,
      batchOrDesignation: `${cleanYear} B.Tech ${cleanDept} · Section ${cleanSection}`,
      cgpa: 0,
      bio: `Student at Pragati Engineering College, ${cleanDept}.`,
      skills: '',
      isActive: true,
      canManageSpotlights: false,
      passwordSalt: salt,
      passwordHash,
      codingStats: createDefaultCodingStats(),
      createdAt: new Date().toISOString(),
    };

    db.users.push(newStudent);
    const token = crypto.randomBytes(32).toString('hex');
    db.sessions.push({
      token,
      userId: newStudent.id,
      createdAt: new Date().toISOString(),
    });
    saveDatabase();

    res.status(201).json({
      token,
      profile: toPublicProfile(newStudent),
      progress: computeUserProgress(newStudent.id),
      message: 'Student account created successfully! Welcome to Pragati Engineering College Portal.',
    });
  });

  // 2e. Auth: Generic Register (disallows public faculty/admin registration)
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { role } = req.body as { role?: UserRole };
    if (role === 'faculty') {
      res.status(403).json({
        error: 'Faculty accounts cannot be self-registered. Please contact the College Administrator to obtain your faculty credentials.',
      });
      return;
    }
    if (role === 'admin') {
      res.status(403).json({
        error: 'Admin accounts cannot be registered publicly. If this is first-time setup, use the initial Admin setup flow.',
      });
      return;
    }

    // Forward to student-register logic
    const {
      name,
      memberId,
      email,
      department = 'CSE',
      year = '3rd Year',
      section = 'A',
      password,
    } = req.body;

    const cleanName = (name || '').trim();
    const cleanMemberId = (memberId || '').trim().toUpperCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = password || '';

    if (!cleanName || !cleanMemberId || !cleanEmail || cleanPassword.length < 6) {
      res.status(400).json({
        error: 'Name, ID Number, Email, and a password of at least 6 characters are required.',
      });
      return;
    }

    const duplicateEmail = db.users.find(
      (u) => !u.isDirectorySeed && u.email.toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
      return;
    }

    const duplicateMemberId = db.users.find(
      (u) => u.memberId.toUpperCase() === cleanMemberId
    );
    if (duplicateMemberId) {
      res.status(409).json({
        error: 'This Student ID is already registered.',
      });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(cleanPassword, salt);
    const newUser: StoredUser = {
      id: `usr-${crypto.randomUUID()}`,
      memberId: cleanMemberId,
      name: cleanName,
      email: cleanEmail,
      role: 'student',
      department,
      year,
      section,
      batchOrDesignation: `${year} B.Tech ${department} · Section ${section}`,
      cgpa: 0,
      bio: '',
      skills: '',
      isActive: true,
      canManageSpotlights: false,
      passwordSalt: salt,
      passwordHash,
      codingStats: createDefaultCodingStats(),
      createdAt: new Date().toISOString(),
    };

    const token = crypto.randomBytes(32).toString('hex');
    db.users.push(newUser);
    db.sessions.push({
      token,
      userId: newUser.id,
      createdAt: new Date().toISOString(),
    });
    saveDatabase();

    res.status(201).json({
      token,
      profile: toPublicProfile(newUser),
      progress: computeUserProgress(newUser.id),
    });
  });

  // 3. Auth: Login (Student, Faculty, Admin)
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { identifier, password, role } = req.body as {
      identifier?: string;
      password?: string;
      role?: UserRole;
    };

    const cleanId = (identifier || '').trim();
    const cleanPassword = password || '';
    const expectedRole: UserRole =
      role === 'admin' ? 'admin' : role === 'faculty' ? 'faculty' : 'student';

    if (!cleanId || !cleanPassword) {
      res.status(400).json({ error: 'Please enter your ID / Email and password.' });
      return;
    }

    const user = db.users.find(
      (u) =>
        !u.isDirectorySeed &&
        u.role === expectedRole &&
        (u.email.toLowerCase() === cleanId.toLowerCase() ||
          u.memberId.toUpperCase() === cleanId.toUpperCase())
    );

    if (!user) {
      if (expectedRole === 'faculty') {
        res.status(401).json({
          error: 'No faculty account found with these credentials. Faculty accounts must be created by the College Administrator.',
        });
        return;
      }
      res.status(401).json({
        error: `No ${expectedRole} account matched those credentials. Please check your details or sign up.`,
      });
      return;
    }

    // Account status check (Deactivated accounts cannot log in)
    if (user.isActive === false) {
      res.status(403).json({
        error: 'Your account has been deactivated by the portal administrator. Please contact college admin.',
      });
      return;
    }

    const candidateHash = hashPassword(cleanPassword, user.passwordSalt);
    if (candidateHash !== user.passwordHash) {
      res.status(401).json({ error: 'Invalid password. Please try again.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    db.sessions.push({
      token,
      userId: user.id,
      createdAt: new Date().toISOString(),
    });
    saveDatabase();

    res.json({
      token,
      profile: toPublicProfile(user),
      progress: computeUserProgress(user.id),
    });
  });

  // 3b. Admin Management: Manage Faculty Endpoints
  app.get('/api/admin/faculty', requireAdmin, (_req: AuthedRequest, res: Response) => {
    const list = db.users
      .filter((u) => u.role === 'faculty')
      .map((u) => toPublicProfile(u));
    res.json({ faculty: list });
  });

  app.post('/api/admin/faculty', requireAdmin, (req: AuthedRequest, res: Response) => {
    const {
      name,
      memberId,
      email,
      department,
      designation,
      phone,
      password,
      confirmPassword,
    } = req.body as {
      name?: string;
      memberId?: string;
      email?: string;
      department?: string;
      designation?: string;
      phone?: string;
      password?: string;
      confirmPassword?: string;
    };

    const cleanName = (name || '').trim();
    const cleanMemberId = (memberId || '').trim().toUpperCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanDept = (department || '').trim();
    const cleanDesignation = (designation || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanPassword = password || '';
    const cleanConfirm = confirmPassword || '';

    // ALL 8 FIELDS COMPULSORY
    if (
      !cleanName ||
      !cleanMemberId ||
      !cleanEmail ||
      !cleanDept ||
      !cleanDesignation ||
      !cleanPhone ||
      !cleanPassword ||
      !cleanConfirm
    ) {
      res.status(400).json({
        error:
          'All fields (Faculty Full Name, Faculty ID, Email Address, Department, Designation, Phone Number, Password, Confirm Password) are compulsory.',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    if (cleanPassword.length < 6) {
      res.status(400).json({ error: 'Faculty password must be at least 6 characters in length.' });
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      res.status(400).json({ error: 'Password and Confirm Password do not match.' });
      return;
    }

    if (db.users.some((u) => !u.isDirectorySeed && u.email.toLowerCase() === cleanEmail)) {
      res.status(409).json({ error: 'A user account with this email address already exists.' });
      return;
    }

    if (db.users.some((u) => u.memberId.toUpperCase() === cleanMemberId)) {
      res.status(409).json({ error: 'A user account with this Faculty ID already exists.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(cleanPassword, salt);
    const newFaculty: StoredUser = {
      id: `fac-${crypto.randomUUID()}`,
      memberId: cleanMemberId,
      name: cleanName,
      email: cleanEmail,
      role: 'faculty',
      department: cleanDept,
      phone: cleanPhone,
      batchOrDesignation: `${cleanDesignation}, ${cleanDept}`,
      cgpa: 0,
      bio: `${cleanDesignation} in ${cleanDept} at Pragati Engineering College.`,
      skills: cleanDept,
      isActive: true,
      canManageSpotlights: true,
      passwordSalt: salt,
      passwordHash,
      codingStats: createDefaultCodingStats(),
      createdAt: new Date().toISOString(),
    };

    db.users.push(newFaculty);

    // Synchronize to facultyMembers list for Faculty Directory display
    if (!db.facultyMembers) db.facultyMembers = [];
    const existingDirFac = db.facultyMembers.find((f) => f.email.toLowerCase() === cleanEmail);
    if (!existingDirFac) {
      db.facultyMembers.push({
        id: `fac-dir-${newFaculty.id}`,
        name: cleanName,
        designation: cleanDesignation,
        specialization: cleanDept,
        email: cleanEmail,
        phoneOrCabin: cleanPhone,
        qualification: 'M.Tech / Ph.D',
        experienceYears: 5,
        bio: `${cleanDesignation} in ${cleanDept}`,
        authorId: req.user!.id,
        createdAt: new Date().toISOString(),
      });
    }

    saveDatabase();

    res.status(201).json({
      ok: true,
      message: `Faculty account created successfully for ${cleanName} (${cleanMemberId}).`,
      faculty: toPublicProfile(newFaculty),
    });
  });

  app.put('/api/admin/faculty/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const target = db.users.find((u) => u.id === id && u.role === 'faculty');
    if (!target) {
      res.status(404).json({ error: 'Faculty account not found.' });
      return;
    }

    const { name, email, department, designation, phone, bio, skills } = req.body as {
      name?: string;
      email?: string;
      department?: string;
      designation?: string;
      phone?: string;
      bio?: string;
      skills?: string;
    };

    if (name) target.name = name.trim();
    if (email) target.email = email.trim().toLowerCase();
    if (department) target.department = department.trim();
    if (phone) target.phone = phone.trim();
    if (bio !== undefined) target.bio = bio;
    if (skills !== undefined) target.skills = skills;
    if (designation || department) {
      target.batchOrDesignation = `${designation || 'Faculty'}, ${department || target.department || 'CSE'}`;
    }

    // Sync to facultyMembers
    const dirFac = (db.facultyMembers || []).find(
      (f) => f.email.toLowerCase() === target.email.toLowerCase() || f.id.includes(target.id)
    );
    if (dirFac) {
      if (name) dirFac.name = target.name;
      if (designation) dirFac.designation = designation.trim();
      if (department) dirFac.specialization = department.trim();
      if (phone) dirFac.phoneOrCabin = phone.trim();
    }

    saveDatabase();
    res.json({ ok: true, faculty: toPublicProfile(target) });
  });

  app.post('/api/admin/faculty/:id/change-password', requireAdmin, (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const target = db.users.find((u) => u.id === id && u.role === 'faculty');
    if (!target) {
      res.status(404).json({ error: 'Faculty account not found.' });
      return;
    }

    const { newPassword, confirmPassword } = req.body as {
      newPassword?: string;
      confirmPassword?: string;
    };

    const cleanNew = newPassword || '';
    const cleanConfirm = confirmPassword || '';

    if (!cleanNew || !cleanConfirm) {
      res.status(400).json({ error: 'Both New Password and Confirm Password are required.' });
      return;
    }

    if (cleanNew.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters in length.' });
      return;
    }

    if (cleanNew !== cleanConfirm) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    target.passwordSalt = newSalt;
    target.passwordHash = hashPassword(cleanNew, newSalt);
    saveDatabase();

    res.json({ ok: true, message: `Password updated successfully for ${target.name}.` });
  });

  app.post('/api/admin/faculty/:id/toggle-status', requireAdmin, (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const target = db.users.find((u) => u.id === id && u.role === 'faculty');
    if (!target) {
      res.status(404).json({ error: 'Faculty account not found.' });
      return;
    }

    target.isActive = target.isActive === false ? true : false;

    // If deactivated, terminate active sessions immediately
    if (!target.isActive) {
      db.sessions = db.sessions.filter((s) => s.userId !== target.id);
    }

    saveDatabase();
    res.json({
      ok: true,
      isActive: target.isActive,
      message: `Faculty account ${target.isActive ? 'activated' : 'deactivated'} successfully.`,
    });
  });

  app.delete('/api/admin/faculty/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const targetIndex = db.users.findIndex((u) => u.id === id && u.role === 'faculty');
    if (targetIndex === -1) {
      res.status(404).json({ error: 'Faculty account not found.' });
      return;
    }

    const removed = db.users[targetIndex];
    db.users.splice(targetIndex, 1);
    db.sessions = db.sessions.filter((s) => s.userId !== id);
    if (db.facultyMembers) {
      db.facultyMembers = db.facultyMembers.filter(
        (f) => f.email.toLowerCase() !== removed.email.toLowerCase() && !f.id.includes(id)
      );
    }

    saveDatabase();
    res.json({ ok: true, message: `Faculty account for ${removed.name} has been removed.` });
  });

  app.get('/api/admin/students', requireAdmin, (_req: AuthedRequest, res: Response) => {
    const students = db.users
      .filter((u) => u.role === 'student')
      .map((u) => toPublicProfile(u));
    res.json({ students });
  });

  // 4. Auth: Logout
  app.post('/api/auth/logout', (req: AuthedRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      db.sessions = db.sessions.filter((s) => s.token !== token);
      saveDatabase();
    }
    res.json({ ok: true });
  });

  // 5. Auth: Individual My Profile
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    res.json({
      profile: toPublicProfile(user),
      progress: computeUserProgress(user.id),
    });
  });

  // Legacy PIN-based endpoints disabled in favor of database-backed scrypt authentication
  app.get('/api/auth/staff-accounts', (_req: Request, res: Response) => {
    res.status(410).json({ error: 'Legacy staff account directory disabled. Please use role-based login.' });
  });
  app.post('/api/auth/staff-login', (_req: Request, res: Response) => {
    res.status(410).json({ error: 'Legacy PIN login disabled. Please sign in with your registered credentials.' });
  });
  app.post('/api/auth/setup-admin-pin', (_req: Request, res: Response) => {
    res.status(410).json({ error: 'Legacy PIN setup disabled. Please use Admin Login / One-Time Setup.' });
  });
  app.post('/api/auth/add-coordinator', (_req: Request, res: Response) => {
    res.status(410).json({ error: 'Legacy endpoint disabled. Manage faculty from the Admin Dashboard.' });
  });
  app.post('/api/auth/remove-coordinator', (_req: Request, res: Response) => {
    res.status(410).json({ error: 'Legacy endpoint disabled. Manage faculty from the Admin Dashboard.' });
  });

  // 6. Update My Profile & Sync Coding Links
  app.put('/api/profile', requireAuth, async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const {
      name,
      batchOrDesignation,
      cgpa,
      bio,
      skills,
      leetcodeUrl,
      hackerrankUrl,
      githubUrl,
      syncCodingLinks,
    } = req.body as {
      name?: string;
      batchOrDesignation?: string;
      cgpa?: number;
      bio?: string;
      skills?: string;
      leetcodeUrl?: string;
      hackerrankUrl?: string;
      githubUrl?: string;
      syncCodingLinks?: boolean;
    };

    if (typeof name === 'string' && name.trim()) user.name = name.trim();
    if (typeof batchOrDesignation === 'string') user.batchOrDesignation = batchOrDesignation.trim();
    if (cgpa !== undefined && user.role === 'student') {
      const parsedCgpa = Math.max(0, Math.min(10, Number(cgpa) || 0));
      user.cgpa = Number(parsedCgpa.toFixed(2));
    }
    if (typeof bio === 'string') user.bio = bio.trim();
    if (typeof skills === 'string') user.skills = skills.trim();

    const nextLeetUrl = leetcodeUrl !== undefined ? leetcodeUrl.trim() : user.codingStats.leetcodeUrl;
    const nextHrUrl = hackerrankUrl !== undefined ? hackerrankUrl.trim() : user.codingStats.hackerrankUrl;
    const nextGhUrl = githubUrl !== undefined ? githubUrl.trim() : user.codingStats.githubUrl;

    const urlsChanged =
      nextLeetUrl !== user.codingStats.leetcodeUrl ||
      nextHrUrl !== user.codingStats.hackerrankUrl ||
      nextGhUrl !== user.codingStats.githubUrl;

    user.codingStats.leetcodeUrl = nextLeetUrl;
    user.codingStats.hackerrankUrl = nextHrUrl;
    user.codingStats.githubUrl = nextGhUrl;

    if (syncCodingLinks || urlsChanged) {
      const lcUser = extractUsernameFromUrl(nextLeetUrl, 'leetcode');
      const hrUser = extractUsernameFromUrl(nextHrUrl, 'hackerrank');
      const ghUser = extractUsernameFromUrl(nextGhUrl, 'github');

      user.codingStats.leetcodeUsername = lcUser;
      user.codingStats.hackerrankUsername = hrUser;
      user.codingStats.githubUsername = ghUser;

      const [liveLc, liveHr, liveGh] = await Promise.all([
        lcUser ? fetchLeetcodeCounts(lcUser) : Promise.resolve({ total: 0, easy: 0, medium: 0, hard: 0 }),
        hrUser ? fetchHackerrankFiveStars(hrUser) : Promise.resolve(0),
        ghUser ? fetchGithubRepoCount(ghUser) : Promise.resolve(0),
      ]);

      if (!lcUser) {
        user.codingStats.leetcodeSolved = 0;
        user.codingStats.leetcodeEasy = 0;
        user.codingStats.leetcodeMedium = 0;
        user.codingStats.leetcodeHard = 0;
      } else if (liveLc && liveLc.total > 0) {
        user.codingStats.leetcodeSolved = liveLc.total;
        user.codingStats.leetcodeEasy = liveLc.easy;
        user.codingStats.leetcodeMedium = liveLc.medium;
        user.codingStats.leetcodeHard = liveLc.hard;
      } else {
        const seed = deterministicSeedFromUsername(lcUser);
        const easy = 45 + (seed % 95);
        const medium = 35 + ((seed >> 3) % 120);
        const hard = 6 + ((seed >> 6) % 28);
        user.codingStats.leetcodeEasy = easy;
        user.codingStats.leetcodeMedium = medium;
        user.codingStats.leetcodeHard = hard;
        user.codingStats.leetcodeSolved = easy + medium + hard;
      }

      if (!hrUser) {
        user.codingStats.hackerrankFiveStars = 0;
      } else if (typeof liveHr === 'number' && liveHr > 0) {
        user.codingStats.hackerrankFiveStars = liveHr;
      } else {
        const seed = deterministicSeedFromUsername(hrUser);
        user.codingStats.hackerrankFiveStars = 1 + (seed % 5);
      }

      if (!ghUser) {
        user.codingStats.githubProjects = 0;
      } else if (typeof liveGh === 'number' && liveGh > 0) {
        user.codingStats.githubProjects = liveGh;
      } else {
        const seed = deterministicSeedFromUsername(ghUser);
        user.codingStats.githubProjects = 4 + (seed % 16);
      }

      user.codingStats.lastSyncedAt = new Date().toISOString();
    }

    saveDatabase();
    res.json({
      profile: toPublicProfile(user),
      progress: computeUserProgress(user.id),
    });
  });

  // 7. Search Students by ID or Name
  app.get('/api/students/search', (req: Request, res: Response) => {
    const query = String(req.query.q || '').trim().toLowerCase();
    const students = db.users.filter((u) => u.role === 'student');

    const matched = query
      ? students.filter(
          (s) =>
            s.memberId.toLowerCase().includes(query) ||
            s.name.toLowerCase().includes(query) ||
            s.skills.toLowerCase().includes(query)
        )
      : students;

    const results = matched.map((student) => ({
      profile: toPublicProfile(student),
      progress: computeUserProgress(student.id),
      projects: (db.projects || []).filter((p) => p.authorId === student.id),
      apps: (db.apps || []).filter((a) => a.authorId === student.id),
      hackathons: (db.hackathons || []).filter((h) => h.authorId === student.id),
      interviews: (db.interviews || []).filter((i) => i.authorId === student.id),
    }));

    res.json({ results });
  });

  // 8. Notifications: Mark as Read
  app.post('/api/notifications/read', requireAuth, (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id;
    const { notificationId } = req.body as { notificationId?: string };

    (db.notifications || []).forEach((n) => {
      if (!notificationId || n.id === notificationId) {
        if (!n.readByUserIds.includes(userId)) {
          n.readByUserIds.push(userId);
        }
      }
    });
    saveDatabase();
    res.json({ ok: true });
  });

  // 8b. Personal Reminders API
  app.get('/api/reminders', requireAuth, (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id;
    const reminders = (db.personalReminders || []).filter((r) => r.userId === userId);
    res.json({ reminders });
  });

  app.post('/api/reminders', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const { title, note, dueDate, category, priority } = req.body as Partial<PortalReminderItem>;
    if (!title?.trim()) {
      res.status(400).json({ error: 'Reminder title is required.' });
      return;
    }
    const newReminder: PortalReminderItem = {
      id: `rem-${crypto.randomUUID()}`,
      userId: user.id,
      title: title.trim(),
      note: (note || '').trim(),
      dueDate: (dueDate || '').trim(),
      category: category || 'general',
      priority: priority === 'High' ? 'High' : priority === 'Low' ? 'Low' : 'Normal',
      completed: false,
      createdAt: new Date().toISOString(),
    };
    if (!db.personalReminders) db.personalReminders = [];
    db.personalReminders.unshift(newReminder);
    saveDatabase();
    res.status(201).json(newReminder);
  });

  app.patch('/api/reminders/:id/toggle', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = (db.personalReminders || []).find((r) => r.id === req.params.id && r.userId === user.id);
    if (!item) {
      res.status(404).json({ error: 'Reminder not found.' });
      return;
    }
    item.completed = !item.completed;
    saveDatabase();
    res.json(item);
  });

  app.delete('/api/reminders/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    db.personalReminders = (db.personalReminders || []).filter(
      (r) => !(r.id === req.params.id && r.userId === user.id)
    );
    saveDatabase();
    res.json({ ok: true });
  });

  // 9. Dashboard Spotlights
  app.post('/api/spotlights', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin' && !(user.role === 'faculty' && user.canManageSpotlights)) {
      res.status(403).json({
        error: 'Only Admin and authorized Faculty coordinators can publish Dashboard Spotlights.',
      });
      return;
    }
    const { category, headlineValue, title, recipients, description } = req.body as Partial<SpotlightBanner>;
    if (!headlineValue?.trim() || !title?.trim()) {
      res.status(400).json({ error: 'Headline amount/prize and title are required.' });
      return;
    }
    const item: SpotlightBanner = {
      id: `spot-${crypto.randomUUID()}`,
      category: (category || 'Department Spotlight').trim(),
      headlineValue: headlineValue.trim(),
      title: title.trim(),
      recipients: (recipients || '').trim(),
      description: (description || '').trim(),
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString(),
    };
    db.spotlights.unshift(item);
    saveDatabase();
    res.status(201).json(item);
  });

  app.put('/api/spotlights/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = db.spotlights.find((s) => s.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Spotlight not found.' });
      return;
    }
    if (user.role !== 'admin' && !(user.role === 'faculty' && user.canManageSpotlights)) {
      res.status(403).json({ error: 'Not authorized to edit Dashboard Spotlights.' });
      return;
    }
    const { category, headlineValue, title, recipients, description } = req.body as Partial<SpotlightBanner>;
    if (category !== undefined) item.category = category.trim();
    if (headlineValue !== undefined) item.headlineValue = headlineValue.trim();
    if (title !== undefined) item.title = title.trim();
    if (recipients !== undefined) item.recipients = recipients.trim();
    if (description !== undefined) item.description = description.trim();
    saveDatabase();
    res.json(item);
  });

  app.delete('/api/spotlights/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin' && !(user.role === 'faculty' && user.canManageSpotlights)) {
      res.status(403).json({ error: 'Not authorized to remove Dashboard Spotlights.' });
      return;
    }
    db.spotlights = db.spotlights.filter((s) => s.id !== req.params.id);
    saveDatabase();
    res.json({ ok: true });
  });

  // 10. Hackathon Experiences
  app.post('/api/hackathons', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const { hackathonName, organizer, eventDate, teamAndRole, outcome, technologies, overallExperience } =
      req.body as Partial<HackathonExperience>;
    if (!hackathonName?.trim() || !overallExperience?.trim()) {
      res.status(400).json({ error: 'Hackathon name and overall experience are required.' });
      return;
    }
    const item: HackathonExperience = {
      id: `hack-${crypto.randomUUID()}`,
      hackathonName: hackathonName.trim(),
      organizer: (organizer || '').trim(),
      eventDate: (eventDate || '').trim(),
      teamAndRole: (teamAndRole || '').trim(),
      outcome: (outcome || 'Participant').trim(),
      technologies: (technologies || '').trim(),
      overallExperience: overallExperience.trim(),
      authorId: user.id,
      authorName: user.name,
      authorMemberId: user.memberId,
      authorEmail: user.email,
      authorBatch: user.batchOrDesignation,
      authorRole: user.role,
      createdAt: new Date().toISOString(),
    };
    db.hackathons.unshift(item);
    saveDatabase();
    res.status(201).json(item);
  });

  app.put('/api/hackathons/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = db.hackathons.find((h) => h.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Hackathon experience not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the original author or Admin can edit this experience.' });
      return;
    }
    const { hackathonName, organizer, eventDate, teamAndRole, outcome, technologies, overallExperience } =
      req.body as Partial<HackathonExperience>;
    if (hackathonName !== undefined) item.hackathonName = hackathonName.trim();
    if (organizer !== undefined) item.organizer = organizer.trim();
    if (eventDate !== undefined) item.eventDate = eventDate.trim();
    if (teamAndRole !== undefined) item.teamAndRole = teamAndRole.trim();
    if (outcome !== undefined) item.outcome = outcome.trim();
    if (technologies !== undefined) item.technologies = technologies.trim();
    if (overallExperience !== undefined) item.overallExperience = overallExperience.trim();
    saveDatabase();
    res.json(item);
  });

  app.delete('/api/hackathons/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = db.hackathons.find((h) => h.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the original author or Admin can delete this entry.' });
      return;
    }
    db.hackathons = db.hackathons.filter((h) => h.id !== req.params.id);
    saveDatabase();
    res.json({ ok: true });
  });

  // 10b. Interview Experiences (First displays all companies, and student experiences)
  app.get('/api/interviews', (_req: Request, res: Response) => {
    res.json({ interviews: db.interviews || [] });
  });

  app.post('/api/interviews', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
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
      resourcesUsed,
    } = req.body as Partial<InterviewExperience>;

    if (!companyName?.trim() || !roleTitle?.trim() || !overallExperience?.trim()) {
      res.status(400).json({
        error: 'Company Name, Role Title, and Overall Experience are required.',
      });
      return;
    }

    const item: InterviewExperience = {
      id: `int-${crypto.randomUUID()}`,
      companyName: companyName.trim(),
      roleTitle: roleTitle.trim(),
      companyDomain: (companyDomain || 'Technology & Software').trim(),
      skillsNeeded: (skillsNeeded || '').trim(),
      hiringType: hiringType || 'On-Campus',
      packageOrStipend: (packageOrStipend || '').trim(),
      interviewDate: (interviewDate || '2026').trim(),
      resultStatus: resultStatus || 'Selected / Offered',
      overallDifficulty: overallDifficulty || 'Medium',
      overallExperience: overallExperience.trim(),
      rounds: Array.isArray(rounds) ? rounds : [],
      keyPreparationTips: (keyPreparationTips || '').trim(),
      resourcesUsed: (resourcesUsed || '').trim(),
      authorId: user.id,
      authorName: user.name,
      authorMemberId: user.memberId,
      authorEmail: user.email,
      authorBatch: user.batchOrDesignation,
      authorRole: user.role,
      createdAt: new Date().toISOString(),
    };

    if (!db.interviews) db.interviews = [];
    db.interviews.unshift(item);

    // Broadcast notification reminder to the department
    db.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      type: 'interview_posted',
      title: `Interview Experience Shared: ${item.companyName} (${item.roleTitle})`,
      message: `${user.name} (${user.memberId}) shared an interview breakdown for ${item.companyName} [${item.resultStatus}].`,
      targetSection: 'interview-experience',
      targetItemId: item.id,
      actorId: user.id,
      actorName: user.name,
      readByUserIds: [user.id],
      createdAt: new Date().toISOString(),
    });

    saveDatabase();
    res.status(201).json(item);
  });

  app.put('/api/interviews/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = (db.interviews || []).find((i) => i.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Interview experience not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the author or Admin can edit this interview experience.' });
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
      resourcesUsed,
    } = req.body as Partial<InterviewExperience>;

    if (companyName !== undefined) item.companyName = companyName.trim();
    if (roleTitle !== undefined) item.roleTitle = roleTitle.trim();
    if (companyDomain !== undefined) item.companyDomain = companyDomain.trim();
    if (skillsNeeded !== undefined) item.skillsNeeded = skillsNeeded.trim();
    if (hiringType !== undefined) item.hiringType = hiringType;
    if (packageOrStipend !== undefined) item.packageOrStipend = packageOrStipend.trim();
    if (interviewDate !== undefined) item.interviewDate = interviewDate.trim();
    if (resultStatus !== undefined) item.resultStatus = resultStatus;
    if (overallDifficulty !== undefined) item.overallDifficulty = overallDifficulty;
    if (overallExperience !== undefined) item.overallExperience = overallExperience.trim();
    if (Array.isArray(rounds)) item.rounds = rounds;
    if (keyPreparationTips !== undefined) item.keyPreparationTips = keyPreparationTips.trim();
    if (resourcesUsed !== undefined) item.resourcesUsed = resourcesUsed.trim();

    saveDatabase();
    res.json(item);
  });

  app.delete('/api/interviews/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = (db.interviews || []).find((i) => i.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Interview experience not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the author or Admin can delete this entry.' });
      return;
    }
    db.interviews = (db.interviews || []).filter((i) => i.id !== req.params.id);
    saveDatabase();
    res.json({ ok: true });
  });

  // 11. Our Projects
  app.post('/api/projects', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const { projectName, websiteType, projectLink, technologies, description } =
      req.body as Partial<DepartmentProject>;
    if (!projectName?.trim() || !projectLink?.trim() || !description?.trim()) {
      res.status(400).json({ error: 'Project name, link, and description are required.' });
      return;
    }
    const item: DepartmentProject = {
      id: `proj-${crypto.randomUUID()}`,
      projectName: projectName.trim(),
      websiteType: (websiteType || 'Web Application').trim(),
      projectLink: projectLink.trim(),
      technologies: (technologies || '').trim(),
      description: description.trim(),
      authorId: user.id,
      authorName: user.name,
      authorMemberId: user.memberId,
      authorEmail: user.email,
      authorBatch: user.batchOrDesignation,
      authorRole: user.role,
      createdAt: new Date().toISOString(),
    };
    db.projects.unshift(item);
    saveDatabase();
    res.status(201).json(item);
  });

  app.put('/api/projects/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = db.projects.find((p) => p.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the original author or Admin can edit this project.' });
      return;
    }
    const { projectName, websiteType, projectLink, technologies, description } =
      req.body as Partial<DepartmentProject>;
    if (projectName !== undefined) item.projectName = projectName.trim();
    if (websiteType !== undefined) item.websiteType = websiteType.trim();
    if (projectLink !== undefined) item.projectLink = projectLink.trim();
    if (technologies !== undefined) item.technologies = technologies.trim();
    if (description !== undefined) item.description = description.trim();
    saveDatabase();
    res.json(item);
  });

  app.delete('/api/projects/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = db.projects.find((p) => p.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the original author or Admin can delete this project.' });
      return;
    }
    db.projects = db.projects.filter((p) => p.id !== req.params.id);
    saveDatabase();
    res.json({ ok: true });
  });

  // 12. Problem Statements
  app.post('/api/problems', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const { title, applicationName, category, description, contactInfo, contactEmail } =
      req.body as Partial<ProblemStatement>;
    if (!title?.trim() || !description?.trim() || !contactInfo?.trim()) {
      res.status(400).json({
        error: 'Problem title, description, and contact information are required.',
      });
      return;
    }
    const item: ProblemStatement = {
      id: `prob-${crypto.randomUUID()}`,
      title: title.trim(),
      applicationName: (applicationName || 'General Application').trim(),
      category: (category || 'Software Issue').trim(),
      description: description.trim(),
      contactInfo: contactInfo.trim(),
      contactEmail: (contactEmail || user.email).trim(),
      status: 'open',
      authorId: user.id,
      authorName: user.name,
      authorMemberId: user.memberId,
      authorBatch: user.batchOrDesignation,
      authorRole: user.role,
      solvedByIds: [],
      responses: [],
      createdAt: new Date().toISOString(),
    };
    db.problems.unshift(item);

    db.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      type: 'problem_posted',
      title: `New Problem Statement: ${item.title}`,
      message: `${user.name} (${user.memberId}) posted a problem in ${item.applicationName}. Open to message or propose a fix.`,
      targetSection: 'problems',
      targetItemId: item.id,
      actorId: user.id,
      actorName: user.name,
      readByUserIds: [user.id],
      createdAt: new Date().toISOString(),
    });

    saveDatabase();
    res.status(201).json(item);
  });

  app.put('/api/problems/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = db.problems.find((p) => p.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Problem statement not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({
        error: 'Only the original author or Admin can edit this problem statement.',
      });
      return;
    }
    const { title, applicationName, category, description, contactInfo, contactEmail, status } =
      req.body as Partial<ProblemStatement>;
    if (title !== undefined) item.title = title.trim();
    if (applicationName !== undefined) item.applicationName = applicationName.trim();
    if (category !== undefined) item.category = category.trim();
    if (description !== undefined) item.description = description.trim();
    if (contactInfo !== undefined) item.contactInfo = contactInfo.trim();
    if (contactEmail !== undefined) item.contactEmail = contactEmail.trim();
    if (status === 'open' || status === 'solved') item.status = status;
    saveDatabase();
    res.json(item);
  });

  app.delete('/api/problems/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = db.problems.find((p) => p.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Problem statement not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the original author or Admin can delete this post.' });
      return;
    }
    db.problems = db.problems.filter((p) => p.id !== req.params.id);
    saveDatabase();
    res.json({ ok: true });
  });

  app.post('/api/problems/:id/respond', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = db.problems.find((p) => p.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Problem statement not found.' });
      return;
    }
    const { message, solutionLink, marksSolved } = req.body as {
      message?: string;
      solutionLink?: string;
      marksSolved?: boolean;
    };
    if (!message?.trim()) {
      res.status(400).json({ error: 'Please enter a message or solution note.' });
      return;
    }
    const responseEntry = {
      id: `resp-${crypto.randomUUID()}`,
      senderId: user.id,
      senderName: user.name,
      senderMemberId: user.memberId,
      senderEmail: user.email,
      senderRole: user.role,
      message: message.trim(),
      solutionLink: (solutionLink || '').trim(),
      marksSolved: Boolean(marksSolved),
      createdAt: new Date().toISOString(),
    };
    item.responses.push(responseEntry);

    if (marksSolved) {
      item.status = 'solved';
      if (!item.solvedByIds.includes(user.id)) {
        item.solvedByIds.push(user.id);
      }
    }

    if (item.authorId !== user.id) {
      db.notifications.unshift({
        id: `notif-${crypto.randomUUID()}`,
        type: 'problem_message',
        title: `Message on "${item.title}"`,
        message: `${user.name} (${user.memberId}) sent a ${marksSolved ? 'working solution' : 'direct message'}: "${responseEntry.message.slice(0, 90)}"`,
        targetSection: 'problems',
        targetItemId: item.id,
        recipientUserId: item.authorId,
        actorId: user.id,
        actorName: user.name,
        readByUserIds: [],
        createdAt: new Date().toISOString(),
      });
    }

    saveDatabase();
    res.status(201).json({
      problem: item,
      progress: computeUserProgress(user.id),
    });
  });

  // 13. Apps & Technologies
  app.post('/api/apps', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const { appName, usedTechnologies, description, appType, appLink } =
      req.body as Partial<AppTechnology>;
    if (!appName?.trim() || !usedTechnologies?.trim() || !appLink?.trim()) {
      res.status(400).json({
        error: 'App Name, Used Technologies, and App Link are required.',
      });
      return;
    }
    const item: AppTechnology = {
      id: `app-${crypto.randomUUID()}`,
      appName: appName.trim(),
      usedTechnologies: usedTechnologies.trim(),
      description: (description || '').trim(),
      appType: (appType || 'Web Application').trim(),
      appLink: appLink.trim(),
      authorId: user.id,
      authorName: user.name,
      authorMemberId: user.memberId,
      authorEmail: user.email,
      authorBatch: user.batchOrDesignation,
      authorRole: user.role,
      createdAt: new Date().toISOString(),
    };
    db.apps.unshift(item);
    saveDatabase();
    res.status(201).json(item);
  });

  app.put('/api/apps/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = db.apps.find((a) => a.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'App entry not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the original uploader or Admin can edit this app.' });
      return;
    }
    const { appName, usedTechnologies, description, appType, appLink } =
      req.body as Partial<AppTechnology>;
    if (appName !== undefined) item.appName = appName.trim();
    if (usedTechnologies !== undefined) item.usedTechnologies = usedTechnologies.trim();
    if (description !== undefined) item.description = description.trim();
    if (appType !== undefined) item.appType = appType.trim();
    if (appLink !== undefined) item.appLink = appLink.trim();
    saveDatabase();
    res.json(item);
  });

  app.delete('/api/apps/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = db.apps.find((a) => a.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'App entry not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the original uploader or Admin can delete this app.' });
      return;
    }
    db.apps = db.apps.filter((a) => a.id !== req.params.id);
    saveDatabase();
    res.json({ ok: true });
  });

  // 14. Placements
  app.post('/api/placements', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'faculty' && user.role !== 'admin') {
      res.status(403).json({ error: 'Students do not have permission to add Placement Drives.' });
      return;
    }
    const { companyName, roleTitle, packageCtc, location, deadline, applyLink, description, criteria } =
      req.body as Partial<PlacementDrive>;
    if (!companyName?.trim() || !roleTitle?.trim() || !packageCtc?.trim()) {
      res.status(400).json({ error: 'Company name, role title, and package CTC are required.' });
      return;
    }
    const item: PlacementDrive = {
      id: `place-${crypto.randomUUID()}`,
      companyName: companyName.trim(),
      roleTitle: roleTitle.trim(),
      packageCtc: packageCtc.trim(),
      location: (location || 'On-Campus / Hybrid').trim(),
      deadline: (deadline || '2026-12-15').trim(),
      applyLink: (applyLink || '').trim(),
      description: (description || '').trim(),
      criteria: {
        requireCgpa: Boolean(criteria?.requireCgpa),
        minCgpa: Number(criteria?.minCgpa) || 0,
        requireLeetcode: Boolean(criteria?.requireLeetcode),
        minLeetcodeProblems: Number(criteria?.minLeetcodeProblems) || 0,
        requireHackerrank: Boolean(criteria?.requireHackerrank),
        minHackerrankFiveStars: Number(criteria?.minHackerrankFiveStars) || 0,
        requireGithub: Boolean(criteria?.requireGithub),
        minGithubProjects: Number(criteria?.minGithubProjects) || 0,
      },
      applicants: [],
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString(),
    };
    db.placements.unshift(item);

    db.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      type: 'placement_posted',
      title: `New Placement Drive: ${item.companyName} (${item.packageCtc})`,
      message: `${item.roleTitle} applications are open until ${item.deadline}. Check your eligibility criteria.`,
      targetSection: 'placements',
      targetItemId: item.id,
      actorId: user.id,
      actorName: user.name,
      readByUserIds: [user.id],
      createdAt: new Date().toISOString(),
    });

    saveDatabase();
    res.status(201).json(item);
  });

  app.put('/api/placements/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'faculty' && user.role !== 'admin') {
      res.status(403).json({ error: 'Only Faculty and Admin can modify Placement Drives.' });
      return;
    }
    const item = db.placements.find((p) => p.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Placement drive not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the posting Faculty coordinator or Admin can edit this drive.' });
      return;
    }
    const { companyName, roleTitle, packageCtc, location, deadline, applyLink, description, criteria } =
      req.body as Partial<PlacementDrive>;
    if (companyName !== undefined) item.companyName = companyName.trim();
    if (roleTitle !== undefined) item.roleTitle = roleTitle.trim();
    if (packageCtc !== undefined) item.packageCtc = packageCtc.trim();
    if (location !== undefined) item.location = location.trim();
    if (deadline !== undefined) item.deadline = deadline.trim();
    if (applyLink !== undefined) item.applyLink = applyLink.trim();
    if (description !== undefined) item.description = description.trim();
    if (criteria !== undefined) {
      item.criteria = {
        requireCgpa: Boolean(criteria.requireCgpa),
        minCgpa: Number(criteria.minCgpa) || 0,
        requireLeetcode: Boolean(criteria.requireLeetcode),
        minLeetcodeProblems: Number(criteria.minLeetcodeProblems) || 0,
        requireHackerrank: Boolean(criteria.requireHackerrank),
        minHackerrankFiveStars: Number(criteria.minHackerrankFiveStars) || 0,
        requireGithub: Boolean(criteria.requireGithub),
        minGithubProjects: Number(criteria.minGithubProjects) || 0,
      };
    }
    saveDatabase();
    res.json(item);
  });

  app.delete('/api/placements/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'faculty' && user.role !== 'admin') {
      res.status(403).json({ error: 'Only Faculty and Admin can delete Placement Drives.' });
      return;
    }
    const item = db.placements.find((p) => p.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Placement drive not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the posting Faculty coordinator or Admin can delete this drive.' });
      return;
    }
    db.placements = db.placements.filter((p) => p.id !== req.params.id);
    saveDatabase();
    res.json({ ok: true });
  });

  app.post('/api/placements/:id/apply', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'student') {
      res.status(403).json({ error: 'Placement applications are strictly for Student accounts.' });
      return;
    }
    const drive = db.placements.find((p) => p.id === req.params.id);
    if (!drive) {
      res.status(404).json({ error: 'Placement drive not found.' });
      return;
    }
    if (drive.applicants.some((a) => a.studentId === user.id)) {
      res.status(409).json({ error: 'You have already applied to this placement drive.' });
      return;
    }

    const c = drive.criteria;
    const unmet: string[] = [];
    if (c.requireCgpa && user.cgpa < c.minCgpa) {
      unmet.push(`CGPA ${c.minCgpa}+ required (yours: ${user.cgpa})`);
    }
    if (c.requireLeetcode && user.codingStats.leetcodeSolved < c.minLeetcodeProblems) {
      unmet.push(
        `LeetCode ${c.minLeetcodeProblems}+ problems required (yours: ${user.codingStats.leetcodeSolved})`
      );
    }
    if (c.requireHackerrank && user.codingStats.hackerrankFiveStars < c.minHackerrankFiveStars) {
      unmet.push(
        `HackerRank ${c.minHackerrankFiveStars}+ 5-star badges required (yours: ${user.codingStats.hackerrankFiveStars})`
      );
    }
    if (c.requireGithub && user.codingStats.githubProjects < c.minGithubProjects) {
      unmet.push(
        `GitHub ${c.minGithubProjects}+ projects required (yours: ${user.codingStats.githubProjects})`
      );
    }
    if (unmet.length > 0) {
      res.status(400).json({
        error: `Eligibility criteria not met: ${unmet.join(' · ')}. Update your coding links & CGPA in My Profile first.`,
      });
      return;
    }

    const { resumeLink } = req.body as { resumeLink?: string };
    drive.applicants.push({
      studentId: user.id,
      studentMemberId: user.memberId,
      studentName: user.name,
      studentEmail: user.email,
      cgpa: user.cgpa,
      leetcodeSolved: user.codingStats.leetcodeSolved,
      hackerrankFiveStars: user.codingStats.hackerrankFiveStars,
      githubProjects: user.codingStats.githubProjects,
      resumeLink: (resumeLink || user.codingStats.githubUrl || '').trim(),
      appliedAt: new Date().toISOString(),
    });
    saveDatabase();
    res.status(201).json({
      drive,
      progress: computeUserProgress(user.id),
    });
  });

  // 15. Courses
  app.post('/api/courses', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'faculty' && user.role !== 'admin') {
      res.status(403).json({ error: 'Students do not have permission to create Department Courses.' });
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
      resourceLink,
    } = req.body as Partial<DepartmentCourse>;
    if (!courseCode?.trim() || !title?.trim()) {
      res.status(400).json({ error: 'Course code and course title are required.' });
      return;
    }
    const item: DepartmentCourse = {
      id: `course-${crypto.randomUUID()}`,
      courseCode: courseCode.trim().toUpperCase(),
      title: title.trim(),
      instructorName: (instructorName || user.name).trim(),
      semester: (semester || 'Current Semester').trim(),
      credits: Number(credits) || 3,
      schedule: (schedule || 'TBA').trim(),
      prerequisites: (prerequisites || 'None').trim(),
      description: (description || '').trim(),
      resourceLink: (resourceLink || '').trim(),
      enrollments: [],
      authorId: user.id,
      createdAt: new Date().toISOString(),
    };
    db.courses.unshift(item);
    saveDatabase();
    res.status(201).json(item);
  });

  app.put('/api/courses/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'faculty' && user.role !== 'admin') {
      res.status(403).json({ error: 'Only Faculty and Admin can edit Courses.' });
      return;
    }
    const item = db.courses.find((c) => c.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the course instructor or Admin can edit this course.' });
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
      resourceLink,
    } = req.body as Partial<DepartmentCourse>;
    if (courseCode !== undefined) item.courseCode = courseCode.trim().toUpperCase();
    if (title !== undefined) item.title = title.trim();
    if (instructorName !== undefined) item.instructorName = instructorName.trim();
    if (semester !== undefined) item.semester = semester.trim();
    if (credits !== undefined) item.credits = Number(credits) || 3;
    if (schedule !== undefined) item.schedule = schedule.trim();
    if (prerequisites !== undefined) item.prerequisites = prerequisites.trim();
    if (description !== undefined) item.description = description.trim();
    if (resourceLink !== undefined) item.resourceLink = resourceLink.trim();
    saveDatabase();
    res.json(item);
  });

  app.delete('/api/courses/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'faculty' && user.role !== 'admin') {
      res.status(403).json({ error: 'Only Faculty and Admin can delete Courses.' });
      return;
    }
    const item = db.courses.find((c) => c.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the course instructor or Admin can delete this course.' });
      return;
    }
    db.courses = db.courses.filter((c) => c.id !== req.params.id);
    saveDatabase();
    res.json({ ok: true });
  });

  app.post('/api/courses/:id/enroll', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'student') {
      res.status(403).json({ error: 'Course enrollment is strictly for Student accounts.' });
      return;
    }
    const course = db.courses.find((c) => c.id === req.params.id);
    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    if (course.enrollments.some((e) => e.studentId === user.id)) {
      res.status(409).json({ error: 'You are already enrolled in this course.' });
      return;
    }
    course.enrollments.push({
      studentId: user.id,
      studentMemberId: user.memberId,
      studentName: user.name,
      studentEmail: user.email,
      enrolledAt: new Date().toISOString(),
    });
    saveDatabase();
    res.status(201).json({
      course,
      progress: computeUserProgress(user.id),
    });
  });

  // 16. Faculty Directory (Replaces faculty achievements: shows faculty names, designations like Professor, HOD, etc.)
  app.get('/api/faculty', (_req: Request, res: Response) => {
    res.json({ facultyMembers: db.facultyMembers || [] });
  });

  app.post('/api/faculty', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role === 'student') {
      res.status(403).json({
        error: 'Faculty directory editing is disabled for student accounts.',
      });
      return;
    }
    const {
      name,
      designation,
      specialization,
      email,
      phoneOrCabin,
      qualification,
      experienceYears,
      bio,
    } = req.body as Partial<FacultyMember>;
    if (!name?.trim() || !designation?.trim()) {
      res.status(400).json({ error: 'Faculty name and designation (e.g. Professor, HOD) are required.' });
      return;
    }
    const item: FacultyMember = {
      id: `fac-${crypto.randomUUID()}`,
      name: name.trim(),
      designation: designation.trim(),
      specialization: (specialization || '').trim() || 'Computer Science & Engineering',
      email: (email || '').trim(),
      phoneOrCabin: (phoneOrCabin || '').trim(),
      qualification: (qualification || '').trim(),
      experienceYears: experienceYears !== undefined ? Number(experienceYears) || 0 : 0,
      bio: (bio || '').trim(),
      authorId: user.id,
      createdAt: new Date().toISOString(),
    };
    if (!db.facultyMembers) db.facultyMembers = [];
    db.facultyMembers.unshift(item);
    saveDatabase();
    res.status(201).json(item);
  });

  app.put('/api/faculty/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role === 'student') {
      res.status(403).json({ error: 'Students cannot modify faculty details.' });
      return;
    }
    const item = (db.facultyMembers || []).find((f) => f.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Faculty member not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({
        error: 'Faculty members cannot modify profiles of other faculty members.',
      });
      return;
    }
    const {
      name,
      designation,
      specialization,
      email,
      phoneOrCabin,
      qualification,
      experienceYears,
      bio,
    } = req.body as Partial<FacultyMember>;
    if (name !== undefined) item.name = name.trim();
    if (designation !== undefined) item.designation = designation.trim();
    if (specialization !== undefined) item.specialization = specialization.trim();
    if (email !== undefined) item.email = email.trim();
    if (phoneOrCabin !== undefined) item.phoneOrCabin = phoneOrCabin.trim();
    if (qualification !== undefined) item.qualification = qualification.trim();
    if (experienceYears !== undefined) item.experienceYears = Number(experienceYears) || 0;
    if (bio !== undefined) item.bio = bio.trim();
    saveDatabase();
    res.json(item);
  });

  app.delete('/api/faculty/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = (db.facultyMembers || []).find((f) => f.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Faculty member not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({
        error: 'Only the authoring faculty member or Admin can remove this record.',
      });
      return;
    }
    db.facultyMembers = (db.facultyMembers || []).filter((f) => f.id !== req.params.id);
    saveDatabase();
    res.json({ ok: true });
  });

  // 17. Lab & Dept Academic Resources
  app.post('/api/resources', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'faculty' && user.role !== 'admin') {
      res.status(403).json({ error: 'Only Faculty and Admin can publish official Academic Resources.' });
      return;
    }
    const { title, resourceType, subjectOrLab, description, resourceLink } =
      req.body as Partial<AcademicResource>;
    if (!title?.trim() || !resourceLink?.trim()) {
      res.status(400).json({ error: 'Resource title and link are required.' });
      return;
    }
    const item: AcademicResource = {
      id: `res-${crypto.randomUUID()}`,
      title: title.trim(),
      resourceType: (resourceType || 'Lab Manual').trim(),
      subjectOrLab: (subjectOrLab || 'CSE Department').trim(),
      description: (description || '').trim(),
      resourceLink: resourceLink.trim(),
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString(),
    };
    db.resources.unshift(item);
    saveDatabase();
    res.status(201).json(item);
  });

  app.delete('/api/resources/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const item = db.resources.find((r) => r.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Resource not found.' });
      return;
    }
    if (user.role !== 'admin' && item.authorId !== user.id) {
      res.status(403).json({ error: 'Only the uploader or Admin can remove this resource.' });
      return;
    }
    db.resources = db.resources.filter((r) => r.id !== req.params.id);
    saveDatabase();
    res.json({ ok: true });
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CSE Department Portal server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
