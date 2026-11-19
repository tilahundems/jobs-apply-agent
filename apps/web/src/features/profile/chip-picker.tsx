import { Check, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

const same = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase()

type ChipPickerProps = {
  options: readonly string[]
  selected: readonly string[]
  onChange: (next: string[]) => void
  /** Upper bound on selections, mirroring the API limit. */
  max?: number
  /** false renders a single-choice row, like a radio group. */
  multiple?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  emptyLabel?: string
}

/**
 * Checkbox chips with search: pick from the list or type a value that is not
 * there yet. Values that are selected but missing from `options` stay visible
 * so nothing saved earlier becomes unreachable.
 */
export function ChipPicker({
  options,
  selected,
  onChange,
  max,
  multiple = true,
  searchable = true,
  searchPlaceholder = "Search or type a new value",
  emptyLabel = "No matches",
}: ChipPickerProps) {
  const [query, setQuery] = useState("")
  const term = query.trim().toLowerCase()
  const limitReached = max !== undefined && selected.length >= max

  const custom = selected.filter(
    (value) => !options.some((option) => same(option, value))
  )
  const pool = useMemo(() => {
    const seen = new Set<string>()
    return [...custom, ...options].filter((value) => {
      const key = value.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [custom, options])

  const visible = term
    ? pool.filter((value) => value.toLowerCase().includes(term))
    : pool

  const trimmed = query.trim()
  const canAdd =
    trimmed.length > 0 &&
    trimmed.length <= 60 &&
    !pool.some((value) => same(value, trimmed)) &&
    !limitReached

  const add = () => {
    if (!canAdd) return
    onChange(multiple ? [...selected, trimmed] : [trimmed])
    setQuery("")
  }

  const isOn = (value: string) => selected.some((item) => same(item, value))

  return (
    <div className="flex flex-col gap-2">
      {searchable ? (
        <div className="flex items-center gap-2">
          <Input
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              add()
            }}
          />
          {multiple && max !== undefined ? (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {selected.length}/{max}
            </span>
          ) : null}
        </div>
      ) : null}

      {visible.length > 0 ? (
        <ToggleGroup
          multiple={multiple}
          value={[...selected]}
          onValueChange={(value) => {
            onChange(multiple ? value : value.slice(-1))
          }}
          variant="outline"
          size="sm"
          spacing={4}
          className="w-full flex-wrap justify-start"
        >
          {visible.map((value) => {
            const on = isOn(value)
            const blocked = !on && limitReached
            return (
              <ToggleGroupItem
                key={value}
                value={value}
                aria-label={value}
                disabled={blocked}
                title={blocked ? `You can pick at most ${max}` : undefined}
                className={cn(
                  "h-auto min-h-7 max-w-full gap-1.5 py-0.5 whitespace-normal",
                  on && "border-primary bg-primary/10 text-foreground"
                )}
              >
                <Check
                  className={cn("size-3.5", on ? "opacity-100" : "opacity-0")}
                />
                <span className="truncate">{value}</span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      ) : null}

      {visible.length === 0 && !canAdd ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : null}

      {canAdd ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={add}
        >
          <Plus className="size-3.5" />
          Add “{trimmed}”
        </Button>
      ) : null}
    </div>
  )
}
