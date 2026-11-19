import { PlusIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ConditionRow } from "./conditions"
import { newCondition, OPERATORS } from "./conditions"
import { PermissionSelect } from "./permission-select"
import type { ConditionField } from "./permissions-api"

export function ConditionsEditor({
  rows,
  fields,
  onChange,
}: {
  rows: ConditionRow[]
  fields: ConditionField[]
  onChange: (rows: ConditionRow[]) => void
}) {
  const update = (id: string, patch: Partial<ConditionRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  return (
    <div className="flex flex-col gap-3">
      {!rows.length && (
        <p className="text-sm text-muted-foreground">
          Applies to all records. Add conditions to limit access.
        </p>
      )}
      {rows.map((row, index) => {
        const field = fields.find((item) => item.name === row.field)
        const list = ["$in", "$nin"].includes(row.operator)
        return (
          <div
            key={row.id}
            className="flex items-start gap-2 rounded-lg border p-3"
          >
            <FieldGroup className="gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`${row.id}-field`}>Field</FieldLabel>
                  <PermissionSelect
                    id={`${row.id}-field`}
                    label={`Field ${index + 1}`}
                    value={row.field}
                    items={fields.map((item) => ({
                      value: item.name,
                      label: item.name,
                    }))}
                    onChange={(value) =>
                      update(row.id, {
                        field: value,
                        value: "",
                        source: "value",
                        operator: "$eq",
                      })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${row.id}-operator`}>
                    Operator
                  </FieldLabel>
                  <PermissionSelect
                    id={`${row.id}-operator`}
                    label={`Operator ${index + 1}`}
                    value={row.operator}
                    items={OPERATORS.filter(
                      (item) =>
                        field?.type === "number" ||
                        ["$eq", "$ne", "$in", "$nin"].includes(item.value)
                    )}
                    onChange={(value) => update(row.id, { operator: value })}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                <Field>
                  <FieldLabel htmlFor={`${row.id}-source`}>
                    Value source
                  </FieldLabel>
                  <PermissionSelect
                    id={`${row.id}-source`}
                    label={`Value source ${index + 1}`}
                    value={row.source}
                    items={[
                      { value: "value", label: "Value" },
                      ...(field?.type === "string"
                        ? [{ value: "user", label: "Current user" }]
                        : []),
                      ...(["$eq", "$ne", "$in", "$nin"].includes(row.operator)
                        ? [{ value: "null", label: "Empty (null)" }]
                        : []),
                    ]}
                    onChange={(value) =>
                      update(row.id, {
                        source: value as ConditionRow["source"],
                      })
                    }
                  />
                </Field>
                {row.source === "value" && (
                  <Field>
                    <FieldLabel htmlFor={`${row.id}-value`}>
                      {list ? "Values" : "Value"}
                    </FieldLabel>
                    {list ? (
                      <>
                        <Textarea
                          id={`${row.id}-value`}
                          value={row.value}
                          onChange={(e) =>
                            update(row.id, { value: e.target.value })
                          }
                          placeholder="One value per line"
                          rows={2}
                        />
                        <FieldDescription>One value per line.</FieldDescription>
                      </>
                    ) : field?.type === "boolean" || field?.values.length ? (
                      <PermissionSelect
                        id={`${row.id}-value`}
                        label={`Value ${index + 1}`}
                        value={row.value}
                        items={(field.type === "boolean"
                          ? ["true", "false"]
                          : field.values
                        ).map((value) => ({ value, label: value }))}
                        onChange={(value) => update(row.id, { value })}
                      />
                    ) : (
                      <Input
                        id={`${row.id}-value`}
                        type={field?.type === "number" ? "number" : "text"}
                        value={row.value}
                        onChange={(e) =>
                          update(row.id, { value: e.target.value })
                        }
                        placeholder="Enter a value"
                      />
                    )}
                  </Field>
                )}
                {row.source !== "value" && (
                  <Field className="justify-end">
                    <p className="flex h-8 items-center text-sm text-muted-foreground">
                      {row.source === "user"
                        ? "Uses the signed-in user’s ID."
                        : "Matches an empty value."}
                    </p>
                  </Field>
                )}
              </div>
            </FieldGroup>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove condition ${index + 1}`}
              onClick={() =>
                onChange(rows.filter((item) => item.id !== row.id))
              }
            >
              <XIcon />
            </Button>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={!fields.length}
        onClick={() => onChange([...rows, newCondition()])}
      >
        <PlusIcon data-icon="inline-start" />
        Add condition
      </Button>
    </div>
  )
}
