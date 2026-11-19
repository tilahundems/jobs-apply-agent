import type { ProfileInput } from "@et/contracts"
import {
  type CandidateProfile,
  candidateProfile,
  db,
  requiredOrganizationId,
  tenantWhere,
} from "@et/db"
import { Injectable } from "@nestjs/common"
import { and, eq } from "drizzle-orm"
import { type AuditRecorder, InjectAudit } from "../common/audit.port.js"

@Injectable()
export class ProfileService {
  constructor(@InjectAudit() private readonly audit?: AuditRecorder) {}

  async current(): Promise<CandidateProfile | null> {
    return (
      (await db.query.candidateProfile.findFirst({
        where: tenantWhere(candidateProfile.organizationId),
      })) ?? null
    )
  }

  async get() {
    return { profile: await this.current() }
  }

  /** One profile per organization: update it if it exists, otherwise create it. */
  async save(userId: string, input: ProfileInput) {
    const existing = await this.current()
    const id = existing?.id ?? crypto.randomUUID()

    if (existing) {
      await db
        .update(candidateProfile)
        .set({ ...input })
        .where(
          and(
            eq(candidateProfile.id, existing.id),
            tenantWhere(candidateProfile.organizationId)
          )
        )
    } else {
      await db.insert(candidateProfile).values({
        id,
        ...input,
        organizationId: requiredOrganizationId(),
      })
    }

    await this.audit?.record({
      actorId: userId,
      actorType: "USER",
      action: existing ? "PROFILE_UPDATED" : "PROFILE_CREATED",
      resourceType: "candidate_profile",
      resourceId: id,
      newValues: {
        name: input.name,
        channels: input.sources.channels,
        minMatchScore: input.preferences.minMatchScore,
      },
    })

    return this.get()
  }
}
