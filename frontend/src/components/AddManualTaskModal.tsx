import { createSignal, createEffect, For, Show } from "solid-js";
import { Role, Subrole, SUBROLES_BY_ROLE, settings } from "../lib/store";

interface AddManualTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (taskData: {
    role: Role;
    subrole: Subrole;
    title: string;
    url: string;
    notes: string;
    startTime?: string;
    endTime?: string;
    taskDate?: string;
    durationMinutes?: number;
    isUntracked: boolean;
  }) => void;
}

export function AddManualTaskModal(props: AddManualTaskModalProps) {
  const [role, setRole] = createSignal<Role>(settings.defaultRole || "Reviewer");
  const [subrole, setSubrole] = createSignal<Subrole>(
    SUBROLES_BY_ROLE[settings.defaultRole || "Reviewer"][0]
  );
  const [title, setTitle] = createSignal<string>("");
  const [url, setUrl] = createSignal<string>("");
  const [notes, setNotes] = createSignal<string>("");

  const [timingMode, setTimingMode] = createSignal<"timestamps" | "duration">("timestamps");
  
  // Date & Time inputs
  const now = new Date();
  const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
  
  const toLocalISO = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const toLocalDate = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [startTime, setStartTime] = createSignal<string>(toLocalISO(thirtyMinsAgo));
  const [endTime, setEndTime] = createSignal<string>(toLocalISO(now));
  const [taskDate, setTaskDate] = createSignal<string>(toLocalDate(now));
  const [durationMins, setDurationMins] = createSignal<number>(30);
  const [isUntracked, setIsUntracked] = createSignal<boolean>(false);

  createEffect(() => {
    const currentRole = role();
    const availableSubroles = SUBROLES_BY_ROLE[currentRole];
    if (!availableSubroles.includes(subrole())) {
      setSubrole(availableSubroles[0]);
    }
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!title().trim()) {
      alert("Please enter a task title.");
      return;
    }

    if (timingMode() === "timestamps") {
      const start = new Date(startTime()).getTime();
      const end = new Date(endTime()).getTime();
      if (isNaN(start) || isNaN(end)) {
        alert("Please provide valid start and end timestamps.");
        return;
      }
      if (end <= start) {
        alert("End time must be after start time.");
        return;
      }
    } else {
      if (durationMins() <= 0) {
        alert("Please specify a duration greater than 0 minutes.");
        return;
      }
    }

    props.onAdd({
      role: role(),
      subrole: subrole(),
      title: title().trim(),
      url: url().trim(),
      notes: notes().trim(),
      startTime: timingMode() === "timestamps" ? new Date(startTime()).toISOString() : undefined,
      endTime: timingMode() === "timestamps" ? new Date(endTime()).toISOString() : undefined,
      taskDate: timingMode() === "duration" ? taskDate() : undefined,
      durationMinutes: timingMode() === "duration" ? durationMins() : undefined,
      isUntracked: isUntracked(),
    });

    setTitle("");
    setUrl("");
    setNotes("");
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
          
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 class="text-lg font-bold text-white flex items-center space-x-2">
                <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add / Import Past Task</span>
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Manually log historical tasks with automatic Hubstaff session reconciliation.
              </p>
            </div>
            <button
              onClick={props.onClose}
              class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} class="space-y-4">
            
            {/* Role & Subrole Selection */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Role <span class="text-rose-400">*</span>
                </label>
                <select
                  value={role()}
                  onChange={(e) => setRole(e.currentTarget.value as Role)}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Trainer">Trainer</option>
                  <option value="Reviewer">Reviewer</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Subrole <span class="text-rose-400">*</span>
                </label>
                <select
                  value={subrole()}
                  onChange={(e) => setSubrole(e.currentTarget.value as Subrole)}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <For each={SUBROLES_BY_ROLE[role()]}>
                    {(sub) => <option value={sub}>{sub}</option>}
                  </For>
                </select>
              </div>
            </div>

            {/* Task Title & URL */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Task Title <span class="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Legacy Ticket Audit #302"
                  value={title()}
                  onInput={(e) => setTitle(e.currentTarget.value)}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Task URL
                </label>
                <input
                  type="url"
                  placeholder="https://hubstaff.com/tasks/..."
                  value={url()}
                  onInput={(e) => setUrl(e.currentTarget.value)}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Timing Mode Toggle */}
            <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Task Timing Specification
                </span>
                <div class="flex items-center space-x-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setTimingMode("timestamps")}
                    class={`px-3 py-1 rounded-lg transition-all ${
                      timingMode() === "timestamps"
                        ? "bg-sky-600 text-white font-medium"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Start & End Time
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimingMode("duration")}
                    class={`px-3 py-1 rounded-lg transition-all ${
                      timingMode() === "duration"
                        ? "bg-sky-600 text-white font-medium"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Date & Duration
                  </button>
                </div>
              </div>

              <Show
                when={timingMode() === "timestamps"}
                fallback={
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs text-slate-400 mb-1">
                        Task Date (YYYY-MM-DD)
                      </label>
                      <input
                        type="date"
                        value={taskDate()}
                        onInput={(e) => setTaskDate(e.currentTarget.value)}
                        class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-400 mb-1">
                        Elapsed Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="480"
                        value={durationMins()}
                        onInput={(e) => setDurationMins(parseInt(e.currentTarget.value) || 1)}
                        class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                      />
                    </div>
                  </div>
                }
              >
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs text-slate-400 mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      value={startTime()}
                      onInput={(e) => setStartTime(e.currentTarget.value)}
                      class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-400 mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      value={endTime()}
                      onInput={(e) => setEndTime(e.currentTarget.value)}
                      class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </Show>
            </div>

            {/* Reconciliation Strategy Option */}
            <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUntracked()}
                  onChange={(e) => setIsUntracked(e.currentTarget.checked)}
                  class="w-4 h-4 text-sky-500 rounded bg-slate-900 border-slate-700 focus:ring-sky-500"
                />
                <span class="text-xs font-bold text-slate-200">
                  Mark as Untracked / Legacy Task (Skip Hubstaff timer reconciliation)
                </span>
              </label>
              <p class="text-[11px] text-slate-400 pl-6">
                When checked, increments task count ($+1$) without attempting to match against Hubstaff billed hours.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Task Notes
              </label>
              <textarea
                rows={2}
                placeholder="Optional migration notes or legacy ticket reference..."
                value={notes()}
                onInput={(e) => setNotes(e.currentTarget.value)}
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              ></textarea>
            </div>

            {/* Modal Actions */}
            <div class="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800">
              <button
                type="button"
                onClick={props.onClose}
                class="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-950 transition-colors flex items-center space-x-1.5"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Task to Log</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}
