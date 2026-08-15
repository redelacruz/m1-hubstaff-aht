import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  ssr: false,
  server: {
    routeRules: {
      "/api/**": { proxy: "http://backend:8000/api/**" },
    },
  },
});
