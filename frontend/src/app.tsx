import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { Navbar } from "./components/Navbar";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
          <Navbar />
          <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Suspense fallback={
              <div class="flex items-center justify-center min-h-[400px]">
                <div class="flex items-center space-x-3 text-slate-400">
                  <div class="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading Hubstaff AHT Application...</span>
                </div>
              </div>
            }>
              {props.children}
            </Suspense>
          </main>
          <footer class="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
            Hubstaff AHT Tracking App • Single-User Engine Architecture • Webhook Integration Scaffolding
          </footer>
        </div>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
