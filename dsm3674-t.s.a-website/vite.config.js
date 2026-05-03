import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  // Only GitHub Pages sets this env var
  const isGitHubPages = process.env.GITHUB_PAGES === "true";

  return {
    plugins: [react()],

   
    base: isGitHubPages ? "/T.S.A-website/" : "/",

    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom"],
          },
        },
      },
    },

    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
          secure: false,
        },
      },
    },

    preview: {
      port: 4173,
    },
  };
});
