import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Web-map-test/" : "/",
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },
}));
