import type { ForcedSubject, MongoAbility, RawRuleOf } from "@casl/ability"
import type { Table } from "drizzle-orm"

export type PermissionSubject = string | ForcedSubject<string>
export type PermissionAbility = MongoAbility<[string, PermissionSubject]>
export type PermissionRule = RawRuleOf<PermissionAbility>

export interface AuthzRequest {
  user?: { id: string } | null
  session?: {
    user?: { id: string } | null
    session?: { activeOrganizationId?: string | null }
  } | null
}

export interface AuthzOptions {
  /** Rules in CASL order: later entries have higher priority. */
  loadRules: (
    userId: string,
    organizationId?: string | null
  ) => Promise<PermissionRule[]> | PermissionRule[]
  getOrganizationId?: () => string | null
  subjects: Record<string, Table>
}

export interface PermissionRequirement {
  action: string
  subject: string
}

export const AUTHZ_OPTIONS = Symbol("AUTHZ_OPTIONS")
export const PERMISSION = Symbol("PERMISSION")
