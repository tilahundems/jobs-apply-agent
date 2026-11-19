import { Module } from "@nestjs/common"
import { AuthzModule } from "../authz/authz.module.js"
import { PermissionsController } from "./permissions.controller.js"
import { PermissionsService } from "./permissions.service.js"

@Module({
  imports: [AuthzModule],
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
