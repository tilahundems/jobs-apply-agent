import { redirect } from "@tanstack/react-router"
import type { Action, AppAbility, AppAbilityRule, Subject } from "./ability"
import { createAppAbility } from "./ability"

export type PageSubject = Exclude<Subject, "all">

export type PageAbility = {
  action: Action
  subject: PageSubject
}

export function abilityFromRules(rules: AppAbilityRule[] | undefined) {
  return createAppAbility(rules ?? [])
}

export function canAccessPage(
  ability: AppAbility,
  requirement?: PageAbility | null
) {
  if (requirement == null) {
    return true
  }

  return ability.can(requirement.action, requirement.subject)
}

export function canReadSubject(
  rules: AppAbilityRule[] | undefined,
  subject: PageSubject
) {
  return canAccessPage(abilityFromRules(rules), { action: "read", subject })
}

export function requirePageAbility(
  rules: AppAbilityRule[] | undefined,
  action: Action,
  subject: PageSubject
) {
  if (!canAccessPage(abilityFromRules(rules), { action, subject })) {
    throw redirect({ to: "/dashboard" })
  }
}
