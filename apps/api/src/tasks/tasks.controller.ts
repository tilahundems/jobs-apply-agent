import { Conditions, UsePermision } from "@et/authz"
import {
  type TaskInput,
  type TaskListQuery,
  taskInputSchema,
  taskListQuerySchema,
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
import { TasksService } from "./tasks.service.js"

@Controller("tasks")
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}

  @Get("page")
  @UsePermision("read", "Task")
  page(
    @Session() session: UserSession,
    @Query({ schema: taskListQuerySchema }) query: TaskListQuery,
    @Conditions() conditions: SQL
  ) {
    return this.tasks.page(session.user.id, query, conditions)
  }

  @Get()
  @UsePermision("read", "Task")
  list(@Session() session: UserSession, @Conditions() conditions: SQL) {
    return this.tasks.list(session.user.id, conditions)
  }

  @Post()
  @UsePermision("create", "Task")
  create(
    @Session() session: UserSession,
    @Body({ schema: taskInputSchema }) body: TaskInput
  ) {
    return this.tasks.create(session.user.id, body)
  }

  @Patch(":id")
  @UsePermision("update", "Task")
  update(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body({ schema: taskInputSchema }) body: TaskInput,
    @Conditions() conditions: SQL
  ) {
    return this.tasks.update(session.user.id, id, body, conditions)
  }

  @Delete(":id")
  @UsePermision("delete", "Task")
  remove(@Param("id") id: string, @Conditions() conditions: SQL) {
    return this.tasks.remove(id, conditions)
  }
}
