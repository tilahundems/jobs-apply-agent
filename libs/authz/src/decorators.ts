import {
  applyDecorators,
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UseGuards,
} from "@nestjs/common"
import type { SQL } from "drizzle-orm"
import { AuthzService } from "./authz.service.js"
import { relevantRules } from "./conditions.js"
import {
  type AuthzRequest,
  PERMISSION,
  type PermissionRequirement,
} from "./types.js"

const requestConditions = new WeakMap<object, SQL>()
const conditionHandlers = new WeakSet<object>()

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(@Inject(AuthzService) private readonly authz: AuthzService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = Reflect.getMetadata(PERMISSION, context.getHandler()) as
      | PermissionRequirement
      | undefined
    if (!permission) throw new Error("AccessGuard requires @UsePermision()")
    const request = context.switchToHttp().getRequest<AuthzRequest>()
    const ability = await this.authz.abilityForRequest(request)
    if (!ability.can(permission.action, permission.subject)) {
      throw new ForbiddenException("You do not have permission to do that")
    }
    if (conditionHandlers.has(context.getHandler())) {
      requestConditions.set(
        request,
        this.authz.conditions(ability, permission.action, permission.subject)
      )
    } else if (permission.action !== "create") {
      // Conditional row access must not accidentally degrade to a type-only check.
      const rules = relevantRules(
        ability,
        permission.action,
        permission.subject
      )
      if (rules.some((rule) => rule.conditions || rule.fields?.length)) {
        throw new Error(
          "Conditional permissions require @Conditions() on this handler"
        )
      }
    }
    return true
  }
}

/** Authentication must run first (e.g. Better Auth's global guard). */
export function UsePermision(action: string, subject: string): MethodDecorator {
  return applyDecorators(
    SetMetadata(PERMISSION, { action, subject }),
    UseGuards(AccessGuard)
  )
}

const extractConditions = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SQL => {
    const condition = requestConditions.get(
      context.switchToHttp().getRequest<object>()
    )
    if (!condition)
      throw new Error(
        "@Conditions() requires @UsePermision() on the same handler"
      )
    return condition
  }
)

export function Conditions(): ParameterDecorator {
  return (target, key, index) => {
    if (key === undefined)
      throw new Error("@Conditions() is only supported on route parameters")
    const handler = Object.getOwnPropertyDescriptor(target, key)?.value as
      | object
      | undefined
    if (!handler) throw new Error("@Conditions() requires a route handler")
    conditionHandlers.add(handler)
    extractConditions()(target, key, index)
  }
}
