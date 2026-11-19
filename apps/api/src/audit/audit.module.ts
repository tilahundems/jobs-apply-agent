import { Global, Module } from "@nestjs/common"
import { AuthzModule } from "../authz/authz.module.js"
import { AUDIT_RECORDER } from "../common/audit.port.js"
import { AuditController } from "./audit.controller.js"
import { AuditService } from "./audit.service.js"

/** Records audit events for every module through `@InjectAudit()`. */
@Global()
@Module({
  imports: [AuthzModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    { provide: AUDIT_RECORDER, useExisting: AuditService },
  ],
  exports: [AUDIT_RECORDER],
})
export class AuditModule {}
