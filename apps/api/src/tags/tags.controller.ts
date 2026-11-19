import { Conditions, UsePermision } from "@et/authz"
import {
  type TagInput,
  type TagListQuery,
  tagInputSchema,
  tagListQuerySchema,
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
import { TagsService } from "./tags.service.js"

@Controller("tags")
export class TagsController {
  constructor(@Inject(TagsService) private readonly tags: TagsService) {}

  @Get("page")
  @UsePermision("read", "Tag")
  page(
    @Query({ schema: tagListQuerySchema }) query: TagListQuery,
    @Conditions() conditions: SQL
  ) {
    return this.tags.page(query, conditions)
  }

  @Get()
  @UsePermision("read", "Tag")
  list(@Conditions() conditions: SQL) {
    return this.tags.list(conditions)
  }

  @Post()
  @UsePermision("create", "Tag")
  create(
    @Session() session: UserSession,
    @Body({ schema: tagInputSchema }) body: TagInput
  ) {
    return this.tags.create(session.user.id, body)
  }

  @Patch(":id")
  @UsePermision("update", "Tag")
  update(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body({ schema: tagInputSchema }) body: TagInput,
    @Conditions() conditions: SQL
  ) {
    return this.tags.update(session.user.id, id, body, conditions)
  }

  @Delete(":id")
  @UsePermision("delete", "Tag")
  remove(@Param("id") id: string, @Conditions() conditions: SQL) {
    return this.tags.remove(id, conditions)
  }
}
