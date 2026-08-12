import { defineConfig } from "vite";
import solidPlugin from "@solidjs/start/vite";

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    host: "0.0.0.0",
    port: 80
  }
});
