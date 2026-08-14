import { createSignal, createEffect, For, Show } from "solid-js";
import {
  Role,
  TaskLogEntry,
  tasks,
  updateTaskLog,
  deleteTaskLog,
  formatTaskDuration,
  getUserAvailableRoles,
} from "../lib/store";
import { EditTaskModal } from "../components/EditTaskModal";
import { TaskGroupModal } from "../components/TaskGroupModal";

export default function TaskLogPage() {
  // Filters & State
  const [roleFilter, setRoleFilter] = createSignal<Role | "All">("All");
  const [searchQuery, setSearchQuery] = createSignal<string>("");
  const [currentPage, setCurrentPage] = createSignal<number>(1);
  const [pageSize, setPageSize] = createSignal<number>(25);

  // Toast Signal
  const [showNotification, setShowNotification] = createSignal<boolean>(false);
  const [notificationMsg, setNotificationMsg] = createSignal<string>("");

  // Edit Modal Signals
  const [editingTask, setEditingTask] = createSignal<TaskLogEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = createSignal<boolean>(false);

  // Task Group Modal Signals
  const [isGroupModalOpen, setIsGroupModalOpen] = createSignal<boolean>(false);
  const [activeGroupData, setActiveGroupData] = createSignal<{
    subrole: string;
    title: string;
    tasks: TaskLogEntry[];
  }>({ subrole: "", title: "", tasks: [] });

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

  const filteredTasks = () => {
    const rFilter = roleFilter();
    const query = searchQuery().toLowerCase().trim();

    return tasks.filter((t) => {
      if (rFilter !== "All" && t.role !== rFilter) return false;
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

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
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

      {/* Task Group Breakdown Modal */}
      <TaskGroupModal
        isOpen={isGroupModalOpen()}
        subrole={activeGroupData().subrole}
        title={activeGroupData().title}
        groupTasks={activeGroupData().tasks}
        onClose={() => setIsGroupModalOpen(false)}
        onEditTask={openEditModal}
        onDeleteTask={(id) => {
          deleteTaskLog(id);
          const updated = tasks.filter((t) => t.subrole === activeGroupData().subrole && t.title === activeGroupData().title && t.title !== "Administrative Time");
          if (updated.length === 0) setIsGroupModalOpen(false);
          else setActiveGroupData((prev) => ({ ...prev, tasks: updated }));
        }}
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        task={editingTask()}
        isOpen={isEditModalOpen()}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEditedTask}
      />

      {/* Header Banner */}
      <div class="bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-sky-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Complete Historical Log</span>
            </div>
            <h1 class="text-2xl font-extrabold text-white tracking-tight">Task Log Directory</h1>
            <p class="text-slate-400 text-sm mt-1 max-w-2xl">
              Inspect all submitted task entries, task groups, durations, and notes across all roles and sessions.
            </p>
          </div>

          <div class="text-right">
            <span class="text-xs text-slate-400 block">Total Logged Entries:</span>
            <span class="text-xl font-extrabold text-white font-mono">{tasks.length} Logs</span>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        
        {/* Filter Controls Bar */}
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div class="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Search Tasks</label>
              <input
                type="text"
                placeholder="Search title, subrole, notes..."
                value={searchQuery()}
                onInput={(e) => {
                  setSearchQuery(e.currentTarget.value);
                  setCurrentPage(1);
                }}
                class="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 min-w-[220px]"
              />
            </div>

            {/* Role Filter Buttons */}
            <Show when={getUserAvailableRoles().length > 1 || (tasks.some((t) => t.role === "Trainer") && tasks.some((t) => t.role === "Reviewer"))}>
              <div>
                <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Role Filter</label>
                <div class="flex items-center space-x-1 bg-slate-950 border border-slate-800 p-1 rounded-lg text-xs">
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
                      roleFilter() === "Trainer" ? "bg-sky-600 text-white font-medium shadow-md shadow-sky-950" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Trainer
                  </button>
                  <button
                    onClick={() => { setRoleFilter("Reviewer"); setCurrentPage(1); }}
                    class={`px-3 py-1 rounded-lg transition-all ${
                      roleFilter() === "Reviewer" ? "bg-purple-600 text-white font-medium shadow-md shadow-purple-950" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Reviewer
                  </button>
                </div>
              </div>
            </Show>
          </div>

          {/* Items Per Page Selector */}
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

        {/* Task Log Table */}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th class="py-3.5 px-4">Logged At</th>
                <th class="py-3.5 px-4">Role & Subrole</th>
                <th class="py-3.5 px-4">Task Information</th>
                <th class="py-3.5 px-4">Tracking Mode</th>
                <th class="py-3.5 px-4">Duration</th>
                <th class="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <Show
                when={paginatedTasks().length > 0}
                fallback={
                  <tr>
                    <td colSpan={6} class="py-12 text-center text-slate-500">
                      No task log entries found matching the current filters.
                    </td>
                  </tr>
                }
              >
                <For each={paginatedTasks()}>
                  {(task) => {
                    const sameGroupTasks = () => tasks.filter((t) => t.subrole === task.subrole && t.title === task.title && t.title !== "Administrative Time");
                    const isGroup = () => sameGroupTasks().length > 1;

                    return (
                      <tr class="hover:bg-slate-800/40 transition-colors">
                        <td class="py-3.5 px-4 whitespace-nowrap text-slate-400 font-mono">
                          {new Date(task.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        <td class="py-3.5 px-4 whitespace-nowrap">
                          <div class="flex flex-col space-y-1">
                            <span class={`w-max text-[10px] font-bold px-2 py-0.5 rounded border ${
                              task.role === 'Trainer'
                                ? 'bg-sky-950/80 text-sky-300 border-sky-800'
                                : 'bg-purple-950/80 text-purple-300 border-purple-800'
                            }`}>
                              {task.role}
                            </span>
                            <span class="text-slate-300 font-medium">{task.subrole}</span>
                          </div>
                        </td>

                        <td class="py-3.5 px-4 max-w-xs sm:max-w-md">
                          <div class="flex items-center space-x-2">
                            <span class="font-semibold text-slate-100 text-sm">{task.title}</span>
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

                        <td class="py-3.5 px-4 whitespace-nowrap font-mono">
                          <div class="text-sm font-bold text-white">
                            {task.timerMode === "untracked" ? "00:00 (0m)" : formatTaskDuration(task.durationSeconds)}
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
                    );
                  }}
                </For>
              </Show>
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
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
