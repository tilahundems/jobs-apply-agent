/**
 * Writing the tailored CV and cover letter.
 *
 * The hard rule is honesty: the model may re-order, re-word and omit what is
 * in the profile, but must never invent an employer, a skill or a number. A
 * fabricated line gets you rejected in the interview, which is worse than no
 * application at all.
 */

import type { CandidateProfile, JobPost } from "@et/db"
import { HttpStatus } from "@nestjs/common"
import { apiError } from "../http/api-error.js"
import { complete, llmProviders } from "./llm.js"

export type Tailoring = { cv: string; coverLetter: string }

const SYSTEM = `You are an expert technical recruiter and CV writer.
You tailor a candidate's real CV to one specific job posting.

Rules you must never break:
- Only use facts present in the candidate profile. Never invent employers, job titles, dates, degrees, certifications, metrics or technologies.
- You may re-word, re-order, merge and omit existing content. You may promote the most relevant bullets to the top.
- Never add a skill the candidate has not listed.
- Keep every bullet truthful and specific. No filler adjectives, no "passionate team player".
- Match the vocabulary of the posting where it is honest to do so (for example "REST API" instead of "web services").

Return exactly two sections, in this format and nothing else:

===CV===
# Full Name
one line of contact details
## Summary
2-3 sentences aimed at this role
## Skills
- grouped, only the candidate's real skills, most relevant first
## Experience
### Job Title — Company (start – end)
- 3-5 bullets, most relevant first
## Education
### Degree — School (year)
## Projects
### Project name
- one or two lines, only if relevant

===COVER===
A cover letter of 150-220 words, addressed to the hiring team of that company.
First paragraph: the role and one concrete reason the candidate fits.
Middle: two specific pieces of evidence from the profile, tied to the posting's requirements.
Last paragraph: a short, confident close. No placeholders like [Company] left unfilled.

Write in plain text. Do not use markdown inside the cover letter.`

function profileBrief(profile: CandidateProfile) {
  return {
    name: profile.name,
    headline: profile.headline,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    summary: profile.summary,
    links: profile.links,
    skills: profile.skills,
    experience: profile.experience,
    education: profile.education,
    projects: undefined,
  }
}

function jobBrief(
  job: Pick<JobPost, "title" | "company" | "location" | "url" | "rawText">
) {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    posting: job.rawText,
  }
}

export function splitSections(raw: string): Tailoring {
  const cvMatch = /===\s*CV\s*===([\s\S]*?)(?====\s*COVER\s*===|$)/i.exec(raw)
  const coverMatch = /===\s*COVER\s*===([\s\S]*)$/i.exec(raw)
  return {
    cv: cvMatch?.[1]?.trim() ?? "",
    coverLetter: (coverMatch?.[1] ?? "").trim(),
  }
}

export async function tailorApplication(
  profile: CandidateProfile,
  job: Pick<JobPost, "title" | "company" | "location" | "url" | "rawText">
): Promise<Tailoring> {
  const providers = llmProviders()
  if (!providers.length) {
    apiError(
      HttpStatus.BAD_REQUEST,
      "No LLM provider configured. Set AI_PROVIDERS (for example groq,openrouter,gemini) with the matching API keys on the API, then prepare the application again."
    )
  }

  const user = [
    "CANDIDATE PROFILE (the only source of truth):",
    JSON.stringify(profileBrief(profile), null, 2),
    "",
    "JOB POSTING:",
    JSON.stringify(jobBrief(job), null, 2),
    "",
    "Write the tailored CV and the cover letter for this posting.",
  ].join("\n")

  const raw = await complete(providers, SYSTEM, user)
  const tailoring = splitSections(raw)

  if (!tailoring.cv || !tailoring.coverLetter) {
    apiError(
      HttpStatus.BAD_GATEWAY,
      "The model did not return both sections. Try preparing again."
    )
  }

  return tailoring
}
