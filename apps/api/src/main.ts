import "reflect-metadata"

import { NestFactory } from "@nestjs/core"
import { Logger } from "nestjs-pino"
import { AppModule } from "./app.module.js"
import { env } from "./env.js"
import { configureApp } from "./http/configure-app.js"

const app = await NestFactory.create(AppModule, {
  bodyParser: false,
  bufferLogs: true,
})
app.useLogger(app.get(Logger))
configureApp(app)
app.enableShutdownHooks()

await app.listen(env.PORT)
app.get(Logger).log(`API listening on http://localhost:${env.PORT}`)
