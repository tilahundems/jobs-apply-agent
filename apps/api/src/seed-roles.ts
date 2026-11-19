import { closeDb } from "@et/db"
import { seedRolesAndPermissions } from "./authz/permissions.js"

try {
  await seedRolesAndPermissions()
} finally {
  await closeDb()
}
