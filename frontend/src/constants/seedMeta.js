export const ROLES = ["Admin", "Project Manager", "Team Member"];
export const STATUSES = ["To Do", "In Progress", "Under Review", "Completed"];
export const PRIORITIES = ["Low", "Medium", "High", "Critical"];
export const TASK_TYPES = ["Task", "Bug", "Issue", "Feature", "Documentation"];
export const SEVERITIES = ["Low", "Medium", "High", "Critical"];
export const PRESET_TAGS = [
  "Frontend",
  "Backend",
  "API",
  "Bug",
  "Documentation",
  "Testing",
  "Design",
  "DevOps",
  "Security",
];

// The API sends calendar dates (due dates, milestones, sprints, meetings) as "YYYY-MM-DD" strings,
// and event times (createdAt, comment/announcement dates) as full ISO timestamps.
export function formatDateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Calendar day (YYYY-MM-DD) of a timestamp, in local time
export function dayOf(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts).slice(0, 10);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Today in the user's local time zone (toISOString would give the UTC day)
export function todayISO() {
  return dayOf(new Date());
}

export function addDays(dateStr, n) {
  const d = new Date((dateStr || todayISO()) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const s = new Date(startStr + "T00:00:00Z");
  const e = new Date(endStr + "T00:00:00Z");
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  return daysBetween(todayISO(), dateStr);
}

export function isTaskOverdue(task) {
  if (!task || !task.dueDate || task.status === "Completed") return false;
  return task.dueDate < todayISO();
}

export function isTaskApproaching(task, withinDays = 2) {
  if (!task || !task.dueDate || task.status === "Completed") return false;
  const diff = daysUntil(task.dueDate);
  return diff !== null && diff >= 0 && diff <= withinDays;
}

export const PROJECT_TEMPLATES = {
  Blank: {
    name: "Blank",
    description: "Start from scratch with an empty project workspace.",
    tags: [],
    buildMilestones: () => [],
    buildSprints: () => [],
  },
  "Web App": {
    name: "Web App",
    description: "Full-stack web application template with design, API, and launch milestones.",
    tags: ["Frontend", "Backend", "API", "Testing"],
    buildMilestones: (startDate) => [
      { id: `m_${Date.now()}_1`, name: "Architecture & Wireframes Freeze", date: addDays(startDate, 7), done: false },
      { id: `m_${Date.now()}_2`, name: "Core API & Auth Beta", date: addDays(startDate, 18), done: false },
      { id: `m_${Date.now()}_3`, name: "QA Sign-off & Production Launch", date: addDays(startDate, 30), done: false },
    ],
    buildSprints: (startDate) => [
      {
        id: `s_${Date.now()}_1`,
        name: "Sprint 1 — Foundation & Setup",
        goal: "Deliver design system, database schema, and authentication flow",
        start: startDate,
        end: addDays(startDate, 14),
        status: "Active",
      },
    ],
  },
  "Mobile App": {
    name: "Mobile App",
    description: "iOS/Android app release cycle with beta testing and store submission stages.",
    tags: ["Frontend", "API", "Design", "Testing"],
    buildMilestones: (startDate) => [
      { id: `m_${Date.now()}_1`, name: "Interactive Prototype", date: addDays(startDate, 10), done: false },
      { id: `m_${Date.now()}_2`, name: "TestFlight / Internal Beta", date: addDays(startDate, 22), done: false },
      { id: `m_${Date.now()}_3`, name: "App Store Submission", date: addDays(startDate, 35), done: false },
    ],
    buildSprints: (startDate) => [
      {
        id: `s_${Date.now()}_1`,
        name: "Sprint 1 — Core Navigation & Offline Sync",
        goal: "Implement app shell, onboarding screens, and API sync",
        start: startDate,
        end: addDays(startDate, 14),
        status: "Active",
      },
    ],
  },
  "Bug Triage": {
    name: "Bug Triage",
    description: "Dedicated issue tracking, QA regression testing, and hotfix deployment pipeline.",
    tags: ["Bug", "Testing", "Backend", "Frontend"],
    buildMilestones: (startDate) => [
      { id: `m_${Date.now()}_1`, name: "Critical P0/P1 Bugs Resolved", date: addDays(startDate, 7), done: false },
      { id: `m_${Date.now()}_2`, name: "Regression Suite Green", date: addDays(startDate, 14), done: false },
    ],
    buildSprints: (startDate) => [
      {
        id: `s_${Date.now()}_1`,
        name: "Triage Wave 1",
        goal: "Eliminate all critical & high severity defects",
        start: startDate,
        end: addDays(startDate, 14),
        status: "Active",
      },
    ],
  },
  "Marketing Campaign": {
    name: "Marketing Campaign",
    description: "Product launch campaign with content creation, landing pages, and analytics setup.",
    tags: ["Design", "Documentation", "Frontend"],
    buildMilestones: (startDate) => [
      { id: `m_${Date.now()}_1`, name: "Creative Assets Approved", date: addDays(startDate, 10), done: false },
      { id: `m_${Date.now()}_2`, name: "Campaign Go-Live", date: addDays(startDate, 21), done: false },
    ],
    buildSprints: (startDate) => [
      {
        id: `s_${Date.now()}_1`,
        name: "Cycle 1 — Content & Landing Pages",
        goal: "Finalize copy, visuals, and conversion tracking",
        start: startDate,
        end: addDays(startDate, 14),
        status: "Active",
      },
    ],
  },
};

// Project methodologies: how the work process is organised. `sprints` on a project holds its stages.
export const METHODOLOGIES = {
  Agile: {
    description: "Time-boxed sprints pulled from a product backlog. Sprints can be planned and run flexibly; unfinished work returns to the backlog.",
    stage: "Sprint",
    stages: "Sprints",
    backlog: "Product Backlog",
  },
  Waterfall: {
    description: "Sequential phases (Requirements → Design → Implementation → Verification → Deployment). Each phase must be signed off before the next one starts.",
    stage: "Phase",
    stages: "Phases",
    backlog: "Unphased Work",
  },
  Iterative: {
    description: "Repeated iterations that refine the product. One iteration runs at a time; unfinished work carries over to the next.",
    stage: "Iteration",
    stages: "Iterations",
    backlog: "Iteration Backlog",
  },
};

export function methodologyOf(project) {
  return METHODOLOGIES[project?.methodology] || METHODOLOGIES.Agile;
}
