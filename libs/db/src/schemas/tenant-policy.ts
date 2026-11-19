import { text } from "drizzle-orm/sqlite-core"
import { SINGLE_TENANT_ID } from "../tenant.js"

/**
 * Every tenant-owned table carries this column. SQLite has no row-level
 * security, so isolation rests on the `tenantWhere()` predicates the services
 * apply; the column keeps the schema and the queries identical to the kit's.
 */
export const organizationIdColumn = () =>
  text("organization_id").notNull().default(SINGLE_TENANT_ID)
