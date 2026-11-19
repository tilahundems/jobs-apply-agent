import type { Page, ProjectInput } from "@et/contracts"
import { projectInputSchema } from "@et/contracts"
import { queryOptions } from "@tanstack/react-query"
import type { Tag } from "@/features/tags"
import { api, json } from "@/lib/api"
import { type ListQuery, listQueryString } from "@/lib/table-search-params"

export type { Tag }
export type CreateProjectInput = ProjectInput
export type Project = {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  tags: Tag[]
}
const normalize = (
  project: Omit<Project, "tags"> & { tags?: Tag[] }
): Project => ({
  ...project,
  tags: project.tags ?? [],
})
export async function listProjects(
  query: ListQuery = { page: 1, perPage: 100 }
): Promise<Page<Project>> {
  const result = await api<Page<Omit<Project, "tags"> & { tags?: Tag[] }>>(
    `/api/v1/projects?${listQueryString(query)}`
  )
  return { items: result.items.map(normalize), total: result.total }
}
export async function getProject(id: string): Promise<Project> {
  return normalize(await api(`/api/v1/projects/${encodeURIComponent(id)}`))
}
export async function createProject(input: ProjectInput): Promise<Project> {
  return normalize(
    await api("/api/v1/projects", json("POST", projectInputSchema.parse(input)))
  )
}
export async function updateProject(
  id: string,
  input: ProjectInput
): Promise<Project> {
  return normalize(
    await api(
      `/api/v1/projects/${encodeURIComponent(id)}`,
      json("PATCH", projectInputSchema.parse(input))
    )
  )
}
export async function deleteProject(id: string) {
  await api(`/api/v1/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  return { ok: true as const }
}
export const projectsQueryOptions = queryOptions({
  queryKey: ["projects", { page: 1, perPage: 100 }] as const,
  queryFn: async () => (await listProjects()).items,
})
export const projectPageQueryOptions = (query: ListQuery) =>
  queryOptions({
    queryKey: ["projects", "page", query] as const,
    queryFn: () => listProjects(query),
  })
export const projectQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["projects", id] as const,
    queryFn: () => getProject(id),
  })
