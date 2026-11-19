import {
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Module,
} from "@nestjs/common"
import { APP_GUARD, Reflector } from "@nestjs/core"
import {
  getOptionsToken,
  getStorageToken,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  ThrottlerModule,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from "@nestjs/throttler"

class ApiThrottlerGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail
  ): Promise<void> {
    throw new HttpException(
      await this.getErrorMessage(context, detail),
      HttpStatus.TOO_MANY_REQUESTS
    )
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  providers: [
    {
      provide: APP_GUARD,
      inject: [getOptionsToken(), getStorageToken(), Reflector],
      // The throttler is CommonJS while Nest 12 is ESM; inject Nest's Reflector
      // explicitly so the guard uses the same instance as the application.
      useFactory: (
        options: ThrottlerModuleOptions,
        storage: ThrottlerStorage,
        reflector: Reflector
      ) => new ApiThrottlerGuard(options, storage, reflector),
    },
  ],
})
export class RateLimitModule {}
