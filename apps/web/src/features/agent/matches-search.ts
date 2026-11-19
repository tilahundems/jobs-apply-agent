import { createTableSearch } from "@/components/table/create-table-search"

/**
 * The matches list keeps search, status and sort in the URL so a filtered view
 * can be reloaded or shared. It is not a data table; the server still sorts.
 */
export const matchesSearch = createTableSearch({
  fields: [{ value: "status", label: "Status" }],
  sortFields: ["score", "createdAt"],
  defaultSort: "score:desc",
})
