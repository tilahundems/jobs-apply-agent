import { AbilityProvider as CaslAbilityProvider, useAbility } from "@casl/react"
import type { ReactNode } from "react"
import { createContext, useContext, useMemo } from "react"
import type { AppAbility, AppAbilityRule } from "./ability"
import { createAppAbility } from "./ability"

const CurrentUserIdContext = createContext<string | null>(null)

export function AppAbilityProvider({
  rules,
  userId,
  children,
}: {
  rules: AppAbilityRule[]
  userId: string
  children: ReactNode
}) {
  const ability = useMemo(() => createAppAbility(rules), [rules])

  return (
    <CurrentUserIdContext.Provider value={userId}>
      <CaslAbilityProvider value={ability}>{children}</CaslAbilityProvider>
    </CurrentUserIdContext.Provider>
  )
}

export function useCurrentUserId() {
  return useContext(CurrentUserIdContext)
}

export function useAppAbility() {
  return useAbility<AppAbility>()
}
