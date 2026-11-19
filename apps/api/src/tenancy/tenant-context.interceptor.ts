import { member, rootDb, SINGLE_TENANT_ID, withTenantTransaction } from "@et/db"
import {
  type CallHandler,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  type NestInterceptor,
  UnauthorizedException,
} from "@nestjs/common"
import { and, eq } from "drizzle-orm"
import { from, lastValueFrom, mergeMap } from "rxjs"
import { env } from "../env.js"

type AuthenticatedRequest = {
  url?: string
  session?: {
    user?: { id: string }
    session?: { activeOrganizationId?: string | null }
  } | null
}

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (request.url?.split("?")[0]?.endsWith("/notifications/stream")) {
      return from(this.resolveOrganizationId(request)).pipe(
        mergeMap(() => next.handle())
      )
    }
    return from(this.handle(request, next))
  }

  private async handle(request: AuthenticatedRequest, next: CallHandler) {
    // Better Auth's own routes do not use tenant-owned application tables.
    if (!request.session?.user?.id) {
      return lastValueFrom(next.handle())
    }

    const organizationId = await this.resolveOrganizationId(request)
    return withTenantTransaction(rootDb, organizationId, () =>
      lastValueFrom(next.handle())
    )
  }

  private async resolveOrganizationId(request: AuthenticatedRequest) {
    if (!request.session?.user?.id) return SINGLE_TENANT_ID
    let organizationId = SINGLE_TENANT_ID
    if (env.MULTI_TENANCY) {
      const active = request.session.session?.activeOrganizationId
      if (!active) throw new ForbiddenException("Select an organization first")
      const [membership] = await rootDb
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, active),
            eq(member.userId, request.session.user.id)
          )
        )
        .limit(1)
      if (!membership)
        throw new UnauthorizedException("Organization membership required")
      organizationId = active
    }

    return organizationId
  }
}
