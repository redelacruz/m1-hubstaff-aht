import { createSignal, createEffect, For, Show, onMount } from "solid-js";
import {
  Role,
  HubstaffTimeAdjustment,
  timeAdjustments,
  addTimeAdjustment,
  updateTimeAdjustment,
  deleteTimeAdjustment,
  formatDuration,
  parsePastedTimestamp,
  toLocalDateTimeLocalString,
  fetchHubstaffStatusFromBackend,
  fetchTimeAdjustmentsFromBackend,
} from "../lib/store";
import { ConfirmationModal } from "../components/ConfirmationModal";

export default function TimeAdjustmentsPage() {
  onMount(() => {
    fetchHubstaffStatusFromBackend();
    fetchTimeAdjustmentsFromBackend();
  });
  // Filters & Search
  const [filterRole, setFilterRole] = createSignal<Role | "All">("All");
  const [filterType, setFilterType] = createSignal<"All" | "addition" | "deletion">("All");
  const [searchQuery, setSearchQuery] = createSignal<string>("");
  const [currentPage, setCurrentPage] = createSignal<number>(1);
  const [pageSize, setPageSize] = createSignal<number>(25);

  // Toast Signal
  const [toastMsg, setToastMsg] = createSignal<string>("");

  // Modal Signals (Add / Edit)
  const [isModalOpen, setIsModalOpen] = createSignal<boolean>(false);
  const [editingAdj, setEditingAdj] = createSignal<HubstaffTimeAdjustment | null>(null);

  // Form Signals (Hours, Minutes, Seconds)
  const [formRole, setFormRole] = createSignal<Role>("Reviewer");
  const [formType, setFormType] = createSignal<"addition" | "deletion">("addition");
  const [formHours, setFormHours] = createSignal<number>(0);
  const [formMins, setFormMins] = createSignal<number>(15);
  const [formSecs, setFormSecs] = createSignal<number>(0);
  const [formReason, setFormReason] = createSignal<string>("");
  const [formDateTime, setFormDateTime] = createSignal<string>("");

  // Delete Modal Signals
  const [deletingAdj, setDeletingAdj] = createSignal<HubstaffTimeAdjustment | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = createSignal<boolean>(false);

  let dateTimeInputRef: HTMLInputElement | undefined;

  const formatLocalDateTimeLocal = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const formatHHMMSS = (totalSeconds: number): string => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00:00";
    const h = Math.floor(totalSeconds / 3600);
    const r = totalSeconds % 3600;
    const m = Math.floor(r / 60);
    const s = Math.floor(r % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const openAddModal = () => {
    setEditingAdj(null);
    setFormRole("Reviewer");
    setFormType("addition");
    setFormHours(0);
    setFormMins(15);
    setFormSecs(0);
    setFormReason("");
    setFormDateTime(formatLocalDateTimeLocal(new Date()));
    setIsModalOpen(true);
  };

  const openEditModal = (adj: HubstaffTimeAdjustment) => {
    setEditingAdj(adj);
    setFormRole(adj.role);
    setFormType(adj.adjustmentType);

    const totalSecs = adj.amountSeconds;
    setFormHours(Math.floor(totalSecs / 3600));
    const remSecs = totalSecs % 3600;
    setFormMins(Math.floor(remSecs / 60));
    setFormSecs(remSecs % 60);
    setFormReason(adj.reason);
    
    const dt = new Date(adj.createdAt);
    if (!isNaN(dt.getTime())) {
      setFormDateTime(toLocalDateTimeLocalString(dt));
    } else {
      setFormDateTime(formatLocalDateTimeLocal(new Date()));
    }
    setIsModalOpen(true);
  };

  const handleClipboardPaste = async (currentVal: string, setter: (v: string) => void) => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const parsed = parsePastedTimestamp(text, currentVal);
          if (parsed) {
            setter(parsed);
          } else {
            alert(`Could not parse pasted timestamp: "${text}"`);
          }
        }
      }
    } catch (e) {
      console.warn("Clipboard paste access error:", e);
    }
  };

  const handlePasteTimestamp = (e: ClipboardEvent, currentVal: string, setter: (v: string) => void) => {
    const pastedText = e.clipboardData?.getData("text") || e.clipboardData?.getData("text/plain");
    if (pastedText) {
      const parsed = parsePastedTimestamp(pastedText, currentVal);
      if (parsed) {
        e.preventDefault();
        setter(parsed);
      }
    }
  };

  const handleSaveModal = (e: Event) => {
    e.preventDefault();
    if (!formReason().trim()) {
      alert("Please provide a reason for the time adjustment.");
      return;
    }

    const totalSeconds = Math.max(0, formHours() * 3600 + formMins() * 60 + formSecs());
    if (totalSeconds <= 0) {
      alert("Please specify an adjustment duration greater than 0 seconds.");
      return;
    }

    let createdIso = new Date().toISOString();
    if (formDateTime()) {
      const dt = new Date(formDateTime());
      if (!isNaN(dt.getTime())) {
        createdIso = dt.toISOString();
      }
    }

    if (editingAdj()) {
      updateTimeAdjustment(editingAdj()!.id, {
        role: formRole(),
        adjustmentType: formType(),
        amountSeconds: totalSeconds,
        reason: formReason().trim(),
        createdAt: createdIso,
      });
      setToastMsg("Time adjustment updated successfully.");
    } else {
      addTimeAdjustment({
        role: formRole(),
        adjustmentType: formType(),
        amountSeconds: totalSeconds,
        reason: formReason().trim(),
        createdAt: createdIso,
      });
      setToastMsg("Time adjustment added successfully.");
    }

    setIsModalOpen(false);
    setTimeout(() => setToastMsg(""), 3500);
  };

  const openDeleteModal = (adj: HubstaffTimeAdjustment) => {
    setDeletingAdj(adj);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (deletingAdj()) {
      deleteTimeAdjustment(deletingAdj()!.id);
      setToastMsg("Time adjustment deleted.");
      setTimeout(() => setToastMsg(""), 3000);
    }
    setIsDeleteModalOpen(false);
  };

  // Metrics Calculations
  const calcMetrics = () => {
    let trainerAdd = 0, trainerDel = 0;
    let reviewerAdd = 0, reviewerDel = 0;

    for (const a of timeAdjustments) {
      if (a.role === "Trainer") {
        if (a.adjustmentType === "addition") trainerAdd += a.amountSeconds;
        else trainerDel += a.amountSeconds;
      } else if (a.role === "Reviewer") {
        if (a.adjustmentType === "addition") reviewerAdd += a.amountSeconds;
        else reviewerDel += a.amountSeconds;
      }
    }

    return {
      trainerAdd,
      trainerDel,
      trainerNet: trainerAdd - trainerDel,
      reviewerAdd,
      reviewerDel,
      reviewerNet: reviewerAdd - reviewerDel,
      totalNet: (trainerAdd - trainerDel) + (reviewerAdd - reviewerDel),
      count: timeAdjustments.length,
    };
  };

  // Filtered List
  const filteredAdjustments = () => {
    const r = filterRole();
    const t = filterType();
    const q = searchQuery().toLowerCase().trim();

    return timeAdjustments.filter((adj) => {
      if (r !== "All" && adj.role !== r) return false;
      if (t !== "All" && adj.adjustmentType !== t) return false;
      if (q && !adj.reason.toLowerCase().includes(q)) return false;
      return true;
    });
  };

  const totalPages = () => Math.max(1, Math.ceil(filteredAdjustments().length / pageSize()));

  const paginatedAdjustments = () => {
    const start = (currentPage() - 1) * pageSize();
    return filteredAdjustments().slice(start, start + pageSize());
  };

  const formatDateTimeDisplay = (isoStr: string) => {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const formatNetAdjustmentDisplay = (netSeconds: number) => {
    const sign = netSeconds > 0 ? "+" : netSeconds < 0 ? "-" : "+";
    const formatted = formatHHMMSS(Math.abs(netSeconds));
    let colorClass = "text-white";
    if (netSeconds > 0) colorClass = "text-emerald-400";
    else if (netSeconds < 0) colorClass = "text-rose-400";

    return { text: `${sign}${formatted}`, colorClass };
  };

  return (
    <div class="space-y-8">
      {/* Toast Notification */}
      <Show when={toastMsg()}>
        <div class="fixed bottom-6 right-6 z-50 bg-slate-900 border border-sky-500/60 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-toast pointer-events-none transform-gpu">
          <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm font-medium">{toastMsg()}</span>
        </div>
      </Show>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen()}
        title="Delete Time Adjustment"
        warningText="Action cannot be undone"
        description={`Are you sure you want to delete this ${deletingAdj()?.adjustmentType || ""} entry for ${deletingAdj()?.role || ""} (${formatHHMMSS(deletingAdj()?.amountSeconds || 0)})? Net Hubstaff billed time will be recalculated.`}
        confirmText="Delete Adjustment"
        isDestructive={true}
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      {/* Top Banner Context Note */}
      <div class="bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-sky-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Manual Time Adjustments</span>
            </div>
            <h1 class="text-2xl font-extrabold text-white tracking-tight">Hubstaff Time Adjustments Log</h1>
            <p class="text-slate-400 text-sm mt-1 max-w-2xl">
              Record manual additions and deletions to Hubstaff billed hours to account for offline work, manual time edits, or break deductions.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            class="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-sky-950 transition-all flex items-center space-x-2 self-start md:self-auto"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add Time Adjustment</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Trainer Net Adjustment */}
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Trainer Time Adjustments</span>
            <span class="text-xs font-mono font-bold px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-900 rounded">Trainer</span>
          </div>
          {(() => {
            const m = formatNetAdjustmentDisplay(calcMetrics().trainerNet);
            return (
              <div class={`text-2xl font-extrabold font-mono my-1 ${m.colorClass}`}>
                {m.text}
              </div>
            );
          })()}
          <div class="flex justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Additions: <strong class="text-emerald-400 font-mono">+{formatHHMMSS(calcMetrics().trainerAdd)}</strong></span>
            <span>Deletions: <strong class="text-rose-400 font-mono">-{formatHHMMSS(calcMetrics().trainerDel)}</strong></span>
          </div>
        </div>

        {/* Reviewer Net Adjustment */}
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Reviewer Time Adjustments</span>
            <span class="text-xs font-mono font-bold px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-900 rounded">Reviewer</span>
          </div>
          {(() => {
            const m = formatNetAdjustmentDisplay(calcMetrics().reviewerNet);
            return (
              <div class={`text-2xl font-extrabold font-mono my-1 ${m.colorClass}`}>
                {m.text}
              </div>
            );
          })()}
          <div class="flex justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Additions: <strong class="text-emerald-400 font-mono">+{formatHHMMSS(calcMetrics().reviewerAdd)}</strong></span>
            <span>Deletions: <strong class="text-rose-400 font-mono">-{formatHHMMSS(calcMetrics().reviewerDel)}</strong></span>
          </div>
        </div>

        {/* Total Overall Net */}
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Net Hubstaff Billed Impact</span>
            <span class="text-xs font-mono font-bold px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded">{calcMetrics().count} Records</span>
          </div>
          {(() => {
            const m = formatNetAdjustmentDisplay(calcMetrics().totalNet);
            return (
              <div class={`text-2xl font-extrabold font-mono my-1 ${m.colorClass}`}>
                {m.text}
              </div>
            );
          })()}
          <div class="text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            Net adjustment added/subtracted from Hubstaff totals
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        {/* Controls Row */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div class="flex flex-wrap items-center gap-3">
            {/* Role Filter */}
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Role</label>
              <select
                value={filterRole()}
                onChange={(e) => {
                  setFilterRole(e.currentTarget.value as Role | "All");
                  setCurrentPage(1);
                }}
                class="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="All">All Roles</option>
                <option value="Trainer">Trainer</option>
                <option value="Reviewer">Reviewer</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Type</label>
              <select
                value={filterType()}
                onChange={(e) => {
                  setFilterType(e.currentTarget.value as "All" | "addition" | "deletion");
                  setCurrentPage(1);
                }}
                class="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="All">All Types</option>
                <option value="addition">Additions (+)</option>
                <option value="deletion">Deletions (-)</option>
              </select>
            </div>

            {/* Search Input */}
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Search Reason</label>
              <input
                type="text"
                placeholder="Search description..."
                value={searchQuery()}
                onInput={(e) => {
                  setSearchQuery(e.currentTarget.value);
                  setCurrentPage(1);
                }}
                class="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 placeholder-slate-500 focus:outline-none min-w-[200px]"
              />
            </div>
          </div>

          <div class="text-xs text-slate-400">
            Showing <strong class="text-slate-200">{filteredAdjustments().length}</strong> adjustment entries
          </div>
        </div>

        {/* Adjustments Table */}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th class="py-3 px-4">Date & Time</th>
                <th class="py-3 px-4">Role</th>
                <th class="py-3 px-4">Type</th>
                <th class="py-3 px-4">Duration (HH:MM:SS)</th>
                <th class="py-3 px-4">Reason / Notes</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-medium">
              <Show
                when={paginatedAdjustments().length > 0}
                fallback={
                  <tr>
                    <td colSpan={6} class="py-8 text-center text-slate-500">
                      No time adjustment records found.
                    </td>
                  </tr>
                }
              >
                <For each={paginatedAdjustments()}>
                  {(adj) => (
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-4 font-mono text-slate-200 whitespace-nowrap">
                        {formatDateTimeDisplay(adj.createdAt)}
                      </td>
                      <td class="py-3 px-4">
                        <span
                          class={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            adj.role === "Trainer"
                              ? "bg-sky-950 text-sky-300 border border-sky-900"
                              : "bg-purple-950 text-purple-300 border border-purple-900"
                          }`}
                        >
                          {adj.role}
                        </span>
                      </td>
                      <td class="py-3 px-4">
                        <span
                          class={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            adj.adjustmentType === "addition"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-900"
                              : "bg-rose-950 text-rose-300 border border-rose-900"
                          }`}
                        >
                          {adj.adjustmentType === "addition" ? "+ Addition" : "- Deletion"}
                        </span>
                      </td>
                      <td class="py-3 px-4 font-mono font-bold whitespace-nowrap">
                        <span class={adj.adjustmentType === "addition" ? "text-emerald-400" : "text-rose-400"}>
                          {adj.adjustmentType === "addition" ? "+" : "-"}{formatHHMMSS(adj.amountSeconds)}
                        </span>
                      </td>
                      <td class="py-3 px-4 text-slate-300 max-w-md break-words">
                        {adj.reason}
                      </td>
                      <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(adj)}
                          title="Edit Adjustment"
                          class="text-sky-400 hover:text-sky-300 p-1.5 rounded hover:bg-sky-950/40 transition-colors"
                        >
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteModal(adj)}
                          title="Delete Adjustment"
                          class="text-slate-500 hover:text-rose-400 p-1.5 rounded hover:bg-rose-950/40 transition-colors"
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

        {/* Pagination Controls */}
        <Show when={totalPages() > 1}>
          <div class="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
            <div>
              Page <strong>{currentPage()}</strong> of <strong>{totalPages()}</strong>
            </div>
            <div class="flex items-center space-x-2">
              <button
                type="button"
                disabled={currentPage() === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                class="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage() >= totalPages()}
                onClick={() => setCurrentPage((p) => Math.min(totalPages(), p + 1))}
                class="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* Add / Edit Time Adjustment Modal */}
      <Show when={isModalOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 class="text-lg font-bold text-white flex items-center space-x-2">
                  <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{editingAdj() ? "Edit Time Adjustment" : "Add Time Adjustment"}</span>
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">
                  Record an addition or deduction to Hubstaff billed hours.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveModal} class="space-y-4">
              {/* Role & Adjustment Type Row */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Role <span class="text-rose-400">*</span>
                  </label>
                  <select
                    value={formRole()}
                    onChange={(e) => setFormRole(e.currentTarget.value as Role)}
                    class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="Trainer">Trainer</option>
                    <option value="Reviewer">Reviewer</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Adjustment Type <span class="text-rose-400">*</span>
                  </label>
                  <select
                    value={formType()}
                    onChange={(e) => setFormType(e.currentTarget.value as "addition" | "deletion")}
                    class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="addition">Addition (+ Hours)</option>
                    <option value="deletion">Deletion (- Hours)</option>
                  </select>
                </div>
              </div>

              {/* Date & Time Picker */}
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Date & Time <span class="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleClipboardPaste(formDateTime(), setFormDateTime)}
                    class="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center space-x-1 hover:underline"
                    title="Paste timestamp directly from system clipboard"
                  >
                    <span>📋 Paste</span>
                  </button>
                </div>
                <div class="relative flex items-center">
                  <input
                    ref={(el) => (dateTimeInputRef = el)}
                    type="datetime-local"
                    step="1"
                    required
                    value={formDateTime()}
                    onPaste={(e) => handlePasteTimestamp(e, formDateTime(), setFormDateTime)}
                    onInput={(e) => setFormDateTime(e.currentTarget.value)}
                    class="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-9 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => dateTimeInputRef?.showPicker?.()}
                    class="absolute right-2.5 text-slate-400 hover:text-white p-1 transition-colors"
                    title="Open calendar picker"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Duration (HH:MM:SS) Inputs - No Limit */}
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Adjustment Duration (HH:MM:SS) <span class="text-rose-400">*</span>
                </label>
                <div class="flex items-center space-x-2">
                  <div class="flex-1 relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      value={formHours()}
                      onInput={(e) => setFormHours(Math.max(0, parseInt(e.currentTarget.value) || 0))}
                      class="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-7 py-2.5 text-sm text-slate-100 font-mono text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="00"
                    />
                    <span class="absolute right-2.5 text-xs text-slate-500 font-mono">h</span>
                  </div>
                  <span class="text-slate-400 font-bold font-mono text-sm">:</span>
                  <div class="flex-1 relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={formMins()}
                      onInput={(e) => setFormMins(Math.min(59, Math.max(0, parseInt(e.currentTarget.value) || 0)))}
                      class="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-7 py-2.5 text-sm text-slate-100 font-mono text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="00"
                    />
                    <span class="absolute right-2.5 text-xs text-slate-500 font-mono">m</span>
                  </div>
                  <span class="text-slate-400 font-bold font-mono text-sm">:</span>
                  <div class="flex-1 relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={formSecs()}
                      onInput={(e) => setFormSecs(Math.min(59, Math.max(0, parseInt(e.currentTarget.value) || 0)))}
                      class="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-7 py-2.5 text-sm text-slate-100 font-mono text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="00"
                    />
                    <span class="absolute right-2.5 text-xs text-slate-500 font-mono">s</span>
                  </div>
                </div>
              </div>

              {/* Reason / Notes */}
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Reason / Explanation <span class="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe why this time addition/deletion is being recorded..."
                  value={formReason()}
                  onInput={(e) => setFormReason(e.currentTarget.value)}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                ></textarea>
              </div>

              {/* Modal Action Buttons */}
              <div class="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  class="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-950 transition-colors"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
