import { createRequire } from "node:module"
import type { DynamicModule } from "@nestjs/common"
import { LoggerModule } from "nestjs-pino"

import { loggerConfig } from "./logger.config.js"

// Nest 12 is ESM-only while nestjs-pino is CommonJS, so its ApplicationConfig
// injection token is a separate class instance. Supply the token it expects.
const { ApplicationConfig } = createRequire(import.meta.url)(
  "@nestjs/core"
) as {
  ApplicationConfig: new () => object
}
const loggerModule = LoggerModule.forRoot(loggerConfig)

export const PinoLoggerModule: DynamicModule = {
  ...loggerModule,
  providers: [
    ...(loggerModule.providers ?? []),
    { provide: ApplicationConfig, useValue: new ApplicationConfig() },
  ],
}
