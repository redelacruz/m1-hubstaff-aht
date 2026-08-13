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
  lastSyncedAt?: string;
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
  first_name?: string;
  last_name?: string;
  email: string;
  time_zone?: string;
  status?: string;
}

export interface HubstaffOrgProject {
  id: string;
  name: string;
  status: string;
}

export interface HubstaffOrg {
  id: string;
  name: string;
  status: string;
  is_micro1?: boolean;
  projects: HubstaffOrgProject[];
}

export interface WebhookStatusInfo {
  is_active: boolean;
  target_url: string;
  events: string[];
  updated_at?: string | null;
}

export interface HubstaffAuthStatus {
  isConnected: boolean;
  isLocked: boolean;
  user: UserProfile | null;
  organizations?: HubstaffOrg[];
  webhook_status?: WebhookStatusInfo;
}

const STORAGE_KEY = "hubstaff_aht_app_state_v3";

export const DEFAULT_USER: UserProfile = {
  id: "usr_alex_rivera_01",
  name: "Alex Rivera",
  first_name: "Alex",
  last_name: "Rivera",
  email: "alex.rivera@company.com",
  time_zone: "America/New_York",
  status: "active",
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
  Reviewer: 0,
  Trainer: 0,
};

const getSeedTasks = (): TaskLogEntry[] => {
  return [];
};

const getSeedHubstaffEvents = (): HubstaffEvent[] => {
  return [];
};

interface LocalState {
  settings: UserSettings;
  tasks: TaskLogEntry[];
  hubstaffEvents: HubstaffEvent[];
  hubstaffTime: HubstaffTimeRecord;
}

const loadInitialState = (): LocalState => {
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

export const [hubstaffStatus, setHubstaffStatus] = createSignal<HubstaffAuthStatus>({
  isConnected: true,
  isLocked: true,
  user: DEFAULT_USER,
});

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
  if (newSettings.defaultRole !== undefined) setSettings("defaultRole", newSettings.defaultRole);
  if (newSettings.trackingStartDate !== undefined) setSettings("trackingStartDate", newSettings.trackingStartDate);
  if (newSettings.pageSize !== undefined) setSettings("pageSize", newSettings.pageSize);
  if (newSettings.hubstaffPageSize !== undefined) setSettings("hubstaffPageSize", newSettings.hubstaffPageSize);

  if (newSettings.thresholds) {
    if (newSettings.thresholds.Trainer) {
      if (newSettings.thresholds.Trainer.expectedAhtMinutes !== undefined) {
        setSettings("thresholds", "Trainer", "expectedAhtMinutes", newSettings.thresholds.Trainer.expectedAhtMinutes);
      }
      if (newSettings.thresholds.Trainer.maxAhtMinutes !== undefined) {
        setSettings("thresholds", "Trainer", "maxAhtMinutes", newSettings.thresholds.Trainer.maxAhtMinutes);
      }
    }
    if (newSettings.thresholds.Reviewer) {
      if (newSettings.thresholds.Reviewer.expectedAhtMinutes !== undefined) {
        setSettings("thresholds", "Reviewer", "expectedAhtMinutes", newSettings.thresholds.Reviewer.expectedAhtMinutes);
      }
      if (newSettings.thresholds.Reviewer.maxAhtMinutes !== undefined) {
        setSettings("thresholds", "Reviewer", "maxAhtMinutes", newSettings.thresholds.Reviewer.maxAhtMinutes);
      }
    }
  }
  setSettings("lastSyncedAt", new Date().toISOString());
  saveStateToLocalStorage();
};

export const hydrateStoreFromLocalStorage = () => {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.settings) {
        updateUserSettings(parsed.settings);
      }
      if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        setTasks(parsed.tasks);
      }
      if (Array.isArray(parsed.hubstaffEvents) && parsed.hubstaffEvents.length > 0) {
        setHubstaffEvents(parsed.hubstaffEvents);
      }
      if (parsed.hubstaffTime) {
        setHubstaffTime(parsed.hubstaffTime);
      }
    }
  } catch (e) {
    console.error("Error hydrating store from localStorage:", e);
  }
};

export const saveUserSettingsToBackend = async (newSettings: Partial<UserSettings>) => {
  try {
    const payload = {
      default_role: newSettings.defaultRole || settings.defaultRole,
      tracking_start_date: newSettings.trackingStartDate || settings.trackingStartDate,
      trainer_expected_aht_minutes: newSettings.thresholds?.Trainer.expectedAhtMinutes ?? settings.thresholds.Trainer.expectedAhtMinutes,
      trainer_max_aht_minutes: newSettings.thresholds?.Trainer.maxAhtMinutes ?? settings.thresholds.Trainer.maxAhtMinutes,
      reviewer_expected_aht_minutes: newSettings.thresholds?.Reviewer.expectedAhtMinutes ?? settings.thresholds.Reviewer.expectedAhtMinutes,
      reviewer_max_aht_minutes: newSettings.thresholds?.Reviewer.maxAhtMinutes ?? settings.thresholds.Reviewer.maxAhtMinutes,
    };

    await fetch(`${getApiBaseUrl()}/api/hubstaff/user-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("Could not save settings to backend database:", e);
  }
};

export const addHubstaffTime = (role: Role, additionalSeconds: number) => {
  setHubstaffTime(role, (prev: number) => prev + additionalSeconds);
  saveStateToLocalStorage();
};

export const addTaskLog = (
  entry: Omit<TaskLogEntry, "id" | "userId" | "createdAt">,
  addToHubstaffTime: boolean = true
) => {
  const currentUserId = hubstaffStatus().user?.id || DEFAULT_USER.id;
  const newTask: TaskLogEntry = {
    ...entry,
    id: `task_${Date.now()}`,
    userId: currentUserId,
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
  const currentUserId = hubstaffStatus().user?.id || DEFAULT_USER.id;
  const newStartEvent: HubstaffEvent = {
    id: `evt_sync_${Date.now()}_1`,
    userId: currentUserId,
    eventName: "Timer Started",
    eventTime: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
    projectId: "PRJ-901",
    projectName: "Quality Assurance & Reviews",
  };
  const newStopEvent: HubstaffEvent = {
    id: `evt_sync_${Date.now()}_2`,
    userId: currentUserId,
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
  setTasks([]);
  setHubstaffEvents([]);
  setHubstaffTime({ Reviewer: 0, Trainer: 0 });
  saveStateToLocalStorage();
};

export const syncHubstaffTrackingStatesFromBackend = async (): Promise<{
  success: boolean;
  events_count: number;
  tracking_start_date?: string;
}> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/hubstaff/sync-tracking-states`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.events)) {
        setHubstaffEvents(data.events);
      }
      if (data.tracking_start_date) {
        updateUserSettings({ trackingStartDate: data.tracking_start_date });
      }
      saveStateToLocalStorage();
      return {
        success: true,
        events_count: data.events_count || (data.events ? data.events.length : 0),
        tracking_start_date: data.tracking_start_date,
      };
    }
  } catch (e) {
    console.error("Error syncing tracking states from backend:", e);
  }
  return { success: false, events_count: 0 };
};

export const fetchLocalHubstaffEvents = async () => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/hubstaff/events`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.events)) {
        setHubstaffEvents(data.events);
        saveStateToLocalStorage();
      }
    }
  } catch (e) {
    console.error("Failed to fetch local events:", e);
  }
};

// API Integration Helpers for Hubstaff Auth & Status
const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    return (window as any)._env_?.VITE_API_BASE_URL || "";
  }
  return "http://backend:8000";
};

export const fetchHubstaffStatusFromBackend = async () => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/hubstaff/status`);
    if (res.ok) {
      const data = await res.json();
      setHubstaffStatus({
        isConnected: data.connected,
        isLocked: data.is_locked,
        user: data.user || null,
        organizations: data.organizations || [],
        webhook_status: data.webhook_status || undefined,
      });

      if (data.user_settings) {
        updateUserSettings({
          defaultRole: data.user_settings.default_role as Role,
          trackingStartDate: data.user_settings.tracking_start_date,
          thresholds: {
            Trainer: {
              expectedAhtMinutes: data.user_settings.trainer_expected_aht_minutes,
              maxAhtMinutes: data.user_settings.trainer_max_aht_minutes,
            },
            Reviewer: {
              expectedAhtMinutes: data.user_settings.reviewer_expected_aht_minutes,
              maxAhtMinutes: data.user_settings.reviewer_max_aht_minutes,
            },
          },
        });
      }
    }
  } catch (e) {
    console.warn("Could not fetch backend Hubstaff status:", e);
  }
};

export const syncOrganizationsFromBackend = async () => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/hubstaff/sync-organizations`, {
      method: "POST",
    });
    if (res.ok) {
      await fetchHubstaffStatusFromBackend();
    }
  } catch (e) {
    console.warn("Could not sync organizations from backend:", e);
  }
};

export const submitHubstaffPatToBackend = async (patToken: string) => {
  const res = await fetch(`${getApiBaseUrl()}/api/hubstaff/pat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pat_token: patToken }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to authenticate Hubstaff Personal Access Token.");
  }

  // Clear local task logs and events for the new user profile
  setTasks([]);
  setHubstaffEvents([]);
  setHubstaffTime({ Reviewer: 0, Trainer: 0 });

  setHubstaffStatus({
    isConnected: true,
    isLocked: true,
    user: data.user,
  });

  saveStateToLocalStorage();
  return data.user;
};

export const disconnectHubstaffAccountInBackend = async () => {
  try {
    await fetch(`${getApiBaseUrl()}/api/hubstaff/disconnect`, { method: "DELETE" });
  } catch (e) {
    console.warn("Disconnect call error:", e);
  }

  setTasks([]);
  setHubstaffEvents([]);
  setHubstaffTime({ Reviewer: 0, Trainer: 0 });

  setHubstaffStatus({
    isConnected: false,
    isLocked: false,
    user: null,
  });

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

export const calculateGlobalAHT = (roleFilter: Role | "All"): GlobalAhtBreakdown => {
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
): {
  status: "optimal" | "warning" | "exceeded" | "no_data";
  label: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
} => {
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

export const getUserAvailableRoles = (): Role[] => {
  const orgs = hubstaffStatus().organizations || [];
  let hasTrainerProject = false;
  let hasReviewerProject = false;

  for (const org of orgs) {
    if (org.projects && org.projects.length > 0) {
      for (const prj of org.projects) {
        const nameLower = prj.name.toLowerCase();
        if (nameLower.includes("trainer")) hasTrainerProject = true;
        if (nameLower.includes("reviewer")) hasReviewerProject = true;
      }
    }
  }

  const hasTrainerHistory = tasks.some((t) => t.role === "Trainer");
  const hasReviewerHistory = tasks.some((t) => t.role === "Reviewer");

  const hasTrainer = hasTrainerProject || hasTrainerHistory;
  const hasReviewer = hasReviewerProject || hasReviewerHistory;

  if (hasTrainer && hasReviewer) {
    return ["Trainer", "Reviewer"];
  }
  if (hasTrainer && !hasReviewer) {
    return ["Trainer"];
  }
  if (hasReviewer && !hasTrainer) {
    return ["Reviewer"];
  }

  // Exception: If user has no projects and no prior data, default to only Trainer
  return ["Trainer"];
};

export const getEffectiveUserRole = (): Role => {
  const available = getUserAvailableRoles();
  if (available.length === 1) {
    return available[0];
  }
  return settings.defaultRole || "Reviewer";
};
