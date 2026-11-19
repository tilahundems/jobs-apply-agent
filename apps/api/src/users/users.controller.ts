import { Conditions, UsePermision } from "@et/authz"
import {
  type CreateUserInput,
  createUserInputSchema,
  type UserInput,
  userInputSchema,
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
import { UsersService } from "./users.service.js"

@Controller("users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get("me")
  me(@Session() session: UserSession) {
    return session
  }

  @Get("roles")
  listRoles(@Session() session: UserSession) {
    return this.users.listRoles(session.user.id)
  }

  @Get()
  @UsePermision("read", "User")
  list(@Conditions() conditions: SQL) {
    return this.users.list(conditions)
  }

  @Post()
  @UsePermision("create", "User")
  create(
    @Session() session: UserSession,
    @Body({ schema: createUserInputSchema }) body: CreateUserInput
  ) {
    return this.users.create(session.user.id, body)
  }

  @Patch(":id")
  @UsePermision("update", "User")
  update(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body({ schema: userInputSchema }) body: UserInput,
    @Conditions() conditions: SQL
  ) {
    return this.users.update(session.user.id, id, body, conditions)
  }

  @Delete(":id/membership")
  @UsePermision("delete", "User")
  removeMembership(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Conditions() conditions: SQL
  ) {
    return this.users.removeMembership(session.user.id, id, conditions)
  }
}
