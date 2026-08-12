import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";

export type Role = "Trainer" | "Reviewer";
export type Subrole = "Trainer 1" | "Trainer 2" | "Completion Reviewer" | "Quality Reviewer";
export type TimerMode = "hubstaff" | "untracked";

export const SUBROLES_BY_ROLE: Record<Role, Subrole[]> = {
  Trainer: ["Trainer 1", "Trainer 2"],
  Reviewer: ["Completion Reviewer", "Quality Reviewer"],
};

export interface RoleThresholds {
  expectedAhtMinutes: number;
  maxAhtMinutes: number;
}

export interface UserSettings {
  defaultRole: Role;
  trackingStartDate: string; // YYYY-MM-DD
  pageSize: number; // 25, 50, 100
  hubstaffPageSize: number; // 25, 50, 100
  thresholds: {
    Trainer: RoleThresholds;
    Reviewer: RoleThresholds;
  };
}

export interface TaskLogEntry {
  id: string;
  userId: string;
  role: Role;
  subrole: Subrole;
  title: string;
  url: string;
  notes: string;
  durationSeconds: number;
  timerMode: TimerMode;
  createdAt: string; // ISO string
}

export interface HubstaffEvent {
  id: string;
  userId: string;
  eventName: "Timer Started" | "Timer Stopped";
  eventTime: string; // ISO string
  projectId: string;
  projectName: string;
}

export interface HubstaffTimeRecord {
  Trainer: number;
  Reviewer: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

const STORAGE_KEY = "hubstaff_aht_app_state_v3";

export const DEFAULT_USER: UserProfile = {
  id: "usr_alex_rivera_01",
  name: "Alex Rivera",
  email: "alex.rivera@company.com",
};

export const DEFAULT_SETTINGS: UserSettings = {
  defaultRole: "Reviewer",
  trackingStartDate: "2026-08-01",
  pageSize: 25,
  hubstaffPageSize: 25,
  thresholds: {
    Trainer: { expectedAhtMinutes: 15, maxAhtMinutes: 25 },
    Reviewer: { expectedAhtMinutes: 10, maxAhtMinutes: 18 },
  },
};

export const DEFAULT_HUBSTAFF_TIME: HubstaffTimeRecord = {
  Reviewer: 16200, // 4.5 hours
  Trainer: 21600,  // 6.0 hours
};

const getSeedTasks = (): TaskLogEntry[] => {
  const now = new Date();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000).toISOString();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

  const entries: TaskLogEntry[] = [];
  const roles: Role[] = ["Reviewer", "Trainer"];
  const titles = [
    "Audit Onboarding Case", "Escalation Verification", "SLA Triaging Workshop",
    "Tier 2 Quality Review", "KB SOP Documentation", "Workflow Optimization",
    "Customer Care Audit", "Ticket Escalation Analysis", "Quality Assurance Batch"
  ];

  for (let i = 1; i <= 35; i++) {
    const role = roles[i % 2];
    const subrole = SUBROLES_BY_ROLE[role][i % 2];
    entries.push({
      id: `task_${i.toString().padStart(2, "0")}`,
      userId: DEFAULT_USER.id,
      role,
      subrole,
      title: `${titles[i % titles.length]} #${100 + i}`,
      url: `https://hubstaff.com/tasks/${10400 + i}`,
      notes: i % 3 === 0 ? "Offline notes reviewed." : "Verified standard operating procedure.",
      durationSeconds: 450 + (i * 35) % 900,
      timerMode: i % 5 === 0 ? "untracked" : "hubstaff",
      createdAt: i < 5 ? minsAgo(i * 40) : daysAgo(Math.floor(i / 3)),
    });
  }
  return entries;
};

const getSeedHubstaffEvents = (): HubstaffEvent[] => {
  const now = new Date();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000).toISOString();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

  const events: HubstaffEvent[] = [];
  const projects = [
    { id: "PRJ-901", name: "Quality Assurance & Reviews" },
    { id: "PRJ-902", name: "Trainer Coaching & SOP" },
    { id: "PRJ-903", name: "Client Escalations" },
  ];

  for (let i = 1; i <= 30; i++) {
    const isStart = i % 2 !== 0;
    const prj = projects[i % projects.length];
    events.push({
      id: `evt_${i.toString().padStart(3, "0")}`,
      userId: DEFAULT_USER.id,
      eventName: isStart ? "Timer Started" : "Timer Stopped",
      eventTime: i < 6 ? minsAgo(i * 30) : daysAgo(Math.floor(i / 2)),
      projectId: prj.id,
      projectName: prj.name,
    });
  }
  return events;
};

interface LocalState {
  settings: UserSettings;
  tasks: TaskLogEntry[];
  hubstaffEvents: HubstaffEvent[];
  hubstaffTime: HubstaffTimeRecord;
}

const loadInitialState = (): LocalState => {
  if (typeof window === "undefined") {
    return {
      settings: DEFAULT_SETTINGS,
      tasks: getSeedTasks(),
      hubstaffEvents: getSeedHubstaffEvents(),
      hubstaffTime: DEFAULT_HUBSTAFF_TIME,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        tasks: Array.isArray(parsed.tasks) && parsed.tasks.length > 0 ? parsed.tasks : getSeedTasks(),
        hubstaffEvents: Array.isArray(parsed.hubstaffEvents) && parsed.hubstaffEvents.length > 0 ? parsed.hubstaffEvents : getSeedHubstaffEvents(),
        hubstaffTime: { ...DEFAULT_HUBSTAFF_TIME, ...parsed.hubstaffTime },
      };
    }
  } catch (e) {
    console.error("Error loading localStorage state:", e);
  }
  return {
    settings: DEFAULT_SETTINGS,
    tasks: getSeedTasks(),
    hubstaffEvents: getSeedHubstaffEvents(),
    hubstaffTime: DEFAULT_HUBSTAFF_TIME,
  };
};

const initialState = loadInitialState();

export const [settings, setSettings] = createStore<UserSettings>(initialState.settings);
export const [tasks, setTasks] = createStore<TaskLogEntry[]>(initialState.tasks);
export const [hubstaffEvents, setHubstaffEvents] = createStore<HubstaffEvent[]>(initialState.hubstaffEvents);
export const [hubstaffTime, setHubstaffTime] = createStore<HubstaffTimeRecord>(initialState.hubstaffTime);

export const [activeTimerSeconds, setActiveTimerSeconds] = createSignal<number>(435);

export const saveStateToLocalStorage = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings,
        tasks,
        hubstaffEvents,
        hubstaffTime,
      })
    );
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
};

export const updateUserSettings = (newSettings: Partial<UserSettings>) => {
  setSettings((prev: UserSettings) => ({ ...prev, ...newSettings }));
  saveStateToLocalStorage();
};

export const addHubstaffTime = (role: Role, additionalSeconds: number) => {
  setHubstaffTime(role, (prev: number) => prev + additionalSeconds);
  saveStateToLocalStorage();
};

export const addTaskLog = (
  entry: Omit<TaskLogEntry, "id" | "userId" | "createdAt">,
  addToHubstaffTime: boolean = true
) => {
  const newTask: TaskLogEntry = {
    ...entry,
    id: `task_${Date.now()}`,
    userId: DEFAULT_USER.id,
    createdAt: new Date().toISOString(),
  };

  if (entry.timerMode === "hubstaff" && addToHubstaffTime && entry.durationSeconds > 0) {
    setHubstaffTime(entry.role, (prev: number) => prev + entry.durationSeconds);
  }

  setTasks((prev: TaskLogEntry[]) => [newTask, ...prev]);
  saveStateToLocalStorage();
};

export const updateTaskLog = (id: string, updatedFields: Partial<TaskLogEntry>) => {
  setTasks((prev: TaskLogEntry[]) =>
    prev.map((t: TaskLogEntry) => (t.id === id ? { ...t, ...updatedFields } : t))
  );
  saveStateToLocalStorage();
};

export const deleteTaskLog = (id: string) => {
  setTasks((prev: TaskLogEntry[]) => prev.filter((t: TaskLogEntry) => t.id !== id));
  saveStateToLocalStorage();
};

export const syncHubstaffData = () => {
  const now = new Date();
  const newStartEvent: HubstaffEvent = {
    id: `evt_sync_${Date.now()}_1`,
    userId: DEFAULT_USER.id,
    eventName: "Timer Started",
    eventTime: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
    projectId: "PRJ-901",
    projectName: "Quality Assurance & Reviews",
  };
  const newStopEvent: HubstaffEvent = {
    id: `evt_sync_${Date.now()}_2`,
    userId: DEFAULT_USER.id,
    eventName: "Timer Stopped",
    eventTime: now.toISOString(),
    projectId: "PRJ-901",
    projectName: "Quality Assurance & Reviews",
  };

  setHubstaffEvents((prev: HubstaffEvent[]) => [newStartEvent, newStopEvent, ...prev]);
  addHubstaffTime("Reviewer", 1500); // add 25 mins
  saveStateToLocalStorage();
};

export const resetTaskLogsToSeed = () => {
  setTasks(getSeedTasks());
  setHubstaffEvents(getSeedHubstaffEvents());
  setHubstaffTime(DEFAULT_HUBSTAFF_TIME);
  saveStateToLocalStorage();
};

export const resetAllToDefault = () => {
  setSettings(DEFAULT_SETTINGS);
  setTasks(getSeedTasks());
  setHubstaffEvents(getSeedHubstaffEvents());
  setHubstaffTime(DEFAULT_HUBSTAFF_TIME);
  saveStateToLocalStorage();
};

// Helper utilities for AHT calculations
export const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMins}m ${secs.toString().padStart(2, "0")}s`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const formatMinutesDecimal = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return "0.0 min";
  const mins = totalSeconds / 60;
  return `${mins.toFixed(1)} min`;
};

export interface GlobalAhtBreakdown {
  taskCount: number;
  totalHubstaffSeconds: number;
  totalDirectTaskSeconds: number;
  nonTaskSeconds: number;
  globalAhtSeconds: number;
  globalAhtMinutes: number;
  directTaskAhtSeconds: number;
  directTaskAhtMinutes: number;
}

export const getFilteredTasks = (
  roleFilter?: Role | "All",
  timeframe?: "week" | "month" | "global"
): TaskLogEntry[] => {
  const now = new Date();
  
  return tasks.filter((task: TaskLogEntry) => {
    if (roleFilter && roleFilter !== "All" && task.role !== roleFilter) {
      return false;
    }
    
    if (!timeframe || timeframe === "global") return true;

    const taskDate = new Date(task.createdAt);
    
    if (timeframe === "week") {
      const startOfWeek = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      return taskDate >= startOfWeek;
    }
    
    if (timeframe === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return taskDate >= startOfMonth;
    }

    return true;
  });
};

export const calculateGlobalAHT = (
  roleFilter: Role | "All"
): GlobalAhtBreakdown => {
  const filteredTasks = getFilteredTasks(roleFilter, "global");
  const taskCount = filteredTasks.length;

  let totalHubstaffSeconds = 0;
  if (roleFilter === "All") {
    totalHubstaffSeconds = hubstaffTime.Trainer + hubstaffTime.Reviewer;
  } else {
    totalHubstaffSeconds = hubstaffTime[roleFilter];
  }

  const totalDirectTaskSeconds = filteredTasks.reduce(
    (sum: number, t: TaskLogEntry) => sum + (t.durationSeconds || 0),
    0
  );

  const nonTaskSeconds = Math.max(0, totalHubstaffSeconds - totalDirectTaskSeconds);

  if (taskCount === 0) {
    return {
      taskCount: 0,
      totalHubstaffSeconds,
      totalDirectTaskSeconds,
      nonTaskSeconds,
      globalAhtSeconds: 0,
      globalAhtMinutes: 0,
      directTaskAhtSeconds: 0,
      directTaskAhtMinutes: 0,
    };
  }

  const globalAhtSeconds = Math.round(totalHubstaffSeconds / taskCount);
  const globalAhtMinutes = globalAhtSeconds / 60;

  const directTaskAhtSeconds = Math.round(totalDirectTaskSeconds / taskCount);
  const directTaskAhtMinutes = directTaskAhtSeconds / 60;

  return {
    taskCount,
    totalHubstaffSeconds,
    totalDirectTaskSeconds,
    nonTaskSeconds,
    globalAhtSeconds,
    globalAhtMinutes,
    directTaskAhtSeconds,
    directTaskAhtMinutes,
  };
};

export const getAhtStatus = (
  avgMinutes: number,
  expectedMinutes: number,
  maxMinutes: number
): { status: "optimal" | "warning" | "exceeded" | "no_data"; label: string; colorClass: string; borderClass: string; bgClass: string } => {
  if (avgMinutes === 0) {
    return {
      status: "no_data",
      label: "No Data",
      colorClass: "text-slate-400",
      borderClass: "border-slate-700",
      bgClass: "bg-slate-800/50 text-slate-400",
    };
  }

  if (avgMinutes <= expectedMinutes) {
    return {
      status: "optimal",
      label: "Optimal AHT",
      colorClass: "text-emerald-400",
      borderClass: "border-emerald-500/40",
      bgClass: "bg-emerald-950/60 text-emerald-300",
    };
  } else if (avgMinutes <= maxMinutes) {
    return {
      status: "warning",
      label: "Near Max Limit",
      colorClass: "text-amber-400",
      borderClass: "border-amber-500/40",
      bgClass: "bg-amber-950/60 text-amber-300",
    };
  } else {
    return {
      status: "exceeded",
      label: "Exceeding Max AHT",
      colorClass: "text-rose-400",
      borderClass: "border-rose-500/40",
      bgClass: "bg-rose-950/60 text-rose-300",
    };
  }
};
