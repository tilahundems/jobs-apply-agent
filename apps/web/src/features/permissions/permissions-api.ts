import type { PermissionInput } from "@et/contracts"
import { permissionInputSchema } from "@et/contracts"
import { queryOptions } from "@tanstack/react-query"
import { api, json } from "@/lib/api"

export type PermissionConditions = PermissionInput["conditions"]
export type { PermissionInput }
export type Permission = PermissionInput & {
  id: string
  fields: string[]
  inverted: boolean
  reason: string | null
  roleCount: number
}
export type ConditionField = {
  name: string
  type: "string" | "number" | "boolean"
  values: string[]
}
export type PermissionOption = { subject: string; fields: ConditionField[] }
export const listPermissions = () => api<Permission[]>("/api/v1/permissions")
export const getPermissionOptions = () =>
  api<PermissionOption[]>("/api/v1/permissions/options")
export async function createPermission(input: PermissionInput) {
  await api(
    "/api/v1/permissions",
    json("POST", permissionInputSchema.parse(input))
  )
  return { ok: true as const }
}
export async function updatePermission(id: string, input: PermissionInput) {
  await api(
    `/api/v1/permissions/${encodeURIComponent(id)}`,
    json("PATCH", permissionInputSchema.parse(input))
  )
  return { ok: true as const }
}
export async function deletePermission(id: string) {
  await api(`/api/v1/permissions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  return { ok: true as const }
}
export const permissionsQueryOptions = queryOptions({
  queryKey: ["permissions"],
  queryFn: listPermissions,
})
export const permissionOptionsQueryOptions = queryOptions({
  queryKey: ["permission-options"],
  queryFn: getPermissionOptions,
})
