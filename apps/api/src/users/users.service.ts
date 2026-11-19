import { AuthzService, an } from "@et/authz"
import type { CreateUserInput, UserInput } from "@et/contracts"
import {
  currentOrganizationId,
  db,
  lockRoleAssignments,
  member,
  requiredOrganizationId,
  role,
  tenantWhere,
  user,
  userRole,
} from "@et/db"
import { HttpStatus, Inject, Injectable } from "@nestjs/common"
import { and, eq, exists, inArray, type SQL } from "drizzle-orm"
import { auth } from "../auth.js"
import {
  createAppAbility,
  isOrgAdmin,
  isOrgOwner,
  loadRulesForUser,
  memberRoleKey,
  ROLE_ADMIN,
} from "../authz/permissions.js"
import { type AuditRecorder, InjectAudit } from "../common/audit.port.js"
import { env } from "../env.js"
import { apiError } from "../http/api-error.js"
import {
  assertDelegation,
  currentMemberRole,
  ensureRoleManager,
} from "../roles/role-management.js"

const userColumns = {
  id: true,
  name: true,
  email: true,
  image: true,
  createdAt: true,
} as const

const roleColumns = {
  id: true,
  key: true,
  name: true,
  description: true,
} as const

function serializeUser<T extends { userRoles: Array<{ role: unknown }> }>(
  row: T
) {
  const { userRoles, ...userRow } = row

  return {
    ...userRow,
    roles: userRoles.map((assignment) => assignment.role),
  }
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(AuthzService) private readonly authz: AuthzService,
    @InjectAudit() private readonly audit?: AuditRecorder
  ) {}

  async list(conditions: SQL) {
    const organizationId = currentOrganizationId()
    const rows = await db.query.user.findMany({
      where:
        env.MULTI_TENANCY && organizationId
          ? and(
              conditions,
              exists(
                db
                  .select({ id: member.id })
                  .from(member)
                  .where(
                    and(
                      eq(member.userId, user.id),
                      eq(member.organizationId, organizationId)
                    )
                  )
              )
            )
          : conditions,
      columns: userColumns,
      with: {
        userRoles: {
          with: {
            role: {
              columns: roleColumns,
            },
          },
        },
      },
      orderBy: (userTable, { asc }) => [asc(userTable.name)],
    })

    if (!env.MULTI_TENANCY) return rows.map(serializeUser)
    const memberships = rows.length
      ? await db.query.member.findMany({
          where: and(
            eq(member.organizationId, requiredOrganizationId()),
            inArray(
              member.userId,
              rows.map((row) => row.id)
            )
          ),
        })
      : []
    const roles = await db.query.role.findMany({
      where: tenantWhere(role.organizationId),
      columns: roleColumns,
    })
    return rows.map((row) => {
      const membership = memberships.find((item) => item.userId === row.id)
      const key = memberRoleKey(membership?.role)
      const assigned =
        roles.find((item) => item.id === membership?.appRoleId) ??
        roles.find((item) => item.key === key)
      const { userRoles: _userRoles, ...userRow } = row
      return { ...userRow, roles: assigned ? [assigned] : [] }
    })
  }

  async listRoles(actorId: string) {
    const ability = createAppAbility(await loadRulesForUser(actorId))
    const roles = await db.query.role.findMany({
      columns: roleColumns,
      where: tenantWhere(role.organizationId),
      orderBy: (table, { asc }) => [asc(table.name)],
    })
    return roles.filter((item) => ability.can("assign", an("Role", item)))
  }

  async create(actorId: string, input: CreateUserInput) {
    if (env.MULTI_TENANCY) {
      apiError(
        HttpStatus.BAD_REQUEST,
        "Invite people to the organization instead of creating a global account."
      )
    }
    const candidate = {
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email,
      roleId: input.roleId,
    }
    await this.authz.assert(
      actorId,
      "create",
      an("User", candidate),
      Object.keys(input)
    )

    const assignedRole = await db.query.role.findFirst({
      columns: roleColumns,
      where: (roleTable, { eq: eqOp }) => eqOp(roleTable.id, input.roleId),
    })

    if (!assignedRole) {
      apiError(HttpStatus.BAD_REQUEST, "Role not found")
    }

    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, input.email))
      .limit(1)

    if (existing) {
      apiError(HttpStatus.BAD_REQUEST, "A user with this email already exists.")
    }

    await db.transaction(async (tx) => {
      await lockRoleAssignments(tx)
      await assertDelegation(tx, actorId, "assign", "Role", assignedRole)
    })

    const created = await auth.api.signUpEmail({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
      },
    })

    try {
      await db.transaction(async (tx) => {
        await lockRoleAssignments(tx)
        const targetRole = await tx.query.role.findFirst({
          where: eq(role.id, assignedRole.id),
        })
        if (!targetRole) apiError(HttpStatus.BAD_REQUEST, "Role not found")
        await assertDelegation(tx, actorId, "assign", "Role", targetRole)
        await tx.delete(userRole).where(eq(userRole.userId, created.user.id))
        await tx.insert(userRole).values({
          userId: created.user.id,
          roleId: assignedRole.id,
        })
        await this.audit?.record(
          {
            actorId,
            actorType: "USER",
            action: "USER_ROLE_ASSIGNED",
            resourceType: "user",
            resourceId: created.user.id,
            newValues: { roleId: assignedRole.id },
          },
          tx
        )
      })
    } catch (error) {
      // Better Auth owns credential creation; compensate if assignment fails.
      await db.delete(user).where(eq(user.id, created.user.id))
      throw error
    }

    return {
      id: created.user.id,
      name: created.user.name,
      email: created.user.email,
      image: created.user.image ?? null,
      createdAt: created.user.createdAt,
      roles: [assignedRole],
    }
  }

  async update(actorId: string, id: string, input: UserInput, conditions: SQL) {
    if (env.MULTI_TENANCY)
      return this.updateMembershipRole(actorId, id, input, conditions)
    return await db.transaction(async (tx) => {
      await lockRoleAssignments(tx)
      const [existing] = await tx
        .select()
        .from(user)
        .where(and(conditions, eq(user.id, id)))

      if (!existing) apiError(HttpStatus.NOT_FOUND, "User not found")

      await this.authz.assert(
        actorId,
        "update",
        an("User", { ...existing, ...input }),
        Object.keys(input)
      )

      const existingAssignments = await tx.query.userRole.findMany({
        where: eq(userRole.userId, id),
        with: { role: true },
      })
      const changingRole =
        input.roleId !== undefined &&
        !(
          existingAssignments.length === 1 &&
          existingAssignments[0]?.roleId === input.roleId
        )
      const assignedRole = changingRole
        ? await tx.query.role.findFirst({
            columns: roleColumns,
            where: eq(role.id, input.roleId!),
          })
        : undefined
      if (changingRole) {
        if (!assignedRole) apiError(HttpStatus.BAD_REQUEST, "Role not found")
        await assertDelegation(tx, actorId, "assign", "Role", assignedRole)
        for (const link of existingAssignments)
          await assertDelegation(tx, actorId, "assign", "Role", link.role)
      }

      const [userRow] = await tx
        .update(user)
        .set({
          name: input.name,
        })
        .where(and(conditions, eq(user.id, id)))
        .returning({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          createdAt: user.createdAt,
        })

      if (!userRow) apiError(HttpStatus.NOT_FOUND, "User not found")

      if (changingRole && assignedRole) {
        await tx.delete(userRole).where(eq(userRole.userId, id))
        await tx
          .insert(userRole)
          .values({ userId: id, roleId: assignedRole.id })
        await ensureRoleManager(tx)
        await this.audit?.record(
          {
            actorId,
            actorType: "USER",
            action: "USER_ROLE_ASSIGNED",
            resourceType: "user",
            resourceId: id,
            oldValues: {
              roleIds: existingAssignments.map((link) => link.roleId),
            },
            newValues: { roleIds: [assignedRole.id] },
          },
          tx
        )
      }
      return {
        ...userRow,
        roles:
          changingRole && assignedRole
            ? [assignedRole]
            : existingAssignments.map((link) => link.role),
      }
    })
  }

  private async updateMembershipRole(
    actorId: string,
    id: string,
    input: UserInput,
    conditions: SQL
  ) {
    if (!input.roleId) apiError(HttpStatus.BAD_REQUEST, "Role is required")
    const organizationId = requiredOrganizationId()
    return db.transaction(async (tx) => {
      await lockRoleAssignments(tx)
      const [existing] = await tx
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(and(conditions, eq(user.id, id)))
        .limit(1)
      if (!existing) apiError(HttpStatus.NOT_FOUND, "User not found")
      const [membership] = await tx
        .select()
        .from(member)
        .where(
          and(eq(member.userId, id), eq(member.organizationId, organizationId))
        )
      if (!membership) apiError(HttpStatus.NOT_FOUND, "User not found")
      const [actorMembership] = await tx
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.userId, actorId),
            eq(member.organizationId, organizationId)
          )
        )
        .limit(1)
      if (!isOrgAdmin(actorMembership?.role))
        apiError(HttpStatus.FORBIDDEN, "Organization administration required")
      if (isOrgOwner(membership.role) && !isOrgOwner(actorMembership?.role))
        apiError(
          HttpStatus.FORBIDDEN,
          "Only an owner can change an owner's role"
        )
      if (input.name !== existing.name)
        apiError(
          HttpStatus.BAD_REQUEST,
          "Organization admins cannot change a global profile name"
        )
      const [assignedRole] = await tx
        .select()
        .from(role)
        .where(
          and(eq(role.id, input.roleId!), tenantWhere(role.organizationId))
        )
        .limit(1)
      if (!assignedRole) apiError(HttpStatus.BAD_REQUEST, "Role not found")
      await this.authz.assert(
        actorId,
        "update",
        an("User", { ...existing, roleId: assignedRole.id }),
        ["roleId"]
      )
      await assertDelegation(tx, actorId, "assign", "Role", assignedRole)
      const previousRole = await currentMemberRole(tx, membership)
      if (previousRole)
        await assertDelegation(tx, actorId, "assign", "Role", previousRole)
      const owner = isOrgOwner(membership.role)
      if (owner && assignedRole.key !== ROLE_ADMIN)
        apiError(
          HttpStatus.BAD_REQUEST,
          "Transfer ownership before changing the owner's role"
        )
      await tx
        .update(member)
        .set({
          appRoleId: assignedRole.id,
          role: owner
            ? "owner"
            : assignedRole.key === ROLE_ADMIN
              ? "admin"
              : "member",
        })
        .where(eq(member.id, membership.id))
      await ensureRoleManager(tx)
      if (previousRole?.id !== assignedRole.id)
        await this.audit?.record(
          {
            actorId,
            actorType: "USER",
            action: "USER_ROLE_ASSIGNED",
            resourceType: "user",
            resourceId: id,
            oldValues: { roleId: previousRole?.id ?? null },
            newValues: { roleId: assignedRole.id },
          },
          tx
        )
      return {
        ...existing,
        roles: [
          {
            id: assignedRole.id,
            key: assignedRole.key,
            name: assignedRole.name,
            description: assignedRole.description,
          },
        ],
      }
    })
  }

  async removeMembership(actorId: string, id: string, conditions: SQL) {
    if (!env.MULTI_TENANCY)
      apiError(HttpStatus.NOT_FOUND, "Membership not found")
    const organizationId = requiredOrganizationId()
    return db.transaction(async (tx) => {
      await lockRoleAssignments(tx)
      const [existing] = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(conditions, eq(user.id, id)))
        .limit(1)
      if (!existing) apiError(HttpStatus.NOT_FOUND, "Member not found")
      const [membership] = await tx
        .select()
        .from(member)
        .where(
          and(eq(member.organizationId, organizationId), eq(member.userId, id))
        )
      if (!membership) apiError(HttpStatus.NOT_FOUND, "Member not found")
      await this.authz.assert(actorId, "delete", an("User", existing))
      if (isOrgOwner(membership.role))
        apiError(
          HttpStatus.BAD_REQUEST,
          "Transfer ownership before removing the owner"
        )
      const [actor] = await tx
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, actorId)
          )
        )
        .limit(1)
      if (!isOrgAdmin(actor?.role))
        apiError(HttpStatus.FORBIDDEN, "Organization administration required")
      const previousRole = await currentMemberRole(tx, membership)
      if (previousRole)
        await assertDelegation(tx, actorId, "assign", "Role", previousRole)
      await tx.delete(member).where(eq(member.id, membership.id))
      await ensureRoleManager(tx)
      await this.audit?.record(
        {
          actorId,
          actorType: "USER",
          action: "MEMBER_REMOVED",
          resourceType: "user",
          resourceId: id,
          oldValues: {
            role: membership.role,
            roleId: previousRole?.id ?? null,
          },
        },
        tx
      )
      return { ok: true as const }
    })
  }
}
