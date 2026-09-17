import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-core",
              test: /node_modules[/\\](react|react-dom|scheduler)[/\\]/,
              priority: 30,
            },
            {
              name: "tanstack",
              test: /node_modules[/\\]@tanstack[/\\]/,
              priority: 20,
            },
            {
              name: "auth",
              test: /node_modules[/\\](@better-auth|better-auth|@simplewebauthn)[/\\]/,
              priority: 20,
            },
            {
              name: "ui-runtime",
              test: /node_modules[/\\](@base-ui|lucide-react|next-themes|sonner|input-otp|qrcode.react)[/\\]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": Bun.fileURLToPath(new URL("./src/", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api/auth": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/api/verify": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/api/admin": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    css: true,
  },
})
