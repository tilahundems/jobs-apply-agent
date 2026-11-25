/**
 * Opens the built web app to Telegram without ngrok's "You are about to visit"
 * page, which free ngrok cannot avoid because Telegram controls the request.
 *
 * Starts a Cloudflare quick tunnel, then repoints the bot's Open app button at
 * the address it got, so a changing address is never something you see.
 *
 * Usage: node scripts/mini-app.mjs [port]     (default port 3001)
 */
import { spawn } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const port = process.argv[2] ?? "3001"
const envPath = resolve(root, ".env")
const binary = resolve(root, ".tools/cloudflared.exe")

process.loadEnvFile(envPath)
const token = process.env.TELEGRAM_AGENT_BOT_TOKEN
const ownerChats = (process.env.TELEGRAM_CHAT_ID ?? "")
  .split(",")
  .map((chat) => chat.trim())
  .filter(Boolean)

if (!token) {
  console.error("TELEGRAM_AGENT_BOT_TOKEN is missing from .env")
  process.exit(1)
}

const saveUrl = (url) => {
  const env = readFileSync(envPath, "utf8")
  const next = env.includes("TELEGRAM_WEBAPP_URL=")
    ? env.replace(/^TELEGRAM_WEBAPP_URL=.*$/m, `TELEGRAM_WEBAPP_URL=${url}`)
    : `${env}\nTELEGRAM_WEBAPP_URL=${url}\n`
  writeFileSync(envPath, next)
}

/** The button Telegram shows beside the message box, for every chat and the default. */
async function pointButtonAt(url) {
  const call = async (method, payload) => {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }
    )
    return await response.json()
  }

  const button = { type: "web_app", text: "Open app", web_app: { url } }
  // A chat's own button overrides the default one, and an older run left a
  // button pinned to a dead address, so every chat is pointed at the new URL.
  const results = await Promise.all([
    call("setChatMenuButton", { menu_button: button }),
    ...ownerChats.map((chat) =>
      call("setChatMenuButton", {
        chat_id: Number(chat),
        menu_button: button,
      })
    ),
  ])
  const failed = results.filter((result) => !result.ok)
  if (failed.length > 0) {
    console.warn("Telegram rejected the menu button:", failed[0].description)
  }
}

const tunnel = spawn(
  binary,
  ["tunnel", "--url", `http://localhost:${port}`, "--no-autoupdate"],
  { cwd: root }
)

let announced = false
const scan = async (chunk) => {
  const text = chunk.toString()
  if (announced) return
  // cloudflared's own log mentions api.trycloudflare.com; only our tunnel
  // address answers with the app's HTML.
  const candidates = text.match(
    /https:\/\/(?!api\.|region\d)[a-z0-9-]+\.trycloudflare\.com/g
  )
  if (!candidates) return
  announced = true
  const url = candidates.find((candidate) => !candidate.includes("api."))
  if (!url) return
  // The address needs a few seconds to resolve; a GET proves it is ours, and
  // a HEAD would be refused by the preview server.
  let ready = false
  for (let attempt = 0; attempt < 8 && !ready; attempt++) {
    const response = await fetch(url).catch(() => null)
    const type = response?.headers.get("content-type") ?? ""
    ready = Boolean(response?.ok) && type.includes("text/html")
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  if (!ready)
    console.warn("Tunnel address did not answer yet; using it anyway.")
  saveUrl(url)
  console.log(`\nMini app: ${url}`)
  pointButtonAt(url).then(() => console.log("Telegram button updated."))
}

tunnel.stdout.on("data", scan)
tunnel.stderr.on("data", scan)
tunnel.on("exit", (code) => {
  console.log(`Tunnel stopped (${code}). The last address is no longer live.`)
  process.exit(0)
})

console.log(`Tunnelling localhost:${port}. Keep this window open.`)
