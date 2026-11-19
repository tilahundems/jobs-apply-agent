import type { Request, Response } from "express"

export function normalizedRoute(request: Request): string {
  const path: unknown = request.route?.path
  return typeof path === "string" &&
    path.startsWith("/") &&
    !path.includes("?") &&
    !path.includes("*")
    ? path
    : "unmatched"
}

/**
 * Calls `done` once per request (never for `/metrics`) with the final status
 * (499 when the client disconnects first) and the duration in milliseconds.
 */
export function onRequestComplete(
  request: Request,
  response: Response,
  done: (statusCode: number, durationMs: number) => void
) {
  if (request.path === "/metrics") return
  const started = process.hrtime.bigint()
  let completed = false
  const complete = (aborted: boolean) => {
    if (completed) return
    completed = true
    done(
      aborted ? 499 : response.statusCode,
      Number(process.hrtime.bigint() - started) / 1e6
    )
  }
  response.once("finish", () => complete(false))
  response.once("close", () => complete(true))
}
