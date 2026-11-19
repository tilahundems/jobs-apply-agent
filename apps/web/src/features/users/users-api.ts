import type { CreateUserInput, UserInput } from "@et/contracts"
import { createUserInputSchema, userInputSchema } from "@et/contracts"
import { queryOptions } from "@tanstack/react-query"
import { api, json } from "@/lib/api"

export type UserRole = {
  id: string
  key: string
  name: string
  description?: string | null
}
export type User = {
  id: string
  name: string
  email: string
  image?: string | null
  createdAt?: string
  roles?: UserRole[]
}
export type { CreateUserInput }
export type UpdateUserInput = UserInput
export const listUsers = () => api<User[]>("/api/v1/users")
export const listRoles = () => api<UserRole[]>("/api/v1/users/roles")
export const createUser = (input: CreateUserInput) =>
  api<User>("/api/v1/users", json("POST", createUserInputSchema.parse(input)))
export const updateUser = (id: string, input: UserInput) => {
  return api<User>(
    `/api/v1/users/${encodeURIComponent(id)}`,
    json("PATCH", userInputSchema.parse(input))
  )
}
export const removeMembership = async (id: string) => {
  await api(`/api/v1/users/${encodeURIComponent(id)}/membership`, {
    method: "DELETE",
  })
}
export const usersQueryOptions = queryOptions({
  queryKey: ["users"],
  queryFn: listUsers,
})
export const rolesQueryOptions = queryOptions({
  queryKey: ["roles"],
  queryFn: listRoles,
})
