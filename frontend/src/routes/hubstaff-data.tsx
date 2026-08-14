import { createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import {
  hubstaffEvents,
  syncHubstaffTrackingStatesFromBackend,
  fetchLocalHubstaffEvents,
  settings,
  updateUserSettings,
} from "../lib/store";

export default function HubstaffDataPage() {
  let startDateInputRef: HTMLInputElement | undefined;
  let endDateInputRef: HTMLInputElement | undefined;

  const [currentPage, setCurrentPage] = createSignal<number>(1);
  const [pageSize, setPageSize] = createSignal<number>(settings.hubstaffPageSize || 25);
  const [toastMsg, setToastMsg] = createSignal<string>("");
  const [isSyncing, setIsSyncing] = createSignal<boolean>(false);

  // Auto-refresh events from local database every 5 seconds for (semi-)real time updates
  onMount(() => {
    fetchLocalHubstaffEvents();
    const interval = setInterval(() => {
      fetchLocalHubstaffEvents();
    }, 5000);
    onCleanup(() => clearInterval(interval));
  });

  // Sorting & Filtering State
  const [sortOrder, setSortOrder] = createSignal<"desc" | "asc">("desc"); // Default: reverse chronological (newest first)
  const [startDateFilter, setStartDateFilter] = createSignal<string>("");
  const [endDateFilter, setEndDateFilter] = createSignal<string>("");
  const [eventNameFilter, setEventNameFilter] = createSignal<string>("all");
  const [projectNameFilter, setProjectNameFilter] = createSignal<string>("");
  const [projectIdFilter, setProjectIdFilter] = createSignal<string>("");

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    updateUserSettings({ hubstaffPageSize: size });
    setCurrentPage(1);
  };

  const handleSyncClick = async () => {
    setIsSyncing(true);
    const result = await syncHubstaffTrackingStatesFromBackend();
    setIsSyncing(false);
    if (result.success) {
      setToastMsg(`Synced ${result.events_count} Hubstaff tracking events! Start Date: ${settings.trackingStartDate}`);
    } else {
      setToastMsg("Hubstaff tracking states sync complete.");
    }
    setTimeout(() => setToastMsg(""), 4000);
  };

  const handleResetFilters = () => {
    setStartDateFilter("");
    setEndDateFilter("");
    setEventNameFilter("all");
    setProjectNameFilter("");
    setProjectIdFilter("");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  const isAnyFilterActive = () => {
    return (
      startDateFilter() !== "" ||
      endDateFilter() !== "" ||
      eventNameFilter() !== "all" ||
      projectNameFilter() !== "" ||
      projectIdFilter() !== "" ||
      sortOrder() !== "desc"
    );
  };

  // Filter & Sort Pipeline
  const filteredAndSortedEvents = () => {
    let list = [...hubstaffEvents];

    // Filter by Start Date
    if (startDateFilter()) {
      const startMs = new Date(`${startDateFilter()}T00:00:00`).getTime();
      if (!isNaN(startMs)) {
        list = list.filter((evt) => new Date(evt.eventTime).getTime() >= startMs);
      }
    }

    // Filter by End Date
    if (endDateFilter()) {
      const endMs = new Date(`${endDateFilter()}T23:59:59.999`).getTime();
      if (!isNaN(endMs)) {
        list = list.filter((evt) => new Date(evt.eventTime).getTime() <= endMs);
      }
    }

    // Filter by Event Name
    if (eventNameFilter() !== "all") {
      list = list.filter((evt) => evt.eventName === eventNameFilter());
    }

    // Filter by Project Name
    if (projectNameFilter().trim()) {
      const q = projectNameFilter().trim().toLowerCase();
      list = list.filter((evt) => evt.projectName.toLowerCase().includes(q));
    }

    // Filter by Project ID
    if (projectIdFilter().trim()) {
      const q = projectIdFilter().trim().toLowerCase();
      list = list.filter((evt) => evt.projectId.toLowerCase().includes(q));
    }

    // Sort by eventTime (desc = reverse chronological / newest first, asc = oldest first)
    list.sort((a, b) => {
      const timeA = new Date(a.eventTime).getTime();
      const timeB = new Date(b.eventTime).getTime();

      if (timeA !== timeB) {
        return sortOrder() === "desc" ? timeB - timeA : timeA - timeB;
      }

      // Secondary Tie-breaker for identical eventTime (e.g. blip events within the same second):
      // In reverse chronological order ("desc", newest first): "Timer Stopped" is newer than "Timer Started"
      // In chronological order ("asc", oldest first): "Timer Started" is older than "Timer Stopped"
      if (a.eventName !== b.eventName) {
        const aIsStop = a.eventName.toLowerCase().includes("stop");
        const bIsStop = b.eventName.toLowerCase().includes("stop");
        if (aIsStop !== bIsStop) {
          if (sortOrder() === "desc") {
            return aIsStop ? -1 : 1;
          } else {
            return aIsStop ? 1 : -1;
          }
        }
      }

      // Tertiary tie-breaker by ID for deterministic stable sorting
      return sortOrder() === "desc" ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
    });

    return list;
  };

  const totalFilteredCount = () => filteredAndSortedEvents().length;
  const totalPages = () => Math.max(1, Math.ceil(totalFilteredCount() / pageSize()));

  const paginatedEvents = () => {
    const start = (currentPage() - 1) * pageSize();
    return filteredAndSortedEvents().slice(start, start + pageSize());
  };

  return (
    <div class="space-y-8">
      {/* Toast Notification */}
      <Show when={toastMsg()}>
        <Portal>
          <div class="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-500/60 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-toast pointer-events-none transform-gpu">
            <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="text-sm font-medium">{toastMsg()}</span>
          </div>
        </Portal>
      </Show>

      {/* Header & Sync Button */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div class="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Hubstaff Webhook Data Ingestion</span>
          </div>
          <h1 class="text-2xl font-extrabold text-white tracking-tight">Hubstaff Raw Event Log</h1>
          <p class="text-slate-400 text-sm mt-1">
            Ingested webhook telemetry for timer start and timer stop events.
          </p>
        </div>

        {/* Sync Button */}
        <div class="flex items-center space-x-3">
          <button
            onClick={handleSyncClick}
            disabled={isSyncing()}
            class="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-950 transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            <svg class={`w-4 h-4 ${isSyncing() ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isSyncing() ? "Syncing Hubstaff Data..." : "Sync Data from Hubstaff"}</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        
        {/* Filters Controls Panel */}
        <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2 text-xs font-semibold text-slate-300">
              <svg class="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>Filter & Sort Controls</span>
            </div>
            
            <div class="flex items-center space-x-3">
              {/* Sort Order Toggle Button */}
              <button
                onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
                class="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-sky-500 text-sky-300 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all shadow-sm"
              >
                <span>Sort: {sortOrder() === "desc" ? "Newest First" : "Oldest First"}</span>
                <span class="text-sky-400 font-bold">{sortOrder() === "desc" ? "↓" : "↑"}</span>
              </button>

              <Show when={isAnyFilterActive()}>
                <button
                  onClick={handleResetFilters}
                  class="px-3 py-1.5 bg-rose-950/50 border border-rose-800/60 hover:bg-rose-900/60 text-rose-300 rounded-lg text-xs font-medium transition-all"
                >
                  Reset Filters
                </button>
              </Show>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            {/* Start Date */}
            <div>
              <label class="block text-[11px] font-medium text-slate-400 mb-1">Start Date</label>
              <div class="relative flex items-center">
                <input
                  ref={(el) => (startDateInputRef = el)}
                  type="date"
                  value={startDateFilter()}
                  onInput={(e) => {
                    setStartDateFilter(e.currentTarget.value);
                    setCurrentPage(1);
                  }}
                  class="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => startDateInputRef?.showPicker?.()}
                  class="absolute right-2 text-slate-400 hover:text-white p-1 transition-colors"
                  title="Open calendar picker"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* End Date */}
            <div>
              <label class="block text-[11px] font-medium text-slate-400 mb-1">End Date</label>
              <div class="relative flex items-center">
                <input
                  ref={(el) => (endDateInputRef = el)}
                  type="date"
                  value={endDateFilter()}
                  onInput={(e) => {
                    setEndDateFilter(e.currentTarget.value);
                    setCurrentPage(1);
                  }}
                  class="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => endDateInputRef?.showPicker?.()}
                  class="absolute right-2 text-slate-400 hover:text-white p-1 transition-colors"
                  title="Open calendar picker"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Event Name Filter */}
            <div>
              <label class="block text-[11px] font-medium text-slate-400 mb-1">Event Type</label>
              <select
                value={eventNameFilter()}
                onChange={(e) => {
                  setEventNameFilter(e.currentTarget.value);
                  setCurrentPage(1);
                }}
                class="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="all">All Events</option>
                <option value="Timer Started">Timer Started</option>
                <option value="Timer Stopped">Timer Stopped</option>
              </select>
            </div>

            {/* Project Name Filter */}
            <div>
              <label class="block text-[11px] font-medium text-slate-400 mb-1">Project Name</label>
              <input
                type="text"
                placeholder="Filter by project..."
                value={projectNameFilter()}
                onInput={(e) => {
                  setProjectNameFilter(e.currentTarget.value);
                  setCurrentPage(1);
                }}
                class="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Project ID Filter */}
            <div>
              <label class="block text-[11px] font-medium text-slate-400 mb-1">Project ID</label>
              <input
                type="text"
                placeholder="Filter by ID..."
                value={projectIdFilter()}
                onInput={(e) => {
                  setProjectIdFilter(e.currentTarget.value);
                  setCurrentPage(1);
                }}
                class="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Status Bar / Page Size Header */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
          <div class="text-xs text-slate-400">
            Showing events for window: <span class="text-sky-300 font-mono font-bold">{settings.trackingStartDate}</span> to Present
            <Show when={isAnyFilterActive()}>
              <span class="ml-2 text-amber-400 font-medium">(Filtered: {totalFilteredCount()} of {hubstaffEvents.length})</span>
            </Show>
          </div>

          {/* Page Size Selector */}
          <div class="flex items-center space-x-2 text-xs text-slate-400 self-end sm:self-auto">
            <span>Items per page:</span>
            <select
              value={pageSize()}
              onChange={(e) => handlePageSizeChange(parseInt(e.currentTarget.value))}
              class="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 bg-slate-950/40">
                <th class="py-3 px-4">Event Name</th>
                <th
                  onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
                  class="py-3 px-4 cursor-pointer hover:text-sky-400 transition-colors select-none"
                >
                  <div class="flex items-center space-x-1">
                    <span>Event Time</span>
                    <span class="text-sky-400">{sortOrder() === "desc" ? "↓" : "↑"}</span>
                  </div>
                </th>
                <th class="py-3 px-4">Project ID</th>
                <th class="py-3 px-4">Project Name</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <Show
                when={paginatedEvents().length > 0}
                fallback={
                  <tr>
                    <td colSpan={4} class="py-12 text-center text-slate-500">
                      {hubstaffEvents.length === 0
                        ? 'No Hubstaff events found. Click "Sync Data from Hubstaff" to fetch events.'
                        : 'No events match the current filter criteria.'}
                    </td>
                  </tr>
                }
              >
                <For each={paginatedEvents()}>
                  {(evt) => (
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="py-3.5 px-4 whitespace-nowrap">
                        <Show
                          when={evt.eventName === "Timer Started"}
                          fallback={
                            <span class="inline-flex items-center space-x-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-300">
                              <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                              <span>Timer Stopped</span>
                            </span>
                          }
                        >
                          <span class="inline-flex items-center space-x-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>Timer Started</span>
                          </span>
                        </Show>
                      </td>

                      <td class="py-3.5 px-4 text-slate-300 whitespace-nowrap font-mono">
                        {new Date(evt.eventTime).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>

                      <td class="py-3.5 px-4 text-slate-400 whitespace-nowrap font-mono font-semibold">
                        {evt.projectId}
                      </td>

                      <td class="py-3.5 px-4 text-slate-200 whitespace-nowrap font-medium">
                        {evt.projectName}
                      </td>
                    </tr>
                  )}
                </For>
              </Show>
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div class="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            Showing <span class="font-bold text-slate-200">{totalFilteredCount() > 0 ? (currentPage() - 1) * pageSize() + 1 : 0}</span> to{" "}
            <span class="font-bold text-slate-200">{Math.min(currentPage() * pageSize(), totalFilteredCount())}</span> of{" "}
            <span class="font-bold text-slate-200">{totalFilteredCount()}</span> filtered Hubstaff event records
          </div>

          <div class="flex items-center space-x-2 self-end sm:self-auto">
            <button
              disabled={currentPage() <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              class="px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            
            <span class="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono font-bold text-slate-200">
              Page {currentPage()} of {totalPages()}
            </span>

            <button
              disabled={currentPage() >= totalPages()}
              onClick={() => setCurrentPage((p) => Math.min(totalPages(), p + 1))}
              class="px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
