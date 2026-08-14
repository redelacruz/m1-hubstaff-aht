import { createSignal, createEffect, onMount, Show, For } from "solid-js";
import {
  Role,
  settings,
  updateUserSettings,
  saveUserSettingsToBackend,
  syncHubstaffData,
  syncHubstaffTrackingStatesFromBackend,
  hubstaffStatus,
  fetchHubstaffStatusFromBackend,
  submitHubstaffPatToBackend,
  hydrateStoreFromLocalStorage,
  getUserAvailableRoles,
} from "../lib/store";
import { ConfirmationModal } from "../components/ConfirmationModal";

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
  const [trainerOnboarding, setTrainerOnboarding] = createSignal<number>(
    settings.thresholds.Trainer.onboardingMinutes ?? 120
  );

  const [reviewerExpected, setReviewerExpected] = createSignal<number>(
    settings.thresholds.Reviewer.expectedAhtMinutes
  );
  const [reviewerMax, setReviewerMax] = createSignal<number>(
    settings.thresholds.Reviewer.maxAhtMinutes
  );
  const [reviewerOnboarding, setReviewerOnboarding] = createSignal<number>(
    settings.thresholds.Reviewer.onboardingMinutes ?? 60
  );

  // Hubstaff PAT Authentication State
  const [patInput, setPatInput] = createSignal<string>("");
  const [showPatToken, setShowPatToken] = createSignal<boolean>(false);
  const [isPatLoading, setIsPatLoading] = createSignal<boolean>(false);
  const [isUnlockedByChoice, setIsUnlockedByChoice] = createSignal<boolean>(false);

  // Warning Modals State
  const [isUnlockModalOpen, setIsUnlockModalOpen] = createSignal<boolean>(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = createSignal<boolean>(false);

  const [savedSuccess, setSavedSuccess] = createSignal<boolean>(false);
  const [toastMsg, setToastMsg] = createSignal<string>("");
  const [isSyncing, setIsSyncing] = createSignal<boolean>(false);

  let dateInputRef: HTMLInputElement | undefined;

  const formatHumanDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-").map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return dateStr;
    }
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  createEffect(() => {
    setDefaultRole(settings.defaultRole);
    setTrackingStartDate(settings.trackingStartDate || "2026-08-01");
    setTrainerExpected(settings.thresholds.Trainer.expectedAhtMinutes);
    setTrainerMax(settings.thresholds.Trainer.maxAhtMinutes);
    setReviewerExpected(settings.thresholds.Reviewer.expectedAhtMinutes);
    setReviewerMax(settings.thresholds.Reviewer.maxAhtMinutes);
  });

  onMount(async () => {
    hydrateStoreFromLocalStorage();
    await fetchHubstaffStatusFromBackend();
  });

  const isUserConnected = () => hubstaffStatus().isConnected;

  const isFieldLocked = () => {
    return isUserConnected() && hubstaffStatus().isLocked && !isUnlockedByChoice();
  };

  const handleSaveSettings = async (e: Event) => {
    e.preventDefault();

    const updated = {
      defaultRole: defaultRole(),
      trackingStartDate: trackingStartDate(),
      thresholds: {
        Trainer: {
          expectedAhtMinutes: Number(trainerExpected()),
          maxAhtMinutes: Number(trainerMax()),
          onboardingMinutes: Number(trainerOnboarding()),
        },
        Reviewer: {
          expectedAhtMinutes: Number(reviewerExpected()),
          maxAhtMinutes: Number(reviewerMax()),
          onboardingMinutes: Number(reviewerOnboarding()),
        },
      },
    };

    // Save to local storage & persist to database
    updateUserSettings(updated);
    await saveUserSettingsToBackend(updated);

    setToastMsg("Settings saved successfully!");
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSyncFromStartDate = async () => {
    setIsSyncing(true);
    updateUserSettings({ trackingStartDate: trackingStartDate() });
    await saveUserSettingsToBackend({ trackingStartDate: trackingStartDate() });

    const result = await syncHubstaffTrackingStatesFromBackend();
    setIsSyncing(false);
    if (result.success) {
      setToastMsg(`Synced ${result.events_count} Hubstaff tracking events! Start Date: ${settings.trackingStartDate}`);
    } else {
      setToastMsg("Hubstaff tracking states sync complete.");
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  // Workflow Handlers for PAT Authentication & Modals
  const handleUnlockClick = () => {
    setIsUnlockModalOpen(true);
  };

  const handleConfirmUnlock = () => {
    setIsUnlockModalOpen(false);
    setIsUnlockedByChoice(true);
    setPatInput("");
    setToastMsg("PAT field unlocked. You may enter a new PAT or cancel to keep existing account & data.");
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleCancelUnlock = () => {
    setIsUnlockedByChoice(false);
    setPatInput("");
    setToastMsg("Cancelled. Existing Hubstaff account and all data retained.");
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSubmitPatClick = (e: Event) => {
    e.preventDefault();
    if (!patInput().trim()) {
      alert("Please enter a valid Hubstaff Personal Access Token (PAT).");
      return;
    }
    setIsSubmitModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitModalOpen(false);
    setIsPatLoading(true);
    try {
      const user = await submitHubstaffPatToBackend(patInput().trim());
      setIsUnlockedByChoice(false);
      setToastMsg(`Successfully connected new Hubstaff account as ${user.name}!`);
      setSavedSuccess(true);
      setPatInput("");
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (e: any) {
      alert(`Authentication Error: ${e.message}`);
    } finally {
      setIsPatLoading(false);
    }
  };

  // Reusable Hubstaff PAT Authentication & Profile Card Section
  const renderHubstaffAuthSection = () => (
    <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 class="text-base font-bold text-white flex items-center space-x-2">
            <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span>Hubstaff API V2 Authentication (PAT)</span>
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            Enter your Hubstaff Personal Access Token to authenticate API requests.
          </p>
        </div>

        {/* Connection Status Badge */}
        <Show
          when={isFieldLocked()}
          fallback={
            <span class="px-3 py-1 bg-amber-950 text-amber-300 border border-amber-800/80 rounded-full font-bold text-xs flex items-center space-x-1.5">
              <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span>{isUserConnected() ? "Unlocked for New PAT" : "Not Connected / Unlocked"}</span>
            </span>
          }
        >
          <span class="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800/80 rounded-full font-bold text-xs flex items-center space-x-1.5">
            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Connected</span>
          </span>
        </Show>
      </div>

      {/* Form Controls */}
      <div class="space-y-4">
        <Show
          when={isFieldLocked()}
          fallback={
            <form onSubmit={handleSubmitPatClick} class="space-y-4">
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Personal Access Token (PAT)
              </label>

              <div class="relative flex items-center">
                <input
                  type={showPatToken() ? "text" : "password"}
                  placeholder="Enter Hubstaff PAT (e.g. hspat_...)"
                  value={patInput()}
                  onInput={(e) => setPatInput(e.currentTarget.value)}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-24 py-3 text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPatToken(!showPatToken())}
                  class="absolute right-3 text-xs font-bold text-slate-400 hover:text-white px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg"
                >
                  {showPatToken() ? "Hide" : "Show"}
                </button>
              </div>

              <div class="flex items-center justify-between pt-2">
                <a
                  href="https://developer.hubstaff.com/authentication#pat"
                  target="_blank"
                  rel="noreferrer"
                  class="text-xs text-sky-400 hover:underline inline-flex items-center space-x-1"
                >
                  <span>How to generate a Hubstaff PAT</span>
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>

                <div class="flex items-center space-x-3">
                  <Show when={isUserConnected()}>
                    <button
                      type="button"
                      onClick={handleCancelUnlock}
                      class="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
                    >
                      <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Cancel</span>
                    </button>
                  </Show>

                  <button
                    type="submit"
                    disabled={isPatLoading()}
                    class="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-950 transition-all flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Show when={isPatLoading()}>
                      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </Show>
                    <span>{isPatLoading() ? "Authenticating..." : "Connect Hubstaff Account"}</span>
                  </button>
                </div>
              </div>
            </form>
          }
        >
          {/* Locked Display State */}
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
            <div class="flex items-center justify-between">
              <div class="space-y-1">
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Personal Access Token (PAT) Status
                </label>
                <div class="flex items-center space-x-2 font-mono text-xs text-slate-300">
                  <span>••••••••••••••••••••••••••••••••••••••••</span>
                  <span class="text-emerald-400 font-bold">(Locked)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUnlockClick}
                disabled={isPatLoading()}
                class="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 font-bold text-xs rounded-xl transition-all flex items-center space-x-2"
              >
                <svg class="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                <span>Connect New Account</span>
              </button>
            </div>
          </div>
        </Show>

        {/* User Profile Card */}
        <Show when={hubstaffStatus().user}>
          {(usr) => (
            <div class="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <div class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <svg class="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Connected Hubstaff User Profile</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div class="text-slate-500 font-medium mb-0.5">Full Name</div>
                  <div class="font-bold text-white">{usr().name}</div>
                </div>

                <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div class="text-slate-500 font-medium mb-0.5">Email Address</div>
                  <div class="font-semibold text-slate-200 truncate">{usr().email}</div>
                </div>

                <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div class="text-slate-500 font-medium mb-0.5">Hubstaff User ID</div>
                  <div class="font-mono font-bold text-sky-400">{usr().id}</div>
                </div>

                <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div class="text-slate-500 font-medium mb-0.5">Timezone / Status</div>
                  <div class="font-medium text-slate-300">
                    {usr().time_zone || "UTC"} ({usr().status || "active"})
                  </div>
                </div>
              </div>

              {/* Webhook Telemetry Status Bar */}
              <div class="pt-3 border-t border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div class="flex items-center space-x-2">
                  <span class="text-slate-500 font-medium">Webhook Status:</span>
                  <Show
                    when={hubstaffStatus().webhook_status?.is_active}
                    fallback={
                      <span class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-medium">
                        <span class="w-2 h-2 rounded-full bg-slate-500"></span>
                        <span>Pending Webhook Subscription</span>
                      </span>
                    }
                  >
                    <span class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-[11px] font-bold">
                      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Active (timer.start, timer.stop)</span>
                    </span>
                  </Show>
                </div>

                <div class="text-[11px] text-slate-400 flex items-center space-x-2 truncate font-mono">
                  <span class="text-slate-500">Target URL:</span>
                  <span class="text-sky-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 truncate">
                    {hubstaffStatus().webhook_status?.target_url || "https://hubstaff-data.redelacruz.com/api/hubstaff/webhook"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Show>

        {/* Hubstaff Organizations & Projects Card */}
        <Show when={hubstaffStatus().user}>
          <div class="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
            <div class="flex items-center justify-between">
              <div class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Hubstaff Organizations & Projects</span>
              </div>
            </div>

            <Show
              when={(hubstaffStatus().organizations || []).length > 0}
              fallback={
                <div class="text-xs text-slate-500 py-4 text-center bg-slate-900/30 rounded-lg border border-slate-900">
                  No Hubstaff organizations found. Connect a valid PAT token to load organizations and projects.
                </div>
              }
            >
              <div class="space-y-4">
                <For each={hubstaffStatus().organizations || []}>
                  {(org) => (
                    <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                      <div class="flex items-center justify-between flex-wrap gap-2">
                        <div class="flex items-center space-x-2">
                          <span class="font-semibold text-sm text-slate-100">{org.name}</span>
                          <Show when={org.is_micro1}>
                            <span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Micro1 Org
                            </span>
                          </Show>
                        </div>
                        <div class="flex items-center space-x-2 text-xs">
                          <span class="font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                            ID: {org.id}
                          </span>
                          <span
                            class={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${org.status === "active"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                          >
                            {org.status}
                          </span>
                        </div>
                      </div>

                      {/* Display Projects if this is Micro1 organization */}
                      <Show when={org.is_micro1}>
                        <div class="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                          <div class="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
                            <svg class="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            <span>Projects</span>
                          </div>

                          <Show
                            when={(org.projects || []).length > 0}
                            fallback={
                              <div class="text-xs text-slate-500 italic py-2 pl-2">
                                No projects retrieved for Micro1 organization.
                              </div>
                            }
                          >
                            <div class="space-y-2 text-xs">
                              <For each={org.projects || []}>
                                {(prj) => (
                                  <div class="bg-slate-950 p-3 rounded-lg border border-slate-800/90 flex items-center justify-between gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
                                    <div class="font-medium text-slate-200 min-w-0 flex-1">
                                      {prj.name}
                                    </div>
                                    <div class="font-mono text-xs text-sky-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 shrink-0">
                                      ID: {prj.id}
                                    </div>
                                    <span
                                      class={`px-2.5 py-1 rounded text-xs font-medium capitalize shrink-0 ${prj.status === "active"
                                          ? "bg-sky-950 text-sky-400 border border-sky-800"
                                          : "bg-slate-900 text-slate-400 border border-slate-800"
                                        }`}
                                    >
                                      {prj.status}
                                    </span>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );

  return (
    <div class="max-w-4xl mx-auto space-y-8">
      {/* Toast Notification */}
      <Show when={savedSuccess()}>
        <div class="fixed bottom-6 right-6 z-50 bg-slate-900 border border-sky-500/60 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-toast pointer-events-none transform-gpu">
          <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm font-medium">{toastMsg()}</span>
        </div>
      </Show>

      {/* Confirmation Modal 1: Unlock Field Notice */}
      <ConfirmationModal
        isOpen={isUnlockModalOpen()}
        title="Unlock Field to Change Hubstaff Account"
        warningText="⚠️ Notice: Account Change Warning"
        description="Unlocking this field allows you to enter a new Hubstaff Personal Access Token. Please note that submitting and connecting a new account will wipe all existing data (logged tasks, timer events, and time totals). You can cancel at any time before submitting a new token to keep your existing account and data intact."
        confirmText="Unlock Field"
        cancelText="Keep Connected Account"
        isDestructive={false}
        isLoading={isPatLoading()}
        onConfirm={handleConfirmUnlock}
        onCancel={() => setIsUnlockModalOpen(false)}
      />

      {/* Confirmation Modal 2: Submit & Wipe Confirmation */}
      <ConfirmationModal
        isOpen={isSubmitModalOpen()}
        title="Confirm New Hubstaff Account Connection"
        warningText="🚨 Critical Warning: Permanent Data Reset"
        description="Submitting and connecting this new Hubstaff account will permanently delete all existing task logs, activity history, and metrics for the currently connected user. This action cannot be undone. Are you sure you want to proceed?"
        confirmText="Wipe Existing Data & Connect New Account"
        cancelText="Back to Settings"
        isDestructive={true}
        isLoading={isPatLoading()}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setIsSubmitModalOpen(false)}
      />

      {/* Header */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <div class="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Configuration & API Integration</span>
          </div>
          <h1 class="text-2xl font-extrabold text-white tracking-tight">Application Settings</h1>
          <p class="text-slate-400 text-sm mt-1">
            Manage Hubstaff Personal Access Token (PAT) authentication, sync start date, role defaults, and AHT thresholds.
          </p>
        </div>
      </div>

      {/* POSITION 1: FRESH INSTALL / DISCONNECTED STATE -> Render PAT Auth Card at VERY TOP */}
      <Show when={!isUserConnected()}>
        {renderHubstaffAuthSection()}
      </Show>

      {/* MAIN SETTINGS FORM */}
      <form onSubmit={handleSaveSettings} class="space-y-8">

        {/* CARD 1: Default User Role */}
        <Show when={getUserAvailableRoles().length > 1}>
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
              <label
                class={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${defaultRole() === "Trainer"
                    ? "bg-sky-950/60 border-sky-500/80 shadow-md shadow-sky-950"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  }`}
              >
                <input
                  type="radio"
                  name="defaultRole"
                  value="Trainer"
                  checked={defaultRole() === "Trainer"}
                  onChange={() => setDefaultRole("Trainer")}
                  class="w-4 h-4 text-sky-500 focus:ring-sky-500 bg-slate-900 border-slate-700"
                />
                <div class="ml-3">
                  <span class="block text-sm font-bold text-white">Trainer</span>
                  <span class="block text-xs text-slate-400 mt-0.5">
                    Subroles: Trainer 1, Trainer 2
                  </span>
                </div>
              </label>

              <label
                class={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${defaultRole() === "Reviewer"
                    ? "bg-purple-950/60 border-purple-500/80 shadow-md shadow-purple-950"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  }`}
              >
                <input
                  type="radio"
                  name="defaultRole"
                  value="Reviewer"
                  checked={defaultRole() === "Reviewer"}
                  onChange={() => setDefaultRole("Reviewer")}
                  class="w-4 h-4 text-purple-500 focus:ring-purple-500 bg-slate-900 border-slate-700"
                />
                <div class="ml-3">
                  <span class="block text-sm font-bold text-white">Reviewer</span>
                  <span class="block text-xs text-slate-400 mt-0.5">
                    Subroles: Completion Reviewer, Quality Reviewer
                  </span>
                </div>
              </label>
            </div>
          </div>
        </Show>

        {/* CARD 2: Role AHT Thresholds */}
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

          <div class={getUserAvailableRoles().length > 1 ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "grid grid-cols-1 gap-6"}>
            <Show when={getUserAvailableRoles().includes("Trainer")}>
              <div class="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div class="flex items-center space-x-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
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

                <div>
                  <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Onboarding Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    value={trainerOnboarding()}
                    onInput={(e) => setTrainerOnboarding(parseInt(e.currentTarget.value) || 0)}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p class="text-[11px] text-slate-400 mt-1">
                    Billed time excluded from Global Effective AHT calculation.
                  </p>
                </div>
              </div>
            </Show>

            <Show when={getUserAvailableRoles().includes("Reviewer")}>
              <div class="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div class="flex items-center space-x-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
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

                <div>
                  <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Onboarding Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    value={reviewerOnboarding()}
                    onInput={(e) => setReviewerOnboarding(parseInt(e.currentTarget.value) || 0)}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p class="text-[11px] text-slate-400 mt-1">
                    Billed time excluded from Global Effective AHT calculation.
                  </p>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* CARD 3: Hubstaff Data Sync Start Date */}
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
            <div class="flex-1 max-w-sm">
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Tracking Start Date
              </label>

              <div
                onClick={() => dateInputRef?.showPicker()}
                title="Open calendar picker"
                class="relative w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-xl px-4 py-2.5 flex items-center justify-between cursor-pointer transition-all focus-within:ring-2 focus-within:ring-sky-500 group shadow-sm"
              >
                <span class="text-slate-100 text-sm font-semibold tracking-wide">
                  {formatHumanDate(trackingStartDate())}
                </span>

                <div class="flex items-center space-x-2 text-slate-300 group-hover:text-white">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>

                <input
                  ref={dateInputRef}
                  type="date"
                  value={trackingStartDate()}
                  onInput={(e) => setTrackingStartDate(e.currentTarget.value)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker();
                    } catch (err) { }
                  }}
                  class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            </div>

            <div class="pt-0 sm:pt-6">
              <button
                type="button"
                onClick={handleSyncFromStartDate}
                disabled={isSyncing()}
                class="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-950 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <svg class={`w-4 h-4 text-white ${isSyncing() ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{isSyncing() ? "Syncing..." : "Sync Hubstaff Data"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Save Settings Action Button */}
        <div class="flex items-center justify-end pt-2">
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

      {/* POSITION 2: CONNECTED STATE -> Render PAT Auth Card at VERY BOTTOM below Save Settings */}
      <Show when={isUserConnected()}>
        <div class="pt-6 border-t border-slate-800/80 space-y-3">
          <div class="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Hubstaff Account Management</span>
          </div>
          {renderHubstaffAuthSection()}
        </div>
      </Show>
    </div>
  );
}
