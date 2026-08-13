import { createSignal, createEffect, For, Show } from "solid-js";
import {
  Role,
  Subrole,
  SUBROLES_BY_ROLE,
  getEffectiveUserRole,
} from "../lib/store";
import { TaskTimingFields } from "./TaskTimingFields";

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
  const [role, setRole] = createSignal<Role>("Trainer");
  const [subrole, setSubrole] = createSignal<Subrole>("Trainer 1");
  const [title, setTitle] = createSignal<string>("");
  const [url, setUrl] = createSignal<string>("");
  const [notes, setNotes] = createSignal<string>("");
  const [isUntracked, setIsUntracked] = createSignal<boolean>(false);

  // Timing Mode: 'timestamps' or 'duration'
  const [timingMode, setTimingMode] = createSignal<"timestamps" | "duration">("timestamps");
  const [startTime, setStartTime] = createSignal<string>("");
  const [endTime, setEndTime] = createSignal<string>("");
  const [startDateTime, setStartDateTime] = createSignal<string>("");
  const [durationMins, setDurationMins] = createSignal<number>(15);
  const [durationSecs, setDurationSecs] = createSignal<number>(0);

  const formatLocalDateTimeLocal = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  createEffect(() => {
    if (props.isOpen) {
      const now = new Date();
      const defaultStart = new Date(now.getTime() - 15 * 60 * 1000);
      setStartTime(formatLocalDateTimeLocal(defaultStart));
      setEndTime(formatLocalDateTimeLocal(now));
      setStartDateTime(formatLocalDateTimeLocal(defaultStart));

      const effRole = getEffectiveUserRole();
      setRole(effRole);
      setSubrole(SUBROLES_BY_ROLE[effRole][0]);
      setTitle("");
      setUrl("");
      setNotes("");
      setIsUntracked(false);
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
    if (isUntracked()) {
      setTimingMode("duration");
      setDurationMins(0);
      setDurationSecs(0);
    }
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!title().trim()) {
      alert("Please enter a task title.");
      return;
    }

    if (isUntracked()) {
      let startIso: string | undefined = undefined;
      if (startDateTime()) {
        const startDt = new Date(startDateTime());
        if (!isNaN(startDt.getTime())) {
          startIso = startDt.toISOString();
        }
      }
      if (!startIso) {
        startIso = new Date().toISOString();
      }

      props.onAdd({
        role: role(),
        subrole: subrole(),
        title: title().trim(),
        url: url().trim(),
        notes: notes().trim(),
        startTime: startIso,
        endTime: startIso,
        durationMinutes: 0,
        isUntracked: true,
      });
    } else if (timingMode() === "timestamps") {
      if (!startTime() || !endTime()) {
        alert("Please specify both Start Time and End Time.");
        return;
      }
      if (new Date(startTime()).getTime() >= new Date(endTime()).getTime()) {
        alert("Start time must be before end time.");
        return;
      }

      props.onAdd({
        role: role(),
        subrole: subrole(),
        title: title().trim(),
        url: url().trim(),
        notes: notes().trim(),
        startTime: new Date(startTime()).toISOString(),
        endTime: new Date(endTime()).toISOString(),
        isUntracked: false,
      });
    } else {
      // Start Date/Time & Duration Mode
      let startIso: string | undefined = undefined;
      let endIso: string | undefined = undefined;

      if (startDateTime()) {
        const startDt = new Date(startDateTime());
        if (!isNaN(startDt.getTime())) {
          startIso = startDt.toISOString();
          const totalSecs = durationMins() * 60 + durationSecs();
          const endDt = new Date(startDt.getTime() + totalSecs * 1000);
          endIso = endDt.toISOString();
        }
      }

      props.onAdd({
        role: role(),
        subrole: subrole(),
        title: title().trim(),
        url: url().trim(),
        notes: notes().trim(),
        startTime: startIso,
        endTime: endIso,
        durationMinutes: durationMins() + durationSecs() / 60,
        isUntracked: false,
      });
    }

    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">

          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 class="text-lg font-bold text-white flex items-center space-x-2">
                <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Manual Task Log</span>
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Manually record task details with automatic window reconciliation.
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
                  placeholder="e.g. gnLokxh8Gsk or 4081768869215654175"
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
                  placeholder="https://feather.openai.com/tasks/..."
                  value={url()}
                  onInput={(e) => setUrl(e.currentTarget.value)}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Reusable Task Timing Fields Card */}
            <TaskTimingFields
              title="Task Timing Specification"
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
              isUntracked={isUntracked()}
            />

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
                class="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-950 transition-colors"
              >
                Save Task Entry
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}
