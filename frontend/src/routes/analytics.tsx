import { createSignal, createEffect, For, Show, onMount, onCleanup } from "solid-js";
import {
  Role,
  Subrole,
  SUBROLES_BY_ROLE,
  settings,
  calculateGlobalAHT,
  getAhtStatus,
  formatDuration,
  formatMinutesDecimal,
  tasks,
  getUserAvailableRoles,
  getEffectiveUserRole,
  fetchLocalHubstaffEvents,
  calculateHubstaffBilledSecondsFromEvents,
} from "../lib/store";

export default function Analytics() {
  const [selectedRole, setSelectedRole] = createSignal<Role | "All">(getEffectiveUserRole());

  onMount(() => {
    fetchLocalHubstaffEvents();
    const interval = setInterval(() => {
      fetchLocalHubstaffEvents();
    }, 5000);
    onCleanup(() => clearInterval(interval));
  });

  createEffect(() => {
    const available = getUserAvailableRoles();
    if (available.length === 1 && selectedRole() !== available[0]) {
      setSelectedRole(available[0]);
    }
  });

  const currentGlobalAHT = () => calculateGlobalAHT(selectedRole());
  const currentBilledInfo = () => calculateHubstaffBilledSecondsFromEvents(selectedRole());

  const getEffectiveThresholds = () => {
    const role = selectedRole();
    if (role === "All") {
      return {
        expectedAhtMinutes: (settings.thresholds.Trainer.expectedAhtMinutes + settings.thresholds.Reviewer.expectedAhtMinutes) / 2,
        maxAhtMinutes: (settings.thresholds.Trainer.maxAhtMinutes + settings.thresholds.Reviewer.maxAhtMinutes) / 2,
      };
    }
    return settings.thresholds[role];
  };

  return (
    <div class="space-y-8">
      {/* Header & Role Selector Dropdown */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div class="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2 2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Performance Intelligence</span>
          </div>
          <h1 class="text-2xl font-extrabold text-white tracking-tight">Detailed AHT & Time Breakdown</h1>
          <p class="text-slate-400 text-sm mt-1">
            Hubstaff billed hours, task volume, and Global Effective AHT calculations.
          </p>
        </div>

        {/* Role Filter Dropdown */}
        <Show when={getUserAvailableRoles().length > 1 || (tasks.some((t) => t.role === "Trainer") && tasks.some((t) => t.role === "Reviewer"))}>
          <div class="flex items-center space-x-3 bg-slate-950 border border-slate-800 p-2 rounded-xl">
            <label class="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-2">
              Select Role:
            </label>
            <div class="relative">
              <select
                value={selectedRole()}
                onChange={(e) => setSelectedRole(e.currentTarget.value as Role | "All")}
                class="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none pr-8 cursor-pointer"
              >
                <option value="Trainer">Trainer</option>
                <option value="Reviewer">Reviewer</option>
                <option value="All">All Roles Combined</option>
              </select>
              <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Hubstaff Time Utilization & Global AHT Section */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Global AHT Card */}
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">
                Global Effective AHT
              </span>
              <span class="text-[10px] bg-sky-950 border border-sky-800 text-sky-300 px-2 py-0.5 rounded font-semibold">
                Hubstaff Billed
              </span>
            </div>

            <div class="my-3">
              <div class="text-3xl font-extrabold text-white font-mono">
                {formatMinutesDecimal(currentGlobalAHT().globalAhtSeconds)}
              </div>
              <div class="text-xs text-slate-400 font-mono mt-0.5">
                Formatted: {formatDuration(currentGlobalAHT().globalAhtSeconds)}
              </div>
            </div>

            <div class="mt-4 pt-4 border-t border-slate-800">
              {(() => {
                const thresholds = getEffectiveThresholds();
                const status = getAhtStatus(currentGlobalAHT().globalAhtMinutes, thresholds.expectedAhtMinutes, thresholds.maxAhtMinutes);
                return (
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-slate-400">Status vs Benchmark:</span>
                    <span class={`font-bold px-2.5 py-0.5 rounded-full border ${status.bgClass} ${status.borderClass}`}>
                      {status.label}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          <div class="mt-4 text-xs text-slate-500 flex justify-between items-center">
            <span>Formula:</span>
            <span class="font-mono text-slate-300">(Hubstaff Time - Onboarding) ÷ Tasks</span>
          </div>
        </div>

        {/* Hubstaff Total Billed Hours Card */}
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Hubstaff Billed Time
              </span>
              <Show
                when={currentBilledInfo().activeTimer}
                fallback={
                  <span class="text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded font-semibold">
                    Events Direct
                  </span>
                }
              >
                <span class="text-[10px] bg-emerald-950 border border-emerald-700 text-emerald-300 px-2 py-0.5 rounded font-bold flex items-center space-x-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Timer Active</span>
                </span>
              </Show>
            </div>

            <div class="my-3">
              <div class="text-3xl font-extrabold text-emerald-400 font-mono">
                {formatDuration(currentGlobalAHT().totalHubstaffSeconds)}
              </div>
              <div class="text-xs text-slate-400 font-mono mt-0.5">
                {formatMinutesDecimal(currentGlobalAHT().totalHubstaffSeconds)}
              </div>
            </div>

            <div class="mt-4 pt-4 border-t border-slate-800 text-xs space-y-1.5">
              <div class="flex justify-between text-slate-400">
                <span>Task Execution Hours:</span>
                <span class="font-mono font-bold text-slate-200">{formatDuration(currentGlobalAHT().totalDirectTaskSeconds)}</span>
              </div>
              <div class="flex justify-between text-slate-400">
                <span>Non-Task / Admin Hours:</span>
                <span class="font-mono font-bold text-amber-400">{formatDuration(currentGlobalAHT().nonTaskSeconds)}</span>
              </div>
              <div class="flex justify-between text-slate-400">
                <span>Onboarding Hours:</span>
                <span class="font-mono font-bold text-sky-400">{formatDuration(currentGlobalAHT().onboardingSeconds)}</span>
              </div>
            </div>
          </div>

          <div class="mt-4 text-xs text-slate-500 flex justify-between items-center">
            <span>Billed Client Time:</span>
            <span class="font-bold text-slate-300">Dynamic Events Paired</span>
          </div>
        </div>

        {/* Total Tasks Submitted Card */}
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Tasks Submitted
              </span>
              <span class="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded">
                Deliverables
              </span>
            </div>

            <div class="my-3">
              <div class="text-3xl font-extrabold text-white font-mono">
                {currentGlobalAHT().taskCount}
              </div>
              <div class="text-xs text-slate-400 mt-0.5">
                Completed Task Submissions
              </div>
            </div>

            <div class="mt-4 pt-4 border-t border-slate-800">
              <div class="flex justify-between text-xs text-slate-400">
                <span>Direct Task Average:</span>
                <span class="font-mono font-bold text-sky-300">
                  {formatMinutesDecimal(currentGlobalAHT().directTaskAhtSeconds)}
                </span>
              </div>
            </div>
          </div>

          <div class="mt-4 text-xs text-slate-500 flex justify-between items-center">
            <span>Tasks Logged:</span>
            <span class="font-bold text-slate-300">{currentGlobalAHT().taskCount} tasks</span>
          </div>
        </div>
      </div>

      {/* Subrole Distribution */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 class="text-lg font-bold text-white flex items-center space-x-2">
              <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Subrole Task Distribution</span>
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              Task count and direct handling time broken down by subrole responsibilities.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(() => {
            const role = selectedRole();
            const subrolesToDisplay: Subrole[] = role === "All"
              ? [...SUBROLES_BY_ROLE.Reviewer, ...SUBROLES_BY_ROLE.Trainer]
              : SUBROLES_BY_ROLE[role];

            return (
              <For each={subrolesToDisplay}>
                {(subrole) => {
                  const parentRole: Role = SUBROLES_BY_ROLE.Reviewer.includes(subrole) ? "Reviewer" : "Trainer";
                  const subroleTasks = tasks.filter((t) => t.subrole === subrole);
                  const count = subroleTasks.length;
                  const totalDirectSecs = subroleTasks.reduce((sum, t) => sum + (t.durationSeconds || 0), 0);
                  const avgDirectSecs = count > 0 ? Math.round(totalDirectSecs / count) : 0;

                  return (
                    <div class="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col justify-between">
                      <div>
                        <div class="flex items-center justify-between mb-2">
                          <span class={`text-[10px] font-bold px-2 py-0.5 rounded border ${parentRole === 'Trainer'
                              ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                              : 'bg-sky-950/80 text-sky-300 border-sky-800'
                            }`}>
                            {parentRole}
                          </span>
                          <span class="text-xs font-mono font-bold text-slate-300">
                            {count} tasks
                          </span>
                        </div>

                        <h3 class="text-base font-bold text-white mb-2">{subrole}</h3>

                        <div class="flex items-baseline space-x-3 my-2">
                          <span class="text-2xl font-mono font-extrabold text-sky-400">
                            {formatMinutesDecimal(avgDirectSecs)}
                          </span>
                          <span class="text-xs text-slate-400 font-mono">
                            Direct Avg ({formatDuration(avgDirectSecs)})
                          </span>
                        </div>
                      </div>

                      <div class="mt-4 pt-3 border-t border-slate-900 text-xs text-slate-400 flex justify-between">
                        <span>Total Direct Execution Time:</span>
                        <span class="font-bold font-mono text-slate-200">{formatDuration(totalDirectSecs)}</span>
                      </div>
                    </div>
                  );
                }}
              </For>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
