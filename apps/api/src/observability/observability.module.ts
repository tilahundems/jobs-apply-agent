import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from "@nestjs/common"

import { HttpObservabilityMiddleware } from "./http-observability.middleware.js"
import { MetricsController } from "./metrics/metrics.controller.js"
import { MetricsService } from "./metrics/metrics.service.js"

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, HttpObservabilityMiddleware],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HttpObservabilityMiddleware)
      .forRoutes({ path: "{*path}", method: RequestMethod.ALL })
  }
}
