import { Inject, Injectable, type NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"

import { normalizedRoute, onRequestComplete } from "./http-route.js"
import { MetricsService } from "./metrics/metrics.service.js"

function normalizedMethod(method: string): string {
  return [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "CONNECT",
    "TRACE",
  ].includes(method)
    ? method
    : "OTHER"
}

@Injectable()
export class HttpObservabilityMiddleware implements NestMiddleware {
  constructor(
    @Inject(MetricsService) private readonly metrics: MetricsService
  ) {}

  use(request: Request, response: Response, next: NextFunction) {
    if (request.path !== "/metrics") this.metrics.inFlight.inc()
    onRequestComplete(request, response, (statusCode, durationMs) => {
      this.metrics.inFlight.dec()
      const labels = {
        method: normalizedMethod(request.method),
        route: normalizedRoute(request),
        status_code: String(statusCode),
      }
      this.metrics.requests.inc(labels)
      this.metrics.duration.observe(labels, durationMs / 1000)
    })
    next()
  }
}
