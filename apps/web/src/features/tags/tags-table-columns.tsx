import { createColumnHelper } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/table/column-header"
import { createTableSearch } from "@/components/table/create-table-search"
import type { dataTableFeatures } from "@/components/table/data-table"
import { RowActions } from "@/components/table/row-actions"
import { Badge } from "@/components/ui/badge"
import { formatRecordDate } from "@/lib/format"
import type { Tag } from "./tags-api"
import { TagsDeleteDialog } from "./tags-delete-dialog"
import { TagsForm } from "./tags-form"

/** The Tags list's URL state; the server searches, filters and sorts. */
export const tagTableSearch = createTableSearch({
  fields: [
    { value: "label", label: "Label" },
    { value: "color", label: "Color" },
    { value: "createdAt", label: "Created", kind: "date" },
  ],
  sortFields: ["label", "color", "createdAt"],
})

const columnHelper = createColumnHelper<typeof dataTableFeatures, Tag>()

export function createTagsTableColumns() {
  return columnHelper.columns([
    columnHelper.accessor("label", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Label" />
      ),
      cell: ({ row }) => (
        <Badge variant="outline" className="gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: row.original.color }}
          />
          {row.original.label}
        </Badge>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor("color", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Color" />
      ),
      cell: ({ row }) => (
        <span className="flex items-center gap-2 text-muted-foreground">
          <span
            className="size-3 rounded-full border border-input"
            style={{ backgroundColor: row.original.color }}
          />
          {row.original.color}
        </span>
      ),
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
          subject="Tag"
          edit={(open, onOpenChange) => (
            <TagsForm
              tag={row.original}
              open={open}
              onOpenChange={onOpenChange}
            />
          )}
          remove={(open, onOpenChange) => (
            <TagsDeleteDialog
              tag={row.original}
              open={open}
              onOpenChange={onOpenChange}
            />
          )}
        />
      ),
    }),
  ])
}
