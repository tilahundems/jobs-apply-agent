import type { AuditListQuery } from "@et/contracts"
import {
  auditLog,
  currentOrganizationId,
  type Database,
  type DatabaseTransaction,
  db,
  SINGLE_TENANT_ID,
  tenantWhere,
  user,
} from "@et/db"
import { Injectable } from "@nestjs/common"
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm"
import type { AuditRecorder, AuditRecordInput } from "../common/audit.port.js"
import { likeMatches, paginate } from "../common/list-query.js"

const sensitiveKey =
  /(password|token|authorization|cookie|api.?key|secret|otp|private.?key)/i

const metadataStatus = sql`json_extract(${auditLog.metadata}, '$.status')`
const metadataHttpStatus = sql`coalesce(json_extract(${auditLog.metadata}, '$.httpStatusCode'), json_extract(${auditLog.metadata}, '$.statusCode'), '')`

const statusExpression = sql<string>`case when
  upper(coalesce(${metadataStatus}, '')) in ('FAILED', 'FAILURE', 'ERROR')
  or ${auditLog.action} like '%FAILED%'
  or ${metadataHttpStatus} like '4%'
  or ${metadataHttpStatus} like '5%'
  then 'failed' else 'success' end`

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize)
  if (value === null || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : sanitize(item),
    ])
  )
}

function safeObject(value: Record<string, unknown> | null | undefined) {
  return value == null ? null : (sanitize(value) as Record<string, unknown>)
}

@Injectable()
export class AuditService implements AuditRecorder {
  private readonly database: Database = db

  async record(input: AuditRecordInput, tx?: DatabaseTransaction) {
    if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(input.action)) {
      throw new Error("Audit action must be a stable uppercase identifier")
    }
    const client: Database | DatabaseTransaction = tx ?? this.database
    const [record] = await client
      .insert(auditLog)
      .values({
        id: crypto.randomUUID(),
        actorId: input.actorId ?? null,
        actorType: input.actorType,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        organizationId:
          currentOrganizationId() ?? input.organizationId ?? SINGLE_TENANT_ID,
        oldValues: safeObject(input.oldValues),
        newValues: safeObject(input.newValues),
        metadata: safeObject(input.metadata),
        requestId: input.requestId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })
      .returning()
    return record
  }

  async list(query: AuditListQuery, conditions: SQL) {
    const filters: SQL[] = [conditions, tenantWhere(auditLog.organizationId)]
    if (query.q) {
      filters.push(
        or(
          likeMatches(auditLog.action, query.q),
          likeMatches(auditLog.resourceType, query.q),
          likeMatches(auditLog.resourceId, query.q),
          likeMatches(user.name, query.q),
          likeMatches(user.email, query.q)
        )!
      )
    }
    if (query.actor) {
      filters.push(
        or(
          likeMatches(auditLog.actorId, query.actor),
          likeMatches(auditLog.actorType, query.actor),
          likeMatches(user.name, query.actor),
          likeMatches(user.email, query.actor)
        )!
      )
    }
    if (query.actorId) filters.push(eq(auditLog.actorId, query.actorId))
    if (query.action) filters.push(likeMatches(auditLog.action, query.action))
    if (query.resourceType)
      filters.push(likeMatches(auditLog.resourceType, query.resourceType))
    if (query.resourceId)
      filters.push(eq(auditLog.resourceId, query.resourceId))
    if (query.organizationId)
      filters.push(eq(auditLog.organizationId, query.organizationId))
    if (query.status) filters.push(eq(statusExpression, query.status))
    if (query.from) filters.push(gte(auditLog.createdAt, query.from))
    if (query.to) filters.push(lte(auditLog.createdAt, query.to))
    const where = and(...filters)
    return await paginate(
      query,
      (window) =>
        this.database
          .select({
            id: auditLog.id,
            createdAt: auditLog.createdAt,
            actorId: auditLog.actorId,
            actorType: auditLog.actorType,
            actorName: sql<
              string | null
            >`coalesce(${user.name}, ${user.email})`,
            actorEmail: user.email,
            status: statusExpression,
            action: auditLog.action,
            resourceType: auditLog.resourceType,
            resourceId: auditLog.resourceId,
            organizationId: auditLog.organizationId,
            oldValues: auditLog.oldValues,
            newValues: auditLog.newValues,
            metadata: auditLog.metadata,
            requestId: auditLog.requestId,
            ipAddress: auditLog.ipAddress,
            userAgent: auditLog.userAgent,
          })
          .from(auditLog)
          .leftJoin(user, eq(auditLog.actorId, user.id))
          .where(where)
          .orderBy(
            query.sort === "oldest"
              ? asc(auditLog.createdAt)
              : desc(auditLog.createdAt),
            query.sort === "oldest" ? asc(auditLog.id) : desc(auditLog.id)
          )
          .limit(window.limit)
          .offset(window.offset),
      () =>
        this.database
          .select({ value: count() })
          .from(auditLog)
          .leftJoin(user, eq(auditLog.actorId, user.id))
          .where(where)
    )
  }
}
