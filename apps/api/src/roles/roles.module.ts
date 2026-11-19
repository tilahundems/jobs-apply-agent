import { Module } from "@nestjs/common"

import { AuthzModule } from "../authz/authz.module.js"
import { RolesController } from "./roles.controller.js"
import { RolesService } from "./roles.service.js"

@Module({
  imports: [AuthzModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
