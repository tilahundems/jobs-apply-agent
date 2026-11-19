import { HttpException, type HttpStatus } from "@nestjs/common"

export function apiError(
  status: HttpStatus,
  error: string,
  cause?: unknown
): never {
  throw new HttpException({ error }, status, { cause })
}
