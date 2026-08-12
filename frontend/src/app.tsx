import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <main class="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
          <Suspense fallback={<div class="p-6 text-center text-slate-400">Loading...</div>}>
            {props.children}
          </Suspense>
        </main>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
