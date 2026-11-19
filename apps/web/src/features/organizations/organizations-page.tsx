import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useRouter } from "@tanstack/react-router"
import type { ColumnVisibilityState, SortingState } from "@tanstack/react-table"
import { createColumnHelper, useTable } from "@tanstack/react-table"
import { CheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { DataTable, dataTableFeatures } from "@/components/table/data-table"
import { TableHeader } from "@/components/table/table-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { authClient } from "@/features/auth/auth-client"
import { navigateAfterSessionChange } from "@/features/auth/session-cache"

type Organization = { id: string; name: string; slug: string }
type DialogKind = "create" | "join" | "invite" | "edit" | null

const columnHelper = createColumnHelper<
  typeof dataTableFeatures,
  Organization
>()

/** Lists the user's organizations: switch, create, join, invite and edit. */
export function OrganizationsPage({ activeId }: { activeId: string | null }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [inviteOrganization, setInviteOrganization] =
    useState<Organization | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [createdCode, setCreatedCode] = useState("")
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})
  const [busy, setBusy] = useState(false)
  const { data: activeMember } = useQuery({
    queryKey: ["active-organization-member", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const result = await authClient.organization.getActiveMember()
      if (result.error)
        throw new Error(result.error.message ?? "Unable to load membership")
      return result.data
    },
  })
  const roles = activeMember?.role.split(",").map((role) => role.trim()) ?? []
  const canManage = roles.includes("owner") || roles.includes("admin")
  const {
    data: organizations = [],
    isPending,
    error,
  } = useQuery({
    queryKey: ["organizations"],
    queryFn: async (): Promise<Organization[]> => {
      const result = await authClient.organization.list()
      if (result.error)
        throw new Error(result.error.message ?? "Unable to load organizations")
      return (result.data ?? []).map(({ id, name, slug }) => ({
        id,
        name,
        slug,
      }))
    },
  })

  async function activate(organizationId: string) {
    if (busy || organizationId === activeId) return
    setBusy(true)
    const { error } = await authClient.organization.setActive({
      organizationId,
    })
    if (error) {
      toast.error(error.message ?? "Unable to switch organization")
      setBusy(false)
      return
    }
    await navigateAfterSessionChange(
      queryClient,
      router,
      "/settings/organizations"
    )
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    const slug = `${trimmed
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`
    const { data, error } = await authClient.organization.create({
      name: trimmed,
      slug,
    })
    if (error || !data) {
      toast.error(error?.message ?? "Unable to create organization")
      setBusy(false)
      return
    }
    setBusy(false)
    await activate(data.id)
  }

  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    const { error } = await authClient.organization.acceptInvitation({
      invitationId: code.trim(),
    })
    if (error) {
      toast.error(error.message ?? "Unable to accept invitation")
      setBusy(false)
      return
    }
    await navigateAfterSessionChange(
      queryClient,
      router,
      "/settings/organizations"
    )
  }

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inviteOrganization || !email.trim() || busy) return
    setBusy(true)
    const { data, error } = await authClient.organization.inviteMember({
      email: email.trim(),
      role: "member",
      organizationId: inviteOrganization.id,
    })
    setBusy(false)
    if (error || !data) {
      toast.error(error?.message ?? "Unable to invite member")
      return
    }
    setCreatedCode(data.id)
    setEmail("")
    toast.success("Invitation created. Share the code with the invited person.")
  }

  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !activeId ||
      !canManage ||
      !name.trim() ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim()) ||
      busy
    )
      return
    setBusy(true)
    const result = await authClient.organization.update({
      organizationId: activeId,
      data: { name: name.trim(), slug: slug.trim() },
    })
    setBusy(false)
    if (result.error) {
      toast.error(result.error.message ?? "Unable to update organization")
      return
    }
    await queryClient.invalidateQueries({ queryKey: ["organizations"] })
    setDialog(null)
    toast.success("Organization updated")
  }

  const columns = columnHelper.columns([
    columnHelper.accessor("name", {
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor("slug", { header: "Slug" }),
    columnHelper.display({
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.id === activeId ? (
          <span className="inline-flex items-center gap-1 text-sm">
            <CheckIcon className="size-4" /> Active
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          {row.original.id !== activeId ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void activate(row.original.id)}
            >
              Switch
            </Button>
          ) : null}
          {row.original.id === activeId && canManage ? (
            <>
              <Button
                size="sm"
                variant="outline"
                render={<Link to="/settings/users" />}
              >
                Members
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setName(row.original.name)
                  setSlug(row.original.slug)
                  setDialog("edit")
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setInviteOrganization(row.original)
                  setCreatedCode("")
                  setDialog("invite")
                }}
              >
                Invite
              </Button>
            </>
          ) : null}
        </div>
      ),
    }),
  ])

  const term = search.trim().toLowerCase()
  const table = useTable({
    features: dataTableFeatures,
    data: organizations.filter((organization) =>
      `${organization.name} ${organization.slug}`.toLowerCase().includes(term)
    ),
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
  })

  return (
    <div className="flex flex-col gap-4 pt-2 pb-4 lg:pt-3 lg:pb-6">
      <PageHeader
        title="Organizations"
        subtitle="Manage your workspaces and invitations."
      />
      <TableHeader
        table={table}
        label="Organizations"
        searchLabel="Search organizations"
        clearLabel="Clear Organization Search"
        search={search}
        onSearch={(value) => {
          setSearch(value)
          table.setPageIndex(0)
        }}
      >
        <Button size="sm" variant="outline" onClick={() => setDialog("join")}>
          Join organization
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setName("")
            setDialog("create")
          }}
        >
          Create organization
        </Button>
      </TableHeader>
      {error ? (
        <p role="alert" className="px-4 text-destructive lg:px-6">
          {error.message}
        </p>
      ) : null}
      {isPending ? (
        <p className="px-4 text-muted-foreground lg:px-6">
          Loading organizations…
        </p>
      ) : (
        <DataTable table={table} />
      )}

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "create"
                ? "Create organization"
                : dialog === "join"
                  ? "Join organization"
                  : dialog === "edit"
                    ? "Edit organization"
                    : `Invite to ${inviteOrganization?.name ?? "organization"}`}
            </DialogTitle>
            <DialogDescription>
              {dialog === "invite"
                ? "Invite someone by email and share the invitation code."
                : dialog === "join"
                  ? "Enter the invitation code you received."
                  : dialog === "edit"
                    ? "Update the name and slug of this organization."
                    : "Create a workspace for your team."}
            </DialogDescription>
          </DialogHeader>
          {dialog === "create" ? (
            <form
              onSubmit={(event) => void create(event)}
              className="grid gap-4"
            >
              <Input
                aria-label="Organization name"
                placeholder="Organization name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <DialogFooter>
                <Button type="submit" disabled={busy || !name.trim()}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          ) : dialog === "join" ? (
            <form onSubmit={(event) => void join(event)} className="grid gap-4">
              <Input
                aria-label="Invitation code"
                placeholder="Invitation code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
              <DialogFooter>
                <Button type="submit" disabled={busy || !code.trim()}>
                  Join
                </Button>
              </DialogFooter>
            </form>
          ) : dialog === "edit" ? (
            <form
              onSubmit={(event) => void update(event)}
              className="grid gap-4"
            >
              <Input
                aria-label="Organization name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <Input
                aria-label="Organization slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title="Use lowercase letters, numbers, and hyphens"
                required
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    !name.trim() ||
                    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())
                  }
                >
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form
              onSubmit={(event) => void invite(event)}
              className="grid gap-4"
            >
              <Input
                type="email"
                aria-label="Invite email"
                placeholder="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              {createdCode ? (
                <p className="break-all text-sm">
                  Share invitation code: <strong>{createdCode}</strong>
                </p>
              ) : null}
              <DialogFooter>
                <Button type="submit" disabled={busy || !email.trim()}>
                  Invite
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
