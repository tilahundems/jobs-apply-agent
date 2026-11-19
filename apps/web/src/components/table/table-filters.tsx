import { ListFilterIcon, PlusIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { Separator } from "@/components/ui/separator"
import type { FilterField, FilterRule } from "./list-filters"
import { operatorsFor } from "./list-filters"

/** The advanced-filter popover for list pages. Rules combine with AND. */
export function TableFilters({
  label,
  fields,
  applied,
  onApply,
}: {
  label: string
  fields: readonly FilterField[]
  applied: FilterRule[]
  onApply: (rules: FilterRule[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterRule[]>([])

  function newRule(): FilterRule {
    return {
      id: crypto.randomUUID(),
      field: fields[0]?.value ?? "",
      operator: "equals",
      value: "",
    }
  }

  function updateRule(id: string, update: Partial<FilterRule>) {
    setDraft((rules) =>
      rules.map((rule) => (rule.id === id ? { ...rule, ...update } : rule))
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen)
          setDraft(
            applied.length ? applied.map((rule) => ({ ...rule })) : [newRule()]
          )
        setOpen(nextOpen)
      }}
    >
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <ListFilterIcon data-icon="inline-start" />
        Filters
        {applied.length > 0 && (
          <Badge
            variant="outline"
            className="ml-1 size-[18px] rounded-full border-transparent bg-foreground px-0 text-xs leading-none text-white dark:border-border dark:bg-transparent dark:text-foreground"
            aria-label={`${applied.length} Applied Filters`}
          >
            {applied.length}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(44rem,calc(100vw-2rem))] gap-0 p-0"
      >
        <PopoverTitle className="sr-only">
          Filter {label.toLowerCase()}
        </PopoverTitle>
        <PopoverDescription className="sr-only">
          {label} must match all filters. Apply to update the table.
        </PopoverDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onApply(draft)
            setOpen(false)
          }}
        >
          <FieldGroup className="max-h-[min(24rem,55dvh)] gap-3 overflow-y-auto p-4">
            {draft.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No filters. Add a filter to narrow your {label.toLowerCase()}.
              </p>
            )}
            {draft.map((rule, index) => {
              const field = fields.find(({ value }) => value === rule.field)
              const operators = operatorsFor(field)
              return (
                <FieldGroup
                  key={rule.id}
                  className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_2rem] sm:gap-3"
                >
                  <Field className="min-w-0">
                    <Select
                      items={fields}
                      value={rule.field}
                      onValueChange={(value) => {
                        if (value)
                          updateRule(rule.id, {
                            field: value,
                            operator: "equals",
                            value: "",
                          })
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`Filter ${index + 1} field`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {fields.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field className="col-start-1 min-w-0 sm:col-start-auto">
                    <Select
                      items={operators}
                      value={rule.operator}
                      onValueChange={(value) => {
                        if (value) updateRule(rule.id, { operator: value })
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`Filter ${index + 1} operator`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {operators.map((operator) => (
                            <SelectItem
                              key={operator.value}
                              value={operator.value}
                            >
                              {operator.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field className="col-start-1 min-w-0 sm:col-start-auto">
                    <Input
                      aria-label={`Filter ${index + 1} value`}
                      type={field?.kind === "date" ? "date" : "text"}
                      placeholder={field?.placeholder ?? "Enter value…"}
                      value={rule.value}
                      onChange={(event) =>
                        updateRule(rule.id, { value: event.target.value })
                      }
                      required
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto"
                    aria-label={`Remove Filter ${index + 1}`}
                    onClick={() =>
                      setDraft((rules) =>
                        rules.filter(({ id }) => id !== rule.id)
                      )
                    }
                  >
                    <XIcon />
                  </Button>
                </FieldGroup>
              )
            })}
          </FieldGroup>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft((rules) => [...rules, newRule()])}
            >
              <PlusIcon data-icon="inline-start" />
              Add Filter
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={draft.length === 0 && applied.length === 0}
                onClick={() => {
                  setDraft([])
                  onApply([])
                }}
              >
                Clear All
              </Button>
              <Button
                type="submit"
                disabled={draft.some((rule) => !rule.value.trim())}
              >
                Apply Filter
              </Button>
            </div>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
