import { createSignal, createEffect, For, Show } from "solid-js";
import {
  Role,
  Subrole,
  SUBROLES_BY_ROLE,
  TaskLogEntry,
  toLocalDateTimeLocalString,
} from "../lib/store";
import { TaskTimingFields } from "./TaskTimingFields";

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
  const [durationSecs, setDurationSecs] = createSignal<number>(0);
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
      const totalSecs = props.task.durationSeconds || 0;
      setDurationMins(Math.floor(totalSecs / 60));
      setDurationSecs(totalSecs % 60);

      if (props.task.timerMode === "untracked") {
        setTimingMode("duration");
        setDurationMins(0);
        setDurationSecs(0);
      }
    }
  });

  createEffect(() => {
    const currentRole = role();
    const availableSubroles = SUBROLES_BY_ROLE[currentRole];
    if (!availableSubroles.includes(subrole())) {
      setSubrole(availableSubroles[0]);
    }
  });

  createEffect(() => {
    if (timerMode() === "untracked") {
      setTimingMode("duration");
      setDurationMins(0);
      setDurationSecs(0);
    }
  });

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
        if (startDateTime()) {
          const startDt = new Date(startDateTime());
          if (!isNaN(startDt.getTime())) {
            updatedFields.createdAt = startDt.toISOString();
          }
        }
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
            updatedFields.durationSeconds = Math.max(0, durationMins() * 60 + durationSecs());
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

            {/* Manual-Only Timing Adjustments Reusable Card */}
            <Show when={props.task?.isManualEntry}>
              <TaskTimingFields
                title="Date & Timing Adjustments"
                timingMode={timingMode()}
                onTimingModeChange={setTimingMode}
                startTime={startTime()}
                onStartTimeChange={setStartTime}
                endTime={endTime()}
                onEndTimeChange={setEndTime}
                startDateTime={startDateTime()}
                onStartDateTimeChange={setStartDateTime}
                durationMins={durationMins()}
                onDurationMinsChange={setDurationMins}
                durationSecs={durationSecs()}
                onDurationSecsChange={setDurationSecs}
                timerMode={timerMode()}
                onTimerModeChange={setTimerMode}
                showUntrackedOption={true}
                isUntracked={timerMode() === "untracked"}
              />
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
