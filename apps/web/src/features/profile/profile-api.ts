import { type ProfileInput, profileInputSchema } from "@et/contracts"
import { queryOptions } from "@tanstack/react-query"
import { api, json } from "@/lib/api"

export type { ProfileInput }

export type CandidateProfile = {
  id: string
  organizationId: string
  name: string
  email: string
  phone: string | null
  location: string
  headline: string
  summary: string
  skills: string[]
  links: Record<string, string>
  experience: Array<{
    company: string
    title: string
    start: string
    end: string
    bullets: string[]
  }>
  education: Array<{ degree: string; school: string; year: string }>
  preferences: {
    titles: string[]
    seniority: string
    locations: string[]
    remoteOk: boolean
    minMatchScore: number
    excludeKeywords: string[]
    avoidKeywords: string[]
  }
  sources: { channels: string[]; messagesPerChannel: number }
  createdAt: string
  updatedAt: string
}

type ProfileResponse = { profile: CandidateProfile | null }

export async function getProfile(): Promise<CandidateProfile | null> {
  return (await api<ProfileResponse>("/api/v1/profile")).profile
}

export async function saveProfile(
  input: ProfileInput
): Promise<CandidateProfile | null> {
  const response = await api<ProfileResponse>(
    "/api/v1/profile",
    json("PUT", profileInputSchema.parse(input))
  )
  return response.profile
}

export const profileQueryOptions = queryOptions({
  queryKey: ["profile"] as const,
  queryFn: getProfile,
})
