import { Conditions, UsePermision } from "@et/authz"
import { type AuditListQuery, auditListQuerySchema } from "@et/contracts"
import { Controller, Get, Inject, Query } from "@nestjs/common"
import type { SQL } from "drizzle-orm"
import { AuditService } from "./audit.service.js"

@Controller("audit-logs")
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @UsePermision("read", "AuditLog")
  list(
    @Query({ schema: auditListQuerySchema }) query: AuditListQuery,
    @Conditions() conditions: SQL
  ) {
    return this.audit.list(query, conditions)
  }
}
