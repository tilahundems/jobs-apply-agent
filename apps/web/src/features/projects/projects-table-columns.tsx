import { Link } from "@tanstack/react-router"
import { createColumnHelper } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/table/column-header"
import { createTableSearch } from "@/components/table/create-table-search"
import type { dataTableFeatures } from "@/components/table/data-table"
import { RowActions } from "@/components/table/row-actions"
import { Badge } from "@/components/ui/badge"
import { formatRecordDate } from "@/lib/format"
import type { Project } from "./projects-api"
import { ProjectsDeleteDialog } from "./projects-delete-dialog"
import { ProjectsForm } from "./projects-form"

/**
 * The Projects list's URL state, the reference for server-paginated lists:
 * the server searches, filters and sorts before it paginates.
 */
export const projectTableSearch = createTableSearch({
  fields: [
    { value: "name", label: "Name" },
    { value: "description", label: "Description" },
    { value: "tags", label: "Tags", placeholder: "Enter tag name…" },
    { value: "createdAt", label: "Created", kind: "date" },
  ],
  sortFields: ["name", "description", "createdAt"],
})

const columnHelper = createColumnHelper<typeof dataTableFeatures, Project>()

export function createProjectsTableColumns() {
  return columnHelper.columns([
    columnHelper.accessor("name", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <Link
          to="/projects/$projectId"
          params={{ projectId: row.original.id }}
          className="font-medium hover:underline"
        >
          {row.original.name}
        </Link>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor("description", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      cell: ({ row }) => (
        <span
          className="line-clamp-1 max-w-md text-muted-foreground"
          title={row.original.description}
        >
          {row.original.description}
        </span>
      ),
    }),
    columnHelper.accessor("tags", {
      header: "Tags",
      enableSorting: false,
      cell: ({ row }) => {
        if (row.original.tags.length === 0) {
          return <span className="text-muted-foreground">—</span>
        }

        return (
          <div className="flex max-w-xs flex-wrap gap-1">
            {row.original.tags.map((tag) => (
              <Badge key={tag.id} variant="outline" className="gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.label}
              </Badge>
            ))}
          </div>
        )
      },
    }),
    columnHelper.accessor("createdAt", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatRecordDate(row.original.createdAt)}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => (
        <RowActions
          subject="Project"
          view={
            <Link
              to="/projects/$projectId"
              params={{ projectId: row.original.id }}
            />
          }
          edit={(open, onOpenChange) => (
            <ProjectsForm
              project={row.original}
              open={open}
              onOpenChange={onOpenChange}
            />
          )}
          remove={(open, onOpenChange) => (
            <ProjectsDeleteDialog
              project={row.original}
              open={open}
              onOpenChange={onOpenChange}
            />
          )}
        />
      ),
    }),
  ])
}
