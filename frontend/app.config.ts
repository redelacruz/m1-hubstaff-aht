import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    port: 80,
  },
  nitro: {
    routeRules: {
      "/api/**": { proxy: "http://backend:8000/api/**" },
    },
  },
});
