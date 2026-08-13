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
  let startDateTimeInputRef: HTMLInputElement | undefined;
  let startTimeInputRef: HTMLInputElement | undefined;
  let endTimeInputRef: HTMLInputElement | undefined;

  const handlePasteTimestamp = (e: ClipboardEvent, currentValue: string, setter: (val: string) => void) => {
    const pastedText = e.clipboardData?.getData("text") || e.clipboardData?.getData("text/plain");
    if (pastedText) {
      const parsed = parsePastedTimestamp(pastedText, currentValue);
      if (parsed) {
        e.preventDefault();
        setter(parsed);
      }
    }
  };

  const handleClipboardPaste = async (currentValue: string, setter: (val: string) => void) => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const parsed = parsePastedTimestamp(text, currentValue);
          if (parsed) {
            setter(parsed);
          } else {
            alert(`Could not parse pasted timestamp: "${text}"`);
          }
        }
      }
    } catch (err) {
      console.warn("Clipboard read permission or access error:", err);
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
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs text-slate-400">
                  Start Date & Time
                </label>
                <button
                  type="button"
                  onClick={() => handleClipboardPaste(props.startDateTime, props.onStartDateTimeChange)}
                  class="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center space-x-1 hover:underline"
                  title="Paste timestamp directly from system clipboard"
                >
                  <span>📋 Paste</span>
                </button>
              </div>
              <div class="relative flex items-center">
                <input
                  ref={(el) => (startDateTimeInputRef = el)}
                  type="datetime-local"
                  value={props.startDateTime}
                  onPaste={(e) => handlePasteTimestamp(e, props.startDateTime, props.onStartDateTimeChange)}
                  onInput={(e) => props.onStartDateTimeChange(e.currentTarget.value)}
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => startDateTimeInputRef?.showPicker?.()}
                  class="absolute right-2.5 text-slate-400 hover:text-white p-1 transition-colors"
                  title="Open Calendar Picker"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
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
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        }
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-slate-400">
                Start Time
              </label>
              <button
                type="button"
                onClick={() => handleClipboardPaste(props.startTime, props.onStartTimeChange)}
                class="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center space-x-1 hover:underline"
                title="Paste timestamp directly from system clipboard"
              >
                <span>📋 Paste</span>
              </button>
            </div>
            <div class="relative flex items-center">
              <input
                ref={(el) => (startTimeInputRef = el)}
                type="datetime-local"
                value={props.startTime}
                onPaste={(e) => handlePasteTimestamp(e, props.startTime, props.onStartTimeChange)}
                onInput={(e) => props.onStartTimeChange(e.currentTarget.value)}
                class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => startTimeInputRef?.showPicker?.()}
                class="absolute right-2.5 text-slate-400 hover:text-white p-1 transition-colors"
                title="Open Calendar Picker"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-slate-400">
                End Time
              </label>
              <button
                type="button"
                onClick={() => handleClipboardPaste(props.endTime, props.onEndTimeChange)}
                class="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center space-x-1 hover:underline"
                title="Paste timestamp directly from system clipboard"
              >
                <span>📋 Paste</span>
              </button>
            </div>
            <div class="relative flex items-center">
              <input
                ref={(el) => (endTimeInputRef = el)}
                type="datetime-local"
                value={props.endTime}
                onPaste={(e) => handlePasteTimestamp(e, props.endTime, props.onEndTimeChange)}
                onInput={(e) => props.onEndTimeChange(e.currentTarget.value)}
                class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => endTimeInputRef?.showPicker?.()}
                class="absolute right-2.5 text-slate-400 hover:text-white p-1 transition-colors"
                title="Open Calendar Picker"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
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
              class="w-4 h-4 text-sky-500 rounded bg-slate-900 border-slate-700 focus:ring-sky-500"
            />
            <span>Mark as Untracked Task (Duration = 0m)</span>
          </label>
        </div>
      </Show>
    </div>
  );
}
