import { Conditions, UsePermision } from "@et/authz"
import {
  type ProjectInput,
  type ProjectListQuery,
  projectInputSchema,
  projectListQuerySchema,
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
  Query,
} from "@nestjs/common"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { SQL } from "drizzle-orm"
import { ProjectsService } from "./projects.service.js"

@Controller("projects")
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService
  ) {}

  @Get()
  @UsePermision("read", "Project")
  list(
    @Query({ schema: projectListQuerySchema }) query: ProjectListQuery,
    @Conditions() conditions: SQL
  ) {
    return this.projects.list(query, conditions)
  }

  @Get(":id")
  @UsePermision("read", "Project")
  findOne(@Param("id") id: string, @Conditions() conditions: SQL) {
    return this.projects.findOne(id, conditions)
  }

  @Post()
  @UsePermision("create", "Project")
  create(
    @Session() session: UserSession,
    @Body({ schema: projectInputSchema }) body: ProjectInput
  ) {
    return this.projects.create(session.user.id, body)
  }

  @Patch(":id")
  @UsePermision("update", "Project")
  update(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body({ schema: projectInputSchema }) body: ProjectInput,
    @Conditions() conditions: SQL
  ) {
    return this.projects.update(session.user.id, id, body, conditions)
  }

  @Delete(":id")
  @UsePermision("delete", "Project")
  remove(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Conditions() conditions: SQL
  ) {
    return this.projects.remove(session.user.id, id, conditions)
  }
}
