import { api } from "@/lib/api"

import type { AppAbilityRule } from "./ability"

export async function getAbilityRules(): Promise<AppAbilityRule[]> {
  const payload = await api<{ rules?: AppAbilityRule[] }>("/api/v1/abilities")
  return payload.rules ?? []
}
