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

export type ReminderStatus = {
  enabled: boolean
  days: number
  checkMinutes: number
}

export async function getReminderStatus(): Promise<ReminderStatus> {
  return await api<ReminderStatus>("/api/v1/reminders")
}

export async function sendTestReminder(): Promise<{ sent: boolean }> {
  return await api<{ sent: boolean }>("/api/v1/reminders/test", {
    method: "POST",
  })
}

export const remindersQueryOptions = queryOptions({
  queryKey: ["reminders"] as const,
  queryFn: getReminderStatus,
})
