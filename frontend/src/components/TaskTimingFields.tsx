import { Show } from "solid-js";
import { parsePastedTimestamp } from "../lib/store";

export interface TaskTimingFieldsProps {
  title?: string;
  timingMode: "timestamps" | "duration";
  onTimingModeChange: (mode: "timestamps" | "duration") => void;

  startTime: string;
  onStartTimeChange: (val: string) => void;

  endTime: string;
  onEndTimeChange: (val: string) => void;

  startDateTime: string;
  onStartDateTimeChange: (val: string) => void;

  durationMins: number;
  onDurationMinsChange: (val: number) => void;

  timerMode?: "hubstaff" | "untracked";
  onTimerModeChange?: (mode: "hubstaff" | "untracked") => void;
  showUntrackedOption?: boolean;
}

export function TaskTimingFields(props: TaskTimingFieldsProps) {
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

  return (
    <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-300">
          {props.title || "Task Timing Specification"}
        </span>
        <div class="flex items-center space-x-1 text-xs">
          <button
            type="button"
            onClick={() => props.onTimingModeChange("timestamps")}
            class={`px-3 py-1 rounded-lg transition-all ${
              props.timingMode === "timestamps"
                ? "bg-sky-600 text-white font-medium"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Start & End Time
          </button>
          <button
            type="button"
            onClick={() => props.onTimingModeChange("duration")}
            class={`px-3 py-1 rounded-lg transition-all ${
              props.timingMode === "duration"
                ? "bg-sky-600 text-white font-medium"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Duration
          </button>
        </div>
      </div>

      <Show
        when={props.timingMode === "timestamps"}
        fallback={
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-400 mb-1">
                Start Date & Time (Paste supported)
              </label>
              <input
                type="datetime-local"
                value={props.startDateTime}
                onClick={(e) => e.currentTarget.showPicker?.()}
                onPaste={(e) => handlePasteTimestamp(e, props.onStartDateTimeChange)}
                onInput={(e) => props.onStartDateTimeChange(e.currentTarget.value)}
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono cursor-pointer"
              />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">
                Elapsed Duration (Minutes)
              </label>
              <input
                type="number"
                min="0"
                max="480"
                disabled={props.timerMode === "untracked"}
                value={props.durationMins}
                onInput={(e) => props.onDurationMinsChange(parseInt(e.currentTarget.value) || 0)}
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
              value={props.startTime}
              onClick={(e) => e.currentTarget.showPicker?.()}
              onPaste={(e) => handlePasteTimestamp(e, props.onStartTimeChange)}
              onInput={(e) => props.onStartTimeChange(e.currentTarget.value)}
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono cursor-pointer"
            />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">
              End Time (Paste supported)
            </label>
            <input
              type="datetime-local"
              value={props.endTime}
              onClick={(e) => e.currentTarget.showPicker?.()}
              onPaste={(e) => handlePasteTimestamp(e, props.onEndTimeChange)}
              onInput={(e) => props.onEndTimeChange(e.currentTarget.value)}
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono cursor-pointer"
            />
          </div>
        </div>
      </Show>

      <Show when={props.showUntrackedOption && props.onTimerModeChange}>
        <div class="flex items-center space-x-2 pt-1 text-xs">
          <label class="flex items-center space-x-2 text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={props.timerMode === "untracked"}
              onChange={(e) => props.onTimerModeChange!(e.currentTarget.checked ? "untracked" : "hubstaff")}
              class="w-4 h-4 text-sky-500 rounded bg-slate-900 border-slate-700"
            />
            <span>Mark as Untracked Task (Duration = 0m)</span>
          </label>
        </div>
      </Show>
    </div>
  );
}
