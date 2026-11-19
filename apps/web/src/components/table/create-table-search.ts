import { useNavigate, useSearch } from "@tanstack/react-router"
import type {
  PaginationState,
  SortingState,
  Updater,
} from "@tanstack/react-table"
import { useCallback, useMemo, useState } from "react"
import type { ListQuery, PageSize } from "@/lib/table-search-params"
import {
  applyUpdater,
  DEFAULT_SORT,
  fromSorting,
  readSort,
  readTableSearch,
  toPageSize,
  toSorting,
} from "@/lib/table-search-params"
import type { FilterField, FilterQuery, FilterRule } from "./list-filters"
import { parseFilter, withIds, withoutIds } from "./list-filters"

export type TableSearchParams = {
  page?: number
  perPage?: PageSize
  q?: string
  filters?: FilterQuery[]
  sort?: string
}

type SearchPatch = Partial<TableSearchParams>
type NavigateSearch = (options: {
  to: "."
  search: (previous: Record<string, unknown>) => Record<string, unknown>
}) => Promise<void>

/**
 * Keeps a list page's page, page size, search, filters and (for server-sorted
 * lists) sort in route search params. Pass `sortFields` when the server sorts;
 * otherwise sorting stays in component state and sorts the loaded rows.
 */
export function createTableSearch<const TField extends string>({
  fields,
  sortFields,
  defaultSort = DEFAULT_SORT,
}: {
  fields: readonly FilterField<TField>[]
  sortFields?: readonly string[]
  defaultSort?: string
}) {
  function validateSearch(search: Record<string, unknown>): TableSearchParams {
    const base = readTableSearch(search)
    return {
      page: base.page,
      perPage: base.perPage,
      q: base.q,
      filters: base.filters
        .map((value) => parseFilter(value, fields))
        .filter((value): value is FilterQuery => value !== null),
      ...(sortFields
        ? { sort: readSort(search.sort, sortFields, defaultSort) }
        : {}),
    }
  }

  /** The server query for these search params; use it in loaders and query keys. */
  function toQuery(search: TableSearchParams): ListQuery {
    return {
      page: search.page ?? 1,
      perPage: search.perPage ?? 10,
      search: search.q ?? "",
      filters: search.filters ?? [],
      ...(sortFields ? { sort: search.sort ?? defaultSort } : {}),
    }
  }

  function useTableSearch() {
    const params = useSearch({ strict: false }) as TableSearchParams
    const navigate = useNavigate() as unknown as NavigateSearch
    const query = toQuery(params)
    const update = useCallback(
      (patch: SearchPatch) =>
        navigate({
          to: ".",
          search: (previous) => ({ ...previous, ...patch }),
        }),
      [navigate]
    )

    const pagination = useMemo<PaginationState>(
      () => ({ pageIndex: query.page - 1, pageSize: query.perPage }),
      [query.page, query.perPage]
    )
    const setPagination = useCallback(
      (updater: Updater<PaginationState>) => {
        const next = applyUpdater(updater, pagination)
        return update({
          page: next.pageIndex + 1,
          perPage: toPageSize(next.pageSize),
        })
      },
      [pagination, update]
    )

    const [localSorting, setLocalSorting] = useState<SortingState>([])
    const urlSorting = useMemo(
      () => toSorting(query.sort ?? defaultSort),
      [query.sort]
    )
    const sorting = sortFields ? urlSorting : localSorting
    const setSorting = useCallback(
      (updater: Updater<SortingState>) => {
        if (!sortFields) return setLocalSorting(updater)
        const next = applyUpdater(updater, urlSorting)
        return update({
          sort: next.length ? fromSorting(next) : defaultSort,
          page: 1,
        })
      },
      [update, urlSorting]
    )

    const rules = useMemo(() => withIds(query.filters ?? []), [query.filters])
    const setRules = useCallback(
      (next: FilterRule[]) => update({ filters: withoutIds(next), page: 1 }),
      [update]
    )
    const setSearch = useCallback(
      (value: string) => update({ q: value.slice(0, 255), page: 1 }),
      [update]
    )

    return {
      query,
      search: query.search ?? "",
      setSearch,
      rules,
      setRules,
      pagination,
      setPagination,
      sorting,
      setSorting,
    }
  }

  return { fields, validateSearch, toQuery, useTableSearch }
}
