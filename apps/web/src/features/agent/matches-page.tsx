import { useSuspenseQuery } from "@tanstack/react-query"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  SearchIcon,
  TargetIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { jobPageQueryOptions } from "@/features/jobs/jobs-api"
import { cn } from "@/lib/utils"
import { MatchRow } from "./match-row"
import { matchesSearch } from "./matches-search"

const STATUSES = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "prepared", label: "Written" },
  { value: "applied", label: "Applied" },
  { value: "dismissed", label: "Dismissed" },
] as const

/**
 * Every posting the agent kept. Search and status live in the URL; the rows are
 * read top to bottom, so there are no columns to configure.
 */
export function MatchesPage() {
  const {
    query,
    search,
    setSearch,
    rules,
    setRules,
    pagination,
    setPagination,
    setSorting,
  } = matchesSearch.useTableSearch()
  const { data: page } = useSuspenseQuery(jobPageQueryOptions(query))
  const status = rules.find((rule) => rule.field === "status")?.value ?? ""
  const sort = query.sort ?? "createdAt:desc"

  const [term, setTerm] = useState(search)
  useEffect(() => setTerm(search), [search])
  useEffect(() => {
    if (term === search) return
    const timer = setTimeout(() => setSearch(term), 300)
    return () => clearTimeout(timer)
  }, [term, search, setSearch])

  function setStatus(value: string) {
    setRules(
      value
        ? [{ id: "status", field: "status", operator: "equals", value }]
        : []
    )
  }

  const from =
    page.items.length === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const to = pagination.pageIndex * pagination.pageSize + page.items.length
  const pages = Math.max(1, Math.ceil(page.total / pagination.pageSize))

  return (
    <div className="pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
      <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
        Everything the agent kept, newest scan first. The chips under each role
        are the evidence behind its score.
      </p>

      <div className="mt-6 flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Role, company or channel"
            aria-label="Search matches"
            className="h-8 pl-8 text-sm"
          />
          {term ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setTerm("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
          {STATUSES.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant="ghost"
              aria-pressed={status === item.value}
              onClick={() => setStatus(item.value)}
              className={cn(
                "text-muted-foreground",
                status === item.value && "bg-muted text-foreground"
              )}
            >
              {item.label}
            </Button>
          ))}

          <span className="mx-1 h-4 w-px bg-border" aria-hidden />

          <Button
            size="sm"
            variant="ghost"
            aria-pressed={sort === "score:desc"}
            onClick={() => setSorting([{ id: "score", desc: true }])}
            className={cn(
              "text-muted-foreground",
              sort === "score:desc" && "bg-muted text-foreground"
            )}
          >
            <TargetIcon />
            Best fit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={sort === "createdAt:desc"}
            onClick={() => setSorting([{ id: "createdAt", desc: true }])}
            className={cn(
              "text-muted-foreground",
              sort === "createdAt:desc" && "bg-muted text-foreground"
            )}
          >
            <ClockIcon />
            Newest
          </Button>
        </div>
      </div>

      {page.items.length === 0 ? (
        <p className="max-w-prose py-16 text-sm text-muted-foreground">
          {search || status
            ? "No posting matches this search. Clear it to see everything the agent kept."
            : "The agent has not kept anything yet. Scan your channels, or check that your profile's target titles match the work you want."}
        </p>
      ) : (
        <>
          <div className="divide-y divide-border/60">
            {page.items.map((job) => (
              <MatchRow key={job.id} job={job} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 py-5 text-xs text-muted-foreground">
            <p className="tabular-nums">
              {from}–{to} of {page.total}
            </p>
            {pages > 1 ? (
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Previous page"
                  disabled={pagination.pageIndex === 0}
                  onClick={() =>
                    setPagination((current) => ({
                      ...current,
                      pageIndex: current.pageIndex - 1,
                    }))
                  }
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="tabular-nums">
                  {pagination.pageIndex + 1} / {pages}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Next page"
                  disabled={pagination.pageIndex + 1 >= pages}
                  onClick={() =>
                    setPagination((current) => ({
                      ...current,
                      pageIndex: current.pageIndex + 1,
                    }))
                  }
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
