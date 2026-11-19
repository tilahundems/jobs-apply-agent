import { AuthzService, an } from "@et/authz"
import {
  type DatabaseTransaction,
  db,
  lockRoleAssignments,
  permission,
  requiredOrganizationId,
  rolePermission,
  tenantWhere,
} from "@et/db"
import { HttpStatus, Inject, Injectable } from "@nestjs/common"
import { and, eq, type SQL, sql } from "drizzle-orm"
import {
  type AuditRecorder,
  auditChanges,
  InjectAudit,
} from "../common/audit.port.js"
import { apiError } from "../http/api-error.js"
import {
  assertDelegation,
  ensureRoleManager,
} from "../roles/role-management.js"
import type { PermissionInput } from "./permission-input.js"

async function checkDuplicate(
  tx: DatabaseTransaction,
  input: PermissionInput,
  existing?: typeof permission.$inferSelect
) {
  const fields = existing?.fields ?? []
  const inverted = existing?.inverted ?? false
  const matches = await tx
    .select({ id: permission.id })
    .from(permission)
    .where(
      and(
        tenantWhere(permission.organizationId),
        eq(permission.subject, input.subject),
        eq(permission.action, input.action),
        eq(permission.fields, fields),
        eq(permission.inverted, inverted),
        // SQLite's `IS` is a null-safe equality, so a missing body compares equal
        // to NULL without the Postgres `is not distinct from ...::jsonb` dance.
        sql`${permission.conditions} is ${input.conditions == null ? null : JSON.stringify(input.conditions)}`
      )
    )
  // A no-op edit preserves legacy duplicate IDs and their assignments.
  if (existing && matches.some((item) => item.id === existing.id)) return
  if (matches.length)
    apiError(
      HttpStatus.CONFLICT,
      "A permission with this definition already exists."
    )
}

@Injectable()
export class PermissionsService {
  constructor(
    @Inject(AuthzService) private readonly authz: AuthzService,
    @InjectAudit() private readonly audit?: AuditRecorder
  ) {}

  async list(conditions: SQL) {
    const rows = await db.query.permission.findMany({
      where: and(conditions, tenantWhere(permission.organizationId)),
      orderBy: (table, { asc }) => [
        asc(table.subject),
        asc(table.action),
        asc(table.id),
      ],
      with: { rolePermissions: { columns: { roleId: true } } },
    })
    return rows.map(({ rolePermissions, ...row }) => ({
      ...row,
      roleCount: rolePermissions.length,
    }))
  }

  async create(userId: string, input: PermissionInput) {
    const candidate = {
      id: crypto.randomUUID(),
      organizationId: requiredOrganizationId(),
      ...input,
      fields: [],
      inverted: false,
      reason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await this.authz.assert(
      userId,
      "create",
      an("Permission", candidate),
      Object.keys(input)
    )

    return db.transaction(async (tx) => {
      await lockRoleAssignments(tx)
      await assertDelegation(tx, userId, "grant", "Permission", candidate)
      await checkDuplicate(tx, input)
      const [saved] = await tx.insert(permission).values(candidate).returning()
      await this.audit?.record(
        {
          actorId: userId,
          actorType: "USER",
          action: "PERMISSION_CREATED",
          resourceType: "permission",
          resourceId: candidate.id,
          newValues: input,
        },
        tx
      )
      return saved
    })
  }

  async update(
    userId: string,
    id: string,
    input: PermissionInput,
    conditions: SQL
  ) {
    return await db.transaction(async (tx) => {
      await lockRoleAssignments(tx)
      const [existing] = await tx
        .select()
        .from(permission)
        .where(
          and(
            conditions,
            tenantWhere(permission.organizationId),
            eq(permission.id, id)
          )
        )
      if (!existing) apiError(HttpStatus.NOT_FOUND, "Permission not found")
      await this.authz.assert(
        userId,
        "update",
        an("Permission", { ...existing, ...input }),
        Object.keys(input)
      )
      await assertDelegation(tx, userId, "revoke", "Permission", existing)
      await assertDelegation(tx, userId, "grant", "Permission", {
        ...existing,
        ...input,
      })
      await checkDuplicate(tx, input, existing)
      const [saved] = await tx
        .update(permission)
        .set(input)
        .where(
          and(eq(permission.id, id), tenantWhere(permission.organizationId))
        )
        .returning()
      await ensureRoleManager(tx)
      const changes = auditChanges(existing, input)
      if (changes)
        await this.audit?.record(
          {
            actorId: userId,
            actorType: "USER",
            action: "PERMISSION_UPDATED",
            resourceType: "permission",
            resourceId: id,
            ...changes,
          },
          tx
        )
      return saved
    })
  }

  async remove(userId: string, id: string, conditions: SQL) {
    return await db.transaction(async (tx) => {
      await lockRoleAssignments(tx)
      const [existing] = await tx
        .select()
        .from(permission)
        .where(
          and(
            conditions,
            tenantWhere(permission.organizationId),
            eq(permission.id, id)
          )
        )
      if (!existing) apiError(HttpStatus.NOT_FOUND, "Permission not found")
      const [assigned] = await tx
        .select()
        .from(rolePermission)
        .where(eq(rolePermission.permissionId, id))
        .limit(1)
      if (assigned)
        apiError(
          HttpStatus.BAD_REQUEST,
          "Remove this permission from its roles before deleting it."
        )
      await tx
        .delete(permission)
        .where(
          and(eq(permission.id, id), tenantWhere(permission.organizationId))
        )
      await this.audit?.record(
        {
          actorId: userId,
          actorType: "USER",
          action: "PERMISSION_DELETED",
          resourceType: "permission",
          resourceId: id,
          oldValues: {
            subject: existing.subject,
            action: existing.action,
            conditions: existing.conditions,
          },
        },
        tx
      )
      return { ok: true as const }
    })
  }
}
