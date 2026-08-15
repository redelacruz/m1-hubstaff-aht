import { createSignal, createEffect, createMemo, onMount, For, Show, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import {
  Role,
  Subrole,
  TimerMode,
  TaskLogEntry,
  SUBROLES_BY_ROLE,
  settings,
  addTaskLog,
  updateTaskLog,
  deleteTaskLog,
  tasks,
  calculateGlobalAHT,
  getAhtStatus,
  formatDuration,
  formatTaskDuration,
  formatMinutesDecimal,
  getUserAvailableRoles,
  getEffectiveUserRole,
  calculateHubstaffBilledSecondsFromEvents,
  parseRoleFromProjectName,
  fetchLocalHubstaffEvents,
  hubstaffEvents,
  activeTasking,
  updateActiveTasking,
  clearActiveTasking,
  lastCompletedTaskEndTimeMs,
  setLastCompletedTaskEndTime,
  getUnassignedTimerAnchorMs,
} from "../lib/store";
import { EditTaskModal } from "../components/EditTaskModal";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { TaskGroupModal } from "../components/TaskGroupModal";

export default function Home() {
  // Smooth 1-second reactive clock ticker
  const [nowMs, setNowMs] = createSignal<number>(Date.now());

  // Poll local Hubstaff events every 3 seconds for real-time timer updates & tick clock every 1 second
  onMount(() => {
    const ticker = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    fetchLocalHubstaffEvents();
    const poller = setInterval(() => {
      fetchLocalHubstaffEvents();
    }, 3000);

    onCleanup(() => {
      clearInterval(ticker);
      clearInterval(poller);
    });
  });

  // Form signals
  const [selectedRole, setSelectedRole] = createSignal<Role>(getEffectiveUserRole());
  const [selectedSubrole, setSelectedSubrole] = createSignal<Subrole>(
    SUBROLES_BY_ROLE[getEffectiveUserRole()][0]
  );
  const [taskTitle, setTaskTitle] = createSignal<string>("");
  const [taskUrl, setTaskUrl] = createSignal<string>("");
  const [taskNotes, setTaskNotes] = createSignal<string>("");

  // Lock overrides for double-clicking partially locked fields
  const [unlockedFields, setUnlockedFields] = createSignal({
    role: false,
    subrole: false,
    title: false,
    url: false,
  });

  const activeBilledInfo = createMemo(() => calculateHubstaffBilledSecondsFromEvents("All", nowMs()));

  // Lock computations
  const isRoleTimerLocked = createMemo(() => {
    const info = activeBilledInfo();
    return Boolean(info.activeTimer && info.activeProjectName);
  });

  const isRoleLocked = createMemo(() => {
    if (isRoleTimerLocked()) return true;
    return activeTasking.isTasking && !unlockedFields().role;
  });

  const isSubroleLocked = createMemo(() => {
    return activeTasking.isTasking && !unlockedFields().subrole;
  });

  const isTitleLocked = createMemo(() => {
    return activeTasking.isTasking && !unlockedFields().title;
  });

  const isUrlLocked = createMemo(() => {
    return activeTasking.isTasking && !unlockedFields().url;
  });

  // Imperative DOM element refs to ensure bulletproof locking on initial hydration & refresh
  let roleSelectRef: HTMLSelectElement | undefined;
  let subroleSelectRef: HTMLSelectElement | undefined;
  let titleInputRef: HTMLInputElement | undefined;
  let urlInputRef: HTMLInputElement | undefined;

  createEffect(() => {
    const locked = isRoleLocked();
    if (roleSelectRef) {
      roleSelectRef.disabled = locked;
    }
  });

  createEffect(() => {
    const locked = isSubroleLocked();
    if (subroleSelectRef) {
      subroleSelectRef.disabled = locked;
    }
  });

  createEffect(() => {
    const locked = isTitleLocked();
    if (titleInputRef) {
      titleInputRef.readOnly = locked;
    }
  });

  createEffect(() => {
    const locked = isUrlLocked();
    if (urlInputRef) {
      urlInputRef.readOnly = locked;
    }
  });

  // Keep form inputs synced with activeTasking when active
  createEffect(() => {
    if (activeTasking.isTasking) {
      if (activeTasking.role) setSelectedRole(activeTasking.role);
      if (activeTasking.subrole) setSelectedSubrole(activeTasking.subrole);
      if (activeTasking.title) setTaskTitle(activeTasking.title);
      if (activeTasking.url !== undefined) setTaskUrl(activeTasking.url);
      if (activeTasking.notes !== undefined) setTaskNotes(activeTasking.notes);
    }
  });

  // Lock role to timer project if Hubstaff timer is running
  createEffect(() => {
    const info = activeBilledInfo();
    if (info.activeTimer && info.activeProjectName) {
      setSelectedRole(parseRoleFromProjectName(info.activeProjectName));
    }
  });

  // Automatically update subrole options when role changes
  createEffect(() => {
    const role = selectedRole();
    const availableSubroles = SUBROLES_BY_ROLE[role];
    if (!availableSubroles.includes(selectedSubrole())) {
      setSelectedSubrole(availableSubroles[0]);
    }
  });

  // Keep default role synced with settings when not actively tasking and timer not running
  createEffect(() => {
    const defRole = settings.defaultRole;
    const info = activeBilledInfo();
    if (!activeTasking.isTasking && (!info.activeTimer || !info.activeProjectName)) {
      if (defRole && selectedRole() !== defRole) {
        setSelectedRole(defRole);
      }
    }
  });

  // Filters & Notifications
  const [logFilterRole, setLogFilterRole] = createSignal<Role | "All">("All");
  const [searchQuery, setSearchQuery] = createSignal<string>("");
  const [showNotification, setShowNotification] = createSignal<boolean>(false);
  const [notificationMsg, setNotificationMsg] = createSignal<string>("");

  // Modals
  const [editingTask, setEditingTask] = createSignal<TaskLogEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = createSignal<boolean>(false);

  const [isCancelModalOpen, setIsCancelModalOpen] = createSignal<boolean>(false);

  const [isGroupModalOpen, setIsGroupModalOpen] = createSignal<boolean>(false);
  const [activeGroupData, setActiveGroupData] = createSignal<{
    subrole: string;
    title: string;
    tasks: TaskLogEntry[];
  }>({ subrole: "", title: "", tasks: [] });

  // Monitor Hubstaff Timer transitions during Active Tasking mode
  let previousTimerState = false;

  createEffect(() => {
    const isTimerRunning = activeBilledInfo().activeTimer;
    const info = activeBilledInfo();

    // Timer just STARTED
    if (isTimerRunning && !previousTimerState) {
      if (activeTasking.isTasking) {
        if (!activeTasking.timerStartMs) {
          const startMs = info.activeStartMs || Date.now();
          updateActiveTasking({ timerStartMs: startMs });
        }
      }
    }

    // Timer just STOPPED while in Active Tasking mode -> Commit segment to DB
    if (!isTimerRunning && previousTimerState) {
      if (activeTasking.isTasking && activeTasking.timerStartMs) {
        // Extract latest Hubstaff stop event timestamp to calibrate exact duration
        const eventsList = hubstaffEvents || [];
        const recentEvents = [...eventsList].sort(
          (a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime()
        );
        const latestStopEvt = recentEvents.find((e) => e.eventName.toLowerCase().includes("stop"));
        const stopEventMs = latestStopEvt ? new Date(latestStopEvt.eventTime).getTime() : Date.now();
        const effectiveStopMs = stopEventMs >= activeTasking.timerStartMs ? stopEventMs : Date.now();

        const segSecs = Math.max(1, Math.round((effectiveStopMs - activeTasking.timerStartMs) / 1000));
        
        // Check if there was a delayed timer start (> threshold)
        let segNotes = activeTasking.notes || "";
        const adminThresholdMs = (settings.adminInactivityThresholdMinutes ?? 10) * 60 * 1000;
        if (activeTasking.startTimeMs && (activeTasking.timerStartMs - activeTasking.startTimeMs) > adminThresholdMs) {
          const delaySecs = Math.round((activeTasking.timerStartMs - activeTasking.startTimeMs) / 1000);
          segNotes += `\n[Note: ${formatDuration(delaySecs)} were spent working on the task before the Hubstaff timer was started.]`;
        }

        const newLog = addTaskLog({
          role: activeTasking.role,
          subrole: activeTasking.subrole,
          title: activeTasking.title,
          url: activeTasking.url,
          notes: segNotes.trim(),
          durationSeconds: segSecs,
          timerMode: "hubstaff",
        });

        const updatedSegments = [...(activeTasking.sessionSegmentIds || []), newLog.id];
        updateActiveTasking({
          timerStartMs: undefined,
          lastTimerStopMs: effectiveStopMs,
          sessionSegmentIds: updatedSegments,
        });

        setNotificationMsg(`Hubstaff timer stopped. Segment (${formatTaskDuration(segSecs)}) committed to task log.`);
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3500);
      }
    }

    previousTimerState = isTimerRunning;
  });

  // Calculate 6 Active Task Timer Visual States (Smoothly ticks every 1 second)
  const timerState = createMemo(() => {
    const isTasking = activeTasking.isTasking;
    const isTimerRunning = activeBilledInfo().activeTimer;
    const info = activeBilledInfo();
    const timerStartMs = info.activeStartMs;
    const currentClockMs = nowMs();

    const currentSubrole = isTasking ? activeTasking.subrole : selectedSubrole();
    const currentTitle = isTasking ? activeTasking.title : taskTitle();

    // Group logs for cumulative time calculation
    const groupLogs = tasks.filter(
      (t) => t.subrole === currentSubrole && t.title === currentTitle && t.title !== "Administrative Time"
    );
    const priorGroupSeconds = groupLogs.reduce((sum, t) => sum + (t.durationSeconds || 0), 0);

    // State 1: Idle (No Hubstaff Timer & Not Active Tasking)
    if (!isTasking && !isTimerRunning) {
      return {
        digitsColor: "text-white",
        dotColor: "bg-white",
        dotAnimate: false,
        timerDisplay: "00:00",
        headerText: "Idle (No Hubstaff Timer)",
        subtextText: "Waiting for task or Hubstaff timer to start",
        headerColor: "text-white",
      };
    }

    // State 2: Actively Tasking (Hubstaff Timer Running)
    if (isTasking && isTimerRunning) {
      const currentSegmentSecs = activeTasking.timerStartMs
        ? Math.max(0, Math.round((currentClockMs - activeTasking.timerStartMs) / 1000))
        : (timerStartMs ? Math.max(0, Math.round((currentClockMs - timerStartMs) / 1000)) : 0);
      const totalGroupSecs = priorGroupSeconds + currentSegmentSecs;
      return {
        digitsColor: "text-emerald-400",
        dotColor: "bg-emerald-400",
        dotAnimate: "animate-pulse",
        timerDisplay: formatTaskDuration(totalGroupSecs),
        headerText: "Actively Tasking (Hubstaff Timer Running)",
        subtextText: "Tracking Hubstaff timer and submissions as normal",
        headerColor: "text-emerald-400",
      };
    }

    // State 3 & 4: Hubstaff Timer Running but NOT in Active Tasking Mode
    if (!isTasking && isTimerRunning) {
      const anchorMs = getUnassignedTimerAnchorMs(timerStartMs, lastCompletedTaskEndTimeMs());
      const elapsedSecs = Math.max(0, Math.round((currentClockMs - anchorMs) / 1000));
      const adminThresholdSecs = (settings.adminInactivityThresholdMinutes ?? 10) * 60;

      if (elapsedSecs < adminThresholdSecs) {
        // State 3: Pre-Administrative Warning
        return {
          digitsColor: "text-amber-500",
          dotColor: "bg-amber-500",
          dotAnimate: "animate-pulse",
          timerDisplay: formatTaskDuration(elapsedSecs),
          headerText: "Not Logging Task (Hubstaff Timer Running)",
          subtextText: "Warning: Hubstaff timer is running and affecting AHT",
          headerColor: "text-amber-400",
        };
      } else {
        // State 4: Administrative Mode
        return {
          digitsColor: "text-rose-500",
          dotColor: "bg-rose-500",
          dotAnimate: "animate-ping",
          timerDisplay: formatTaskDuration(elapsedSecs),
          headerText: "Administrative Time (Hubstaff Timer Running)",
          subtextText: "Warning: Hubstaff timer is running and affecting AHT",
          headerColor: "text-rose-400",
        };
      }
    }

    // State 5: Partially Tracked Task (Timer stopped or task worked on before)
    if (isTasking && !isTimerRunning && priorGroupSeconds > 0) {
      return {
        digitsColor: "text-sky-400",
        dotColor: "bg-sky-400",
        dotAnimate: false,
        timerDisplay: formatTaskDuration(priorGroupSeconds),
        headerText: "Partially Tracked Task (Partial Hubstaff Timer)",
        subtextText: "Note: Only the time displayed above will affect AHT",
        headerColor: "text-sky-400",
      };
    }

    // State 6: Untracked Task Mode (In Active Tasking mode, timer not running, 0 prior tracked seconds)
    return {
      digitsColor: "text-yellow-400",
      dotColor: "bg-yellow-400",
      dotAnimate: false,
      timerDisplay: "00:00",
      headerText: "Untracked Task (No Hubstaff Timer)",
      subtextText: "Submissions increment task count and will decrease AHT",
      headerColor: "text-yellow-400",
    };
  });

  // Trigger Start Task Log
  const handleStartTaskLog = (e: Event) => {
    e.preventDefault();
    if (!taskTitle().trim()) {
      alert("Please enter a task title to start logging.");
      return;
    }

    const nowTimestamp = Date.now();
    const info = activeBilledInfo();
    const adminThresholdSecs = (settings.adminInactivityThresholdMinutes ?? 10) * 60;

    let initialTimerStartMs: number | undefined = undefined;

    if (info.activeTimer && info.activeStartMs) {
      const anchorMs = getUnassignedTimerAnchorMs(info.activeStartMs, lastCompletedTaskEndTimeMs());
      const elapsedSecs = Math.max(0, Math.round((nowTimestamp - anchorMs) / 1000));

      if (elapsedSecs > adminThresholdSecs) {
        // Entire unassigned pre-task duration is logged as Administrative Time
        addTaskLog({
          role: selectedRole(),
          subrole: "Administrative",
          title: "Administrative Time",
          url: "",
          notes: "Pre-tasking excess Hubstaff timer duration logged as administrative time.",
          durationSeconds: elapsedSecs,
          timerMode: "hubstaff",
        });
        initialTimerStartMs = nowTimestamp;
      } else {
        // Gap or initial timer start is included in task duration
        initialTimerStartMs = anchorMs;
      }
    }

    // Reset lastCompletedTaskEndTimeMs so the current task uses its own session
    setLastCompletedTaskEndTime(null);

    const existingTask = tasks.find(
      (t) => t.subrole === selectedSubrole() && t.title === taskTitle().trim() && t.title !== "Administrative Time"
    );
    const sessionGroupId = existingTask?.taskGroupId || `tg_${nowTimestamp}_${Math.random().toString(36).substring(2, 7)}`;

    updateActiveTasking({
      isTasking: true,
      role: selectedRole(),
      subrole: selectedSubrole(),
      title: taskTitle().trim(),
      url: taskUrl().trim(),
      notes: taskNotes().trim(),
      taskGroupId: sessionGroupId,
      startTimeMs: nowTimestamp,
      timerStartMs: initialTimerStartMs,
      lastTimerStopMs: undefined,
      sessionSegmentIds: [],
    });

    setUnlockedFields({ role: false, subrole: false, title: false, url: false });

    setNotificationMsg(`Active Tasking Started: '${taskTitle().trim()}'`);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  // Trigger End Task Log
  const handleEndTaskLog = () => {
    if (!activeTasking.isTasking) return;

    const info = activeBilledInfo();
    const nowTimestamp = Date.now();
    const adminThresholdMs = (settings.adminInactivityThresholdMinutes ?? 10) * 60 * 1000;

    // If timer is currently running, log final segment
    if (info.activeTimer && activeTasking.timerStartMs) {
      const segSecs = Math.max(1, Math.round((nowTimestamp - activeTasking.timerStartMs) / 1000));
      
      let finalNotes = taskNotes().trim();
      if (activeTasking.startTimeMs && (activeTasking.timerStartMs - activeTasking.startTimeMs) > adminThresholdMs) {
        const delaySecs = Math.round((activeTasking.timerStartMs - activeTasking.startTimeMs) / 1000);
        finalNotes += `\n[Note: ${formatDuration(delaySecs)} were spent working on the task before the Hubstaff timer was started.]`;
      }

      addTaskLog({
        role: activeTasking.role,
        subrole: activeTasking.subrole,
        title: activeTasking.title,
        url: activeTasking.url,
        notes: finalNotes.trim(),
        durationSeconds: segSecs,
        timerMode: "hubstaff",
      });
    } else if (activeTasking.lastTimerStopMs && (nowTimestamp - activeTasking.lastTimerStopMs) > adminThresholdMs) {
      // Timer stopped > threshold ago before clicking End Task Log -> Append note
      const stopDelaySecs = Math.round((nowTimestamp - activeTasking.lastTimerStopMs) / 1000);
      const appendNote = `\n[Note: ${formatDuration(stopDelaySecs)} were spent working on the task after the Hubstaff timer was stopped.]`;

      // Update recent session log entries with appended note
      const sessionIds = activeTasking.sessionSegmentIds || [];
      if (sessionIds.length > 0) {
        const lastId = sessionIds[sessionIds.length - 1];
        const existingLog = tasks.find((t) => t.id === lastId);
        if (existingLog) {
          updateTaskLog(lastId, { notes: (existingLog.notes + appendNote).trim() });
        }
      }
    } else if ((!activeTasking.sessionSegmentIds || activeTasking.sessionSegmentIds.length === 0) && !info.activeTimer) {
      // Hubstaff timer NEVER ran -> Log as Untracked Task
      addTaskLog({
        role: activeTasking.role,
        subrole: activeTasking.subrole,
        title: activeTasking.title,
        url: activeTasking.url,
        notes: taskNotes().trim(),
        durationSeconds: 0,
        timerMode: "untracked",
      });
    }

    setLastCompletedTaskEndTime(nowTimestamp);
    const endedTitle = activeTasking.title;
    clearActiveTasking();

    setTaskTitle("");
    setTaskUrl("");
    setTaskNotes("");

    setNotificationMsg(`Task Log Ended: '${endedTitle}' committed to history.`);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3500);
  };

  // Trigger Cancel Active Tasking
  const confirmCancelTasking = () => {
    const sessionIds = activeTasking.sessionSegmentIds || [];
    
    // Convert all session segments into Administrative Time
    for (const id of sessionIds) {
      updateTaskLog(id, {
        title: "Administrative Time",
        subrole: "Administrative",
        url: "",
        notes: "Tasking cancelled by user. Duration retained as Administrative Time.",
      });
    }

    // Set lastCompletedTaskEndTime to null so unassigned running timer naturally measures from activeStartMs
    setLastCompletedTaskEndTime(null);

    clearActiveTasking();
    setTaskTitle("");
    setTaskUrl("");
    setTaskNotes("");
    setIsCancelModalOpen(false);

    setNotificationMsg("Active task session cancelled. Time logged as Administrative Time.");
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3500);
  };

  const openGroupModal = (subrole: string, title: string) => {
    const groupTasks = tasks.filter((t) => t.subrole === subrole && t.title === title && t.title !== "Administrative Time");
    setActiveGroupData({ subrole, title, tasks: groupTasks });
    setIsGroupModalOpen(true);
  };

  const openEditModal = (task: TaskLogEntry) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedTask = (id: string, updatedFields: Partial<TaskLogEntry>) => {
    updateTaskLog(id, updatedFields);
    setNotificationMsg("Task details updated successfully.");
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const currentGlobalAHT = () => calculateGlobalAHT(selectedRole());
  const currentRoleThresholds = () => settings.thresholds[selectedRole()];

  const currentAHTStatus = () => {
    const aht = currentGlobalAHT();
    const thresholds = currentRoleThresholds();
    return getAhtStatus(aht.globalAhtMinutes, thresholds.expectedAhtMinutes, thresholds.maxAhtMinutes);
  };

  // Truncated Task Log preview (Max 10 items)
  const previewTasks = () => {
    const roleFilter = logFilterRole();
    const query = searchQuery().toLowerCase().trim();

    const filtered = tasks.filter((t) => {
      if (roleFilter !== "All" && t.role !== roleFilter) return false;
      if (query) {
        const titleMatch = t.title.toLowerCase().includes(query);
        const notesMatch = t.notes.toLowerCase().includes(query);
        const subroleMatch = t.subrole.toLowerCase().includes(query);
        return titleMatch || notesMatch || subroleMatch;
      }
      return true;
    });

    return filtered.slice(0, 10);
  };

  return (
    <div class="space-y-8">
      {/* Toast Notification */}
      <Show when={showNotification()}>
        <Portal>
          <div class="fixed bottom-6 right-6 z-50 bg-slate-900 border border-sky-500/60 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-toast pointer-events-none transform-gpu">
            <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="text-sm font-medium">{notificationMsg()}</span>
          </div>
        </Portal>
      </Show>

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        isOpen={isCancelModalOpen()}
        title="Cancel Active Tasking Session?"
        warningText="Session time will be converted to Administrative Time"
        description={`Are you sure you want to cancel tasking for '${activeTasking.title}'? Any Hubstaff timer segments tracked during this session will be converted to Administrative Time and will NOT count as a completed task.`}
        confirmText="Yes, Cancel Task Session"
        isDestructive={true}
        onCancel={() => setIsCancelModalOpen(false)}
        onConfirm={confirmCancelTasking}
      />

      {/* Task Group Breakdown Modal */}
      <TaskGroupModal
        isOpen={isGroupModalOpen()}
        onClose={() => setIsGroupModalOpen(false)}
        subrole={activeGroupData().subrole}
        title={activeGroupData().title}
        groupTasks={activeGroupData().tasks}
        onEditTask={(task) => {
          setIsGroupModalOpen(false);
          setEditingTask(task);
          setIsEditModalOpen(true);
        }}
        onDeleteTask={(id) => {
          deleteTaskLog(id);
          const updated = tasks.filter((t) => t.subrole === activeGroupData().subrole && t.title === activeGroupData().title && t.title !== "Administrative Time");
          if (updated.length === 0) setIsGroupModalOpen(false);
        }}
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        task={editingTask()}
        isOpen={isEditModalOpen()}
        onClose={() => setIsEditModalOpen(false)}
        onSave={(id, updated) => {
          updateTaskLog(id, updated);
          setNotificationMsg("Task updated.");
          setShowNotification(true);
          setTimeout(() => setShowNotification(false), 3000);
        }}
      />

      {/* Top Banner Context Note */}
      <div class="bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-sky-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div class="absolute top-0 right-0 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Real-Time Tasking Dashboard</span>
            </div>
            <h1 class="text-2xl font-extrabold text-white tracking-tight">Active Handling Time Tracker</h1>
            <p class="text-slate-400 text-sm mt-1 max-w-2xl">
              Track task logs, manage active tasking sessions, and monitor real-time AHT performance.
            </p>
          </div>
          <div class="flex items-center space-x-3 bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl self-start md:self-auto text-xs">
            <span class="text-slate-400">Selected Role:</span>
            <span class="font-bold text-sky-300">{selectedRole()}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Input Form + Global AHT Widget */}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Task Input Form */}
        <div class="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
              <h2 class="text-lg font-bold text-slate-100 flex items-center space-x-2">
                <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Task Entry & Active Tasking Configuration</span>
              </h2>
              <Show when={activeTasking.isTasking}>
                <span class="px-2.5 py-1 text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg flex items-center space-x-1.5 animate-pulse">
                  <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Active Tasking Session</span>
                </span>
              </Show>
            </div>

            <form onSubmit={handleStartTaskLog} class="space-y-5">
              {/* Role & Subrole Row */}
              <div class={getUserAvailableRoles().length > 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-5" : "grid grid-cols-1 gap-5"}>
                <Show when={getUserAvailableRoles().length > 1}>
                  <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex justify-between items-center">
                      <span>Role <span class="text-rose-400">*</span></span>
                      <Show when={isRoleTimerLocked() || activeTasking.isTasking}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isRoleTimerLocked()) {
                              setNotificationMsg(`Role is locked to running Hubstaff timer project '${activeBilledInfo().activeProjectName}'`);
                              setShowNotification(true);
                              setTimeout(() => setShowNotification(false), 3000);
                              return;
                            }
                            if (activeTasking.isTasking) {
                              setUnlockedFields((prev) => ({ ...prev, role: !prev.role }));
                            }
                          }}
                          class="text-[9px] bg-slate-950 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-700 hover:border-sky-500 transition-colors cursor-pointer"
                          title={isRoleTimerLocked() ? "Role is locked to running Hubstaff timer project" : "Click or double-click to unlock"}
                        >
                          {isRoleTimerLocked()
                            ? "🔒 Locked (Timer project)"
                            : (unlockedFields().role ? "🔓 Unlocked" : "🔒 Locked (Click to edit)")}
                        </button>
                      </Show>
                    </label>
                    <div
                      onDblClick={() => {
                        if (isRoleTimerLocked()) {
                          setNotificationMsg(`Role is locked to running Hubstaff timer project '${activeBilledInfo().activeProjectName}'`);
                          setShowNotification(true);
                          setTimeout(() => setShowNotification(false), 3000);
                          return;
                        }
                        if (activeTasking.isTasking) {
                          setUnlockedFields((prev) => ({ ...prev, role: !prev.role }));
                        }
                      }}
                      class="relative"
                    >
                      <select
                        ref={roleSelectRef}
                        value={selectedRole()}
                        disabled={isRoleLocked()}
                        onChange={(e) => {
                          const r = e.currentTarget.value as Role;
                          setSelectedRole(r);
                          if (activeTasking.isTasking) updateActiveTasking({ role: r });
                        }}
                        class={`w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none cursor-pointer ${
                          isRoleLocked() ? "opacity-75 cursor-not-allowed" : ""
                        }`}
                      >
                        <For each={getUserAvailableRoles()}>
                          {(role) => <option value={role}>{role}</option>}
                        </For>
                      </select>
                      <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Show>

                <div>
                  <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex justify-between items-center">
                    <span>Subrole <span class="text-rose-400">*</span></span>
                    <Show when={activeTasking.isTasking}>
                      <button
                        type="button"
                        onClick={() => setUnlockedFields((prev) => ({ ...prev, subrole: !prev.subrole }))}
                        class="text-[9px] bg-slate-950 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-700 hover:border-sky-500 transition-colors cursor-pointer"
                        title="Click or double-click to unlock"
                      >
                        {unlockedFields().subrole ? "🔓 Unlocked" : "🔒 Locked (Click to edit)"}
                      </button>
                    </Show>
                  </label>
                  <div
                    onDblClick={() => {
                      if (activeTasking.isTasking) setUnlockedFields((prev) => ({ ...prev, subrole: !prev.subrole }));
                    }}
                    class="relative"
                  >
                    <select
                      ref={subroleSelectRef}
                      value={selectedSubrole()}
                      disabled={isSubroleLocked()}
                      onChange={(e) => {
                        const sr = e.currentTarget.value as Subrole;
                        setSelectedSubrole(sr);
                        if (activeTasking.isTasking) updateActiveTasking({ subrole: sr });
                      }}
                      class={`w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none cursor-pointer ${
                        isSubroleLocked() ? "opacity-75 cursor-not-allowed" : ""
                      }`}
                    >
                      <For each={SUBROLES_BY_ROLE[selectedRole()]}>
                        {(subrole) => <option value={subrole}>{subrole}</option>}
                      </For>
                    </select>
                    <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Task Title & URL Row */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex justify-between items-center">
                    <span>Task Title <span class="text-rose-400">*</span></span>
                    <Show when={activeTasking.isTasking}>
                      <button
                        type="button"
                        onClick={() => setUnlockedFields((prev) => ({ ...prev, title: !prev.title }))}
                        class="text-[9px] bg-slate-950 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-700 hover:border-sky-500 transition-colors cursor-pointer"
                        title="Click or double-click to unlock"
                      >
                        {unlockedFields().title ? "🔓 Unlocked" : "🔒 Locked (Click to edit)"}
                      </button>
                    </Show>
                  </label>
                  <input
                    ref={titleInputRef}
                    type="text"
                    required
                    readOnly={isTitleLocked() ? true : undefined}
                    onDblClick={() => {
                      if (activeTasking.isTasking) setUnlockedFields((prev) => ({ ...prev, title: !prev.title }));
                    }}
                    placeholder="e.g. gnLokxh8Gsk or 4081768869215654175"
                    value={taskTitle()}
                    onInput={(e) => {
                      const val = e.currentTarget.value;
                      setTaskTitle(val);
                      if (activeTasking.isTasking) updateActiveTasking({ title: val });
                    }}
                    class={`w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isTitleLocked() ? 'cursor-not-allowed opacity-75' : ''
                    }`}
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex justify-between items-center">
                    <span>Task URL</span>
                    <Show when={activeTasking.isTasking}>
                      <button
                        type="button"
                        onClick={() => setUnlockedFields((prev) => ({ ...prev, url: !prev.url }))}
                        class="text-[9px] bg-slate-950 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-700 hover:border-sky-500 transition-colors cursor-pointer"
                        title="Click or double-click to unlock"
                      >
                        {unlockedFields().url ? "🔓 Unlocked" : "🔒 Locked (Click to edit)"}
                      </button>
                    </Show>
                  </label>
                  <input
                    ref={urlInputRef}
                    type="url"
                    readOnly={isUrlLocked() ? true : undefined}
                    onDblClick={() => {
                      if (activeTasking.isTasking) setUnlockedFields((prev) => ({ ...prev, url: !prev.url }));
                    }}
                    placeholder="https://feather.openai.com/tasks/..."
                    value={taskUrl()}
                    onInput={(e) => {
                      const val = e.currentTarget.value;
                      setTaskUrl(val);
                      if (activeTasking.isTasking) updateActiveTasking({ url: val });
                    }}
                    class={`w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isUrlLocked() ? 'cursor-not-allowed opacity-75' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Notes (Always Editable) */}
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Task Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Add optional task details or findings..."
                  value={taskNotes()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    setTaskNotes(val);
                    if (activeTasking.isTasking) updateActiveTasking({ notes: val });
                  }}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                ></textarea>
              </div>

              {/* Action Bar */}
              <div class="pt-4 flex flex-col sm:flex-row sm:items-center justify-end gap-4 border-t border-slate-800">
                <Show
                  when={activeTasking.isTasking}
                  fallback={
                    <button
                      type="submit"
                      class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-sky-950 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Start Task Log</span>
                    </button>
                  }
                >
                  <div class="flex items-center space-x-3 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setIsCancelModalOpen(true)}
                      class="px-4 py-3 bg-slate-950 border border-rose-900/60 hover:bg-rose-950/40 text-rose-400 font-semibold rounded-xl text-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Cancel</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEndTaskLog}
                      class="flex-1 sm:flex-initial px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-950 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>End Task Log</span>
                    </button>
                  </div>
                </Show>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Timer Display & Current Role Global AHT Widget */}
        <div class="lg:col-span-4 space-y-6">

          {/* Active Task Timer Card (6 Visual States) */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <span
                  class={`w-2.5 h-2.5 rounded-full ${timerState().dotColor} ${
                    timerState().dotAnimate || ""
                  }`}
                ></span>
                <span>Active Task Timer</span>
              </span>
              <span class="text-[11px] text-sky-400 bg-sky-950 border border-sky-900 px-2 py-0.5 rounded font-mono">
                Hubstaff Stream
              </span>
            </div>

            <div class="text-center py-4 bg-slate-950 rounded-xl border border-slate-800 my-2">
              <div
                class={`text-4xl font-mono font-extrabold tracking-wider ${timerState().digitsColor}`}
              >
                {timerState().timerDisplay}
              </div>
              <div class="text-xs mt-2 space-y-0.5">
                <span class={`block font-bold ${timerState().headerColor}`}>
                  {timerState().headerText}
                </span>
                <span class="block text-slate-400">
                  {timerState().subtextText}
                </span>
              </div>
            </div>
          </div>

          {/* Current Global AHT Status Card */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Global AHT ({selectedRole()})
              </h3>
              <span class={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${currentAHTStatus().bgClass} ${currentAHTStatus().borderClass}`}>
                {currentAHTStatus().label}
              </span>
            </div>

            <div class="flex items-baseline space-x-2 my-2">
              <span class="text-3xl font-extrabold text-white font-mono">
                {formatMinutesDecimal(currentGlobalAHT().globalAhtSeconds)}
              </span>
              <span class="text-xs text-slate-400">
                ({formatDuration(currentGlobalAHT().globalAhtSeconds)})
              </span>
            </div>

            <div class="text-xs text-slate-400 space-y-1 mb-4">
              <div class="flex justify-between">
                <span>Hubstaff Tracked Hours:</span>
                <span class="font-mono font-bold text-slate-200">{formatDuration(currentGlobalAHT().totalHubstaffSeconds)}</span>
              </div>
              <div class="flex justify-between">
                <span>Submitted Tasks:</span>
                <span class="font-mono font-bold text-slate-200">{currentGlobalAHT().taskCount} tasks</span>
              </div>
            </div>

            {/* Threshold Benchmarks */}
            <div class="space-y-2 pt-4 border-t border-slate-800 text-xs mt-4">
              <div class="flex justify-between items-center text-slate-300">
                <span>Expected Target:</span>
                <span class="font-mono font-semibold text-emerald-400">
                  {currentRoleThresholds().expectedAhtMinutes} min
                </span>
              </div>

              <div class="flex justify-between items-center text-slate-300">
                <span>Max Threshold:</span>
                <span class="font-mono font-semibold text-rose-400">
                  {currentRoleThresholds().maxAhtMinutes} min
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task Log Table Preview Section (Truncated at 10 items) */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div class="flex items-center space-x-3">
              <h2 class="text-lg font-bold text-white flex items-center space-x-2">
                <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span>Recent Task Log</span>
              </h2>
              <span class="px-2 py-0.5 text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-400 rounded-md">
                Preview (Max 10)
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              Showing 10 most recent submitted tasks in reverse chronological order
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search title, subrole, notes..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 min-w-[200px]"
            />

            <Show when={getUserAvailableRoles().length > 1 || (tasks.some((t) => t.role === "Trainer") && tasks.some((t) => t.role === "Reviewer"))}>
              <div class="flex items-center space-x-1 bg-slate-950 border border-slate-800 p-1 rounded-lg text-xs">
                <button
                  onClick={() => setLogFilterRole("All")}
                  class={`px-2.5 py-0.5 rounded transition-all ${logFilterRole() === "All" ? "bg-sky-600 text-white font-medium" : "text-slate-400"
                    }`}
                >
                  All
                </button>
                <button
                  onClick={() => setLogFilterRole("Trainer")}
                  class={`px-2.5 py-0.5 rounded transition-all ${logFilterRole() === "Trainer" ? "bg-sky-600 text-white font-medium shadow-md shadow-sky-950" : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                  Trainer
                </button>
                <button
                  onClick={() => setLogFilterRole("Reviewer")}
                  class={`px-2.5 py-0.5 rounded transition-all ${logFilterRole() === "Reviewer" ? "bg-purple-600 text-white font-medium shadow-md shadow-purple-950" : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                  Reviewer
                </button>
              </div>
            </Show>
          </div>
        </div>

        {/* Task Log Table */}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th class="py-3 px-4">Logged At</th>
                <th class="py-3 px-4">Role & Subrole</th>
                <th class="py-3 px-4">Task Information</th>
                <th class="py-3 px-4">Tracking Mode</th>
                <th class="py-3 px-4">Duration</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-medium">
              <Show
                when={previewTasks().length > 0}
                fallback={
                  <tr>
                    <td colSpan={6} class="py-8 text-center text-slate-500">
                      No task log entries found. Start a task log above to record tasks.
                    </td>
                  </tr>
                }
              >
                <For each={previewTasks()}>
                  {(task) => {
                    const sameGroupTasks = () => tasks.filter((t) => t.subrole === task.subrole && t.title === task.title && t.title !== "Administrative Time");
                    const isGroup = () => sameGroupTasks().length > 1;

                    return (
                      <tr class="hover:bg-slate-800/40 transition-colors">
                        <td class="py-3 px-4 whitespace-nowrap text-slate-400 font-mono">
                          {new Date(task.createdAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        <td class="py-3 px-4 whitespace-nowrap">
                          <div class="flex flex-col space-y-1">
                            <span class={`w-max text-[10px] font-bold px-2 py-0.5 rounded border ${task.role === 'Trainer'
                              ? 'bg-sky-950/80 text-sky-300 border-sky-800'
                              : 'bg-purple-950/80 text-purple-300 border-purple-800'
                              }`}>
                              {task.role}
                            </span>
                            <span class="text-slate-300 font-medium">{task.subrole}</span>
                          </div>
                        </td>

                        <td class="py-3 px-4 max-w-xs sm:max-w-md">
                          <div class="flex items-center space-x-2">
                            <Show
                              when={task.url && task.url !== "#"}
                              fallback={<span class="font-semibold text-slate-100 text-sm">{task.title}</span>}
                            >
                              <a
                                href={task.url}
                                target="_blank"
                                rel="noreferrer"
                                class="font-semibold text-sky-400 hover:text-sky-300 hover:underline text-sm inline-flex items-center space-x-1"
                              >
                                <span>{task.title}</span>
                                <svg class="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </Show>
                            <Show when={isGroup()}>
                              <button
                                type="button"
                                onClick={() => openGroupModal(task.subrole, task.title)}
                                class="px-2 py-0.5 text-[10px] font-bold bg-sky-950/90 text-sky-300 border border-sky-700/80 hover:bg-sky-900 rounded-md transition-colors flex items-center space-x-1 cursor-pointer"
                                title="Click to view task group breakdown and total time logged"
                              >
                                <span>🧩 Part of Group ({sameGroupTasks().length} logs)</span>
                              </button>
                            </Show>
                          </div>
                          <Show when={task.notes}>
                            <p class="text-xs text-slate-300 mt-1 italic font-normal">
                              "{task.notes}"
                            </p>
                          </Show>
                        </td>

                        <td class="py-3 px-4 whitespace-nowrap">
                          <div class="flex flex-col space-y-1">
                            <Show
                              when={task.timerMode === "hubstaff"}
                              fallback={
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300">
                                  Untracked Task
                                </span>
                              }
                            >
                              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                                Hubstaff Active
                              </span>
                            </Show>
                            <Show when={task.isManualEntry}>
                              <span class="w-max text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-sky-800 text-sky-300">
                                🖊️ Manual Entry
                              </span>
                            </Show>
                          </div>
                        </td>

                        <td class="py-3 px-4 whitespace-nowrap font-mono">
                          <div class="text-sm font-bold text-white">
                            {task.timerMode === "untracked" ? "00:00 (0m)" : formatTaskDuration(task.durationSeconds)}
                          </div>
                        </td>

                        <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => openEditModal(task)}
                            title="Edit task log details"
                            class="text-sky-400 hover:text-sky-300 p-1 rounded hover:bg-sky-950/40 transition-colors"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteTaskLog(task.id)}
                            title="Delete task entry"
                            class="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/40 transition-colors"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </Show>
            </tbody>
          </table>
        </div>

        <div class="pt-2 text-right">
          <a
            href="/task-log"
            class="text-xs text-sky-400 hover:text-sky-300 font-semibold inline-flex items-center space-x-1 hover:underline"
          >
            <span>View All Task Logs & Historical Entries &rarr;</span>
          </a>
        </div>
      </div>
    </div>
  );
}
