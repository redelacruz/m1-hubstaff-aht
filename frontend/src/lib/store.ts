import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";

export type Role = "Trainer" | "Reviewer";
export type Subrole = "Trainer 1" | "Trainer 2" | "Completion Reviewer" | "Quality Reviewer" | "Administrative";
export type TimerMode = "hubstaff" | "untracked";

export const SUBROLES_BY_ROLE: Record<Role, Subrole[]> = {
  Trainer: ["Trainer 1", "Trainer 2"],
  Reviewer: ["Completion Reviewer", "Quality Reviewer"],
};

export interface RoleThresholds {
  expectedAhtMinutes: number;
  maxAhtMinutes: number;
  onboardingMinutes?: number;
}

export interface UserSettings {
  defaultRole: Role;
  trackingStartDate: string; // YYYY-MM-DD
  reconciliationIntervalHours?: number; // 1, 3, 6, 12, 24, 0 (Manual)
  reconciliationLookbackDays?: number; // 1, 3, 7, 14, 30
  adminInactivityThresholdMinutes?: number; // default 10
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
  taskGroupId?: string;
  role: Role;
  subrole: Subrole;
  title: string;
  url: string;
  notes: string;
  durationSeconds: number;
  timerMode: TimerMode;
  isManualEntry?: boolean;
  createdAt: string; // ISO string
}

export interface ActiveTaskingSession {
  isTasking: boolean;
  role: Role;
  subrole: Subrole;
  title: string;
  url: string;
  notes: string;
  taskGroupId?: string;
  startTimeMs?: number;
  timerStartMs?: number;
  lastTimerStopMs?: number;
  sessionSegmentIds?: string[];
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

export interface HubstaffTimeAdjustment {
  id: string;
  userId: string;
  role: Role;
  adjustmentType: "addition" | "deletion";
  amountSeconds: number;
  reason: string;
  createdAt: string;
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
  reconciliationIntervalHours: 12,
  reconciliationLookbackDays: 7,
  adminInactivityThresholdMinutes: 10,
  pageSize: 25,
  hubstaffPageSize: 25,
  thresholds: {
    Trainer: { expectedAhtMinutes: 60, maxAhtMinutes: 70, onboardingMinutes: 120 },
    Reviewer: { expectedAhtMinutes: 45, maxAhtMinutes: 70, onboardingMinutes: 60 },
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
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          settings: parsed.settings ? { ...DEFAULT_SETTINGS, ...parsed.settings } : DEFAULT_SETTINGS,
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          hubstaffEvents: Array.isArray(parsed.hubstaffEvents) ? parsed.hubstaffEvents : [],
          hubstaffTime: parsed.hubstaffTime || DEFAULT_HUBSTAFF_TIME,
        };
      }
    } catch (e) {
      console.warn("Error loading initial state from localStorage:", e);
    }
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
export const [timeAdjustments, setTimeAdjustments] = createStore<HubstaffTimeAdjustment[]>([]);

const ACTIVE_TASKING_STORAGE_KEY = "hubstaff_active_tasking_session_v1";

const loadInitialActiveTasking = (): ActiveTaskingSession => {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const saved = localStorage.getItem(ACTIVE_TASKING_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Error loading active tasking session from localStorage:", e);
    }
  }
  return {
    isTasking: false,
    role: "Reviewer",
    subrole: "Completion Reviewer",
    title: "",
    url: "",
    notes: "",
    taskGroupId: undefined,
    sessionSegmentIds: [],
  };
};

export const [activeTasking, setActiveTasking] = createStore<ActiveTaskingSession>(loadInitialActiveTasking());

export const updateActiveTasking = (fields: Partial<ActiveTaskingSession>) => {
  const nextState: ActiveTaskingSession = { ...activeTasking, ...fields };
  setActiveTasking(fields);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(ACTIVE_TASKING_STORAGE_KEY, JSON.stringify(nextState));
    } catch (e) {
      console.warn("Error saving active tasking session to localStorage:", e);
    }
  }
};

export const clearActiveTasking = () => {
  setActiveTasking({
    isTasking: false,
    role: "Reviewer",
    subrole: "Completion Reviewer",
    title: "",
    url: "",
    notes: "",
    taskGroupId: undefined,
    startTimeMs: undefined,
    timerStartMs: undefined,
    lastTimerStopMs: undefined,
    sessionSegmentIds: [],
  });
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.removeItem(ACTIVE_TASKING_STORAGE_KEY);
    } catch (e) {}
  }
};

export const [hubstaffStatus, setHubstaffStatus] = createSignal<HubstaffAuthStatus>({
  isConnected: true,
  isLocked: true,
  user: DEFAULT_USER,
});

const LAST_END_TASK_STORAGE_KEY = "hubstaff_last_completed_task_end_ms_v1";

const loadInitialLastCompletedTaskEnd = (): number | null => {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const saved = localStorage.getItem(LAST_END_TASK_STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        return isNaN(parsed) ? null : parsed;
      }
    } catch (e) {
      console.warn("Error loading last completed task end timestamp:", e);
    }
  }
  return null;
};

export const [lastCompletedTaskEndTimeMs, setLastCompletedTaskEndTimeState] = createSignal<number | null>(
  loadInitialLastCompletedTaskEnd()
);

export const setLastCompletedTaskEndTime = (timeMs: number | null) => {
  setLastCompletedTaskEndTimeState(timeMs);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      if (timeMs === null) {
        localStorage.removeItem(LAST_END_TASK_STORAGE_KEY);
      } else {
        localStorage.setItem(LAST_END_TASK_STORAGE_KEY, timeMs.toString());
      }
    } catch (e) {
      console.warn("Error saving last completed task end timestamp:", e);
    }
  }
};

export const getUnassignedTimerAnchorMs = (activeStartMs?: number, lastEndMs?: number | null): number => {
  if (!activeStartMs) return Date.now();
  if (lastEndMs && activeStartMs && lastEndMs >= activeStartMs) {
    return lastEndMs;
  }
  return activeStartMs;
};


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
  if (newSettings.reconciliationIntervalHours !== undefined) setSettings("reconciliationIntervalHours", newSettings.reconciliationIntervalHours);
  if (newSettings.reconciliationLookbackDays !== undefined) setSettings("reconciliationLookbackDays", newSettings.reconciliationLookbackDays);
  if (newSettings.adminInactivityThresholdMinutes !== undefined) setSettings("adminInactivityThresholdMinutes", newSettings.adminInactivityThresholdMinutes);
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
      if (newSettings.thresholds.Trainer.onboardingMinutes !== undefined) {
        setSettings("thresholds", "Trainer", "onboardingMinutes", newSettings.thresholds.Trainer.onboardingMinutes);
      }
    }
    if (newSettings.thresholds.Reviewer) {
      if (newSettings.thresholds.Reviewer.expectedAhtMinutes !== undefined) {
        setSettings("thresholds", "Reviewer", "expectedAhtMinutes", newSettings.thresholds.Reviewer.expectedAhtMinutes);
      }
      if (newSettings.thresholds.Reviewer.maxAhtMinutes !== undefined) {
        setSettings("thresholds", "Reviewer", "maxAhtMinutes", newSettings.thresholds.Reviewer.maxAhtMinutes);
      }
      if (newSettings.thresholds.Reviewer.onboardingMinutes !== undefined) {
        setSettings("thresholds", "Reviewer", "onboardingMinutes", newSettings.thresholds.Reviewer.onboardingMinutes);
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

    // Re-hydrate activeTasking session
    const savedActiveTasking = localStorage.getItem(ACTIVE_TASKING_STORAGE_KEY);
    if (savedActiveTasking) {
      try {
        const parsed = JSON.parse(savedActiveTasking);
        if (parsed && typeof parsed.isTasking === "boolean") {
          setActiveTasking(parsed);
        }
      } catch (e) {
        console.warn("Error re-hydrating activeTasking from localStorage:", e);
      }
    }

    // Re-hydrate last completed task end timestamp
    const savedLastEnd = localStorage.getItem(LAST_END_TASK_STORAGE_KEY);
    if (savedLastEnd) {
      const parsed = parseInt(savedLastEnd, 10);
      if (!isNaN(parsed)) {
        setLastCompletedTaskEndTimeState(parsed);
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
      reconciliation_interval_hours: newSettings.reconciliationIntervalHours ?? settings.reconciliationIntervalHours ?? 12,
      reconciliation_lookback_days: newSettings.reconciliationLookbackDays ?? settings.reconciliationLookbackDays ?? 7,
      admin_inactivity_threshold_minutes: newSettings.adminInactivityThresholdMinutes ?? settings.adminInactivityThresholdMinutes ?? 10,
      trainer_expected_aht_minutes: newSettings.thresholds?.Trainer?.expectedAhtMinutes ?? settings.thresholds.Trainer.expectedAhtMinutes,
      trainer_max_aht_minutes: newSettings.thresholds?.Trainer?.maxAhtMinutes ?? settings.thresholds.Trainer.maxAhtMinutes,
      trainer_onboarding_minutes: newSettings.thresholds?.Trainer?.onboardingMinutes ?? settings.thresholds.Trainer.onboardingMinutes,
      reviewer_expected_aht_minutes: newSettings.thresholds?.Reviewer?.expectedAhtMinutes ?? settings.thresholds.Reviewer.expectedAhtMinutes,
      reviewer_max_aht_minutes: newSettings.thresholds?.Reviewer?.maxAhtMinutes ?? settings.thresholds.Reviewer.maxAhtMinutes,
      reviewer_onboarding_minutes: newSettings.thresholds?.Reviewer?.onboardingMinutes ?? settings.thresholds.Reviewer.onboardingMinutes,
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

export const generateTaskId = (): string => {
  const rand = Math.random().toString(36).substring(2, 7);
  return `task_${Date.now()}_${rand}`;
};

export const getAccumulatedTaskTimeByTitle = (titleStr: string): { totalSeconds: number; segmentCount: number } => {
  const matching = tasks.filter((t: TaskLogEntry) => t.title === titleStr);
  const totalSeconds = matching.reduce((sum: number, t: TaskLogEntry) => sum + (t.durationSeconds || 0), 0);
  return { totalSeconds, segmentCount: matching.length };
};

export const addHubstaffTime = (role: Role, additionalSeconds: number) => {
  setHubstaffTime(role, (prev: number) => prev + additionalSeconds);
  saveStateToLocalStorage();
};

export const addTaskLog = (
  entry: Omit<TaskLogEntry, "id" | "userId" | "createdAt"> & { id?: string },
  addToHubstaffTime: boolean = true
): TaskLogEntry => {
  const currentUserId = hubstaffStatus().user?.id || DEFAULT_USER.id;
  const assignedGroupId = entry.taskGroupId || (activeTasking.isTasking ? activeTasking.taskGroupId : undefined);
  const newTask: TaskLogEntry = {
    ...entry,
    id: entry.id || generateTaskId(),
    taskGroupId: assignedGroupId,
    userId: currentUserId,
    createdAt: new Date().toISOString(),
  };

  if (entry.timerMode === "hubstaff" && addToHubstaffTime && entry.durationSeconds > 0) {
    setHubstaffTime(entry.role, (prev: number) => prev + entry.durationSeconds);
  }

  setTasks((prev: TaskLogEntry[]) => [newTask, ...prev]);
  saveStateToLocalStorage();
  saveTaskToBackend(newTask);
  return newTask;
};

export const fetchTaskLogsFromBackend = async () => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/hubstaff/tasks`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tasks)) {
        setTasks(data.tasks);
        saveStateToLocalStorage();
      }
    }
  } catch (e) {
    console.warn("Could not fetch tasks from backend DB:", e);
  }
};

export const saveTaskToBackend = async (task: TaskLogEntry) => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/hubstaff/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        role: task.role,
        subrole: task.subrole,
        title: task.title,
        url: task.url,
        notes: task.notes,
        duration_seconds: task.durationSeconds,
        timer_mode: task.timerMode,
        is_manual_entry: task.isManualEntry ?? false,
        task_group_id: task.taskGroupId,
        created_at: task.createdAt,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.task?.taskGroupId) {
        setTasks((t) => t.id === task.id, "taskGroupId", data.task.taskGroupId);
        saveStateToLocalStorage();
      }
    }
  } catch (e) {
    console.warn("Could not save task to backend DB:", e);
  }
};

export const updateTaskInBackend = async (id: string, fields: Partial<TaskLogEntry>) => {
  try {
    await fetch(`${getApiBaseUrl()}/api/hubstaff/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: fields.role,
        subrole: fields.subrole,
        title: fields.title,
        url: fields.url,
        notes: fields.notes,
        duration_seconds: fields.durationSeconds,
        timer_mode: fields.timerMode,
        is_manual_entry: fields.isManualEntry,
        created_at: fields.createdAt,
      }),
    });
  } catch (e) {
    console.warn("Could not update task in backend DB:", e);
  }
};

export const deleteTaskFromBackend = async (id: string) => {
  try {
    await fetch(`${getApiBaseUrl()}/api/hubstaff/tasks/${id}`, {
      method: "DELETE",
    });
  } catch (e) {
    console.warn("Could not delete task from backend DB:", e);
  }
};

export const fetchTimeAdjustmentsFromBackend = async () => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/hubstaff/time-adjustments`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.adjustments)) {
        setTimeAdjustments(data.adjustments);
      }
    }
  } catch (e) {
    console.warn("Could not fetch time adjustments from backend DB:", e);
  }
};

export const addTimeAdjustment = async (data: {
  role: Role;
  adjustmentType: "addition" | "deletion";
  amountSeconds: number;
  reason: string;
  createdAt?: string;
}) => {
  const newAdj: HubstaffTimeAdjustment = {
    id: `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: hubstaffStatus().user?.id || DEFAULT_USER.id,
    role: data.role,
    adjustmentType: data.adjustmentType,
    amountSeconds: data.amountSeconds,
    reason: data.reason,
    createdAt: data.createdAt || new Date().toISOString(),
  };

  setTimeAdjustments((prev) => [newAdj, ...prev]);

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/hubstaff/time-adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: newAdj.id,
        role: newAdj.role,
        adjustment_type: newAdj.adjustmentType,
        amount_seconds: newAdj.amountSeconds,
        reason: newAdj.reason,
        created_at: newAdj.createdAt,
      }),
    });
    if (res.ok) {
      const respData = await res.json();
      if (respData && respData.adjustment) {
        setTimeAdjustments((prev) =>
          prev.map((a) => (a.id === newAdj.id ? respData.adjustment : a))
        );
      }
    }
  } catch (e) {
    console.warn("Could not save time adjustment to backend DB:", e);
  }
};

export const updateTimeAdjustment = async (
  id: string,
  fields: Partial<HubstaffTimeAdjustment>
) => {
  setTimeAdjustments((prev) =>
    prev.map((a) => (a.id === id ? { ...a, ...fields } : a))
  );

  try {
    await fetch(`${getApiBaseUrl()}/api/hubstaff/time-adjustments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: fields.role,
        adjustment_type: fields.adjustmentType,
        amount_seconds: fields.amountSeconds,
        reason: fields.reason,
        created_at: fields.createdAt,
      }),
    });
  } catch (e) {
    console.warn("Could not update time adjustment in backend DB:", e);
  }
};

export const deleteTimeAdjustment = async (id: string) => {
  setTimeAdjustments((prev) => prev.filter((a) => a.id !== id));

  try {
    await fetch(`${getApiBaseUrl()}/api/hubstaff/time-adjustments/${id}`, {
      method: "DELETE",
    });
  } catch (e) {
    console.warn("Could not delete time adjustment from backend DB:", e);
  }
};

export interface AddManualTaskParams {
  role: Role;
  subrole: Subrole;
  title: string;
  url: string;
  notes: string;
  startTime?: string;
  endTime?: string;
  taskDate?: string;
  durationMinutes?: number;
  isUntracked?: boolean;
}

export const addManualTaskLog = (params: AddManualTaskParams): { task: TaskLogEntry; message: string } => {
  const currentUserId = hubstaffStatus().user?.id || DEFAULT_USER.id;
  let durationSeconds = 0;
  let timerMode: TimerMode = "untracked";
  let createdAt = new Date().toISOString();
  let message = "";

  if (params.startTime) {
    createdAt = params.startTime;
  } else if (params.taskDate) {
    const [y, m, d] = params.taskDate.split("-").map(Number);
    if (y && m && d) {
      const dt = new Date(y, m - 1, d, 12, 0, 0);
      createdAt = dt.toISOString();
    }
  }

  if (params.isUntracked) {
    durationSeconds = 0;
    timerMode = "untracked";
    message = "Manual task added as untracked entry (Tasks +1, Hubstaff Hours +0).";
  } else if (params.startTime && params.endTime) {
    const startMs = new Date(params.startTime).getTime();
    const endMs = new Date(params.endTime).getTime();
    const windowTotalSecs = Math.max(0, Math.round((endMs - startMs) / 1000));

    // Strategy 1: Intersect window [startMs, endMs] with active Hubstaff session events
    let trackedSeconds = 0;
    const sortedEvents = [...hubstaffEvents].sort(
      (a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime()
    );

    let activeStartMs: number | null = null;
    for (const evt of sortedEvents) {
      const evtMs = new Date(evt.eventTime).getTime();
      if (evt.eventName === "Timer Started") {
        activeStartMs = evtMs;
      } else if (evt.eventName === "Timer Stopped" && activeStartMs !== null) {
        const overlapStart = Math.max(activeStartMs, startMs);
        const overlapEnd = Math.min(evtMs, endMs);
        if (overlapEnd > overlapStart) {
          trackedSeconds += Math.round((overlapEnd - overlapStart) / 1000);
        }
        activeStartMs = null;
      }
    }

    if (trackedSeconds > 0) {
      durationSeconds = trackedSeconds;
      timerMode = "hubstaff";
      message = `Auto-matched ${formatDuration(trackedSeconds)} of active Hubstaff session time within task window.`;
    } else {
      durationSeconds = windowTotalSecs;
      timerMode = "hubstaff";
      addHubstaffTime(params.role, durationSeconds);
      message = `Task logged with ${formatDuration(durationSeconds)} window duration (credited to Hubstaff hours).`;
    }
  } else if (params.durationMinutes && params.durationMinutes > 0) {
    durationSeconds = params.durationMinutes * 60;
    timerMode = "hubstaff";
    addHubstaffTime(params.role, durationSeconds);
    message = `Task logged with ${params.durationMinutes}m manual duration (credited to Hubstaff hours).`;
  } else {
    durationSeconds = 0;
    timerMode = "untracked";
    message = "Manual task added as untracked entry.";
  }

  const newTask: TaskLogEntry = {
    id: generateTaskId(),
    userId: currentUserId,
    role: params.role,
    subrole: params.subrole,
    title: params.title,
    url: params.url,
    notes: params.notes,
    durationSeconds,
    timerMode,
    isManualEntry: true,
    createdAt,
  };

  setTasks((prev: TaskLogEntry[]) => [newTask, ...prev]);
  saveStateToLocalStorage();
  saveTaskToBackend(newTask);

  return { task: newTask, message };
};

export const updateTaskLog = (id: string, updatedFields: Partial<TaskLogEntry>) => {
  setTasks((prev: TaskLogEntry[]) =>
    prev.map((t: TaskLogEntry) => (t.id === id ? { ...t, ...updatedFields } : t))
  );
  saveStateToLocalStorage();
  updateTaskInBackend(id, updatedFields);
};

export const deleteTaskLog = (id: string) => {
  setTasks((prev: TaskLogEntry[]) => prev.filter((t: TaskLogEntry) => t.id !== id));
  saveStateToLocalStorage();
  deleteTaskFromBackend(id);
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

export const syncHubstaffTrackingStatesFromBackend = async (days?: number): Promise<{
  success: boolean;
  events_count: number;
  tracking_start_date?: string;
}> => {
  try {
    const url = days
      ? `${getApiBaseUrl()}/api/hubstaff/sync-tracking-states?days=${encodeURIComponent(days)}`
      : `${getApiBaseUrl()}/api/hubstaff/sync-tracking-states`;
    const res = await fetch(url, {
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
          reconciliationIntervalHours: data.user_settings.reconciliation_interval_hours ?? 12,
          reconciliationLookbackDays: data.user_settings.reconciliation_lookback_days ?? 7,
          adminInactivityThresholdMinutes: data.user_settings.admin_inactivity_threshold_minutes ?? 10,
          thresholds: {
            Trainer: {
              expectedAhtMinutes: data.user_settings.trainer_expected_aht_minutes ?? 60,
              maxAhtMinutes: data.user_settings.trainer_max_aht_minutes ?? 70,
              onboardingMinutes: data.user_settings.trainer_onboarding_minutes ?? 120,
            },
            Reviewer: {
              expectedAhtMinutes: data.user_settings.reviewer_expected_aht_minutes ?? 45,
              maxAhtMinutes: data.user_settings.reviewer_max_aht_minutes ?? 70,
              onboardingMinutes: data.user_settings.reviewer_onboarding_minutes ?? 60,
            },
          },
        });
      }

      await fetchTaskLogsFromBackend();
      await fetchTimeAdjustmentsFromBackend();
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

export const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return "0h 0m 0s";
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMins}m ${secs.toString().padStart(2, "0")}s`;
  }
  return `${remainingMins}m ${secs.toString().padStart(2, "0")}s`;
};

export const formatTaskDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
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
  onboardingSeconds: number;
  netHubstaffSeconds: number;
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

export const parseRoleFromProjectName = (projectName?: string): Role => {
  const name = (projectName || "").toLowerCase();
  if (name.includes("trainer") || name.includes("training")) {
    return "Trainer";
  }
  if (name.includes("reviewer") || name.includes("review") || name.includes("qa")) {
    return "Reviewer";
  }
  return settings.defaultRole || "Reviewer";
};

export const getEventRole = (evt: HubstaffEvent): Role => {
  return parseRoleFromProjectName(evt.projectName);
};

export interface HubstaffBilledCalculation {
  totalSeconds: number;
  activeTimer: boolean;
  activeProjectName?: string;
  activeStartMs?: number;
}

export const calculateHubstaffBilledSecondsFromEvents = (
  roleFilter: Role | "All" = "All",
  referenceNowMs?: number
): HubstaffBilledCalculation => {
  const events = hubstaffEvents || [];
  events.length; // Ensure SolidJS store reactivity tracking
  const filteredEvents = events.filter((evt) => {
    if (roleFilter === "All") return true;
    return getEventRole(evt) === roleFilter;
  });

  // Calculate net time adjustments for role
  let netAdjustmentSeconds = 0;
  const adjs = timeAdjustments || [];
  adjs.length; // Ensure SolidJS store reactivity tracking
  for (const adj of adjs) {
    if (roleFilter === "All" || adj.role === roleFilter) {
      if (adj.adjustmentType === "addition") {
        netAdjustmentSeconds += adj.amountSeconds;
      } else if (adj.adjustmentType === "deletion") {
        netAdjustmentSeconds -= adj.amountSeconds;
      }
    }
  }

  if (filteredEvents.length === 0) {
    return { totalSeconds: Math.max(0, netAdjustmentSeconds), activeTimer: false };
  }

  // Sort events chronologically (oldest first)
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const timeA = new Date(a.eventTime).getTime();
    const timeB = new Date(b.eventTime).getTime();
    if (timeA !== timeB) return timeA - timeB;
    const aIsStop = a.eventName.toLowerCase().includes("stop");
    const bIsStop = b.eventName.toLowerCase().includes("stop");
    if (aIsStop !== bIsStop) return aIsStop ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  let totalSeconds = 0;
  let activeStartMs: number | null = null;
  let activeProjectName: string | undefined = undefined;

  for (const evt of sortedEvents) {
    const isStart = evt.eventName.toLowerCase().includes("start");
    const isStop = evt.eventName.toLowerCase().includes("stop");
    const evtMs = new Date(evt.eventTime).getTime();

    if (isStart) {
      if (activeStartMs !== null) {
        const deltaSecs = Math.max(0, Math.round((evtMs - activeStartMs) / 1000));
        totalSeconds += deltaSecs;
      }
      activeStartMs = evtMs;
      activeProjectName = evt.projectName;
    } else if (isStop) {
      if (activeStartMs !== null) {
        const deltaSecs = Math.max(0, Math.round((evtMs - activeStartMs) / 1000));
        totalSeconds += deltaSecs;
        activeStartMs = null;
        activeProjectName = undefined;
      }
    }
  }

  let activeTimer = false;
  if (activeStartMs !== null) {
    activeTimer = true;
    const currentNowMs = referenceNowMs || Date.now();
    if (currentNowMs > activeStartMs) {
      totalSeconds += Math.max(0, Math.round((currentNowMs - activeStartMs) / 1000));
    }
  }

  totalSeconds = Math.max(0, totalSeconds + netAdjustmentSeconds);

  return {
    totalSeconds,
    activeTimer,
    activeProjectName,
    activeStartMs: activeStartMs || undefined,
  };
};

export const calculateGlobalAHT = (roleFilter: Role | "All"): GlobalAhtBreakdown => {
  const filteredTasks = getFilteredTasks(roleFilter, "global");
  const nonAdminTasks = filteredTasks.filter((t) => t.title !== "Administrative Time");
  const uniqueTaskGroups = new Set(nonAdminTasks.map((t) => `${t.subrole}:::${t.title}`));
  const taskCount = uniqueTaskGroups.size;

  const billedCalc = calculateHubstaffBilledSecondsFromEvents(roleFilter);
  const totalHubstaffSeconds = billedCalc.totalSeconds;

  let onboardingMinutes = 0;
  if (roleFilter === "Trainer") {
    onboardingMinutes = settings.thresholds?.Trainer?.onboardingMinutes ?? 120;
  } else if (roleFilter === "Reviewer") {
    onboardingMinutes = settings.thresholds?.Reviewer?.onboardingMinutes ?? 60;
  } else {
    onboardingMinutes = (settings.thresholds?.Trainer?.onboardingMinutes ?? 120) + (settings.thresholds?.Reviewer?.onboardingMinutes ?? 60);
  }

  const onboardingSeconds = onboardingMinutes * 60;
  const netHubstaffSeconds = Math.max(0, totalHubstaffSeconds - onboardingSeconds);

  const totalDirectTaskSeconds = filteredTasks.reduce(
    (sum: number, t: TaskLogEntry) => sum + (t.durationSeconds || 0),
    0
  );

  const nonTaskSeconds = Math.max(0, totalHubstaffSeconds - totalDirectTaskSeconds - onboardingSeconds);

  if (taskCount === 0) {
    return {
      taskCount: 0,
      totalHubstaffSeconds,
      onboardingSeconds,
      netHubstaffSeconds,
      totalDirectTaskSeconds,
      nonTaskSeconds,
      globalAhtSeconds: 0,
      globalAhtMinutes: 0,
      directTaskAhtSeconds: 0,
      directTaskAhtMinutes: 0,
    };
  }

  const globalAhtSeconds = Math.round(netHubstaffSeconds / taskCount);
  const globalAhtMinutes = globalAhtSeconds / 60;

  const directTaskAhtSeconds = Math.round(totalDirectTaskSeconds / taskCount);
  const directTaskAhtMinutes = directTaskAhtSeconds / 60;

  return {
    taskCount,
    totalHubstaffSeconds,
    onboardingSeconds,
    netHubstaffSeconds,
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

  // Exception: If user has no projects and no prior data, default to both roles
  return ["Reviewer", "Trainer"];
};

export const getEffectiveUserRole = (): Role => {
  const available = getUserAvailableRoles();
  if (available.length === 1) {
    return available[0];
  }
  return settings.defaultRole || "Reviewer";
};

export const toLocalDateTimeLocalString = (d: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const parsePastedTimestamp = (rawInput: string, currentValue?: string): string | null => {
  if (!rawInput || !rawInput.trim()) return null;
  let str = rawInput.trim().replace(/^["'\[\(]+|["'\]\)]+$/g, '');

  // Handle Unix timestamp (numeric digits)
  if (/^\d{9,13}$/.test(str)) {
    const num = parseInt(str, 10);
    const ms = str.length === 10 ? num * 1000 : num;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return toLocalDateTimeLocalString(d);
    }
  }

  // Try standard Date parsing
  let d = new Date(str);
  if (!isNaN(d.getTime())) {
    return toLocalDateTimeLocalString(d);
  }
  
  const normalized = str.replace(/-/g, "/");
  d = new Date(normalized);
  if (!isNaN(d.getTime())) {
    return toLocalDateTimeLocalString(d);
  }

  // Handle explicit HH:MM or HH:MM:SS with optional AM/PM (e.g., "14:30", "2:30 PM", "09:15:00 am")
  const timeRegex = /^([0-1]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(am|pm)?$/i;
  const match = str.match(timeRegex);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[4]?.toLowerCase();

    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    let baseDate = new Date();
    if (currentValue) {
      const cvDate = new Date(currentValue);
      if (!isNaN(cvDate.getTime())) {
        baseDate = cvDate;
      }
    }
    baseDate.setHours(hours, minutes, 0, 0);
    return toLocalDateTimeLocalString(baseDate);
  }

  // Try time-only parsing
  const timeOnlyTest = new Date(`1970/01/01 ${str}`);
  if (!isNaN(timeOnlyTest.getTime())) {
    let baseDate = new Date();
    if (currentValue) {
      const cvDate = new Date(currentValue);
      if (!isNaN(cvDate.getTime())) {
        baseDate = cvDate;
      }
    }
    baseDate.setHours(timeOnlyTest.getHours());
    baseDate.setMinutes(timeOnlyTest.getMinutes());
    baseDate.setSeconds(0);
    return toLocalDateTimeLocalString(baseDate);
  }

  return null;
};
