import {
  type INestApplication,
  RequestMethod,
  VersioningType,
} from "@nestjs/common"
import { env } from "../env.js"
import { API_PREFIX, API_VERSION } from "./api-version.js"

/** HTTP setup shared by the server and the tests: CORS, `/api` prefix, `/v1` URIs. */
export function configureApp(app: INestApplication) {
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      { path: "health", method: RequestMethod.GET },
      { path: "metrics", method: RequestMethod.GET },
    ],
  })
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  })
  return app
}
