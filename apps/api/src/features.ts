// Optional modules. `pnpm new` deletes a removed feature's folder and every
// line marked with its name, here and across the repository.
import { AuditModule } from "./audit/audit.module.js"

export const featureModules = [
  AuditModule,
  // Checkout routes register once the merchant settings are configured.
]
