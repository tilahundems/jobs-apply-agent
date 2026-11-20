import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import {
  account,
  db,
  invitation,
  member,
  organization,
  session,
  user,
  verification,
} from "@et/db"
import { APIError, betterAuth } from "better-auth"
import { bearer, organization as organizationPlugin } from "better-auth/plugins"

import { env } from "./env.js"

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/v1/auth",
  // The mini app loads the same web build from another origin.
  trustedOrigins: [env.WEB_ORIGIN, env.TELEGRAM_WEBAPP_URL].filter(
    (origin) => origin.length > 0
  ),
  rateLimit: { enabled: true },
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user,
      session,
      account,
      verification,
      organization,
      member,
      invitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    bearer(),
    ...(env.MULTI_TENANCY
      ? [
          organizationPlugin({
            disableOrganizationDeletion: true,
            organizationHooks: {
              beforeUpdateMemberRole: async () => {
                throw new APIError("FORBIDDEN", {
                  message:
                    "Change member roles through the workspace Users page.",
                })
              },
            },
          }),
        ]
      : []),
  ],
})
