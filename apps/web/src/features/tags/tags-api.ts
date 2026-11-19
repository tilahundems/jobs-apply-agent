import type { Page, TagInput } from "@et/contracts"
import { tagInputSchema } from "@et/contracts"
import { queryOptions } from "@tanstack/react-query"
import { api, json } from "@/lib/api"
import { type ListQuery, listQueryString } from "@/lib/table-search-params"

export type CreateTagInput = TagInput
export type Tag = {
  id: string
  label: string
  color: string
  createdAt: string
  updatedAt: string
}
export const listTags = () => api<Tag[]>("/api/v1/tags")
export const createTag = (input: TagInput) =>
  api<Tag>("/api/v1/tags", json("POST", tagInputSchema.parse(input)))
export const updateTag = (id: string, input: TagInput) => {
  return api<Tag>(
    `/api/v1/tags/${encodeURIComponent(id)}`,
    json("PATCH", tagInputSchema.parse(input))
  )
}
export async function deleteTag(id: string) {
  await api(`/api/v1/tags/${encodeURIComponent(id)}`, { method: "DELETE" })
  return { ok: true as const }
}
export const tagsQueryOptions = queryOptions({
  queryKey: ["tags"],
  queryFn: listTags,
})
export const tagPageQueryOptions = (query: ListQuery) =>
  queryOptions({
    queryKey: ["tags", "page", query] as const,
    queryFn: () =>
      api<Page<Tag>>(`/api/v1/tags/page?${listQueryString(query)}`),
  })
