import { AuthzService, an } from "@et/authz"
import type { ProjectInput, ProjectListQuery } from "@et/contracts"
import {
  type Database,
  db,
  project,
  projectTag,
  requiredOrganizationId,
  tag,
  tenantWhere,
} from "@et/db"
import { HttpStatus, Inject, Injectable } from "@nestjs/common"
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  not,
  type SQL,
} from "drizzle-orm"
import {
  type AuditRecorder,
  auditChanges,
  InjectAudit,
} from "../common/audit.port.js"
import {
  dateFilter,
  likeMatches,
  paginate,
  textFilter,
  textMatch,
} from "../common/list-query.js"
import { apiError } from "../http/api-error.js"

const tagColumns = {
  id: true,
  label: true,
  color: true,
  createdAt: true,
  updatedAt: true,
} as const

type DbClient = Pick<Database, "query" | "delete" | "insert">

async function resolveTags(tx: DbClient, tagIds: string[]) {
  const uniqueIds = [...new Set(tagIds)]

  if (uniqueIds.length === 0) {
    return []
  }

  const rows = await tx.query.tag.findMany({
    columns: tagColumns,
    where: (tagTable, { inArray: inArrayIds, and: andOp }) =>
      andOp(
        tenantWhere(tagTable.organizationId),
        inArrayIds(tagTable.id, uniqueIds)
      ),
  })

  if (rows.length !== uniqueIds.length) {
    apiError(HttpStatus.BAD_REQUEST, "One or more tags were not found.")
  }

  const byId = new Map(rows.map((row) => [row.id, row]))

  return uniqueIds.map((id) => byId.get(id)!)
}

async function replaceProjectTags(
  tx: DbClient,
  projectId: string,
  tags: Array<{ id: string }>
) {
  await tx
    .delete(projectTag)
    .where(
      and(
        tenantWhere(projectTag.organizationId),
        eq(projectTag.projectId, projectId)
      )
    )

  if (tags.length === 0) {
    return
  }

  await tx.insert(projectTag).values(
    tags.map((item) => ({
      projectId,
      tagId: item.id,
      organizationId: requiredOrganizationId(),
    }))
  )
}

function serializeProject<T extends { projectTags: Array<{ tag: unknown }> }>(
  row: T
) {
  const { projectTags, ...projectRow } = row

  return {
    ...projectRow,
    tags: projectTags.map((item) => item.tag),
  }
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(AuthzService) private readonly authz: AuthzService,
    @InjectAudit() private readonly audit?: AuditRecorder
  ) {}

  async list(query: ProjectListQuery, conditions: SQL) {
    const filters = [
      conditions,
      tenantWhere(project.organizationId),
      isNull(project.deletedAt),
    ]

    if (query.search) {
      filters.push(likeMatches(project.name, query.search))
    }

    for (const rule of query.filter) {
      if (rule.field === "createdAt") {
        filters.push(dateFilter(project.createdAt, rule))
      } else if (rule.field === "tags") {
        const { predicate, negate } = textMatch(tag.label, rule)
        const matchingTag = exists(
          db
            .select({ id: projectTag.tagId })
            .from(projectTag)
            .innerJoin(tag, eq(tag.id, projectTag.tagId))
            .where(
              and(
                tenantWhere(projectTag.organizationId),
                eq(projectTag.projectId, project.id),
                predicate
              )
            )
        )
        filters.push(negate ? not(matchingTag) : matchingTag)
      } else {
        filters.push(
          textFilter(
            rule.field === "description" ? project.description : project.name,
            rule
          )
        )
      }
    }

    if (query.tagIds.length > 0) {
      const tagRows = await db
        .select({ projectId: projectTag.projectId })
        .from(projectTag)
        .where(
          and(
            tenantWhere(projectTag.organizationId),
            inArray(projectTag.tagId, query.tagIds)
          )
        )

      const projectIds = [...new Set(tagRows.map((row) => row.projectId))]

      if (projectIds.length === 0) return { items: [], total: 0 }

      filters.push(inArray(project.id, projectIds))
    }

    const sortColumn =
      query.sort.field === "name"
        ? project.name
        : query.sort.field === "description"
          ? project.description
          : query.sort.field === "updatedAt"
            ? project.updatedAt
            : project.createdAt

    const where = and(...filters)
    const order = query.sort.direction === "asc" ? asc : desc
    return await paginate(
      query,
      async (window) =>
        (
          await db.query.project.findMany({
            with: {
              projectTags: { with: { tag: { columns: tagColumns } } },
            },
            where,
            orderBy: [order(sortColumn), order(project.id)],
            ...window,
          })
        ).map(serializeProject),
      () => db.select({ value: count() }).from(project).where(where)
    )
  }

  async findOne(id: string, conditions: SQL) {
    const row = await db.query.project.findFirst({
      with: {
        projectTags: {
          with: {
            tag: {
              columns: tagColumns,
            },
          },
        },
      },
      where: (projectTable, { and: andFn, eq: eqCol, isNull: isNullCol }) =>
        andFn(
          conditions,
          tenantWhere(projectTable.organizationId),
          eqCol(projectTable.id, id),
          isNullCol(projectTable.deletedAt)
        ),
    })

    if (!row) {
      apiError(HttpStatus.NOT_FOUND, "Project not found")
    }

    return serializeProject(row)
  }

  async create(userId: string, input: ProjectInput) {
    const candidate = {
      id: crypto.randomUUID(),
      ...input,
      organizationId: requiredOrganizationId(),
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await this.authz.assert(
      userId,
      "create",
      an("Project", candidate),
      Object.keys(input)
    )

    return await db.transaction(async (tx) => {
      const linkedTags = await resolveTags(tx, input.tagIds)

      const [projectRow] = await tx
        .insert(project)
        .values({
          id: candidate.id,
          organizationId: candidate.organizationId,
          createdAt: candidate.createdAt,
          updatedAt: candidate.updatedAt,
          name: input.name,
          description: input.description,
        })
        .returning()

      if (!projectRow) {
        apiError(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to create project")
      }

      await replaceProjectTags(tx, projectRow.id, linkedTags)

      await this.audit?.record(
        {
          actorId: userId,
          actorType: "USER",
          action: "PROJECT_CREATED",
          resourceType: "project",
          resourceId: projectRow.id,
          newValues: {
            name: projectRow.name,
            description: projectRow.description,
            tagIds: linkedTags.map((tag) => tag.id),
          },
        },
        tx
      )

      return { ...projectRow, tags: linkedTags }
    })
  }

  async update(
    userId: string,
    id: string,
    input: ProjectInput,
    conditions: SQL
  ) {
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(project)
        .where(
          and(
            conditions,
            tenantWhere(project.organizationId),
            eq(project.id, id),
            isNull(project.deletedAt)
          )
        )

      if (!existing) {
        return null
      }

      await this.authz.assert(
        userId,
        "update",
        an("Project", { ...existing, ...input }),
        Object.keys(input)
      )

      const linkedTags = await resolveTags(tx, input.tagIds)

      const [projectRow] = await tx
        .update(project)
        .set({
          name: input.name,
          description: input.description,
        })
        .where(
          and(
            conditions,
            tenantWhere(project.organizationId),
            eq(project.id, id),
            isNull(project.deletedAt)
          )
        )
        .returning()

      if (!projectRow) {
        return null
      }

      // Previous tags matter only to the audit record.
      const previousTagIds = this.audit
        ? (
            await tx
              .select({ id: projectTag.tagId })
              .from(projectTag)
              .where(
                and(
                  tenantWhere(projectTag.organizationId),
                  eq(projectTag.projectId, id)
                )
              )
          ).map((tag) => tag.id)
        : []
      await replaceProjectTags(tx, projectRow.id, linkedTags)
      const changes = auditChanges(
        {
          name: existing.name,
          description: existing.description,
          tagIds: previousTagIds.sort(),
        },
        {
          name: projectRow.name,
          description: projectRow.description,
          tagIds: linkedTags.map((tag) => tag.id).sort(),
        }
      )
      if (changes)
        await this.audit?.record(
          {
            actorId: userId,
            actorType: "USER",
            action: "PROJECT_UPDATED",
            resourceType: "project",
            resourceId: projectRow.id,
            ...changes,
          },
          tx
        )

      return { ...projectRow, tags: linkedTags }
    })

    if (!updated) {
      apiError(HttpStatus.NOT_FOUND, "Project not found")
    }

    return updated
  }

  async remove(userId: string, id: string, conditions: SQL) {
    const deleted = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(project)
        .where(
          and(
            conditions,
            tenantWhere(project.organizationId),
            eq(project.id, id),
            isNull(project.deletedAt)
          )
        )
      if (!existing) return null
      const [row] = await tx
        .update(project)
        .set({ deletedAt: new Date() })
        .where(
          and(
            conditions,
            tenantWhere(project.organizationId),
            eq(project.id, id),
            isNull(project.deletedAt)
          )
        )
        .returning({ id: project.id, deletedAt: project.deletedAt })
      if (!row) return null
      await this.audit?.record(
        {
          actorId: userId,
          actorType: "USER",
          action: "PROJECT_DELETED",
          resourceType: "project",
          resourceId: row.id,
          oldValues: { deletedAt: null },
          newValues: { deletedAt: row.deletedAt },
        },
        tx
      )
      return row
    })

    if (!deleted) {
      apiError(HttpStatus.NOT_FOUND, "Project not found")
    }

    return { ok: true as const }
  }
}
