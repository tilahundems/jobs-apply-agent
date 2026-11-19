import { Conditions, UsePermision } from "@et/authz"
import {
  type RoleInput,
  type RoleUpdateInput,
  roleInputSchema,
  roleUpdateInputSchema,
} from "@et/contracts"
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
import { RolesService } from "./roles.service.js"

@Controller("roles")
export class RolesController {
  constructor(@Inject(RolesService) private readonly roles: RolesService) {}

  @Get()
  @UsePermision("read", "Role")
  list(@Conditions() conditions: SQL) {
    return this.roles.list(conditions)
  }

  @Post()
  @UsePermision("create", "Role")
  create(
    @Session() session: UserSession,
    @Body({ schema: roleInputSchema }) body: RoleInput
  ) {
    return this.roles.create(session.user.id, body)
  }

  @Patch(":id")
  @UsePermision("update", "Role")
  update(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body({ schema: roleUpdateInputSchema }) body: RoleUpdateInput,
    @Conditions() conditions: SQL
  ) {
    return this.roles.update(session.user.id, id, body, conditions)
  }

  @Delete(":id")
  @UsePermision("delete", "Role")
  remove(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Conditions() conditions: SQL
  ) {
    return this.roles.remove(session.user.id, id, conditions)
  }
}
