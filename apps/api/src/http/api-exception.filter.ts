import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common"
import type { Response } from "express"
import { PinoLogger } from "nestjs-pino"
import { ZodError } from "zod"

import { normalizedRoute } from "../observability/http-route.js"

/**
 * Centralized exception filter.
 *
 * Every unhandled error that reaches Nest is translated here into a meaningful
 * HTTP response so that:
 *  - validation errors (zod) become `400 Bad Request` with the first issue,
 *  - intentional `HttpException`s thrown via `apiError` keep their status/message,
 *  - better-auth `APIError`s (e.g. sign-up failures) keep their status/message,
 *  - known database errors (drizzle / node-postgres SQLSTATE codes) become a
 *    meaningful 4xx response,
 *  - anything else becomes a generic `500 Internal Server Error` and the raw
 *    error is never leaked to the frontend (it is logged server-side instead).
 *
 * Services can therefore let unexpected errors propagate instead of wrapping
 * every call in `try/catch`.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()
    const request = host.switchToHttp().getRequest<import("express").Request>()

    if (isInvalidJson(exception)) {
      response.status(HttpStatus.BAD_REQUEST).json({ error: "Invalid request" })
      return
    }

    if (exception instanceof ZodError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        error: exception.issues[0]?.message ?? "Invalid request",
      })
      return
    }

    if (exception instanceof HttpException) {
      const error = readErrorMessage(exception.getResponse(), exception.message)

      if (exception.getStatus() >= 500) {
        this.logServerError(
          exception.cause instanceof Error ? exception.cause : exception,
          request,
          exception.getStatus()
        )
      }

      response.status(exception.getStatus()).json({
        error: isJsonParseMessage(error) ? "Invalid request" : error,
      })
      return
    }

    const authError = mapAuthApiError(exception)
    if (authError) {
      response.status(authError.status).json({ error: authError.message })
      return
    }

    const dbError = mapDatabaseError(exception)
    if (dbError) {
      response.status(dbError.status).json({ error: dbError.message })
      return
    }

    this.logServerError(exception, request, HttpStatus.INTERNAL_SERVER_ERROR)

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: "Internal server error" })
  }

  private logServerError(
    exception: unknown,
    request: import("express").Request,
    statusCode: number
  ) {
    const error =
      exception instanceof Error ? exception : new Error(String(exception))
    this.logger.error(
      {
        method: request.method,
        route: normalizedRoute(request),
        statusCode,
        error: { name: error.name, message: error.message, stack: error.stack },
      },
      "Unhandled HTTP error"
    )
  }
}

/** `apiError` payloads carry `error`; Nest's built-in exceptions carry `message`. */
function readErrorMessage(payload: string | object, fallback: string) {
  if (typeof payload === "string") return payload
  const { error, message, statusCode } = payload as {
    error?: unknown
    message?: unknown
    statusCode?: unknown
  }
  if (typeof error === "string" && statusCode === undefined) return error
  if (typeof message === "string") return message
  return typeof error === "string" ? error : fallback
}

function isInvalidJson(exception: unknown) {
  return (
    exception instanceof SyntaxError ||
    (typeof exception === "object" &&
      exception !== null &&
      "type" in exception &&
      exception.type === "entity.parse.failed")
  )
}

function isJsonParseMessage(message: string) {
  return /JSON|Unexpected token|Unexpected end of JSON/i.test(message)
}

/**
 * Map known database errors to a meaningful HTTP response.
 *
 * Drizzle rethrows the underlying libsql error, which carries a
 * `SQLITE_CONSTRAINT_*` code. We translate those into 4xx responses with a
 * user-facing message and let everything else fall through to the generic 500.
 * The raw database message is never exposed to the client.
 */
function mapDatabaseError(
  exception: unknown
): { status: HttpStatus; message: string } | null {
  const code = extractDbCode(exception)
  if (!code) {
    return null
  }

  switch (true) {
    case code.includes("UNIQUE") || code.includes("PRIMARYKEY"):
      return {
        status: HttpStatus.CONFLICT,
        message: "A record with these values already exists.",
      }
    case code.includes("FOREIGNKEY"):
      return {
        status: HttpStatus.BAD_REQUEST,
        message:
          "This record is referenced by other records or references a missing record.",
      }
    case code.includes("NOTNULL"):
      return {
        status: HttpStatus.BAD_REQUEST,
        message: "A required field is missing.",
      }
    case code.includes("CHECK"):
      return {
        status: HttpStatus.BAD_REQUEST,
        message: "A field value failed a database constraint.",
      }
    case code.includes("BUSY") || code.includes("LOCKED"):
      return {
        status: HttpStatus.CONFLICT,
        message:
          "The operation conflicted with a concurrent change. Please retry.",
      }
    default:
      return null
  }
}

/**
 * Walk the error and its `cause` chain looking for a SQLite error code. The
 * libsql client exposes it as `code`, and some drizzle paths wrap the original
 * error in `cause`, so both are inspected.
 */
function extractDbCode(exception: unknown): string | null {
  let current: unknown = exception

  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    const { code, extendedCode } = current as {
      code?: unknown
      extendedCode?: unknown
    }
    if (typeof code === "string" && code.startsWith("SQLITE_")) return code
    if (typeof extendedCode === "string" && extendedCode.startsWith("SQLITE_"))
      return extendedCode
    current = (current as { cause?: unknown }).cause
  }

  return null
}

/**
 * Map better-auth `APIError` instances (thrown by `auth.api.*` server calls) to
 * a meaningful HTTP response. These carry a numeric `statusCode` and a `body`
 * with a user-facing `message` (e.g. "User already exists", "Invalid password").
 * Detected by duck-type to avoid importing a transitive dependency.
 */
function mapAuthApiError(
  exception: unknown
): { status: HttpStatus; message: string } | null {
  if (!(exception instanceof Error)) {
    return null
  }

  const status = (exception as { statusCode?: unknown }).statusCode
  if (typeof status !== "number" || status < 400 || status >= 500) {
    return null
  }

  const body = (exception as { body?: unknown }).body
  const bodyMessage =
    body && typeof body === "object" && "message" in body
      ? (body as { message?: unknown }).message
      : undefined

  const message =
    (typeof bodyMessage === "string" && bodyMessage) ||
    exception.message ||
    "Invalid request"

  return { status: status as HttpStatus, message }
}
