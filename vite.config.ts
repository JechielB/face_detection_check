// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: {
    // allow Render’s public URL
    allowedHosts: ["face-detection-check.onrender.com"],
    // (optional) you can also add a wildcard if you ever change name:
    // allowedHosts: ["face-detection-check.onrender.com", ".onrender.com"],
  },
});
