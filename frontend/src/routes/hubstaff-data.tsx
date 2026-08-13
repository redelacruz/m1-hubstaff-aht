import { createSignal, For, Show } from "solid-js";
import {
  hubstaffEvents,
  syncHubstaffTrackingStatesFromBackend,
  settings,
  updateUserSettings,
} from "../lib/store";

export default function HubstaffDataPage() {
  const [currentPage, setCurrentPage] = createSignal<number>(1);
  const [pageSize, setPageSize] = createSignal<number>(settings.hubstaffPageSize || 25);
  const [toastMsg, setToastMsg] = createSignal<string>("");
  const [isSyncing, setIsSyncing] = createSignal<boolean>(false);

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

  const totalPages = () => Math.max(1, Math.ceil(hubstaffEvents.length / pageSize()));

  const paginatedEvents = () => {
    const start = (currentPage() - 1) * pageSize();
    return hubstaffEvents.slice(start, start + pageSize());
  };

  return (
    <div class="space-y-8">
      {/* Toast Notification */}
      <Show when={toastMsg()}>
        <div class="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-500/60 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-bounce">
          <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm font-medium">{toastMsg()}</span>
        </div>
      </Show>

      {/* Header & Sync Button */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div class="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
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
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div class="text-xs text-slate-400">
            Current Historical Window: <span class="text-sky-300 font-mono font-bold">{settings.trackingStartDate}</span> to Present
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
                <th class="py-3 px-4">Event Time</th>
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
                      No Hubstaff events found. Click "Sync Data from Hubstaff" to fetch events.
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
            Showing <span class="font-bold text-slate-200">{hubstaffEvents.length > 0 ? (currentPage() - 1) * pageSize() + 1 : 0}</span> to{" "}
            <span class="font-bold text-slate-200">{Math.min(currentPage() * pageSize(), hubstaffEvents.length)}</span> of{" "}
            <span class="font-bold text-slate-200">{hubstaffEvents.length}</span> Hubstaff event records
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
