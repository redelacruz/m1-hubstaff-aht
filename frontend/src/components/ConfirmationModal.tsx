import { Show } from "solid-js";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  warningText: string;
  description: string;
  confirmText: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal(props: ConfirmationModalProps) {
  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        <div class="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">
          
          {/* Top Decorative Border Highlight */}
          <div
            class={`absolute top-0 left-0 right-0 h-1.5 ${
              props.isDestructive
                ? "bg-gradient-to-r from-rose-500 via-red-500 to-amber-500"
                : "bg-gradient-to-r from-amber-500 via-sky-500 to-indigo-500"
            }`}
          />

          {/* Header & Icon */}
          <div class="flex items-start space-x-4">
            <div
              class={`p-3 rounded-xl border flex-shrink-0 ${
                props.isDestructive
                  ? "bg-rose-950/80 border-rose-800 text-rose-400"
                  : "bg-amber-950/80 border-amber-800 text-amber-400"
              }`}
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <div class="space-y-1">
              <h3 class="text-lg font-extrabold tracking-tight text-white">{props.title}</h3>
              <p class="text-xs font-semibold uppercase tracking-wider text-amber-400">
                {props.warningText}
              </p>
            </div>
          </div>

          {/* Description */}
          <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 leading-relaxed space-y-2">
            <p>{props.description}</p>
          </div>

          {/* Buttons */}
          <div class="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              disabled={props.isLoading}
              onClick={props.onCancel}
              class="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
            >
              {props.cancelText || "Cancel"}
            </button>

            <button
              type="button"
              disabled={props.isLoading}
              onClick={props.onConfirm}
              class={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50 ${
                props.isDestructive
                  ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-950"
                  : "bg-gradient-to-r from-amber-600 to-sky-600 hover:from-amber-500 hover:to-sky-500 text-white shadow-amber-950"
              }`}
            >
              <Show when={props.isLoading}>
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Show>
              <span>{props.isLoading ? "Processing..." : props.confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
