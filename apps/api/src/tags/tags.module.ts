import { Module } from "@nestjs/common"

import { AuthzModule } from "../authz/authz.module.js"
import { TagsController } from "./tags.controller.js"
import { TagsService } from "./tags.service.js"

@Module({
  imports: [AuthzModule],
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}
