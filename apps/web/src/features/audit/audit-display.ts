import type { AuditLog } from "./audit-api"

export function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function actionLabel(action: string) {
  const standard = [
    "CREATED",
    "UPDATED",
    "DELETED",
    "LOGIN",
    "LOGOUT",
    "LOGIN_FAILED",
    "APPROVED",
    "REJECTED",
    "ASSIGNED",
    "EXPORTED",
    "IMPORTED",
    "ROLE_CHANGED",
    "PERMISSION_CHANGED",
  ]
  const match = standard.find(
    (value) => action === value || action.endsWith(`_${value}`)
  )
  return humanize(match ?? action)
}

export function actorLabel(event: AuditLog) {
  return (
    event.actorName ??
    (event.actorType === "USER" ? "Unknown user" : humanize(event.actorType))
  )
}

export function targetLabel(event: AuditLog) {
  const name =
    event.metadata?.targetName ?? event.newValues?.name ?? event.oldValues?.name
  return typeof name === "string" && name ? name : event.resourceId || "—"
}

export function valueLabel(value: unknown): string {
  if (value == null) return "—"
  if (typeof value === "string")
    return /^[A-Z][A-Z0-9_]*$/.test(value) ? humanize(value) : value
  if (typeof value === "number" || typeof value === "boolean")
    return String(value)
  if (Array.isArray(value)) return value.map(valueLabel).join(", ") || "—"
  return JSON.stringify(value)
}

export function changes(event: AuditLog) {
  const keys = new Set([
    ...Object.keys(event.oldValues ?? {}),
    ...Object.keys(event.newValues ?? {}),
  ])
  return [...keys]
    .filter(
      (key) =>
        JSON.stringify(event.oldValues?.[key]) !==
        JSON.stringify(event.newValues?.[key])
    )
    .map((key) => ({
      field: humanize(key),
      before: valueLabel(event.oldValues?.[key]),
      after: valueLabel(event.newValues?.[key]),
    }))
}

export function isChangeEvent(event: AuditLog) {
  return /(?:UPDATED|CHANGED)$/.test(event.action)
}

export function eventSummary(event: AuditLog) {
  const change = isChangeEvent(event) ? changes(event)[0] : undefined
  if (change)
    return `${change.field} changed: ${change.before} → ${change.after}`
  if (event.action.endsWith("LOGIN")) return "User logged in"
  if (event.action.endsWith("LOGIN_FAILED")) return "Login failed"
  if (event.action.endsWith("LOGOUT")) return "User logged out"
  return `${humanize(event.resourceType)} ${actionLabel(event.action).toLowerCase()}`
}
