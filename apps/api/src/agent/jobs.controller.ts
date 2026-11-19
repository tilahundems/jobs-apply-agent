import { Conditions, UsePermision } from "@et/authz"
import {
  type JobListQuery,
  type JobStatusInput,
  jobListQuerySchema,
  jobStatusInputSchema,
} from "@et/contracts"
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { SQL } from "drizzle-orm"
import type { Response } from "express"
import { JobsService } from "./jobs.service.js"

@Controller("jobs")
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}

  @Get()
  @UsePermision("read", "JobPost")
  list(
    @Query({ schema: jobListQuerySchema }) query: JobListQuery,
    @Conditions() conditions: SQL
  ) {
    return this.jobs.list(query, conditions)
  }

  @Get("summary")
  @UsePermision("read", "JobPost")
  summary(@Conditions() conditions: SQL) {
    return this.jobs.summary(conditions)
  }

  @Post("ingest")
  @UsePermision("create", "JobPost")
  ingest() {
    return this.jobs.ingest()
  }

  @Get(":id")
  @UsePermision("read", "JobPost")
  findOne(@Param("id") id: string, @Conditions() conditions: SQL) {
    return this.jobs.findOne(id, conditions)
  }

  @Post(":id/prepare")
  @UsePermision("update", "JobPost")
  prepare(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Conditions() conditions: SQL
  ) {
    return this.jobs.prepare(session.user.id, id, conditions)
  }

  @Patch(":id")
  @UsePermision("update", "JobPost")
  updateStatus(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body({ schema: jobStatusInputSchema }) body: JobStatusInput,
    @Conditions() conditions: SQL
  ) {
    return this.jobs.setStatus(session.user.id, id, body, conditions)
  }

  @Get(":id/cv.docx")
  @UsePermision("read", "JobPost")
  async cv(
    @Param("id") id: string,
    @Conditions() conditions: SQL,
    @Res() response: Response
  ) {
    const buffer = await this.jobs.cvDocx(id, conditions)
    response.set({
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="tailored-cv.docx"`,
      "content-length": String(buffer.byteLength),
    })
    response.send(buffer)
  }
}
