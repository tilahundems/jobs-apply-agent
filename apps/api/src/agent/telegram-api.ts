import { HttpStatus } from "@nestjs/common"
import { env } from "../env.js"
import { apiError } from "../http/api-error.js"

/** Telegram's `description` is the useful half of its error body. */
export const telegramDetail = (body: string) => {
  try {
    const parsed = JSON.parse(body) as { description?: unknown }
    if (typeof parsed.description === "string") return parsed.description
  } catch {
    // Fall through to the raw body.
  }
  return body.slice(0, 200) || "no reason given"
}

/**
 * Calls a Bot API method and returns its parsed JSON body. Every failure is a
 * `502` carrying Telegram's own reason, so a toast can name the fix.
 */
export async function telegramCall(
  method: string,
  payload: Record<string, unknown>,
  timeoutMs = 15_000
) {
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    }
  )
  const raw = await response.text().catch(() => "")
  if (!response.ok) {
    apiError(
      HttpStatus.BAD_GATEWAY,
      `Telegram rejected the message: ${telegramDetail(raw)}`
    )
  }
  try {
    return JSON.parse(raw) as {
      ok?: boolean
      result?: unknown
      description?: string
    }
  } catch {
    return {}
  }
}

/** Untrusted channel text must never reach Telegram's HTML parser raw. */
export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
