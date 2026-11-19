import type { DatabaseTransaction } from "@et/db"
import { Inject, Optional } from "@nestjs/common"

export type AuditActorType = "USER" | "SYSTEM" | "SERVICE"

export type AuditRecordInput = {
  actorId?: string | null
  actorType: AuditActorType
  action: string
  resourceType: string
  resourceId: string
  organizationId?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  requestId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export type AuditRecorder = {
  /** Pass `tx` so the event commits or rolls back with the change it records. */
  record(input: AuditRecordInput, tx?: DatabaseTransaction): Promise<unknown>
}

export const AUDIT_RECORDER = Symbol("AUDIT_RECORDER")

/**
 * Injects the audit recorder. It is `undefined` when `pnpm new` removed audit
 * logging, so record with `await this.audit?.record(...)`.
 */
export function InjectAudit(): ParameterDecorator {
  return (target, key, index) => {
    Optional()(target, key, index)
    Inject(AUDIT_RECORDER)(target, key, index)
  }
}

/** The fields whose values differ, as audit old and new values; null when none do. */
export function auditChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue
    oldValues[key] = before[key]
    newValues[key] = after[key]
  }
  return Object.keys(newValues).length ? { oldValues, newValues } : null
}
