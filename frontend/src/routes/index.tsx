import { createSignal, onMount } from "solid-js";

interface SystemStatusResponse {
  database_connection?: string;
  system_statuses?: Record<string, string>;
  detail?: string;
}

export default function Home() {
  const [apiHealth, setApiHealth] = createSignal<string>("Testing...");
  const [dbStatus, setDbStatus] = createSignal<SystemStatusResponse | null>(null);
  const [loading, setLoading] = createSignal<boolean>(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://192.168.4.104:8000";

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setApiHealth(data.status || "healthy");
      } else {
        setApiHealth(`Error (${res.status})`);
      }
    } catch (e) {
      setApiHealth("Disconnected / Unreachable");
    }
  };

  const fetchDbCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/db-check`);
      const data = await res.json();
      setDbStatus(data);
    } catch (e) {
      setDbStatus({ detail: "Failed to connect to backend/database" });
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchHealth();
    fetchDbCheck();
  });

  return (
    <div class="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <header class="mb-10 text-center">
        <span class="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-400 bg-sky-950 border border-sky-800 rounded-full">
          SolidStart + FastAPI + PostgreSQL Scaffolding
        </span>
        <h1 class="text-4xl font-extrabold tracking-tight text-white mt-4">
          Hubstaff Tracking App
        </h1>
        <p class="text-slate-400 mt-2 text-lg">
          Isolated Multi-Network Full-Stack Architecture
        </p>
      </header>

      {/* Network Topology Cards */}
      <section class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <div class="flex items-center space-x-2 text-emerald-400 font-semibold mb-2">
            <span class="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></span>
            <h2>Internal Network</h2>
          </div>
          <p class="text-xs text-slate-400 font-mono mb-3">hubstaff-aht-app_dev</p>
          <ul class="text-sm text-slate-300 space-y-1">
            <li>• Strict internal isolation</li>
            <li>• DB access restricted to stack</li>
            <li>• Postgres Engine (Port 5432)</li>
          </ul>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <div class="flex items-center space-x-2 text-sky-400 font-semibold mb-2">
            <span class="w-2.5 h-2.5 bg-sky-400 rounded-full"></span>
            <h2>Local LAN Static IPs</h2>
          </div>
          <p class="text-xs text-slate-400 font-mono mb-3">local_lan</p>
          <ul class="text-sm text-slate-300 space-y-1">
            <li>• Frontend: <code class="text-sky-300 bg-slate-800 px-1 py-0.5 rounded">192.168.4.103</code></li>
            <li>• Backend: <code class="text-sky-300 bg-slate-800 px-1 py-0.5 rounded">192.168.4.104</code></li>
            <li>• Local LAN accessibility</li>
          </ul>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <div class="flex items-center space-x-2 text-indigo-400 font-semibold mb-2">
            <span class="w-2.5 h-2.5 bg-indigo-400 rounded-full"></span>
            <h2>Cloudflare Tunnel</h2>
          </div>
          <p class="text-xs text-slate-400 font-mono mb-3">tunnel</p>
          <ul class="text-sm text-slate-300 space-y-1">
            <li>• Secure external ingress</li>
            <li>• Domain: <code class="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">hubstaff-app.redelacruz.com</code></li>
            <li>• Configured FastAPI CORS</li>
          </ul>
        </div>
      </section>

      {/* System Diagnostics */}
      <section class="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-10 shadow-lg">
        <h2 class="text-xl font-bold text-slate-200 mb-4">System Integration Status</h2>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div>
              <p class="font-medium text-slate-200">FastAPI Backend Status</p>
              <p class="text-xs text-slate-500 font-mono mt-0.5">{apiBaseUrl}/api/health</p>
            </div>
            <span class={`px-3 py-1 rounded-full text-xs font-bold ${apiHealth() === 'healthy' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
              {apiHealth()}
            </span>
          </div>

          <div class="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div>
              <p class="font-medium text-slate-200">Internal Database Connection</p>
              <p class="text-xs text-slate-500 font-mono mt-0.5">{apiBaseUrl}/api/db-check</p>
            </div>
            <span class={`px-3 py-1 rounded-full text-xs font-bold ${dbStatus()?.database_connection === 'successful' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
              {loading() ? "Checking..." : (dbStatus()?.database_connection || "Failed")}
            </span>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button 
            onClick={() => { fetchHealth(); fetchDbCheck(); }}
            class="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Re-test Connectivity
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer class="text-center text-xs text-slate-600">
        Hubstaff Tracking Application • Isolated Container Environment
      </footer>
    </div>
  );
}
