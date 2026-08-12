import { createSignal, Show } from "solid-js";
import {
  Role,
  settings,
  updateUserSettings,
  DEFAULT_USER,
  resetAllToDefault,
  DEFAULT_SETTINGS,
  syncHubstaffData,
} from "../lib/store";

export default function Settings() {
  const [defaultRole, setDefaultRole] = createSignal<Role>(settings.defaultRole);
  const [trackingStartDate, setTrackingStartDate] = createSignal<string>(
    settings.trackingStartDate || "2026-08-01"
  );
  
  const [trainerExpected, setTrainerExpected] = createSignal<number>(
    settings.thresholds.Trainer.expectedAhtMinutes
  );
  const [trainerMax, setTrainerMax] = createSignal<number>(
    settings.thresholds.Trainer.maxAhtMinutes
  );

  const [reviewerExpected, setReviewerExpected] = createSignal<number>(
    settings.thresholds.Reviewer.expectedAhtMinutes
  );
  const [reviewerMax, setReviewerMax] = createSignal<number>(
    settings.thresholds.Reviewer.maxAhtMinutes
  );

  const [savedSuccess, setSavedSuccess] = createSignal<boolean>(false);
  const [toastMsg, setToastMsg] = createSignal<string>("");
  const [isSyncing, setIsSyncing] = createSignal<boolean>(false);

  const handleSaveSettings = (e: Event) => {
    e.preventDefault();

    updateUserSettings({
      defaultRole: defaultRole(),
      trackingStartDate: trackingStartDate(),
      thresholds: {
        Trainer: {
          expectedAhtMinutes: Number(trainerExpected()),
          maxAhtMinutes: Number(trainerMax()),
        },
        Reviewer: {
          expectedAhtMinutes: Number(reviewerExpected()),
          maxAhtMinutes: Number(reviewerMax()),
        },
      },
    });

    setToastMsg("Settings saved to browser local storage!");
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSyncFromStartDate = () => {
    setIsSyncing(true);
    // Update tracking start date setting first
    updateUserSettings({ trackingStartDate: trackingStartDate() });

    setTimeout(() => {
      syncHubstaffData();
      setIsSyncing(false);
      setToastMsg(`Triggered Hubstaff activity sync starting from ${trackingStartDate()}!`);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    }, 800);
  };

  const handleResetDefaults = () => {
    if (confirm("Reset all settings, Hubstaff data, and task logs to initial default values?")) {
      resetAllToDefault();
      setDefaultRole(DEFAULT_SETTINGS.defaultRole);
      setTrackingStartDate(DEFAULT_SETTINGS.trackingStartDate);
      setTrainerExpected(DEFAULT_SETTINGS.thresholds.Trainer.expectedAhtMinutes);
      setTrainerMax(DEFAULT_SETTINGS.thresholds.Trainer.maxAhtMinutes);
      setReviewerExpected(DEFAULT_SETTINGS.thresholds.Reviewer.expectedAhtMinutes);
      setReviewerMax(DEFAULT_SETTINGS.thresholds.Reviewer.maxAhtMinutes);
      setToastMsg("All settings reset to defaults.");
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  return (
    <div class="max-w-4xl mx-auto space-y-8">
      {/* Toast Notification */}
      <Show when={savedSuccess()}>
        <div class="fixed bottom-6 right-6 z-50 bg-slate-900 border border-sky-500/60 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-bounce">
          <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm font-medium">{toastMsg()}</span>
        </div>
      </Show>

      {/* Header */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <div class="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Configuration & Integration Defaults</span>
          </div>
          <h1 class="text-2xl font-extrabold text-white tracking-tight">Application Settings</h1>
          <p class="text-slate-400 text-sm mt-1">
            Configure Hubstaff sync start date, default role, and AHT benchmark thresholds.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} class="space-y-8">
        
        {/* Section 1: Hubstaff Tracking Start Date Configuration */}
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div class="pb-3 border-b border-slate-800">
            <h2 class="text-base font-bold text-white flex items-center space-x-2">
              <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Hubstaff Data Sync Start Date</span>
            </h2>
            <p class="text-xs text-slate-400 mt-1">
              Determines the historical start date used by Hubstaff sync operations when requesting activity and timer data.
            </p>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
            <div class="flex-1 max-w-xs">
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Tracking Start Date
              </label>
              <input
                type="date"
                value={trackingStartDate()}
                onInput={(e) => setTrackingStartDate(e.currentTarget.value)}
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div class="pt-0 sm:pt-6">
              <button
                type="button"
                onClick={handleSyncFromStartDate}
                disabled={isSyncing()}
                class="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-950 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <svg class={`w-4 h-4 ${isSyncing() ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{isSyncing() ? "Syncing..." : "Sync Hubstaff Data"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Default Role */}
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div class="pb-3 border-b border-slate-800">
            <h2 class="text-base font-bold text-white flex items-center space-x-2">
              <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Default User Role</span>
            </h2>
            <p class="text-xs text-slate-400 mt-1">
              This role will automatically pre-select in dropdowns when creating new task entries.
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <label class={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
              defaultRole() === 'Reviewer'
                ? 'bg-sky-950/60 border-sky-500/80 shadow-md shadow-sky-950'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}>
              <input
                type="radio"
                name="defaultRole"
                value="Reviewer"
                checked={defaultRole() === "Reviewer"}
                onChange={() => setDefaultRole("Reviewer")}
                class="w-4 h-4 text-sky-500 focus:ring-sky-500 bg-slate-900 border-slate-700"
              />
              <div class="ml-3">
                <span class="block text-sm font-bold text-white">Reviewer</span>
                <span class="block text-xs text-slate-400 mt-0.5">
                  Subroles: Completion Reviewer, Quality Reviewer
                </span>
              </div>
            </label>

            <label class={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
              defaultRole() === 'Trainer'
                ? 'bg-indigo-950/60 border-indigo-500/80 shadow-md shadow-indigo-950'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}>
              <input
                type="radio"
                name="defaultRole"
                value="Trainer"
                checked={defaultRole() === "Trainer"}
                onChange={() => setDefaultRole("Trainer")}
                class="w-4 h-4 text-indigo-500 focus:ring-indigo-500 bg-slate-900 border-slate-700"
              />
              <div class="ml-3">
                <span class="block text-sm font-bold text-white">Trainer</span>
                <span class="block text-xs text-slate-400 mt-0.5">
                  Subroles: Trainer 1, Trainer 2
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Section 3: Role AHT Thresholds */}
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div class="pb-3 border-b border-slate-800">
            <h2 class="text-base font-bold text-white flex items-center space-x-2">
              <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>AHT Benchmark Thresholds</span>
            </h2>
            <p class="text-xs text-slate-400 mt-1">
              Set Expected AHT targets and Max AHT threshold limits (in minutes) for each role.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div class="flex items-center space-x-2">
                <span class="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                <h3 class="font-bold text-white text-sm">Reviewer Role Benchmarks</h3>
              </div>

              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Expected AHT (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={reviewerExpected()}
                  onInput={(e) => setReviewerExpected(parseInt(e.currentTarget.value) || 1)}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Max AHT Threshold (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={reviewerMax()}
                  onInput={(e) => setReviewerMax(parseInt(e.currentTarget.value) || 1)}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div class="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div class="flex items-center space-x-2">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                <h3 class="font-bold text-white text-sm">Trainer Role Benchmarks</h3>
              </div>

              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Expected AHT (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={trainerExpected()}
                  onInput={(e) => setTrainerExpected(parseInt(e.currentTarget.value) || 1)}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Max AHT Threshold (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={trainerMax()}
                  onInput={(e) => setTrainerMax(parseInt(e.currentTarget.value) || 1)}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Multi-User Scaffolding Profile Card */}
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 class="text-base font-bold text-white flex items-center space-x-2">
                <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Single-User Architecture & Multi-Tenant Scaffolding</span>
              </h2>
            </div>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <div class="space-y-1">
              <div class="font-bold text-white">{DEFAULT_USER.name}</div>
              <div class="text-slate-400 font-mono">User ID: {DEFAULT_USER.id}</div>
              <div class="text-slate-500">{DEFAULT_USER.email}</div>
            </div>
            <span class="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full font-bold">
              Active Session
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div class="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={handleResetDefaults}
            class="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl transition-colors"
          >
            Reset All Settings & Data
          </button>

          <button
            type="submit"
            class="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-950 transition-all flex items-center space-x-2"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
