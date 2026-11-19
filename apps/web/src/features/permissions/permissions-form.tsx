import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { SUBJECTS } from "@/features/authz/ability"
import { workspaceRolesQueryOptions } from "@/features/roles/roles-api"
import {
  conditionsFromRows,
  parseConditionsJson,
  permissionSubjectLabel,
  rowsFromConditions,
} from "./conditions"
import { ConditionsEditor } from "./conditions-editor"
import { PermissionSelect } from "./permission-select"
import type {
  Permission,
  PermissionInput,
  PermissionOption,
} from "./permissions-api"
import {
  createPermission,
  permissionsQueryOptions,
  updatePermission,
} from "./permissions-api"

const commonActions = [
  "create",
  "read",
  "update",
  "delete",
  "manage",
  "approve",
  "grant",
  "revoke",
]

export function PermissionsForm({
  permission,
  options,
  actions,
  onClose,
}: {
  permission?: Permission
  options: PermissionOption[]
  actions: string[]
  onClose: () => void
}) {
  const initialRows = rowsFromConditions(permission?.conditions ?? null)
  const [subject, setSubject] = useState<PermissionInput["subject"]>(
    permission?.subject ?? "Task"
  )
  const [action, setAction] = useState(permission?.action ?? "")
  const [rows, setRows] = useState(initialRows ?? [])
  const [mode, setMode] = useState(initialRows ? "builder" : "json")
  const [json, setJson] = useState(
    JSON.stringify(permission?.conditions ?? {}, null, 2)
  )
  const [error, setError] = useState("")
  const queryClient = useQueryClient()
  const router = useRouter()
  const fields = options.find((item) => item.subject === subject)?.fields ?? []
  const suggestions = [
    ...new Set([
      ...commonActions,
      ...actions,
      ...(action.trim() ? [action.trim()] : []),
    ]),
  ]
  const save = useMutation({
    mutationFn: (input: PermissionInput) =>
      permission
        ? updatePermission(permission.id, input)
        : createPermission(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(permissionsQueryOptions),
        queryClient.invalidateQueries(workspaceRolesQueryOptions),
        router.invalidate(),
      ])
      toast.success(permission ? "Permission updated" : "Permission created")
      onClose()
    },
  })

  function changeMode(next: string) {
    try {
      if (next === "json")
        setJson(JSON.stringify(conditionsFromRows(rows, fields) ?? {}, null, 2))
      else {
        const converted = rowsFromConditions(parseConditionsJson(json))
        if (!converted)
          throw new Error(
            "This rule uses advanced conditions. Continue editing it as JSON to preserve its values."
          )
        setRows(converted)
      }
      setMode(next)
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid conditions.")
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose()
      }}
    >
      <DialogContent
        className="flex max-h-[min(40rem,calc(100vh-2rem))] flex-col overflow-hidden p-6 sm:max-w-2xl"
        showCloseButton={!save.isPending}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {permission ? "Edit permission" : "Add permission"}
          </DialogTitle>
          <DialogDescription>
            {permission
              ? `Changes apply to all ${permission.roleCount} assigned ${permission.roleCount === 1 ? "role" : "roles"}.`
              : "Define a permission, then assign it to roles."}
          </DialogDescription>
        </DialogHeader>
        <form
          id="permission-form"
          className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pr-1"
          onSubmit={(event) => {
            event.preventDefault()
            if (save.isPending) return
            setError("")
            try {
              if (
                !/^[a-z][a-z0-9:_-]*$/.test(action.trim()) ||
                action.trim().length > 80
              )
                throw new Error(
                  "Enter an action using lowercase letters, numbers, hyphens, underscores or colons (up to 80 characters)."
                )
              const conditions =
                mode === "builder"
                  ? conditionsFromRows(rows, fields)
                  : parseConditionsJson(json)
              if (
                subject === "all" &&
                conditions &&
                Object.keys(conditions).length
              )
                throw new Error("Choose a specific subject to add conditions.")
              save.mutate(
                {
                  subject,
                  action: action.trim(),
                  conditions:
                    conditions && Object.keys(conditions).length
                      ? conditions
                      : null,
                },
                { onError: (cause) => setError(cause.message) }
              )
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Invalid permission."
              )
            }
          }}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="permission-subject">Subject</FieldLabel>
                <PermissionSelect
                  id="permission-subject"
                  label="Subject"
                  value={subject}
                  items={SUBJECTS.map((value) => ({
                    value,
                    label: permissionSubjectLabel(value),
                  }))}
                  onChange={(value) =>
                    setSubject(value as PermissionInput["subject"])
                  }
                  disabled={save.isPending}
                />
                <FieldDescription>
                  The area this permission applies to.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="permission-action">Action</FieldLabel>
                <Combobox
                  items={suggestions}
                  value={action || null}
                  inputValue={action}
                  onInputValueChange={setAction}
                  onValueChange={(value) => {
                    if (value) setAction(value)
                  }}
                >
                  <ComboboxInput
                    id="permission-action"
                    placeholder="Select or type an action"
                    required
                    maxLength={80}
                    disabled={save.isPending}
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      <ComboboxGroup>
                        {suggestions
                          .filter((item) => item.includes(action))
                          .map((item) => (
                            <ComboboxItem key={item} value={item}>
                              {item}
                              {!commonActions.includes(item) &&
                              !actions.includes(item)
                                ? " (custom)"
                                : ""}
                            </ComboboxItem>
                          ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <FieldDescription>
                  Choose an action or type your own, like approve.
                </FieldDescription>
              </Field>
            </div>
            {action === "manage" && (
              <p className="text-sm text-muted-foreground">
                Manage includes every action for the selected subject.
              </p>
            )}
            <FieldSet disabled={save.isPending}>
              <FieldLegend>
                Conditions{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </FieldLegend>
              <FieldDescription>
                All conditions must match. For alternatives, define another
                permission.
              </FieldDescription>
              <Tabs value={mode} onValueChange={changeMode}>
                <TabsList>
                  <TabsTrigger value="builder">Builder</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                </TabsList>
              </Tabs>
              {mode === "builder" ? (
                <ConditionsEditor
                  rows={rows}
                  fields={fields}
                  onChange={setRows}
                />
              ) : (
                <Field>
                  <FieldLabel htmlFor="permission-json">
                    Conditions JSON
                  </FieldLabel>
                  <Textarea
                    id="permission-json"
                    rows={8}
                    value={json}
                    onChange={(event) => setJson(event.target.value)}
                    spellCheck={false}
                    aria-invalid={Boolean(error)}
                    aria-describedby="permission-error"
                  />
                  <FieldDescription>
                    Use field conditions supported by the app, such as{" "}
                    {`{"assigneeId": "${"${user.id}"}"}`}. Empty braces mean all
                    records.
                  </FieldDescription>
                </Field>
              )}
            </FieldSet>
            {permission?.inverted && (
              <p className="text-sm text-muted-foreground">
                This is an existing deny rule. Its deny behavior is preserved.
              </p>
            )}
            {Boolean(permission?.fields.length) && (
              <p className="text-sm text-muted-foreground">
                Limited to fields: {permission?.fields.join(", ")}. This
                restriction is preserved.
              </p>
            )}
            <Field data-invalid={Boolean(error)}>
              <FieldError id="permission-error" role="alert">
                {error}
              </FieldError>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter className="-mx-6 -mb-6 shrink-0">
          <Button variant="outline" disabled={save.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="permission-form"
            disabled={save.isPending}
          >
            {save.isPending
              ? "Saving…"
              : permission
                ? "Save changes"
                : "Add permission"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
