import { subject } from "@casl/ability"
import {
  type DatabaseTransaction,
  member,
  requiredOrganizationId,
  role,
  tenantWhere,
} from "@et/db"
import { ForbiddenException, HttpStatus } from "@nestjs/common"
import { and, eq } from "drizzle-orm"
import {
  createAppAbility,
  loadRulesForUser,
  memberRoleKey,
} from "../authz/permissions.js"
import { env } from "../env.js"
import { apiError } from "../http/api-error.js"

export async function assertDelegation(
  tx: DatabaseTransaction,
  actorId: string,
  action: "assign" | "grant" | "revoke",
  kind: "Role" | "Permission",
  record: Record<string, unknown>
) {
  const ability = createAppAbility(await loadRulesForUser(actorId, tx))
  if (!ability.can(action, subject(kind, record)))
    throw new ForbiddenException(
      `You do not have permission to ${action} this ${kind.toLowerCase()}`
    )
}

/** The role a membership currently holds: its assigned role or its Better Auth fallback. */
export function currentMemberRole(
  tx: DatabaseTransaction,
  membership: { appRoleId: string | null; role: string }
) {
  return tx.query.role.findFirst({
    where: and(
      membership.appRoleId
        ? eq(role.id, membership.appRoleId)
        : eq(role.key, memberRoleKey(membership.role)),
      tenantWhere(role.organizationId)
    ),
  })
}

/** A real assigned user must retain unconditional administration authority. */
export async function ensureRoleManager(tx: DatabaseTransaction) {
  const organizationId = env.MULTI_TENANCY ? requiredOrganizationId() : null
  const userIds = organizationId
    ? (
        await tx.query.member.findMany({
          columns: { userId: true },
          where: eq(member.organizationId, organizationId),
        })
      ).map((item) => item.userId)
    : (await tx.query.userRole.findMany({ columns: { userId: true } })).map(
        (item) => item.userId
      )
  for (const userId of new Set(userIds)) {
    const rules = await loadRulesForUser(userId, tx)
    const ability = createAppAbility(
      rules.filter(
        (rule) => rule.inverted || (!rule.conditions && !rule.fields?.length)
      )
    )
    const requirements = [
      ["update", "Role"],
      ["assign", "Role"],
      ["update", "Permission"],
      ["grant", "Permission"],
      ["revoke", "Permission"],
    ] as const
    if (
      requirements.every(([action, kind]) => {
        const relevant = rules.filter(
          (rule) =>
            [kind, "all"].includes(rule.subject as string) &&
            [action, "manage"].includes(rule.action as string)
        )
        return (
          !relevant.some((rule) => rule.inverted) && ability.can(action, kind)
        )
      })
    )
      return
  }
  apiError(
    HttpStatus.BAD_REQUEST,
    "At least one assigned user must retain unconditional administration permissions."
  )
}
