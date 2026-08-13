import { createSignal, createEffect, For, Show } from "solid-js";
import {
  Role,
  Subrole,
  SUBROLES_BY_ROLE,
  TaskLogEntry,
  parsePastedTimestamp,
  toLocalDateTimeLocalString,
} from "../lib/store";

interface EditTaskModalProps {
  task: TaskLogEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updatedFields: Partial<TaskLogEntry>) => void;
}

export function EditTaskModal(props: EditTaskModalProps) {
  const [role, setRole] = createSignal<Role>("Reviewer");
  const [subrole, setSubrole] = createSignal<Subrole>("Quality Reviewer");
  const [title, setTitle] = createSignal<string>("");
  const [url, setUrl] = createSignal<string>("");
  const [notes, setNotes] = createSignal<string>("");

  // Timing edit signals (only for manually added entries)
  const [timingMode, setTimingMode] = createSignal<"timestamps" | "duration">("duration");
  const [startTime, setStartTime] = createSignal<string>("");
  const [endTime, setEndTime] = createSignal<string>("");
  const [startDateTime, setStartDateTime] = createSignal<string>("");
  const [durationMins, setDurationMins] = createSignal<number>(0);
  const [timerMode, setTimerMode] = createSignal<"hubstaff" | "untracked">("hubstaff");

  createEffect(() => {
    if (props.task) {
      setRole(props.task.role);
      setSubrole(props.task.subrole);
      setTitle(props.task.title);
      setUrl(props.task.url || "");
      setNotes(props.task.notes || "");
      setTimerMode(props.task.timerMode);

      const createdDt = new Date(props.task.createdAt);
      if (!isNaN(createdDt.getTime())) {
        const startStr = toLocalDateTimeLocalString(createdDt);
        const endDt = new Date(createdDt.getTime() + (props.task.durationSeconds || 0) * 1000);
        const endStr = toLocalDateTimeLocalString(endDt);

        setStartTime(startStr);
        setEndTime(endStr);
        setStartDateTime(startStr);
      }
      setDurationMins(Math.round((props.task.durationSeconds || 0) / 60));
    }
  });

  createEffect(() => {
    const currentRole = role();
    const availableSubroles = SUBROLES_BY_ROLE[currentRole];
    if (!availableSubroles.includes(subrole())) {
      setSubrole(availableSubroles[0]);
    }
  });

  const handlePasteTimestamp = (e: ClipboardEvent, setter: (val: string) => void) => {
    const pastedText = e.clipboardData?.getData("text");
    if (pastedText) {
      const parsed = parsePastedTimestamp(pastedText);
      if (parsed) {
        e.preventDefault();
        setter(parsed);
      }
    }
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!props.task) return;
    if (!title().trim()) {
      alert("Please provide a task title.");
      return;
    }

    const updatedFields: Partial<TaskLogEntry> = {
      role: role(),
      subrole: subrole(),
      title: title().trim(),
      url: url().trim(),
      notes: notes().trim(),
    };

    // Apply timing updates strictly if task was manually entered
    if (props.task.isManualEntry) {
      updatedFields.timerMode = timerMode();

      if (timerMode() === "untracked") {
        updatedFields.durationSeconds = 0;
      } else if (timingMode() === "timestamps") {
        if (startTime() && endTime()) {
          const startMs = new Date(startTime()).getTime();
          const endMs = new Date(endTime()).getTime();
          if (endMs > startMs) {
            updatedFields.createdAt = new Date(startTime()).toISOString();
            updatedFields.durationSeconds = Math.round((endMs - startMs) / 1000);
          }
        }
      } else {
        // Start Date/Time & Duration Mode
        if (startDateTime()) {
          const startDt = new Date(startDateTime());
          if (!isNaN(startDt.getTime())) {
            updatedFields.createdAt = startDt.toISOString();
            updatedFields.durationSeconds = Math.max(0, durationMins() * 60);
          }
        }
      }
    }

    props.onSave(props.task.id, updatedFields);
    props.onClose();
  };

  return (
    <Show when={props.isOpen && props.task !== null}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
          
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div class="flex items-center space-x-2">
                <h3 class="text-lg font-bold text-white flex items-center space-x-2">
                  <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit Task Details</span>
                </h3>
                <Show when={props.task?.isManualEntry}>
                  <span class="px-2 py-0.5 text-[10px] font-bold bg-slate-950 border border-sky-800 text-sky-300 rounded-md">
                    🖊️ Manually Added
                  </span>
                </Show>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                Modify role, task metadata, and manual entry timing.
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
            
            {/* Role & Subrole */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Role
                </label>
                <select
                  value={role()}
                  onChange={(e) => setRole(e.currentTarget.value as Role)}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Trainer">Trainer</option>
                  <option value="Reviewer">Reviewer</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Subrole
                </label>
                <select
                  value={subrole()}
                  onChange={(e) => setSubrole(e.currentTarget.value as Subrole)}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <For each={SUBROLES_BY_ROLE[role()]}>
                    {(sub) => <option value={sub}>{sub}</option>}
                  </For>
                </select>
              </div>
            </div>

            {/* Manual-Only Timing Adjustments */}
            <Show when={props.task?.isManualEntry}>
              <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div class="flex items-center justify-between">
                  <span class="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Date & Timing Adjustments
                  </span>
                  <div class="flex items-center space-x-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setTimingMode("timestamps")}
                      class={`px-2.5 py-1 rounded-lg transition-all ${
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
                      class={`px-2.5 py-1 rounded-lg transition-all ${
                        timingMode() === "duration"
                          ? "bg-sky-600 text-white font-medium"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Start Date/Time & Duration
                    </button>
                  </div>
                </div>

                <Show
                  when={timingMode() === "timestamps"}
                  fallback={
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label class="block text-xs text-slate-400 mb-1">
                          Start Date & Time (Paste supported)
                        </label>
                        <input
                          type="datetime-local"
                          value={startDateTime()}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                          onPaste={(e) => handlePasteTimestamp(e, setStartDateTime)}
                          onInput={(e) => setStartDateTime(e.currentTarget.value)}
                          class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono cursor-pointer"
                        />
                      </div>

                      <div>
                        <label class="block text-xs text-slate-400 mb-1">
                          Duration (Minutes)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="480"
                          disabled={timerMode() === "untracked"}
                          value={durationMins()}
                          onInput={(e) => setDurationMins(parseInt(e.currentTarget.value) || 0)}
                          class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono disabled:opacity-40"
                        />
                      </div>
                    </div>
                  }
                >
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs text-slate-400 mb-1">
                        Start Time (Paste supported)
                      </label>
                      <input
                        type="datetime-local"
                        value={startTime()}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        onPaste={(e) => handlePasteTimestamp(e, setStartTime)}
                        onInput={(e) => setStartTime(e.currentTarget.value)}
                        class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono cursor-pointer"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-400 mb-1">
                        End Time (Paste supported)
                      </label>
                      <input
                        type="datetime-local"
                        value={endTime()}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        onPaste={(e) => handlePasteTimestamp(e, setEndTime)}
                        onInput={(e) => setEndTime(e.currentTarget.value)}
                        class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono cursor-pointer"
                      />
                    </div>
                  </div>
                </Show>

                <div class="flex items-center space-x-2 pt-1 text-xs">
                  <label class="flex items-center space-x-2 text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={timerMode() === "untracked"}
                      onChange={(e) => setTimerMode(e.currentTarget.checked ? "untracked" : "hubstaff")}
                      class="w-4 h-4 text-sky-500 rounded bg-slate-900 border-slate-700"
                    />
                    <span>Mark as Untracked Task (Duration = 0m)</span>
                  </label>
                </div>
              </div>
            </Show>

            {/* Task Title */}
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Task Title <span class="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Task URL */}
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Task URL
              </label>
              <input
                type="url"
                value={url()}
                onInput={(e) => setUrl(e.currentTarget.value)}
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Task Notes */}
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Task Notes
              </label>
              <textarea
                rows={2}
                value={notes()}
                onInput={(e) => setNotes(e.currentTarget.value)}
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              ></textarea>
            </div>

            {/* Footer Buttons */}
            <div class="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800">
              <button
                type="button"
                onClick={props.onClose}
                class="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-950 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}
