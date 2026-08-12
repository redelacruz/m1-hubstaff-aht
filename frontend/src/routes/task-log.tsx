import { createSignal, createEffect, For, Show } from "solid-js";
import {
  Role,
  TaskLogEntry,
  tasks,
  settings,
  updateUserSettings,
  updateTaskLog,
  deleteTaskLog,
  formatDuration,
  resetTaskLogsToSeed,
} from "../lib/store";
import { EditTaskModal } from "../components/EditTaskModal";

export default function TaskLogPage() {
  const [roleFilter, setRoleFilter] = createSignal<Role | "All">("All");
  const [searchQuery, setSearchQuery] = createSignal<string>("");
  const [currentPage, setCurrentPage] = createSignal<number>(1);
  const [pageSize, setPageSize] = createSignal<number>(settings.pageSize || 25);

  // Edit Modal Signals
  const [editingTask, setEditingTask] = createSignal<TaskLogEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = createSignal<boolean>(false);
  const [toastMsg, setToastMsg] = createSignal<string>("");

  // Persist page size changes to local storage
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    updateUserSettings({ pageSize: size });
    setCurrentPage(1);
  };

  // Filtered task logs
  const filteredTasks = () => {
    const query = searchQuery().toLowerCase().trim();
    const r = roleFilter();

    return tasks.filter((t) => {
      if (r !== "All" && t.role !== r) return false;
      if (query) {
        const titleMatch = t.title.toLowerCase().includes(query);
        const notesMatch = t.notes.toLowerCase().includes(query);
        const subroleMatch = t.subrole.toLowerCase().includes(query);
        return titleMatch || notesMatch || subroleMatch;
      }
      return true;
    });
  };

  const totalPages = () => Math.max(1, Math.ceil(filteredTasks().length / pageSize()));

  const paginatedTasks = () => {
    const start = (currentPage() - 1) * pageSize();
    return filteredTasks().slice(start, start + pageSize());
  };

  const openEditModal = (task: TaskLogEntry) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedTask = (id: string, updatedFields: Partial<TaskLogEntry>) => {
    updateTaskLog(id, updatedFields);
    setToastMsg("Task log item updated successfully.");
    setTimeout(() => setToastMsg(""), 3000);
  };

  return (
    <div class="space-y-8">
      {/* Toast Notification */}
      <Show when={toastMsg()}>
        <div class="fixed bottom-6 right-6 z-50 bg-slate-900 border border-sky-500/60 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-bounce">
          <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm font-medium">{toastMsg()}</span>
        </div>
      </Show>

      {/* Edit Modal */}
      <EditTaskModal
        task={editingTask()}
        isOpen={isEditModalOpen()}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEditedTask}
      />

      {/* Header */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div class="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Complete Audit Repository</span>
          </div>
          <h1 class="text-2xl font-extrabold text-white tracking-tight">Full Task Log Directory</h1>
          <p class="text-slate-400 text-sm mt-1">
            View, search, edit, and paginate all submitted task logs across roles.
          </p>
        </div>

        {/* Action / Reset */}
        <div class="flex items-center space-x-3">
          <button
            onClick={resetTaskLogsToSeed}
            class="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium text-xs rounded-xl transition-colors"
          >
            Reset Seed Tasks
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        
        {/* Controls Bar */}
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          
          {/* Search & Role Filters */}
          <div class="flex flex-wrap items-center gap-3">
            <div class="relative min-w-[220px]">
              <input
                type="text"
                placeholder="Search title, notes, subrole..."
                value={searchQuery()}
                onInput={(e) => {
                  setSearchQuery(e.currentTarget.value);
                  setCurrentPage(1);
                }}
                class="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <svg class="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div class="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => { setRoleFilter("All"); setCurrentPage(1); }}
                class={`px-3 py-1 rounded-lg transition-all ${
                  roleFilter() === "All" ? "bg-sky-600 text-white font-medium" : "text-slate-400"
                }`}
              >
                All Roles
              </button>
              <button
                onClick={() => { setRoleFilter("Trainer"); setCurrentPage(1); }}
                class={`px-3 py-1 rounded-lg transition-all ${
                  roleFilter() === "Trainer" ? "bg-sky-600 text-white font-medium" : "text-slate-400"
                }`}
              >
                Trainer
              </button>
              <button
                onClick={() => { setRoleFilter("Reviewer"); setCurrentPage(1); }}
                class={`px-3 py-1 rounded-lg transition-all ${
                  roleFilter() === "Reviewer" ? "bg-sky-600 text-white font-medium" : "text-slate-400"
                }`}
              >
                Reviewer
              </button>
            </div>
          </div>

          {/* Items Per Page Dropdown Selector */}
          <div class="flex items-center space-x-2 text-xs text-slate-400 self-end md:self-auto">
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
                when={paginatedTasks().length > 0}
                fallback={
                  <tr>
                    <td colSpan={6} class="py-12 text-center text-slate-500">
                      No task log entries found matching current filters.
                    </td>
                  </tr>
                }
              >
                <For each={paginatedTasks()}>
                  {(task) => (
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="py-3.5 px-4 text-slate-400 whitespace-nowrap font-mono">
                        {new Date(task.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td class="py-3.5 px-4 whitespace-nowrap">
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

                      <td class="py-3.5 px-4 max-w-xs sm:max-w-md">
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
                        <Show when={task.notes}>
                          <p class="text-[11px] text-slate-400 mt-1 italic">
                            "{task.notes}"
                          </p>
                        </Show>
                      </td>

                      <td class="py-3.5 px-4 whitespace-nowrap">
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
                      </td>

                      <td class="py-3.5 px-4 whitespace-nowrap font-mono">
                        <div class="text-sm font-bold text-white">
                          {task.timerMode === "untracked" ? "00:00 (0m)" : formatDuration(task.durationSeconds)}
                        </div>
                      </td>

                      <td class="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => openEditModal(task)}
                          title="Edit task entry details"
                          class="text-sky-400 hover:text-sky-300 p-1.5 rounded hover:bg-sky-950/40 transition-colors"
                        >
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteTaskLog(task.id)}
                          title="Delete task entry"
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

        {/* Pagination Footer Controls */}
        <div class="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            Showing <span class="font-bold text-slate-200">{filteredTasks().length > 0 ? (currentPage() - 1) * pageSize() + 1 : 0}</span> to{" "}
            <span class="font-bold text-slate-200">{Math.min(currentPage() * pageSize(), filteredTasks().length)}</span> of{" "}
            <span class="font-bold text-slate-200">{filteredTasks().length}</span> entries
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
