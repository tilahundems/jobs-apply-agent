# Permissions and roles

Define permissions in **Settings → Roles & Permissions → Permissions**, then select them when creating or editing a role. Each permission has a subject, an action (including custom actions such as `approve`, `grant`, or `revoke`), and optional conditions. Editing a shared permission updates every assigned role. Remove it from its roles before deleting it.

The condition builder supports matching fields, lists, booleans, empty values, and the current user's ID. Conditions within a rule all match (AND); assign multiple permissions to express alternatives. The JSON editor preserves advanced field conditions. Both editors are validated against CASL and the app's SQL adapter: `$eq`, `$ne`, `$in`, `$nin`, numeric comparisons, and field `$not` are supported. Unknown fields/operators and top-level logical operators are rejected. `${user.id}` is resolved for the signed-in user. Custom actions must also be checked by the application's endpoints to control a corresponding operation.

Role create/update requests send `permissionIds: string[]`; permission definitions are managed through `/api/v1/permissions` with CASL's `Permission` subject and the usual CRUD actions.

Organization tenancy changes how roles are loaded; see [the multi-tenancy guide](multi-tenancy.md).
