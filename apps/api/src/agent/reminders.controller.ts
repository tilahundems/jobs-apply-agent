import { UsePermision } from "@et/authz"
import { Controller, Get, Inject, Post } from "@nestjs/common"
import { RemindersService } from "./reminders.service.js"

@Controller("reminders")
export class RemindersController {
  constructor(
    @Inject(RemindersService) private readonly reminders: RemindersService
  ) {}

  @Get()
  @UsePermision("read", "JobPost")
  status() {
    return this.reminders.status()
  }

  @Post("test")
  @UsePermision("update", "CandidateProfile")
  test() {
    return this.reminders.sendTest()
  }
}
