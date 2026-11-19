import { Injectable, type NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"

import { normalizedRoute, onRequestComplete } from "../http-route.js"

@Injectable()
export class HttpRequestLoggingMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    onRequestComplete(request, response, (statusCode, durationMs) => {
      request.log.info(
        {
          method: request.method,
          route: normalizedRoute(request),
          statusCode,
          durationMs,
        },
        "HTTP request"
      )
    })
    next()
  }
}
