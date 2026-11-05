import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, process.cwd(), "").VITE_APP_BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  build: { rollupOptions: { output: { inlineDynamicImports: true } } },
  test: {
    environment: "jsdom",
    globals: true,
    env: {
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
}));
