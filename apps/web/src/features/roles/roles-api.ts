import type { RoleInput } from "@et/contracts"
import { roleInputSchema } from "@et/contracts"
import { queryOptions } from "@tanstack/react-query"
import { api, json } from "@/lib/api"
import type { RolePermission } from "./roles-permissions"

export type Role = {
  id: string
  key: string
  name: string
  description?: string | null
  createdAt: string
  updatedAt: string
  permissions: RolePermission[]
  userCount: number
  isSystem: boolean
}
export type { RoleInput }
export const listWorkspaceRoles = () => api<Role[]>("/api/v1/roles")
export const createRole = (input: RoleInput) =>
  api<Role>("/api/v1/roles", json("POST", roleInputSchema.parse(input)))
export const updateRole = (id: string, input: RoleInput) => {
  return api<Role>(
    `/api/v1/roles/${encodeURIComponent(id)}`,
    json("PATCH", roleInputSchema.parse(input))
  )
}
export async function deleteRole(id: string) {
  await api(`/api/v1/roles/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  return { ok: true as const }
}
export const workspaceRolesQueryOptions = queryOptions({
  queryKey: ["workspace-roles"],
  queryFn: listWorkspaceRoles,
})
