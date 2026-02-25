import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 5800,
    proxy: {
      // Proxy API requests to Deno server
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        secure: false,
        router: () => {
          try {
            const port = fs.readFileSync(`${process.cwd()}/.dev-port`, "utf8").trim();
            return `http://localhost:${port}`;
          } catch {
            return "http://localhost:3100";
          }
        },
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
