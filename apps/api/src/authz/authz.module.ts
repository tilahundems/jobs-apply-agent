import { AuthzModule as AuthorizationModule } from "@et/authz"
import {
  currentOrganizationId,
  db,
  rootDb,
  withTenantTransaction,
} from "@et/db"
import { Module } from "@nestjs/common"
import { env } from "../env.js"

import { AbilitiesController } from "./abilities.controller.js"
import { loadRulesForUser } from "./permissions.js"
import { SUBJECT_TABLES } from "./subject-tables.js"

@Module({
  imports: [
    AuthorizationModule.forRoot({
      loadRules: (userId, organizationId) =>
        env.MULTI_TENANCY && organizationId && !currentOrganizationId()
          ? withTenantTransaction(rootDb, organizationId, () =>
              loadRulesForUser(userId, db, organizationId)
            )
          : loadRulesForUser(userId, db, organizationId),
      getOrganizationId: currentOrganizationId,
      subjects: SUBJECT_TABLES,
    }),
  ],
  controllers: [AbilitiesController],
  exports: [AuthorizationModule],
})
export class AuthzModule {}
