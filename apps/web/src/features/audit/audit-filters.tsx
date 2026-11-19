import { ListFilterIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AuditSearch } from "./audit-search-params"

const filterKeys = [
  "actor",
  "action",
  "resourceType",
  "status",
  "from",
  "to",
] as const
type FilterKey = (typeof filterKeys)[number]

export function AuditFilters({
  search,
  update,
}: {
  search: AuditSearch
  update: (next: Partial<AuditSearch>) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(search)
  const appliedCount = filterKeys.filter((key) => search[key]).length

  function field(key: FilterKey, label: string, type = "text") {
    return (
      <label
        htmlFor={`audit-${key}`}
        className="flex min-w-0 flex-col gap-1 text-sm"
        key={key}
      >
        <span>{label}</span>
        <Input
          id={`audit-${key}`}
          type={type}
          value={draft[key]}
          onChange={(event) =>
            setDraft((current) => ({ ...current, [key]: event.target.value }))
          }
          maxLength={type === "text" ? 255 : undefined}
          min={key === "to" ? draft.from : undefined}
        />
      </label>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
      <search aria-label="Audit logs" className="min-w-48 flex-1 sm:max-w-80">
        <InputGroup>
          <InputGroupInput
            aria-label="Search audit logs"
            placeholder="Search audit logs…"
            value={search.q}
            onChange={(event) => update({ q: event.target.value })}
          />
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
        </InputGroup>
      </search>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft(search)
          setOpen(next)
        }}
      >
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          <ListFilterIcon data-icon="inline-start" />
          Filters
          {appliedCount > 0 && (
            <Badge variant="secondary">{appliedCount}</Badge>
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(32rem,calc(100vw-2rem))]">
          <PopoverTitle>Filter audit logs</PopoverTitle>
          <PopoverDescription>
            Apply filters to the full audit history.
          </PopoverDescription>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              update(
                Object.fromEntries(filterKeys.map((key) => [key, draft[key]]))
              )
              setOpen(false)
            }}
            className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2"
          >
            {field("actor", "Actor name, email, or ID")}
            {field("action", "Action")}
            {field("resourceType", "Resource")}
            <div className="flex flex-col gap-1 text-sm">
              <span>Status</span>
              <Select
                value={draft.status || "all"}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    status:
                      value === "all" ? "" : (value as AuditSearch["status"]),
                  }))
                }
                items={[
                  { value: "all", label: "All statuses" },
                  { value: "success", label: "Success" },
                  { value: "failed", label: "Failed" },
                ]}
              >
                <SelectTrigger className="w-full" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {field("from", "From date", "date")}
            {field("to", "To date", "date")}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const cleared = Object.fromEntries(
                    filterKeys.map((key) => [key, ""])
                  )
                  setDraft({ ...search, ...cleared })
                  update(cleared)
                  setOpen(false)
                }}
              >
                Clear
              </Button>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
      <Select
        value={search.sort}
        onValueChange={(value) => {
          if (value === "newest" || value === "oldest") update({ sort: value })
        }}
        items={[
          { value: "newest", label: "Newest first" },
          { value: "oldest", label: "Oldest first" },
        ]}
      >
        <SelectTrigger size="sm" aria-label="Sort audit logs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
