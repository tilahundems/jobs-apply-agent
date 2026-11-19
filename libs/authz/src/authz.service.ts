import { createMongoAbility } from "@casl/ability"
import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"

import {
  conditionsFor,
  relevantRules,
  UnsupportedPermissionError,
} from "./conditions.js"
import {
  AUTHZ_OPTIONS,
  type AuthzOptions,
  type AuthzRequest,
  type PermissionAbility,
  type PermissionSubject,
} from "./types.js"

@Injectable()
export class AuthzService {
  private readonly requests = new WeakMap<object, Promise<PermissionAbility>>()

  constructor(@Inject(AUTHZ_OPTIONS) private readonly options: AuthzOptions) {}

  async rulesForUser(
    userId: string,
    organizationId = this.options.getOrganizationId?.() ?? null
  ) {
    return this.options.loadRules(userId, organizationId)
  }

  async abilityForUser(
    userId: string,
    organizationId?: string | null
  ): Promise<PermissionAbility> {
    return createMongoAbility<PermissionAbility>(
      await this.rulesForUser(userId, organizationId)
    )
  }

  abilityForRequest(request: AuthzRequest): Promise<PermissionAbility> {
    const cached = this.requests.get(request)
    if (cached) return cached

    const userId = request.user?.id ?? request.session?.user?.id
    if (!userId) throw new UnauthorizedException()

    const ability = this.abilityForUser(
      userId,
      request.session?.session?.activeOrganizationId
    )
    this.requests.set(request, ability)
    return ability
  }

  conditions(ability: PermissionAbility, action: string, subject: string) {
    const table = Object.hasOwn(this.options.subjects, subject)
      ? this.options.subjects[subject]
      : undefined
    if (!table) {
      throw new Error(`No authorization table registered for ${subject}`)
    }
    try {
      return conditionsFor(ability, action, subject, table)
    } catch (error) {
      if (error instanceof UnsupportedPermissionError)
        throw new ForbiddenException(error.message)
      throw error
    }
  }

  async assert(
    userId: string,
    action: string,
    checked: PermissionSubject,
    fields?: string[]
  ) {
    const ability = await this.abilityForUser(userId)
    if (
      !ability.can(action, checked) ||
      fields?.some((field) => !ability.can(action, checked, field))
    ) {
      throw new ForbiddenException("You do not have permission to do that")
    }

    // A type-only or field-less assertion cannot safely enforce conditional/field rules.
    const subjectType = ability.detectSubjectType(checked)
    const rules = relevantRules(ability, action, subjectType)
    if (
      (typeof checked === "string" && rules.some((rule) => rule.conditions)) ||
      rules.some((rule) => rule.fields?.length)
    ) {
      throw new ForbiddenException("Record and field authorization is required")
    }
  }
}
