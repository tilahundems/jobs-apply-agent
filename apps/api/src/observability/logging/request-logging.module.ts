import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from "@nestjs/common"

import { HttpRequestLoggingMiddleware } from "./http-request-logging.middleware.js"

@Module({ providers: [HttpRequestLoggingMiddleware] })
export class RequestLoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HttpRequestLoggingMiddleware)
      .forRoutes({ path: "{*path}", method: RequestMethod.ALL })
  }
}
