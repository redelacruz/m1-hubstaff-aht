import { useLocation } from "@solidjs/router";
import { DEFAULT_USER, settings } from "../lib/store";

export function Navbar() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header class="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <a href="/" class="flex items-center space-x-3">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-900/30">
              <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-extrabold text-lg tracking-tight text-white">Hubstaff AHT</span>
                <span class="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-400 bg-sky-950/80 border border-sky-800/60 rounded-md">
                  Single-User
                </span>
              </div>
              <p class="text-[11px] text-slate-400 leading-none">Handling Time Tracker</p>
            </div>
          </a>

          {/* Navigation Links */}
          <nav class="flex items-center space-x-1 sm:space-x-2">
            <a
              href="/"
              class={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                isActive("/")
                  ? "bg-sky-600 text-white shadow-md shadow-sky-950"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              Tracker
            </a>

            <a
              href="/task-log"
              class={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                isActive("/task-log")
                  ? "bg-sky-600 text-white shadow-md shadow-sky-950"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              Task Log
            </a>

            <a
              href="/analytics"
              class={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                isActive("/analytics")
                  ? "bg-sky-600 text-white shadow-md shadow-sky-950"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              Analytics
            </a>

            <a
              href="/hubstaff-data"
              class={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                isActive("/hubstaff-data")
                  ? "bg-sky-600 text-white shadow-md shadow-sky-950"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              Hubstaff Data
            </a>

            <a
              href="/settings"
              class={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                isActive("/settings")
                  ? "bg-sky-600 text-white shadow-md shadow-sky-950"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              Settings
            </a>
          </nav>

          {/* User Profile Badge */}
          <div class="hidden lg:flex items-center space-x-3 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3">
            <div class="w-7 h-7 rounded-full bg-slate-800 text-sky-400 font-bold text-xs flex items-center justify-center border border-slate-700">
              AR
            </div>
            <div class="text-left text-xs">
              <div class="font-medium text-slate-200">{DEFAULT_USER.name}</div>
              <div class="text-[10px] text-slate-400 flex items-center space-x-1">
                <span>Default:</span>
                <span class="text-sky-300 font-semibold">{settings.defaultRole}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
