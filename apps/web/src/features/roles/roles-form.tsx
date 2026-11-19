import { useForm } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useRouter } from "@tanstack/react-router"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Can } from "@/features/authz"
import { useI18n } from "@/features/i18n/i18n-provider"
import {
  describeConditions,
  permissionSubjectLabel,
} from "@/features/permissions/conditions"
import type { Permission } from "@/features/permissions/permissions-api"
import { permissionsQueryOptions } from "@/features/permissions/permissions-api"
import { rolesQueryOptions, usersQueryOptions } from "@/features/users"
import { useDialogOpen } from "@/hooks/use-dialog-open"
import type { Role, RoleInput } from "./roles-api"
import { createRole, updateRole, workspaceRolesQueryOptions } from "./roles-api"
import {
  filterPermissionsBySearch,
  groupPermissionsForPicker,
  slugifyRoleKey,
  togglePermissionIds,
} from "./roles-permissions"

const detailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(80, "Name must be at most 80 characters."),
  key: z
    .string()
    .trim()
    .min(1, "Key is required.")
    .max(40, "Key must be at most 40 characters.")
    .regex(
      /^[a-z][a-z0-9-]*$/,
      "Use a lowercase letter, then letters, numbers, or hyphens."
    ),
  description: z
    .string()
    .trim()
    .max(240, "Description must be at most 240 characters."),
})

const formSchema = detailsSchema.extend({
  permissionIds: z.array(z.string().min(1)).max(64),
})

const DETAIL_FIELDS = ["name", "key", "description"] as const

type FormStep = 1 | 2

function roleFormValues(role?: Role) {
  return {
    name: role?.name ?? "",
    key: role?.key ?? "",
    description: role?.description ?? "",
    permissionIds: role?.permissions.map((item) => item.id) ?? [],
  }
}

function RolePermissionPicker({
  catalog,
  search,
  selectedIds,
  errors,
  onSearchChange,
  onSelectedIdsChange,
}: {
  catalog: ReturnType<typeof useQuery<Permission[]>>
  search: string
  selectedIds: string[]
  errors?: Array<{ message?: string } | undefined>
  onSearchChange: (value: string) => void
  onSelectedIdsChange: (value: string[]) => void
}) {
  const { t } = useI18n()
  const groups = groupPermissionsForPicker(
    filterPermissionsBySearch(catalog.data ?? [], search)
  )

  return (
    <Field>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <FieldLabel>{t("Permissions")}</FieldLabel>
          <FieldDescription>
            {t("Optional. Manage the catalog on the")}{" "}
            <Link to="/settings/roles/permissions">
              {t("Permissions page")}
            </Link>
            .
          </FieldDescription>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {selectedIds.length} {t("selected")}
        </p>
      </div>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={t("Search available permissions")}
          placeholder={t("Search subjects, actions, or conditions")}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {search ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={t("Clear permission search")}
              onClick={() => onSearchChange("")}
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
      {catalog.isPending ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : catalog.isError ? (
        <div role="alert" className="flex flex-col gap-2">
          <p className="text-sm text-destructive">{catalog.error.message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void catalog.refetch()}
          >
            {t("Retry")}
          </Button>
        </div>
      ) : (
        <div className="flex max-h-72 flex-col gap-5 overflow-y-auto rounded-lg border p-3">
          {groups.map((group) => {
            const groupIds = group.permissions.map((item) => item.id)
            const selectedInGroup = groupIds.filter((id) =>
              selectedIds.includes(id)
            ).length
            const allSelected = selectedInGroup === groupIds.length

            return (
              <FieldSet
                key={group.subject}
                aria-label={permissionSubjectLabel(group.subject)}
                className="gap-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <FieldTitle>
                    {permissionSubjectLabel(group.subject)}
                  </FieldTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      onSelectedIdsChange(
                        togglePermissionIds(selectedIds, groupIds, !allSelected)
                      )
                    }
                  >
                    {allSelected ? t("Clear") : t("Select all")}
                  </Button>
                </div>
                {group.permissions.map((item) => (
                  <Field key={item.id} orientation="horizontal">
                    <Checkbox
                      id={`choose-${item.id}`}
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={(checked) =>
                        onSelectedIdsChange(
                          togglePermissionIds(selectedIds, [item.id], !!checked)
                        )
                      }
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <FieldLabel htmlFor={`choose-${item.id}`}>
                        {item.action}
                        {item.inverted ? " · Deny" : ""}
                      </FieldLabel>
                      <FieldDescription>
                        {describeConditions(item.conditions)}
                        {item.fields.length
                          ? ` · Fields: ${item.fields.join(", ")}`
                          : ""}
                      </FieldDescription>
                    </div>
                  </Field>
                ))}
              </FieldSet>
            )
          })}
          {!catalog.data.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No permissions yet. Create one first, then select it here.
            </p>
          ) : null}
          {catalog.data.length > 0 && groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No permissions match that search.
            </p>
          ) : null}
        </div>
      )}
      <FieldError errors={errors} />
    </Field>
  )
}

export function RolesForm({
  role,
  open: openProp,
  onOpenChange,
  showTrigger,
}: {
  role?: Role
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}) {
  const { t } = useI18n()
  const isEdit = role != null
  const dialog = useDialogOpen(openProp, onOpenChange)
  const [keyTouched, setKeyTouched] = React.useState(isEdit)
  const [step, setStep] = React.useState<FormStep>(1)
  const [permissionSearch, setPermissionSearch] = React.useState("")
  const { open } = dialog
  const catalog = useQuery({ ...permissionsQueryOptions, enabled: open })
  const queryClient = useQueryClient()
  const router = useRouter()
  const formId = isEdit ? `roles-form-${role.id}` : "roles-form"
  const saveRole = useMutation({
    mutationFn: (input: RoleInput) =>
      isEdit ? updateRole(role.id, input) : createRole(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(workspaceRolesQueryOptions),
        queryClient.invalidateQueries(permissionsQueryOptions),
        queryClient.invalidateQueries(rolesQueryOptions),
        queryClient.invalidateQueries(usersQueryOptions),
        router.invalidate(),
      ])
    },
  })
  const form = useForm({
    defaultValues: roleFormValues(role),
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await saveRole.mutateAsync({
          key: value.key,
          name: value.name,
          description: value.description,
          permissionIds: value.permissionIds,
        })
        toast.success(t(isEdit ? "Role updated" : "Role created"), {
          description: value.name,
        })
        dialog.setOpen(false)
        form.reset(roleFormValues(role))
        setKeyTouched(isEdit)
        setStep(1)
        setPermissionSearch("")
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : isEdit
              ? t("Unable to update role")
              : t("Unable to create role")
        )
      }
    },
  })

  React.useEffect(() => {
    if (!open) {
      return
    }

    form.reset(roleFormValues(role))
    setKeyTouched(isEdit)
    setStep(1)
    setPermissionSearch("")
  }, [form, isEdit, open, role])

  function handleOpenChange(nextOpen: boolean) {
    dialog.setOpen(nextOpen)
    if (!nextOpen) {
      form.reset(roleFormValues(role))
      setKeyTouched(isEdit)
      setStep(1)
      setPermissionSearch("")
    }
  }

  async function goToPermissions() {
    for (const name of DETAIL_FIELDS) {
      form.setFieldMeta(name, (meta) => ({ ...meta, isTouched: true }))
    }

    const parsed = detailsSchema.safeParse({
      name: form.getFieldValue("name"),
      key: form.getFieldValue("key"),
      description: form.getFieldValue("description"),
    })

    await Promise.all(
      DETAIL_FIELDS.map((name) => form.validateField(name, "submit"))
    )

    if (!parsed.success) {
      const first = parsed.error.issues[0]?.path[0]
      if (typeof first === "string") {
        document.getElementById(first)?.focus()
      }
      return
    }

    setStep(2)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {isEdit || showTrigger === false ? null : (
        <Can I="create" a="Role">
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon data-icon="inline-start" />
            <span className="hidden lg:inline">{t("Add Role")}</span>
          </DialogTrigger>
        </Can>
      )}
      <DialogContent className="flex max-h-[min(40rem,calc(100vh-2rem))] flex-col overflow-hidden p-6 sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t(isEdit ? "Edit Role" : "Add Role")}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? isEdit
                ? t("Update this role's name and how it is identified.")
                : t("Name the role, then choose what it can do.")
              : isEdit
                ? t("Update what this role can do in the workspace.")
                : t("Choose what this role can do in the workspace.")}
          </DialogDescription>
        </DialogHeader>
        <form
          id={formId}
          noValidate
          className="-mx-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 pb-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (step === 1) {
              void goToPermissions()
              return
            }
            form.handleSubmit()
          }}
        >
          <FieldGroup className="animate-in duration-150 fade-in-0" key={step}>
            {step === 1 ? (
              <>
                <form.Field
                  name="name"
                  children={(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          {t("Name")}
                        </FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => {
                            field.handleChange(e.target.value)
                            if (!isEdit && !keyTouched) {
                              form.setFieldValue(
                                "key",
                                slugifyRoleKey(e.target.value)
                              )
                            }
                          }}
                          aria-invalid={isInvalid}
                          placeholder="Project manager"
                          autoComplete="off"
                        />
                        <FieldDescription>
                          {t("How this role appears when assigning people.")}
                        </FieldDescription>
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </Field>
                    )
                  }}
                />
                <form.Field
                  name="key"
                  children={(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    const keyLocked = isEdit && Boolean(role.isSystem)
                    return (
                      <Field data-invalid={isInvalid} data-disabled={keyLocked}>
                        <FieldLabel htmlFor={field.name}>{t("Key")}</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => {
                            setKeyTouched(true)
                            field.handleChange(e.target.value)
                          }}
                          aria-invalid={isInvalid}
                          placeholder="project-manager"
                          autoComplete="off"
                          spellCheck={false}
                          disabled={keyLocked}
                        />
                        <FieldDescription>
                          {keyLocked
                            ? t("System role keys cannot be changed.")
                            : t(
                                "A stable identifier used in the API and seed data."
                              )}
                        </FieldDescription>
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </Field>
                    )
                  }}
                />
                <form.Field
                  name="description"
                  children={(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          {t("Description")}
                        </FieldLabel>
                        <InputGroup>
                          <InputGroupTextarea
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            placeholder="Can manage assigned projects and their tasks."
                            rows={4}
                            className="min-h-24 resize-none"
                          />
                          <InputGroupAddon align="block-end">
                            <InputGroupText className="tabular-nums">
                              {field.state.value.length}/240
                            </InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </Field>
                    )
                  }}
                />
              </>
            ) : (
              <form.Field
                name="permissionIds"
                children={(field) => (
                  <RolePermissionPicker
                    catalog={catalog}
                    search={permissionSearch}
                    selectedIds={field.state.value}
                    errors={field.state.meta.errors}
                    onSearchChange={setPermissionSearch}
                    onSelectedIdsChange={field.handleChange}
                  />
                )}
              />
            )}
          </FieldGroup>
        </form>
        <DialogFooter className="-mx-6 -mb-6 shrink-0">
          <Field orientation="horizontal" className="justify-end">
            {step === 1 ? (
              <DialogClose render={<Button variant="outline" />}>
                {t("Cancel")}
              </DialogClose>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
              >
                <ChevronLeftIcon data-icon="inline-start" />
                {t("Back")}
              </Button>
            )}
            {step === 1 ? (
              <Button type="submit" form={formId}>
                {t("Continue")}
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            ) : (
              <form.Subscribe
                selector={(state) => state.isSubmitting}
                children={(isSubmitting) => (
                  <Button type="submit" form={formId} disabled={isSubmitting}>
                    {isSubmitting
                      ? isEdit
                        ? t("Saving...")
                        : t("Adding...")
                      : isEdit
                        ? t("Save Changes")
                        : t("Add Role")}
                  </Button>
                )}
              />
            )}
          </Field>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
