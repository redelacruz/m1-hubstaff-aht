import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    routeRules: {
      "/api/**": { proxy: "http://backend:8000/api/**" },
    },
  },
});
