import { UsePermision } from "@et/authz"
import { type ProfileInput, profileInputSchema } from "@et/contracts"
import { Body, Controller, Get, Inject, Put } from "@nestjs/common"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import { ProfileService } from "./profile.service.js"

@Controller("profile")
export class ProfileController {
  constructor(
    @Inject(ProfileService) private readonly profiles: ProfileService
  ) {}

  @Get()
  @UsePermision("read", "CandidateProfile")
  get() {
    return this.profiles.get()
  }

  @Put()
  @UsePermision("update", "CandidateProfile")
  save(
    @Session() session: UserSession,
    @Body({ schema: profileInputSchema }) body: ProfileInput
  ) {
    return this.profiles.save(session.user.id, body)
  }
}
