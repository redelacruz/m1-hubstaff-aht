import { createSignal, createEffect, For, Show } from "solid-js";
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
  addHubstaffTime,
  tasks,
  calculateGlobalAHT,
  getAhtStatus,
  formatDuration,
  formatMinutesDecimal,
  activeTimerSeconds,
  getUserAvailableRoles,
  getEffectiveUserRole,
} from "../lib/store";
import { EditTaskModal } from "../components/EditTaskModal";

export default function Home() {
  // Form signals
  const [selectedRole, setSelectedRole] = createSignal<Role>(getEffectiveUserRole());
  const [selectedSubrole, setSelectedSubrole] = createSignal<Subrole>(
    SUBROLES_BY_ROLE[getEffectiveUserRole()][0]
  );
  const [taskTitle, setTaskTitle] = createSignal<string>("");
  const [taskUrl, setTaskUrl] = createSignal<string>("");
  const [taskNotes, setTaskNotes] = createSignal<string>("");
  const [timerMode, setTimerMode] = createSignal<TimerMode>("hubstaff");

  // Keep selected role synced with effective role if single role
  createEffect(() => {
    const available = getUserAvailableRoles();
    if (available.length === 1 && selectedRole() !== available[0]) {
      setSelectedRole(available[0]);
    }
  });

  // Duration in minutes for testing / override
  const [customDurationMins, setCustomDurationMins] = createSignal<number>(
    Math.round(activeTimerSeconds() / 60)
  );

  // Filters & Toast
  const [logFilterRole, setLogFilterRole] = createSignal<Role | "All">("All");
  const [searchQuery, setSearchQuery] = createSignal<string>("");
  const [showNotification, setShowNotification] = createSignal<boolean>(false);
  const [notificationMsg, setNotificationMsg] = createSignal<string>("");

  // Edit Modal Signals
  const [editingTask, setEditingTask] = createSignal<TaskLogEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = createSignal<boolean>(false);

  // Automatically update subrole options when role changes
  createEffect(() => {
    const role = selectedRole();
    const availableSubroles = SUBROLES_BY_ROLE[role];
    if (!availableSubroles.includes(selectedSubrole())) {
      setSelectedSubrole(availableSubroles[0]);
    }
  });

  const currentGlobalAHT = () => calculateGlobalAHT(selectedRole());
  const currentRoleThresholds = () => settings.thresholds[selectedRole()];

  const currentAHTStatus = () => {
    const aht = currentGlobalAHT();
    const thresholds = currentRoleThresholds();
    return getAhtStatus(aht.globalAhtMinutes, thresholds.expectedAhtMinutes, thresholds.maxAhtMinutes);
  };

  const handleTaskSubmit = (e: Event) => {
    e.preventDefault();
    if (!taskTitle().trim()) {
      alert("Please enter a task title.");
      return;
    }

    const isUntracked = timerMode() === "untracked";
    const durationInSeconds = isUntracked ? 0 : Math.max(30, customDurationMins() * 60);

    addTaskLog({
      role: selectedRole(),
      subrole: selectedSubrole(),
      title: taskTitle().trim(),
      url: taskUrl().trim() || "#",
      notes: taskNotes().trim(),
      durationSeconds: durationInSeconds,
      timerMode: timerMode(),
    });

    setTaskTitle("");
    setTaskUrl("");
    setTaskNotes("");

    setNotificationMsg(
      isUntracked
        ? "Untracked task logged (Tasks +1, Hubstaff Hours +0)."
        : "Task submitted and logged to Hubstaff tracked time."
    );
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3500);
  };

  const handleSimulateAdminTime = (mins: number) => {
    addHubstaffTime(selectedRole(), mins * 60);
    setNotificationMsg(`Added +${mins}m non-task Hubstaff time for ${selectedRole()}.`);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
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

    return filtered.slice(0, 10); // Main page truncated at 10 items
  };

  return (
    <div class="space-y-8">
      {/* Toast Notification */}
      <Show when={showNotification()}>
        <div class="fixed bottom-6 right-6 z-50 bg-slate-900 border border-sky-500/60 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-bounce">
          <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm font-medium">{notificationMsg()}</span>
        </div>
      </Show>

      {/* Edit Task Modal */}
      <EditTaskModal
        task={editingTask()}
        isOpen={isEditModalOpen()}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEditedTask}
      />

      {/* Top Banner Context Note */}
      <div class="bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-sky-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Hubstaff Source of Truth Standard</span>
            </div>
            <h1 class="text-2xl font-extrabold text-white tracking-tight">Active Handling Time Tracker</h1>
            <p class="text-slate-400 text-sm mt-1 max-w-2xl">
              Global AHT is strictly calculated as <code class="text-sky-300 font-mono font-semibold">Total Hubstaff Hours ÷ Total Tasks</code>. Task durations do not alter Global AHT.
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
                <span>Task Entry & Timer Configuration</span>
              </h2>
            </div>

            <form onSubmit={handleTaskSubmit} class="space-y-5">
              {/* Timer Mode Selection */}
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Timer Tracking Mode
                </label>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label class={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${
                    timerMode() === 'hubstaff'
                      ? 'bg-sky-950/60 border-sky-500/80'
                      : 'bg-slate-950 border-slate-800'
                  }`}>
                    <input
                      type="radio"
                      name="timerMode"
                      value="hubstaff"
                      checked={timerMode() === "hubstaff"}
                      onChange={() => setTimerMode("hubstaff")}
                      class="w-4 h-4 text-sky-500 bg-slate-900 border-slate-700"
                    />
                    <div class="ml-3 text-xs">
                      <span class="block font-bold text-white">Hubstaff Active Timer</span>
                      <span class="block text-slate-400">Logs task with active Hubstaff duration</span>
                    </div>
                  </label>

                  <label class={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${
                    timerMode() === 'untracked'
                      ? 'bg-amber-950/60 border-amber-500/80'
                      : 'bg-slate-950 border-slate-800'
                  }`}>
                    <input
                      type="radio"
                      name="timerMode"
                      value="untracked"
                      checked={timerMode() === "untracked"}
                      onChange={() => setTimerMode("untracked")}
                      class="w-4 h-4 text-amber-500 bg-slate-900 border-slate-700"
                    />
                    <div class="ml-3 text-xs">
                      <span class="block font-bold text-amber-300">Untracked Task (No Hubstaff Timer)</span>
                      <span class="block text-slate-400">Increments task count; Hubstaff time +0</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Role & Subrole Row */}
              <div class={getUserAvailableRoles().length > 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-5" : "grid grid-cols-1 gap-5"}>
                <Show when={getUserAvailableRoles().length > 1}>
                  <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Role <span class="text-rose-400">*</span>
                    </label>
                    <div class="relative">
                      <select
                        value={selectedRole()}
                        onChange={(e) => setSelectedRole(e.currentTarget.value as Role)}
                        class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none"
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
                  <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Subrole <span class="text-rose-400">*</span>
                  </label>
                  <div class="relative">
                    <select
                      value={selectedSubrole()}
                      onChange={(e) => setSelectedSubrole(e.currentTarget.value as Subrole)}
                      class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none"
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
                  <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Task Title <span class="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Audit Support Escalation Ticket #501"
                    value={taskTitle()}
                    onInput={(e) => setTaskTitle(e.currentTarget.value)}
                    class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Task URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://hubstaff.com/tasks/..."
                    value={taskUrl()}
                    onInput={(e) => setTaskUrl(e.currentTarget.value)}
                    class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Task Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Add optional task details or findings..."
                  value={taskNotes()}
                  onInput={(e) => setTaskNotes(e.currentTarget.value)}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                ></textarea>
              </div>

              {/* Action Bar */}
              <div class="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800">
                <button
                  type="submit"
                  class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-sky-950 transition-all flex items-center justify-center space-x-2"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Submit Task to Log</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Timer Display & Current Role Global AHT Widget */}
        <div class="lg:col-span-4 space-y-6">
          
          {/* Active Task Timer Card */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active Task Timer</span>
              </span>
              <span class="text-[11px] text-sky-400 bg-sky-950 border border-sky-900 px-2 py-0.5 rounded font-mono">
                Hubstaff Stream
              </span>
            </div>

            <div class="text-center py-4 bg-slate-950 rounded-xl border border-slate-800 my-2">
              <div class="text-4xl font-mono font-extrabold text-white tracking-wider">
                {timerMode() === "untracked" ? "00:00" : formatDuration(customDurationMins() * 60)}
              </div>
              <p class="text-xs text-slate-400 mt-2">
                {timerMode() === "untracked" ? "Untracked Task Mode (Hubstaff Timer Off)" : "Accumulated Time for Active Task"}
              </p>
            </div>

            <Show when={timerMode() === "hubstaff"}>
              <div class="mt-4 pt-3 border-t border-slate-800">
                <div class="flex justify-between items-center text-xs text-slate-400 mb-1">
                  <span>Simulated Task Duration:</span>
                  <span class="font-bold text-sky-300 font-mono">{customDurationMins()} minutes</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="45"
                  value={customDurationMins()}
                  onInput={(e) => setCustomDurationMins(parseInt(e.currentTarget.value))}
                  class="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </Show>
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

            {/* Non-Task Work Simulation Control */}
            <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div class="text-slate-400 flex items-center justify-between">
                <span>Non-Task Work Simulation:</span>
                <span class="text-amber-400 font-bold font-mono">
                  {formatDuration(currentGlobalAHT().nonTaskSeconds)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSimulateAdminTime(15)}
                class="w-full py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium rounded-lg transition-colors flex items-center justify-center space-x-1"
              >
                <svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Add +15m Non-Task Hubstaff Time</span>
              </button>
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

          {/* Controls */}
          <div class="flex flex-wrap items-center gap-3">
            <div class="relative min-w-[180px]">
              <input
                type="text"
                placeholder="Search recent..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
              <svg class="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <Show when={getUserAvailableRoles().length > 1 || (tasks.some((t) => t.role === "Trainer") && tasks.some((t) => t.role === "Reviewer"))}>
              <div class="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setLogFilterRole("All")}
                  class={`px-2.5 py-0.5 rounded transition-all ${
                    logFilterRole() === "All" ? "bg-sky-600 text-white font-medium" : "text-slate-400"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setLogFilterRole("Trainer")}
                  class={`px-2.5 py-0.5 rounded transition-all ${
                    logFilterRole() === "Trainer" ? "bg-sky-600 text-white font-medium" : "text-slate-400"
                  }`}
                >
                  Trainer
                </button>
                <button
                  onClick={() => setLogFilterRole("Reviewer")}
                  class={`px-2.5 py-0.5 rounded transition-all ${
                    logFilterRole() === "Reviewer" ? "bg-sky-600 text-white font-medium" : "text-slate-400"
                  }`}
                >
                  Reviewer
                </button>
              </div>
            </Show>
          </div>
        </div>

        {/* Table */}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 bg-slate-950/40">
                <th class="py-3 px-4">Date / Time</th>
                <th class="py-3 px-4">Role & Subrole</th>
                <th class="py-3 px-4">Task Details</th>
                <th class="py-3 px-4">Timer Mode</th>
                <th class="py-3 px-4">Duration</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <Show
                when={previewTasks().length > 0}
                fallback={
                  <tr>
                    <td colSpan={6} class="py-8 text-center text-slate-500">
                      No tasks found in recent log preview.
                    </td>
                  </tr>
                }
              >
                <For each={previewTasks()}>
                  {(task) => (
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-4 text-slate-400 whitespace-nowrap font-mono">
                        {new Date(task.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td class="py-3 px-4 whitespace-nowrap">
                        <div class="flex flex-col space-y-1">
                          <span class={`w-max text-[10px] font-bold px-2 py-0.5 rounded border ${
                            task.role === 'Trainer'
                              ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                              : 'bg-sky-950/80 text-sky-300 border-sky-800'
                          }`}>
                            {task.role}
                          </span>
                          <span class="text-slate-300 font-medium">{task.subrole}</span>
                        </div>
                      </td>

                      <td class="py-3 px-4 max-w-xs sm:max-w-md">
                        <div class="font-semibold text-slate-100 text-sm">
                          {task.title}
                        </div>
                        <Show when={task.url && task.url !== "#"}>
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noreferrer"
                            class="text-[11px] text-sky-400 hover:underline inline-flex items-center space-x-1 mt-0.5"
                          >
                            <span>{task.url}</span>
                          </a>
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
                          {task.timerMode === "untracked" ? "00:00 (0m)" : formatDuration(task.durationSeconds)}
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
                  )}
                </For>
              </Show>
            </tbody>
          </table>
        </div>

        {/* Footer Button to navigate to full task log page */}
        <div class="pt-3 border-t border-slate-800 flex items-center justify-between">
          <span class="text-xs text-slate-400">
            Total Logged Tasks: <span class="font-bold text-slate-200">{tasks.length} tasks</span>
          </span>
          <a
            href="/task-log"
            class="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-sky-950 flex items-center space-x-1.5"
          >
            <span>View Full Task Log</span>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
