import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { RequestMethod } from "@nestjs/common"
import type { Params } from "nestjs-pino"

import { env } from "../../env.js"

const packageInfo = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8")
) as { name: string; version: string }

export const redactedPaths = [
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "accessToken",
  "refreshToken",
  "access_token",
  "refresh_token",
  "token",
  "apiKey",
  "api_key",
  "secret",
  "headers.authorization",
  "headers.cookie",
  "headers['set-cookie']",
  "headers['x-api-key']",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['set-cookie']",
  "req.headers['x-api-key']",
  "req.body.password",
  "req.body.accessToken",
  "req.body.refreshToken",
  "req.body.access_token",
  "req.body.refresh_token",
  "req.body.token",
  "req.body.apiKey",
  "req.body.api_key",
  "req.body.secret",
  "body.password",
  "body.accessToken",
  "body.refreshToken",
  "body.access_token",
  "body.refresh_token",
  "body.token",
  "body.apiKey",
  "body.api_key",
  "body.secret",
  "res.headers['set-cookie']",
] as const

export const loggerConfig: Params = {
  forRoutes: [
    { path: "{/*splat}", method: RequestMethod.ALL },
    { path: "health", method: RequestMethod.GET },
    { path: "metrics", method: RequestMethod.GET },
  ],
  pinoHttp: {
    level: env.LOG_LEVEL,
    base: {
      service: packageInfo.name,
      environment: process.env.NODE_ENV ?? "development",
      version: packageInfo.version,
    },
    autoLogging: false,
    quietReqLogger: true,
    customAttributeKeys: { reqId: "requestId" },
    genReqId: (req, res) => {
      const incoming = req.headers["x-request-id"]
      const requestId =
        typeof incoming === "string" && /^[\w.:-]{1,128}$/.test(incoming)
          ? incoming
          : randomUUID()
      res.setHeader("x-request-id", requestId)
      return requestId
    },
    redact: {
      censor: "[Redacted]",
      paths: [...redactedPaths],
    },
  },
}
