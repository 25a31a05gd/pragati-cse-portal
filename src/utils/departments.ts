import type { PublicUserProfile, SpotlightBanner } from '../types';
import { isSuperAdminUser } from './adminPermissions';

export const ALL_DEPARTMENTS_KEY = 'All Departments';

export const ENGINEERING_DEPARTMENTS = [
  'Computer Science & Engineering (CSE)',
  'CSE (Artificial Intelligence)',
  'CSE (Artificial Intelligence & Machine Learning)',
  'CSE (Data Science)',
  'Information Technology (IT)',
  'Electronics & Communication Engineering (ECE)',
  'Electrical & Electronics Engineering (EEE)',
  'Mechanical Engineering (MECH)',
  'Civil Engineering (CIVIL)',
] as const;

export const DASHBOARD_DEPARTMENT_OPTIONS = [
  ALL_DEPARTMENTS_KEY,
  ...ENGINEERING_DEPARTMENTS,
] as const;

export interface DepartmentLabInfo {
  tag: string;
  title: string;
  description: string;
  tagColorClass: string;
}

export interface DepartmentDashboardMeta {
  key: string;
  shortLabel: string;
  badgeText: string;
  heroTitle: string;
  heroSubtitlePublic: string;
  heroSubtitleMember: string;
  innovationTag: string;
  innovationTitle: string;
  innovationDesc: string;
  infrastructureTitle: string;
  infrastructureSubtitle: string;
  recruiters: string[];
  highlightTiles: [
    { value: string; label: string; colorClass: string },
    { value: string; label: string; colorClass: string },
    { value: string; label: string; colorClass: string },
    { value: string; label: string; colorClass: string },
  ];
  labs: [DepartmentLabInfo, DepartmentLabInfo, DepartmentLabInfo];
}

export const DEPARTMENT_DASHBOARD_META: Record<string, DepartmentDashboardMeta> = {
  [ALL_DEPARTMENTS_KEY]: {
    key: ALL_DEPARTMENTS_KEY,
    shortLabel: 'All Engineering Departments',
    badgeText: 'Central University · All Departments',
    heroTitle: 'Pragati University — All Departments Portal',
    heroSubtitlePublic:
      'Unified academic & placement showcase across CSE, CSE (AI), CSE (AI & ML), CSE (Data Science), IT, ECE, EEE, MECH, and CIVIL engineering departments.',
    heroSubtitleMember:
      'Central multi-department workspace covering hackathons, technical projects, company interview archives, placements, courses, and faculty across all engineering branches.',
    innovationTag: 'Pragati University Innovation & Research Ecosystem',
    innovationTitle: 'Cross-Departmental Excellence, Hackathons & Campus Placements',
    innovationDesc:
      'Uniting computing, electronics, power systems, robotics, and sustainable civil engineering research across all Pragati University departments.',
    infrastructureTitle: 'University-Wide Centers of Excellence & Multi-Branch Labs',
    infrastructureSubtitle:
      'Shared interdisciplinary research centers supporting students and faculty across every engineering branch.',
    recruiters: ['Atlassian', 'Google', 'Microsoft', 'Qualcomm', 'Siemens', 'Larsen & Toubro'],
    highlightTiles: [
      { value: '₹48.0 LPA', label: 'Highest Campus CTC', colorClass: 'text-emerald-400' },
      { value: '9 Branches', label: 'Engineering Departments', colorClass: 'text-amber-300' },
      { value: '96.4%', label: 'Campus Placement Rate', colorClass: 'text-blue-300' },
      { value: 'Top 50', label: 'NIRF Engineering', colorClass: 'text-indigo-300' },
    ],
    labs: [
      {
        tag: 'Center 01 · Computing & AI',
        title: 'High-Performance Computing & AI Cluster',
        description:
          'GPU-accelerated cluster and cloud sandboxes powering CSE, AI, ML, Data Science, and IT research.',
        tagColorClass: 'text-blue-700',
      },
      {
        tag: 'Center 02 · Electronics & Power',
        title: 'VLSI, IoT & Smart Energy Hub',
        description:
          'Integrated ASIC design suites, embedded microcontrollers, and smart grid testbeds serving ECE and EEE teams.',
        tagColorClass: 'text-indigo-700',
      },
      {
        tag: 'Center 03 · Robotics & Infrastructure',
        title: 'Mechatronics & Sustainable Structures Lab',
        description:
          'CAD/CAM automation rigs, materials testing systems, and smart infrastructure tools for MECH and CIVIL branches.',
        tagColorClass: 'text-teal-700',
      },
    ],
  },
  'Computer Science & Engineering (CSE)': {
    key: 'Computer Science & Engineering (CSE)',
    shortLabel: 'Dept of CSE',
    badgeText: 'Premier CSE Department',
    heroTitle: 'Department of Computer Science & Engineering',
    heroSubtitlePublic:
      'Welcome to the official CSE Department Portal. Explore our highest campus placement packages, national hackathon championships, faculty research, and student innovation.',
    heroSubtitleMember:
      'Centralized CSE workspace for technical hackathons, student repositories, verified company interview question archives, and academic registrations.',
    innovationTag: 'CSE Advanced Innovation Center',
    innovationTitle: 'Systems Engineering, Hackathon Champions & Elite Recruitment',
    innovationDesc:
      'Celebrating achievements in algorithmic computing, distributed cloud platforms, and national software engineering contests.',
    infrastructureTitle: 'Academic Infrastructure & Specialized Computing Centers',
    infrastructureSubtitle:
      'Industry-sponsored centers of excellence and high-performance computing facilities powering CSE student research.',
    recruiters: ['Atlassian', 'Google', 'Microsoft', 'Zoho', 'Amazon', 'Goldman Sachs'],
    highlightTiles: [
      { value: '₹48.0 LPA', label: 'Highest CTC (Atlassian)', colorClass: 'text-emerald-400' },
      { value: '₹1,50,000', label: '1st Prize Hackathon', colorClass: 'text-amber-300' },
      { value: '98.6%', label: 'Placement Rate', colorClass: 'text-blue-300' },
      { value: 'Top 50', label: 'NIRF Engineering', colorClass: 'text-indigo-300' },
    ],
    labs: [
      {
        tag: 'Lab 01 · High-Performance Computing',
        title: 'Distributed Systems & Cloud Hub',
        description:
          'Equipped with 64-node cluster servers for parallel processing, Linux namespace sandboxes, and distributed consensus research.',
        tagColorClass: 'text-blue-700',
      },
      {
        tag: 'Lab 02 · Artificial Intelligence',
        title: 'AI, Vision & Language Models Lab',
        description:
          'GPU-accelerated neural network training suites with dedicated workstations for deep learning and medical imaging research.',
        tagColorClass: 'text-indigo-700',
      },
      {
        tag: 'Lab 03 · Network Security',
        title: 'Cybersecurity & Cryptography Center',
        description:
          'Isolated sandboxed network testbed for intrusion detection simulation, cryptographic protocols, and secure routing experiments.',
        tagColorClass: 'text-teal-700',
      },
    ],
  },
  'CSE (Artificial Intelligence)': {
    key: 'CSE (Artificial Intelligence)',
    shortLabel: 'Dept of CSE (AI)',
    badgeText: 'Premier CSE (AI) Department',
    heroTitle: 'Department of CSE (Artificial Intelligence)',
    heroSubtitlePublic:
      'Welcome to the CSE (Artificial Intelligence) Portal. Discover neural architecture breakthroughs, AI hackathon awards, faculty research, and top AI product placements.',
    heroSubtitleMember:
      'Dedicated CSE (AI) workspace for deep learning projects, generative AI hackathons, technical interview archives, and course registrations.',
    innovationTag: 'CSE (AI) Deep Intelligence Studio',
    innovationTitle: 'Autonomous Agents, Computer Vision & Applied AI Systems',
    innovationDesc:
      'Advancing applied machine intelligence, natural language processing, and edge AI deployment.',
    infrastructureTitle: 'Artificial Intelligence Research Labs & GPU Compute Facilities',
    infrastructureSubtitle:
      'Dedicated deep-learning workstations and autonomous intelligence sandboxes for CSE (AI) students.',
    recruiters: ['Google', 'NVIDIA', 'Microsoft', 'Adobe', 'Amazon', 'ServiceNow'],
    highlightTiles: [
      { value: '₹42.0 LPA', label: 'Highest AI CTC', colorClass: 'text-emerald-400' },
      { value: '₹1,25,000', label: 'AI Hackathon First Prize', colorClass: 'text-amber-300' },
      { value: '97.8%', label: 'Placement Rate', colorClass: 'text-blue-300' },
      { value: 'GPU Pod', label: 'Dedicated AI Compute', colorClass: 'text-indigo-300' },
    ],
    labs: [
      {
        tag: 'Lab 01 · Neural Systems',
        title: 'Deep Learning & Transformer Compute Lab',
        description:
          'Multi-GPU training rigs dedicated to large-scale representation learning, fine-tuning, and multimodal AI modeling.',
        tagColorClass: 'text-blue-700',
      },
      {
        tag: 'Lab 02 · Computer Vision',
        title: 'Autonomous Robotics & Perception Lab',
        description:
          'Edge-inference cameras, LiDAR rigs, and real-time object tracking suites for robotics and spatial perception.',
        tagColorClass: 'text-indigo-700',
      },
      {
        tag: 'Lab 03 · Natural Language',
        title: 'Conversational AI & Knowledge Graph Lab',
        description:
          'Testbeds for multilingual NLP pipelines, retrieval-augmented generation, and semantic reasoning tools.',
        tagColorClass: 'text-teal-700',
      },
    ],
  },
  'CSE (Artificial Intelligence & Machine Learning)': {
    key: 'CSE (Artificial Intelligence & Machine Learning)',
    shortLabel: 'Dept of CSE (AI & ML)',
    badgeText: 'Premier CSE (AI & ML) Department',
    heroTitle: 'Department of CSE (AI & Machine Learning)',
    heroSubtitlePublic:
      'Welcome to the CSE (AI & ML) Department Portal showcasing predictive modeling research, ML competitions, verified placement offers, and student builds.',
    heroSubtitleMember:
      'Unified CSE (AI & ML) workspace for ML project repositories, hackathon reflections, company interview logs, and coursework.',
    innovationTag: 'CSE (AI & ML) Center of Excellence',
    innovationTitle: 'Statistical Learning, MLOps & Intelligent Automation',
    innovationDesc:
      'Bridging foundational machine learning algorithms with production-grade MLOps and scalable inference pipelines.',
    infrastructureTitle: 'Machine Learning Compute Centers & Experiment Labs',
    infrastructureSubtitle:
      'Specialized facilities enabling end-to-end model training, reinforcement learning, and deployment benchmarks.',
    recruiters: ['Microsoft', 'Amazon', 'Flipkart', 'Oracle', 'Goldman Sachs', 'Zoho'],
    highlightTiles: [
      { value: '₹40.0 LPA', label: 'Highest ML Package', colorClass: 'text-emerald-400' },
      { value: '₹1,20,000', label: 'ML Challenge Prize', colorClass: 'text-amber-300' },
      { value: '97.4%', label: 'Placement Rate', colorClass: 'text-blue-300' },
      { value: 'MLOps Hub', label: 'Cloud Training Studio', colorClass: 'text-indigo-300' },
    ],
    labs: [
      {
        tag: 'Lab 01 · Predictive Modeling',
        title: 'Applied Machine Learning Studio',
        description:
          'High-memory compute workstations for ensemble modeling, feature engineering, and time-series forecasting.',
        tagColorClass: 'text-blue-700',
      },
      {
        tag: 'Lab 02 · Reinforcement Learning',
        title: 'Decision Systems & Simulation Lab',
        description:
          'Physics and multi-agent simulation engines for policy optimization and autonomous control experiments.',
        tagColorClass: 'text-indigo-700',
      },
      {
        tag: 'Lab 03 · Production MLOps',
        title: 'Model Serving & Cloud Inference Lab',
        description:
          'Containerized Kubernetes testbeds for model quantization, drift monitoring, and low-latency APIs.',
        tagColorClass: 'text-teal-700',
      },
    ],
  },
  'CSE (Data Science)': {
    key: 'CSE (Data Science)',
    shortLabel: 'Dept of CSE (DS)',
    badgeText: 'Premier CSE (Data Science) Department',
    heroTitle: 'Department of CSE (Data Science)',
    heroSubtitlePublic:
      'Welcome to the CSE (Data Science) Portal. Explore big-data engineering projects, analytics competitions, industry placements, and faculty research.',
    heroSubtitleMember:
      'Central CSE (Data Science) hub for data pipelines, hackathon solutions, interview experiences, and specialized analytics coursework.',
    innovationTag: 'CSE (Data Science) Analytics Hub',
    innovationTitle: 'Big Data Engineering, Streaming Analytics & Decision Science',
    innovationDesc:
      'Empowering students to build resilient lakehouses, statistical models, and interactive executive intelligence.',
    infrastructureTitle: 'Data Engineering & Visual Analytics Infrastructure',
    infrastructureSubtitle:
      'Distributed storage clusters and business-intelligence labs powering CSE (Data Science) projects.',
    recruiters: ['Goldman Sachs', 'JPMorgan Chase', 'Deloitte', 'Amazon', 'PayPal', 'Accenture'],
    highlightTiles: [
      { value: '₹36.0 LPA', label: 'Highest Analytics CTC', colorClass: 'text-emerald-400' },
      { value: '₹1,00,000', label: 'Datathon Winner', colorClass: 'text-amber-300' },
      { value: '96.9%', label: 'Placement Rate', colorClass: 'text-blue-300' },
      { value: 'Petabyte', label: 'Spark & Lakehouse Lab', colorClass: 'text-indigo-300' },
    ],
    labs: [
      {
        tag: 'Lab 01 · Distributed Data',
        title: 'Big Data & Stream Processing Cluster',
        description:
          'Multi-node Apache Spark and Kafka environments for real-time telemetry ingestion and distributed ETL pipelines.',
        tagColorClass: 'text-blue-700',
      },
      {
        tag: 'Lab 02 · Quantitative Analytics',
        title: 'Statistical Modeling & FinTech Lab',
        description:
          'Dedicated systems for econometrics, risk modeling, Bayesian inference, and algorithmic portfolio analysis.',
        tagColorClass: 'text-indigo-700',
      },
      {
        tag: 'Lab 03 · Data Visualization',
        title: 'Visual Intelligence & BI Studio',
        description:
          'Interactive dashboards, geospatial mapping workstations, and enterprise warehouse modeling tools.',
        tagColorClass: 'text-teal-700',
      },
    ],
  },
  'Information Technology (IT)': {
    key: 'Information Technology (IT)',
    shortLabel: 'Dept of IT',
    badgeText: 'Premier IT Department',
    heroTitle: 'Department of Information Technology (IT)',
    heroSubtitlePublic:
      'Welcome to the IT Department Portal. Explore enterprise cloud architectures, full-stack innovations, top campus placements, and faculty mentorship.',
    heroSubtitleMember:
      'Central IT workspace for web & cloud repositories, hackathon wins, verified technical interview logs, and academic enrollments.',
    innovationTag: 'IT Enterprise Cloud & Systems Center',
    innovationTitle: 'Full-Stack Engineering, DevOps & Enterprise Security',
    innovationDesc:
      'Focused on resilient web platforms, microservice observability, and rapid product engineering.',
    infrastructureTitle: 'IT Infrastructure & Software Engineering Laboratories',
    infrastructureSubtitle:
      'Modern cloud-native testbeds and cybersecurity ranges supporting IT student innovation.',
    recruiters: ['Atlassian', 'Zoho', 'TCS Digital', 'Infosys', 'Cognizant', 'Freshworks'],
    highlightTiles: [
      { value: '₹34.0 LPA', label: 'Highest IT Offer', colorClass: 'text-emerald-400' },
      { value: '₹1,00,000', label: 'Product Hackathon Prize', colorClass: 'text-amber-300' },
      { value: '96.5%', label: 'Placement Rate', colorClass: 'text-blue-300' },
      { value: 'Cloud Native', label: 'DevSecOps Sandbox', colorClass: 'text-indigo-300' },
    ],
    labs: [
      {
        tag: 'Lab 01 · Cloud & DevOps',
        title: 'Containerization & Microservices Lab',
        description:
          'CI/CD pipelines, Kubernetes orchestration clusters, and infrastructure-as-code sandboxes.',
        tagColorClass: 'text-blue-700',
      },
      {
        tag: 'Lab 02 · Enterprise Software',
        title: 'Full-Stack & API Architecture Lab',
        description:
          'High-availability database clusters, distributed caching testbeds, and modern web engineering workstations.',
        tagColorClass: 'text-indigo-700',
      },
      {
        tag: 'Lab 03 · Information Assurance',
        title: 'Application Security & SOC Lab',
        description:
          'Penetration testing ranges, SIEM log pipelines, and zero-trust identity engineering tools.',
        tagColorClass: 'text-teal-700',
      },
    ],
  },
  'Electronics & Communication Engineering (ECE)': {
    key: 'Electronics & Communication Engineering (ECE)',
    shortLabel: 'Dept of ECE',
    badgeText: 'Premier ECE Department',
    heroTitle: 'Department of Electronics & Communication Engineering (ECE)',
    heroSubtitlePublic:
      'Welcome to the official ECE Department Portal. Explore VLSI chip design breakthroughs, embedded IoT prototypes, core electronics placements, and faculty research.',
    heroSubtitleMember:
      'Centralized ECE workspace for hardware-software hackathons, VLSI/IoT projects, core company interview archives, and course registrations.',
    innovationTag: 'ECE VLSI & Communications Innovation Center',
    innovationTitle: 'Silicon Design, 5G RF Engineering & Embedded Intelligence',
    innovationDesc:
      'Advancing RTL verification, mixed-signal integrated circuits, IoT sensor networks, and wireless communication systems.',
    infrastructureTitle: 'ECE Laboratories & Semiconductor Centers of Excellence',
    infrastructureSubtitle:
      'Industry-grade EDA toolchains, FPGA boards, and RF instrumentation powering ECE student research.',
    recruiters: ['Qualcomm', 'Intel', 'Texas Instruments', 'Broadcom', 'Bosch', 'Samsung R&D'],
    highlightTiles: [
      { value: '₹32.0 LPA', label: 'Highest Core VLSI CTC', colorClass: 'text-emerald-400' },
      { value: '₹1,10,000', label: 'Hardware Hackathon Prize', colorClass: 'text-amber-300' },
      { value: '95.8%', label: 'Placement Rate', colorClass: 'text-blue-300' },
      { value: 'NBA Tier-1', label: 'ECE Accreditation', colorClass: 'text-indigo-300' },
    ],
    labs: [
      {
        tag: 'Lab 01 · Semiconductor Design',
        title: 'VLSI, FPGA & ASIC Verification Lab',
        description:
          'Equipped with Cadence/Synopsys EDA suites and Xilinx FPGA kits for RTL synthesis, timing closure, and physical design.',
        tagColorClass: 'text-blue-700',
      },
      {
        tag: 'Lab 02 · Embedded & IoT',
        title: 'Microcontrollers, RTOS & Edge IoT Hub',
        description:
          'ARM Cortex, ESP32, and industrial sensor testbeds for real-time firmware and smart connected hardware.',
        tagColorClass: 'text-indigo-700',
      },
      {
        tag: 'Lab 03 · RF & Signal Processing',
        title: '5G Wireless & DSP Communications Lab',
        description:
          'Software-defined radios, spectrum analyzers, and MIMO antenna benches for next-generation telecommunications.',
        tagColorClass: 'text-teal-700',
      },
    ],
  },
  'Electrical & Electronics Engineering (EEE)': {
    key: 'Electrical & Electronics Engineering (EEE)',
    shortLabel: 'Dept of EEE',
    badgeText: 'Premier EEE Department',
    heroTitle: 'Department of Electrical & Electronics Engineering (EEE)',
    heroSubtitlePublic:
      'Welcome to the official EEE Department Portal. Discover smart-grid innovations, EV powertrain projects, core energy placements, and faculty research.',
    heroSubtitleMember:
      'Central EEE workspace for clean-tech hackathons, power-electronics builds, core PSU/OEM interview logs, and academic enrollments.',
    innovationTag: 'EEE Smart Grid & E-Mobility Center',
    innovationTitle: 'Renewable Microgrids, Power Electronics & EV Systems',
    innovationDesc:
      'Pioneering high-efficiency inverters, battery management systems, and intelligent industrial automation.',
    infrastructureTitle: 'Electrical Power & Control Systems Laboratories',
    infrastructureSubtitle:
      'High-voltage simulation benches, PLC automation racks, and EV drivetrain rigs for EEE learners.',
    recruiters: ['Siemens', 'ABB', 'Schneider Electric', 'Tata Power', 'L&T', 'Honeywell'],
    highlightTiles: [
      { value: '₹24.0 LPA', label: 'Highest Core EEE CTC', colorClass: 'text-emerald-400' },
      { value: '₹1,00,000', label: 'Clean-Tech Award', colorClass: 'text-amber-300' },
      { value: '94.5%', label: 'Placement Rate', colorClass: 'text-blue-300' },
      { value: 'Smart Grid', label: 'EV & Power Testbed', colorClass: 'text-indigo-300' },
    ],
    labs: [
      {
        tag: 'Lab 01 · Power Electronics',
        title: 'EV Drivetrain & Converter Design Lab',
        description:
          'Hardware-in-the-loop benches for DC-DC converters, BLDC motor drives, and battery management systems.',
        tagColorClass: 'text-blue-700',
      },
      {
        tag: 'Lab 02 · Grid & Renewables',
        title: 'Smart Microgrid & Solar Integration Lab',
        description:
          'Real-time digital grid simulators and protective relay testbeds for resilient renewable energy distribution.',
        tagColorClass: 'text-indigo-700',
      },
      {
        tag: 'Lab 03 · Industrial Control',
        title: 'PLC, SCADA & Automation Center',
        description:
          'Industrial controllers, SCADA telemetry consoles, and servo instrumentation for factory automation.',
        tagColorClass: 'text-teal-700',
      },
    ],
  },
  'Mechanical Engineering (MECH)': {
    key: 'Mechanical Engineering (MECH)',
    shortLabel: 'Dept of MECH',
    badgeText: 'Premier MECH Department',
    heroTitle: 'Department of Mechanical Engineering (MECH)',
    heroSubtitlePublic:
      'Welcome to the official Mechanical Engineering Portal. Explore robotics championships, CAD/CAM prototypes, automotive placements, and faculty research.',
    heroSubtitleMember:
      'Central MECH workspace for design hackathons, mechatronics projects, core OEM interview experiences, and department coursework.',
    innovationTag: 'MECH Advanced Manufacturing & Robotics Hub',
    innovationTitle: 'Precision Design, Robotics & Thermal Systems Engineering',
    innovationDesc:
      'Integrating finite-element simulation, additive manufacturing, and autonomous industrial robotics.',
    infrastructureTitle: 'Mechanical Design, Robotics & Manufacturing Facilities',
    infrastructureSubtitle:
      'CNC machining centers, 3D printing studios, and thermal propulsion benches serving MECH innovators.',
    recruiters: ['Tata Motors', 'Mahindra', 'Larsen & Toubro', 'Bosch', 'Caterpillar', 'Ashok Leyland'],
    highlightTiles: [
      { value: '₹22.0 LPA', label: 'Highest Core MECH CTC', colorClass: 'text-emerald-400' },
      { value: '₹1,00,000', label: 'SAE / RoboCon Prize', colorClass: 'text-amber-300' },
      { value: '93.8%', label: 'Placement Rate', colorClass: 'text-blue-300' },
      { value: 'Industry 4.0', label: 'CNC & Additive Hub', colorClass: 'text-indigo-300' },
    ],
    labs: [
      {
        tag: 'Lab 01 · CAD/CAM & CAE',
        title: 'Computational Design & FEA Simulation Lab',
        description:
          'SolidWorks, ANSYS, and CFD workstations for structural optimization, aerodynamics, and digital twin modeling.',
        tagColorClass: 'text-blue-700',
      },
      {
        tag: 'Lab 02 · Smart Manufacturing',
        title: '5-Axis CNC & Additive Prototyping Hub',
        description:
          'Multi-axis CNC mills, metal/polymer 3D printers, and coordinate metrology tools for rapid fabrication.',
        tagColorClass: 'text-indigo-700',
      },
      {
        tag: 'Lab 03 · Robotics & Thermal',
        title: 'Mechatronics & Sustainable Energy Lab',
        description:
          '6-DOF robotic arms, pneumatic automation benches, and thermal heat-transfer testing rigs.',
        tagColorClass: 'text-teal-700',
      },
    ],
  },
  'Civil Engineering (CIVIL)': {
    key: 'Civil Engineering (CIVIL)',
    shortLabel: 'Dept of CIVIL',
    badgeText: 'Premier CIVIL Department',
    heroTitle: 'Department of Civil Engineering (CIVIL)',
    heroSubtitlePublic:
      'Welcome to the official Civil Engineering Portal. Explore sustainable infrastructure projects, BIM/GIS builds, core EPC placements, and faculty research.',
    heroSubtitleMember:
      'Central CIVIL workspace for urban-tech hackathons, structural engineering repositories, EPC interview logs, and academic enrollments.',
    innovationTag: 'CIVIL Smart Infrastructure & Sustainability Center',
    innovationTitle: 'Resilient Structures, Green Concrete & Urban GIS Planning',
    innovationDesc:
      'Advancing seismic structural analysis, sustainable construction materials, and digital BIM city twins.',
    infrastructureTitle: 'Structural Testing, Geotech & Geomatics Laboratories',
    infrastructureSubtitle:
      'Universal testing frames, total-station surveying, and BIM studios supporting CIVIL engineering research.',
    recruiters: ['L&T Construction', 'Tata Projects', 'Shapoorji Pallonji', 'UltraTech', 'AECOM', 'GMR Infra'],
    highlightTiles: [
      { value: '₹18.5 LPA', label: 'Highest Core Infra CTC', colorClass: 'text-emerald-400' },
      { value: '₹75,000', label: 'Smart City Design Prize', colorClass: 'text-amber-300' },
      { value: '93.2%', label: 'Placement Rate', colorClass: 'text-blue-300' },
      { value: 'BIM & GIS', label: 'Smart Infra Studio', colorClass: 'text-indigo-300' },
    ],
    labs: [
      {
        tag: 'Lab 01 · Structural Engineering',
        title: 'Heavy Structures & Material Testing Lab',
        description:
          'High-capacity universal testing machines, shake tables, and non-destructive concrete diagnostics.',
        tagColorClass: 'text-blue-700',
      },
      {
        tag: 'Lab 02 · Geotech & Transportation',
        title: 'Soil Mechanics & Pavement Engineering Lab',
        description:
          'Triaxial shear apparatus, bitumen rheology benches, and sustainable highway material testbeds.',
        tagColorClass: 'text-indigo-700',
      },
      {
        tag: 'Lab 03 · BIM & Geomatics',
        title: 'Drone Surveying, GIS & Hydrology Lab',
        description:
          'Total stations, LiDAR/UAV terrain mapping suites, Revit BIM workflows, and environmental water-quality analyzers.',
        tagColorClass: 'text-teal-700',
      },
    ],
  },
};

export function normalizeDashboardDepartment(rawDepartment?: string | null): string {
  const trimmed = (rawDepartment || '').trim();
  if (!trimmed) return ALL_DEPARTMENTS_KEY;

  const lower = trimmed.toLowerCase();
  if (
    lower === 'all departments' ||
    lower === 'all' ||
    lower === 'administration' ||
    lower === 'central administration' ||
    lower === 'central'
  ) {
    return ALL_DEPARTMENTS_KEY;
  }

  for (const dept of ENGINEERING_DEPARTMENTS) {
    if (dept.toLowerCase() === lower) {
      return dept;
    }
  }

  if (lower.includes('artificial intelligence') && lower.includes('machine learning')) {
    return 'CSE (Artificial Intelligence & Machine Learning)';
  }
  if (lower.includes('artificial intelligence') || lower === 'cse(ai)' || lower === 'cse (ai)' || lower === 'ai') {
    return 'CSE (Artificial Intelligence)';
  }
  if (lower.includes('data science') || lower === 'cse (ds)' || lower === 'ds') {
    return 'CSE (Data Science)';
  }
  if (lower.includes('information technology') || lower === 'it') {
    return 'Information Technology (IT)';
  }
  if (lower.includes('electronics & communication') || lower.includes('electronics and communication') || lower === 'ece') {
    return 'Electronics & Communication Engineering (ECE)';
  }
  if (lower.includes('electrical & electronics') || lower.includes('electrical and electronics') || lower === 'eee') {
    return 'Electrical & Electronics Engineering (EEE)';
  }
  if (lower.includes('mechanical') || lower === 'mech') {
    return 'Mechanical Engineering (MECH)';
  }
  if (lower.includes('civil')) {
    return 'Civil Engineering (CIVIL)';
  }
  if (lower.includes('computer science') || lower === 'cse') {
    return 'Computer Science & Engineering (CSE)';
  }

  return trimmed;
}

export function resolveUserDashboardDepartment(user: PublicUserProfile | null | undefined): string {
  if (!user) return ALL_DEPARTMENTS_KEY;

  if (user.role === 'admin') {
    if (isSuperAdminUser(user)) {
      return ALL_DEPARTMENTS_KEY;
    }
    return normalizeDashboardDepartment(user.department);
  }

  const normalized = normalizeDashboardDepartment(user.department);
  return normalized || 'Computer Science & Engineering (CSE)';
}

export function getDepartmentDashboardMeta(departmentKey?: string | null): DepartmentDashboardMeta {
  const normalized = normalizeDashboardDepartment(departmentKey);
  if (DEPARTMENT_DASHBOARD_META[normalized]) {
    return DEPARTMENT_DASHBOARD_META[normalized];
  }

  return {
    key: normalized,
    shortLabel: `Dept of ${normalized}`,
    badgeText: `${normalized} Department`,
    heroTitle: `Department of ${normalized}`,
    heroSubtitlePublic: `Welcome to the official ${normalized} Department Portal. Explore campus placements, national hackathon championships, faculty research, and student innovation.`,
    heroSubtitleMember: `Centralized ${normalized} workspace for hackathons, student repositories, verified company interview archives, and academic registrations.`,
    innovationTag: `${normalized} Innovation Center`,
    innovationTitle: `${normalized} Research, Projects & Elite Recruitment`,
    innovationDesc: `Celebrating achievements in engineering design, applied research, and national competitions across ${normalized}.`,
    infrastructureTitle: `Academic Infrastructure & ${normalized} Laboratories`,
    infrastructureSubtitle: `Specialized facilities and centers of excellence powering ${normalized} student research.`,
    recruiters: ['Atlassian', 'Google', 'Microsoft', 'Qualcomm', 'Siemens', 'Larsen & Toubro'],
    highlightTiles: DEPARTMENT_DASHBOARD_META[ALL_DEPARTMENTS_KEY].highlightTiles,
    labs: DEPARTMENT_DASHBOARD_META[ALL_DEPARTMENTS_KEY].labs,
  };
}

export function isPackageSpotlight(spot: SpotlightBanner): boolean {
  const cat = (spot.category || '').toLowerCase();
  if (cat.includes('placement rate')) return false;
  return cat.includes('package') || cat.includes('ctc') || (cat.includes('placement') && !cat.includes('rate'));
}

export function isPlacementRateSpotlight(spot: SpotlightBanner): boolean {
  return (spot.category || '').toLowerCase().includes('placement rate');
}

export function isHackathonPrizeSpotlight(spot: SpotlightBanner): boolean {
  const cat = (spot.category || '').toLowerCase();
  return cat.includes('hackathon') || cat.includes('prize');
}

export function isProjectsOrTrainingSpotlight(spot: SpotlightBanner): boolean {
  const cat = (spot.category || '').toLowerCase();
  return cat.includes('project') || cat.includes('training');
}

export interface DepartmentPackageTickerItem {
  department: string;
  shortLabel: string;
  packageValue: string;
  placementRate: string;
  hackathonPrize: string;
  projectsTraining: string;
  title: string;
  recipients: string;
  isPublished: boolean;
}

export interface DepartmentHeroTile {
  value: string;
  label: string;
  colorClass: string;
  isLive: boolean;
}

function parseLpaNumericValue(raw: string): number {
  const normalized = (raw || '').replace(/,/g, '');
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : 0;
}

export function getDepartmentHeroPackageTile(
  departmentKey: string,
  spotlights: SpotlightBanner[]
): DepartmentHeroTile {
  const normalized = normalizeDashboardDepartment(departmentKey);
  const meta = getDepartmentDashboardMeta(normalized);
  const packageSpotlights = spotlights.filter(isPackageSpotlight);

  if (normalized === ALL_DEPARTMENTS_KEY) {
    if (packageSpotlights.length > 0) {
      const top = [...packageSpotlights].sort(
        (a, b) => parseLpaNumericValue(b.headlineValue) - parseLpaNumericValue(a.headlineValue)
      )[0];
      if (top) {
        const deptShort =
          top.department && normalizeDashboardDepartment(top.department) !== ALL_DEPARTMENTS_KEY
            ? ` · ${getDepartmentDashboardMeta(top.department).shortLabel}`
            : '';
        return {
          value: top.headlineValue,
          label: `${top.title || 'Highest Campus Package'}${deptShort}`,
          colorClass: 'text-emerald-400',
          isLive: true,
        };
      }
    }
    return { ...meta.highlightTiles[0], isLive: false };
  }

  const branchPackage = packageSpotlights.find(
    (spot) => normalizeDashboardDepartment(spot.department) === normalized
  );
  if (branchPackage) {
    return {
      value: branchPackage.headlineValue,
      label: branchPackage.title || `Highest ${meta.shortLabel} Package`,
      colorClass: 'text-emerald-400',
      isLive: true,
    };
  }

  return { ...meta.highlightTiles[0], isLive: false };
}

export function getDepartmentHeroTiles(
  departmentKey: string,
  spotlights: SpotlightBanner[]
): [DepartmentHeroTile, DepartmentHeroTile, DepartmentHeroTile, DepartmentHeroTile] {
  const normalized = normalizeDashboardDepartment(departmentKey);
  const meta = getDepartmentDashboardMeta(normalized);
  const matchesScope = (spot: SpotlightBanner) =>
    normalized === ALL_DEPARTMENTS_KEY
      ? true
      : normalizeDashboardDepartment(spot.department) === normalized;

  const packageTile = getDepartmentHeroPackageTile(departmentKey, spotlights);

  const livePrize = spotlights.find((s) => isHackathonPrizeSpotlight(s) && matchesScope(s));
  const prizeTile: DepartmentHeroTile = livePrize
    ? {
        value: livePrize.headlineValue,
        label: livePrize.title || meta.highlightTiles[1].label,
        colorClass: 'text-amber-300',
        isLive: true,
      }
    : { ...meta.highlightTiles[1], isLive: false };

  const liveRate = spotlights.find((s) => isPlacementRateSpotlight(s) && matchesScope(s));
  const rateTile: DepartmentHeroTile = liveRate
    ? {
        value: liveRate.headlineValue,
        label: liveRate.title || 'Placement Rate',
        colorClass: 'text-blue-300',
        isLive: true,
      }
    : { ...meta.highlightTiles[2], isLive: false };

  const liveProjectOrTraining = spotlights.find(
    (s) => isProjectsOrTrainingSpotlight(s) && matchesScope(s)
  );
  const fourthTile: DepartmentHeroTile = liveProjectOrTraining
    ? {
        value: liveProjectOrTraining.headlineValue,
        label: liveProjectOrTraining.title || 'Projects & Training',
        colorClass: 'text-indigo-300',
        isLive: true,
      }
    : { ...meta.highlightTiles[3], isLive: false };

  return [packageTile, prizeTile, rateTile, fourthTile];
}

export function buildDepartmentPackageMarquee(
  spotlights: SpotlightBanner[]
): DepartmentPackageTickerItem[] {
  const packageSpotlights = spotlights.filter(isPackageSpotlight);

  return ENGINEERING_DEPARTMENTS.map((dept) => {
    const meta = getDepartmentDashboardMeta(dept);
    const [pkgTile, prizeTile, rateTile, projectTile] = getDepartmentHeroTiles(dept, spotlights);
    const matched = packageSpotlights.find(
      (spot) => normalizeDashboardDepartment(spot.department) === dept
    );
    const anyLive =
      pkgTile.isLive || prizeTile.isLive || rateTile.isLive || projectTile.isLive;

    return {
      department: dept,
      shortLabel: meta.shortLabel,
      packageValue: pkgTile.value,
      placementRate: rateTile.value,
      hackathonPrize: prizeTile.value,
      projectsTraining: projectTile.value,
      title: matched ? matched.title : pkgTile.label,
      recipients: matched?.recipients || (meta.recruiters[0] ? `Top Recruiter: ${meta.recruiters[0]}` : ''),
      isPublished: anyLive,
    };
  });
}

