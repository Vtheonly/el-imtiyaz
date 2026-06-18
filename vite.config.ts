import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Vite configures the renderer (React) layer of the Electron app.
// The main process and preload are compiled separately via tsc.
export default defineConfig({
  root: "src/ui",
  base: "./",
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  resolve: {
    alias: {
      "@ui": resolve(__dirname, "src/ui"),
      "@core": resolve(__dirname, "src/core"),
      "@shared": resolve(__dirname, "src/shared"),
      "@services": resolve(__dirname, "src/services"),
      "@infra": resolve(__dirname, "src/infrastructure"),
    },
  },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
  build: {
    outDir: resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
    target: "esnext",
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "src/ui/index.html"),
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@reduxjs/toolkit",
      "react-redux",
    ],
  },
});
