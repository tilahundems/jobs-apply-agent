import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

const webDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(webDir, "../..")

const TUNNEL_HOSTS = [
  ".trycloudflare.com",
  ".ngrok-free.app",
  ".ngrok-free.dev",
  ".ngrok.io",
]

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "")

  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }

  const API_URL = env.API_URL || "http://localhost:4000"

  return {
    envDir: repoRoot,
    resolve: { tsconfigPaths: true },
    server: {
      port: 3000,
      // Telegram loads the mini app from a public tunnel hostname, which Vite
      // otherwise rejects as an unknown host.
      allowedHosts: TUNNEL_HOSTS,
      proxy: { "/api": { target: API_URL, changeOrigin: true } },
    },
    // The mini app must not load the dev server: one request per module is slow
    // enough over a tunnel that the chat shows a blank page until it mounts.
    preview: {
      port: 3001,
      allowedHosts: TUNNEL_HOSTS,
      proxy: { "/api": { target: API_URL, changeOrigin: true } },
    },
    optimizeDeps: {
      holdUntilCrawlEnd: false,
      include: [
        "@base-ui/react/avatar",
        "@base-ui/react/button",
        "@base-ui/react/checkbox",
        "@base-ui/react/combobox",
        "@base-ui/react/dialog",
        "@base-ui/react/drawer",
        "@base-ui/react/input",
        "@base-ui/react/menu",
        "@base-ui/react/merge-props",
        "@base-ui/react/select",
        "@base-ui/react/separator",
        "@base-ui/react/tabs",
        "@base-ui/react/toggle",
        "@base-ui/react/toggle-group",
        "@base-ui/react/tooltip",
        "@base-ui/react/use-render",
        "@tanstack/react-query",
        "@tanstack/react-table",
        "recharts",
        "sonner",
        "zod",
      ],
    },
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      tailwindcss(),
      viteReact(),
    ],
  }
})

export default config
