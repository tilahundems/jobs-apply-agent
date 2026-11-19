import { Conditions, UsePermision } from "@et/authz"
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { SQL } from "drizzle-orm"
import {
  type PermissionInput,
  permissionInputSchema,
  permissionOptions,
} from "./permission-input.js"
import { PermissionsService } from "./permissions.service.js"

@Controller("permissions")
export class PermissionsController {
  constructor(
    @Inject(PermissionsService)
    private readonly permissions: PermissionsService
  ) {}

  @Get()
  @UsePermision("read", "Permission")
  list(@Conditions() conditions: SQL) {
    return this.permissions.list(conditions)
  }

  @Get("options")
  @UsePermision("read", "Permission")
  options(@Conditions() _conditions: SQL) {
    return permissionOptions
  }

  @Post()
  @UsePermision("create", "Permission")
  create(
    @Session() session: UserSession,
    @Body({ schema: permissionInputSchema }) body: PermissionInput
  ) {
    return this.permissions.create(session.user.id, body)
  }

  @Patch(":id")
  @UsePermision("update", "Permission")
  update(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body({ schema: permissionInputSchema }) body: PermissionInput,
    @Conditions() conditions: SQL
  ) {
    return this.permissions.update(session.user.id, id, body, conditions)
  }

  @Delete(":id")
  @UsePermision("delete", "Permission")
  remove(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Conditions() conditions: SQL
  ) {
    return this.permissions.remove(session.user.id, id, conditions)
  }
}
