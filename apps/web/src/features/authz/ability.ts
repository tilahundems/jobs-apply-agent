import type { ForcedSubject, MongoAbility, RawRuleOf } from "@casl/ability"
import { createMongoAbility, subject } from "@casl/ability"
import { ACTIONS, SUBJECTS } from "@et/contracts"

export { ACTIONS, SUBJECTS }

export type Action = (typeof ACTIONS)[number] | (string & {})
export type Subject = (typeof SUBJECTS)[number]
export type AppSubject = Subject | ForcedSubject<Exclude<Subject, "all">>
export type AppAbility = MongoAbility<[Action, AppSubject]>
// Rules cross the server-function boundary as JSON; omit CASL's type-only query brand.
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }
export type AppAbilityRule = Omit<RawRuleOf<AppAbility>, "conditions"> & {
  conditions?: Record<string, JsonValue>
}

export function createAppAbility(rules: AppAbilityRule[] = []): AppAbility {
  return createMongoAbility<AppAbility>(rules)
}

export { subject }
