import { AuthzService, type PermissionRule } from "@et/authz"
import { Controller, Get, Inject } from "@nestjs/common"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"

@Controller("abilities")
export class AbilitiesController {
  constructor(@Inject(AuthzService) private readonly authz: AuthzService) {}

  @Get()
  async current(
    @Session() session: UserSession
  ): Promise<{ rules: PermissionRule[] }> {
    return {
      rules: await this.authz.rulesForUser(session.user.id),
    }
  }
}
