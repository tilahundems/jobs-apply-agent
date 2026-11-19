import { closeDb } from "@et/db"
import {
  BadRequestException,
  Injectable,
  Module,
  type OnApplicationShutdown,
  StandardSchemaValidationPipe,
} from "@nestjs/common"
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core"
import { AuthModule } from "@thallesp/nestjs-better-auth"
import { AgentModule } from "./agent/agent.module.js"
import { auth } from "./auth.js"
import { AuthzModule } from "./authz/authz.module.js"
import { DashboardModule } from "./dashboard/dashboard.module.js"
import { featureModules } from "./features.js"
import { HealthController } from "./health.controller.js"
import { ApiExceptionFilter } from "./http/api-exception.filter.js"
import { RateLimitModule } from "./http/rate-limit.module.js"
import { NotificationsModule } from "./notifications/notifications.module.js"
import { PinoLoggerModule } from "./observability/logging/logger.module.js"
import { RequestLoggingModule } from "./observability/logging/request-logging.module.js"
import { ObservabilityModule } from "./observability/observability.module.js"
import { PermissionsModule } from "./permissions/permissions.module.js"
import { ProjectsModule } from "./projects/projects.module.js"
import { RolesModule } from "./roles/roles.module.js"
import { TagsModule } from "./tags/tags.module.js"
import { TasksModule } from "./tasks/tasks.module.js"
import { TenantContextInterceptor } from "./tenancy/tenant-context.interceptor.js"
import { UsersModule } from "./users/users.module.js"

@Injectable()
class DatabaseShutdown implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await closeDb()
  }
}

@Module({
  imports: [
    PinoLoggerModule,
    AuthModule.forRoot({
      auth,
      middleware: (request, _response, next) => {
        // Better Auth reads this header for its rate limiter. Replace any
        // client-supplied value with Express's resolved client address.
        request.headers["x-forwarded-for"] =
          request.ip ?? request.socket.remoteAddress ?? ""
        next()
      },
    }),
    RateLimitModule,
    RequestLoggingModule,
    ObservabilityModule,
    AuthzModule,
    NotificationsModule,
    DashboardModule,
    AgentModule,
    ProjectsModule,
    RolesModule,
    PermissionsModule,
    TagsModule,
    TasksModule,
    UsersModule,
    ...featureModules,
  ],
  controllers: [HealthController],
  providers: [
    DatabaseShutdown,
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useValue: new StandardSchemaValidationPipe({
        transform: true,
        exceptionFactory: (issues) =>
          new BadRequestException({
            error: issues[0]?.message ?? "Invalid request",
          }),
      }),
    },
  ],
})
export class AppModule {}
