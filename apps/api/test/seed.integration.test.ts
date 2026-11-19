import assert from "node:assert/strict"
import { test } from "node:test"
import {
  closeDb,
  db,
  member,
  organization,
  project,
  projectTag,
  rootDb,
  tag,
  task,
  user,
  withTenantTransaction,
} from "@et/db"
import { eq } from "drizzle-orm"

test("tenant demo seed creates one usable workspace and remains idempotent", {
  skip:
    process.env.TENANT_INTEGRATION_TEST !== "1" ||
    process.env.MULTI_TENANCY !== "true",
}, async () => {
  try {
    const [workspace] = await rootDb
      .select({ id: organization.id, slug: organization.slug })
      .from(organization)
      .where(eq(organization.id, "seed-demo-organization"))
    assert.ok(workspace)
    assert.equal(workspace?.slug, "demo-workspace")

    const memberships = await rootDb
      .select({ email: user.email, role: member.role })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, workspace.id))
    assert.deepEqual(
      memberships.sort((a, b) => a.role.localeCompare(b.role)),
      [
        { email: "user@example.com", role: "member" },
        { email: "demo@example.com", role: "owner" },
      ]
    )

    await withTenantTransaction(rootDb, workspace.id, async () => {
      const tags = await db.select().from(tag)
      const projects = await db.select().from(project)
      const links = await db.select().from(projectTag)
      const tasks = await db.select().from(task)
      assert.equal(tags.length, 8)
      assert.equal(projects.length, 12)
      assert.ok(links.length > 0)
      assert.equal(tasks.length, 36)
      for (const row of [...tags, ...projects, ...links, ...tasks])
        assert.equal(row.organizationId, workspace.id)
    })
  } finally {
    await closeDb()
  }
})
