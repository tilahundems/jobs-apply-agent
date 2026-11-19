import { AuthzService, an } from "@et/authz"
import type { TagInput, TagListQuery } from "@et/contracts"
import { db, requiredOrganizationId, tag, tenantWhere } from "@et/db"
import { HttpStatus, Inject, Injectable } from "@nestjs/common"
import { and, asc, count, desc, eq, ne, type SQL } from "drizzle-orm"
import {
  dateFilter,
  likeMatches,
  paginate,
  textFilter,
} from "../common/list-query.js"
import { apiError } from "../http/api-error.js"

const tagColumns = {
  id: true,
  label: true,
  color: true,
  createdAt: true,
  updatedAt: true,
} as const

const DUPLICATE_LABEL = "A tag with this label already exists."

function duplicateLabelWhere(label: string, excludeId?: string) {
  const filters = [tenantWhere(tag.organizationId), eq(tag.label, label)]

  if (excludeId) {
    filters.push(ne(tag.id, excludeId))
  }

  return and(...filters)
}

@Injectable()
export class TagsService {
  constructor(@Inject(AuthzService) private readonly authz: AuthzService) {}

  async list(conditions: SQL) {
    return await db.query.tag.findMany({
      where: and(conditions, tenantWhere(tag.organizationId)),
      columns: tagColumns,
      orderBy: (tagTable, { desc }) => [desc(tagTable.createdAt)],
    })
  }

  async page(query: TagListQuery, conditions: SQL) {
    const filters = [conditions, tenantWhere(tag.organizationId)]
    if (query.search) {
      filters.push(likeMatches(tag.label, query.search))
    }
    for (const rule of query.filter) {
      filters.push(
        rule.field === "createdAt"
          ? dateFilter(tag.createdAt, rule)
          : textFilter(rule.field === "color" ? tag.color : tag.label, rule)
      )
    }
    const where = and(...filters)
    const order = query.sort.direction === "asc" ? asc : desc
    const sortColumn =
      query.sort.field === "label"
        ? tag.label
        : query.sort.field === "color"
          ? tag.color
          : tag.createdAt

    return await paginate(
      query,
      (window) =>
        db.query.tag.findMany({
          where,
          columns: tagColumns,
          orderBy: [order(sortColumn), order(tag.id)],
          ...window,
        }),
      () => db.select({ value: count() }).from(tag).where(where)
    )
  }

  async create(userId: string, input: TagInput) {
    const candidate = {
      id: crypto.randomUUID(),
      ...input,
      organizationId: requiredOrganizationId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await this.authz.assert(
      userId,
      "create",
      an("Tag", candidate),
      Object.keys(input)
    )

    return await db.transaction(async (tx) => {
      const [duplicate] = await tx
        .select({ id: tag.id })
        .from(tag)
        .where(duplicateLabelWhere(input.label))
        .limit(1)

      if (duplicate) apiError(HttpStatus.BAD_REQUEST, DUPLICATE_LABEL)

      const [tagRow] = await tx
        .insert(tag)
        .values({
          id: candidate.id,
          organizationId: candidate.organizationId,
          createdAt: candidate.createdAt,
          updatedAt: candidate.updatedAt,
          label: input.label,
          color: input.color,
        })
        .returning({
          id: tag.id,
          label: tag.label,
          color: tag.color,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        })

      if (!tagRow) {
        apiError(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to create tag")
      }

      return tagRow
    })
  }

  async update(userId: string, id: string, input: TagInput, conditions: SQL) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(tag)
        .where(and(conditions, tenantWhere(tag.organizationId), eq(tag.id, id)))

      if (!existing) apiError(HttpStatus.NOT_FOUND, "Tag not found")

      await this.authz.assert(
        userId,
        "update",
        an("Tag", { ...existing, ...input }),
        Object.keys(input)
      )

      const [duplicate] = await tx
        .select({ id: tag.id })
        .from(tag)
        .where(duplicateLabelWhere(input.label, id))
        .limit(1)

      if (duplicate) apiError(HttpStatus.BAD_REQUEST, DUPLICATE_LABEL)

      const [tagRow] = await tx
        .update(tag)
        .set({
          label: input.label,
          color: input.color,
        })
        .where(and(conditions, tenantWhere(tag.organizationId), eq(tag.id, id)))
        .returning({
          id: tag.id,
          label: tag.label,
          color: tag.color,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        })

      if (!tagRow) apiError(HttpStatus.NOT_FOUND, "Tag not found")

      return tagRow
    })
  }

  async remove(id: string, conditions: SQL) {
    const [deleted] = await db
      .delete(tag)
      .where(and(conditions, tenantWhere(tag.organizationId), eq(tag.id, id)))
      .returning({ id: tag.id })

    if (!deleted) {
      apiError(HttpStatus.NOT_FOUND, "Tag not found")
    }

    return { ok: true as const }
  }
}
