import { Show, For } from "solid-js";
import { TaskLogEntry, formatTaskDuration, formatDuration } from "../lib/store";

interface TaskGroupModalProps {
  isOpen: boolean;
  subrole: string;
  title: string;
  groupTasks: TaskLogEntry[];
  onClose: () => void;
  onEditTask?: (task: TaskLogEntry) => void;
  onDeleteTask?: (taskId: string) => void;
}

export function TaskGroupModal(props: TaskGroupModalProps) {
  const totalGroupSeconds = () =>
    props.groupTasks.reduce((sum, t) => sum + (t.durationSeconds || 0), 0);

  const formatDateTimeDisplay = (isoStr: string) => {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        <div class="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 relative overflow-hidden max-h-[90vh] flex flex-col">
          
          {/* Decorative Top Border Highlight */}
          <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500" />

          {/* Header */}
          <div class="flex items-start justify-between pb-3 border-b border-slate-800 flex-shrink-0">
            <div>
              <div class="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
                <span class="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
                <span>Task Group Breakdown</span>
              </div>
              <h3 class="text-xl font-extrabold text-white tracking-tight break-words max-w-lg">
                {props.title}
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Subrole: <strong class="text-slate-200">{props.subrole}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary Metric Cards */}
          <div class="grid grid-cols-2 gap-4 flex-shrink-0">
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Group Duration</span>
              <span class="text-xl font-mono font-extrabold text-sky-400 mt-1">
                {formatTaskDuration(totalGroupSeconds())}
              </span>
              <span class="text-[11px] text-slate-500 font-mono mt-0.5">
                ({formatDuration(totalGroupSeconds())})
              </span>
            </div>

            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Logged Segments</span>
              <span class="text-xl font-mono font-extrabold text-indigo-400 mt-1">
                {props.groupTasks.length} Log Entries
              </span>
              <span class="text-[11px] text-slate-500 mt-0.5">
                Counts as 1 task for AHT
              </span>
            </div>
          </div>

          {/* Logged Segments Table */}
          <div class="overflow-y-auto flex-1 pr-1">
            <table class="w-full text-left text-xs text-slate-300">
              <thead class="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 sticky top-0">
                <tr>
                  <th class="py-2.5 px-3">Logged At</th>
                  <th class="py-2.5 px-3">Mode</th>
                  <th class="py-2.5 px-3">Duration</th>
                  <th class="py-2.5 px-3">Notes</th>
                  <Show when={props.onEditTask || props.onDeleteTask}>
                    <th class="py-2.5 px-3 text-right">Actions</th>
                  </Show>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 font-medium">
                <For each={props.groupTasks}>
                  {(task) => (
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="py-2.5 px-3 whitespace-nowrap font-mono text-slate-300 text-[11px]">
                        {formatDateTimeDisplay(task.createdAt)}
                      </td>
                      <td class="py-2.5 px-3 whitespace-nowrap">
                        <Show
                          when={task.timerMode === "hubstaff"}
                          fallback={
                            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300">
                              Untracked
                            </span>
                          }
                        >
                          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                            Tracked
                          </span>
                        </Show>
                      </td>
                      <td class="py-2.5 px-3 font-mono font-bold text-slate-100 whitespace-nowrap">
                        {formatTaskDuration(task.durationSeconds)}
                      </td>
                      <td class="py-2.5 px-3 text-slate-400 max-w-xs break-words text-[11px]">
                        {task.notes || <span class="italic text-slate-600">No notes</span>}
                      </td>
                      <Show when={props.onEditTask || props.onDeleteTask}>
                        <td class="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                          <Show when={props.onEditTask}>
                            <button
                              type="button"
                              onClick={() => {
                                props.onClose();
                                props.onEditTask!(task);
                              }}
                              title="Edit Segment"
                              class="text-sky-400 hover:text-sky-300 p-1 rounded hover:bg-sky-950/40 transition-colors"
                            >
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </Show>
                          <Show when={props.onDeleteTask}>
                            <button
                              type="button"
                              onClick={() => props.onDeleteTask!(task.id)}
                              title="Delete Segment"
                              class="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/40 transition-colors"
                            >
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </Show>
                        </td>
                      </Show>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div class="pt-3 border-t border-slate-800 flex justify-end flex-shrink-0">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
