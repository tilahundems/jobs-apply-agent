import { useForm } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import * as z from "zod"
import { Button } from "@/components/ui/button"
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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Can, useCurrentUserId } from "@/features/authz"
import { useI18n } from "@/features/i18n/i18n-provider"
import { tasksQueryOptions } from "@/features/tasks/tasks-api"
import { useDialogOpen } from "@/hooks/use-dialog-open"
import { TenantUsersForm } from "./tenant-users-form"
import type { CreateUserInput, UpdateUserInput, User } from "./users-api"
import {
  createUser,
  rolesQueryOptions,
  updateUser,
  usersQueryOptions,
} from "./users-api"

const editFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(80, "Name must be at most 80 characters."),
  email: z.string(),
  password: z.string(),
  roleId: z.string().min(1, "Role is required."),
})

const createFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(80, "Name must be at most 80 characters."),
  email: z.string().trim().email("Enter a valid email."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be at most 128 characters."),
  roleId: z.string().min(1, "Role is required."),
})

function primaryRoleId(user?: User) {
  const roles = user?.roles ?? []
  return roles.find((role) => role.key === "admin")?.id || roles.at(0)?.id || ""
}

function userFormValues(user?: User) {
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    roleId: primaryRoleId(user),
  }
}

export function UsersForm(props: {
  user?: User
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}) {
  return import.meta.env.VITE_MULTI_TENANCY === "true" ? (
    <TenantUsersForm {...props} />
  ) : (
    <SingleTenantUsersForm {...props} />
  )
}

function SingleTenantUsersForm({
  user,
  open: openProp,
  onOpenChange,
  showTrigger,
}: {
  user?: User
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}) {
  const { t } = useI18n()
  const isEdit = user != null
  const dialog = useDialogOpen(openProp, onOpenChange)
  const { open } = dialog
  const queryClient = useQueryClient()
  const router = useRouter()
  const currentUserId = useCurrentUserId()
  const { data: roles = [] } = useQuery({
    ...rolesQueryOptions,
    enabled: open,
  })
  const roleItems = roles.map((role) => ({
    label: role.name,
    value: role.id,
  }))
  const formId = isEdit ? `users-form-${user.id}` : "users-form"
  const saveUser = useMutation({
    mutationFn: (input: CreateUserInput | UpdateUserInput) =>
      isEdit
        ? updateUser(user.id, { name: input.name, roleId: input.roleId })
        : createUser(input as CreateUserInput),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(usersQueryOptions),
        queryClient.invalidateQueries(tasksQueryOptions),
      ])

      if (isEdit && user.id === currentUserId) {
        await router.invalidate()
      }
    },
  })
  const form = useForm({
    defaultValues: userFormValues(user),
    validators: {
      onSubmit: isEdit ? editFormSchema : createFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await saveUser.mutateAsync(value)
        toast.success(t(isEdit ? "User updated" : "User created"), {
          description: value.name,
        })
        dialog.setOpen(false)
        form.reset(userFormValues(user))
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : isEdit
              ? t("Unable to update user")
              : t("Unable to create user")
        )
      }
    },
  })

  React.useEffect(() => {
    if (!open) {
      return
    }

    form.reset(userFormValues(user))
  }, [form, open, user])

  function handleOpenChange(nextOpen: boolean) {
    dialog.setOpen(nextOpen)
    if (!nextOpen) {
      form.reset(userFormValues(user))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {isEdit || showTrigger === false ? null : (
        <Can I="create" a="User">
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon />
            <span className="hidden lg:inline">{t("Add User")}</span>
          </DialogTrigger>
        </Can>
      )}
      <DialogContent className="flex max-h-[min(40rem,calc(100vh-2rem))] flex-col overflow-hidden p-6 sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t(isEdit ? "Edit User" : "Add User")}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("Update this user's name and workspace role.")
              : t("Create a user and choose their workspace role.")}
          </DialogDescription>
        </DialogHeader>
        <form
          id={formId}
          noValidate
          className="-mx-3 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto px-3"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field
              name="name"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>{t("Name")}</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Jane Doe"
                      autoComplete="off"
                    />
                    <FieldDescription>
                      {t("How this person appears across the workspace.")}
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
            {isEdit ? (
              <Field data-disabled>
                <FieldLabel htmlFor="user-email">{t("Email")}</FieldLabel>
                <Input
                  id="user-email"
                  value={user.email}
                  disabled
                  autoComplete="off"
                />
                <FieldDescription>
                  {t("Email is used to sign in and cannot be changed here.")}
                </FieldDescription>
              </Field>
            ) : (
              <form.Field
                name="email"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>{t("Email")}</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="jane@example.com"
                        autoComplete="off"
                      />
                      <FieldDescription>
                        {t("They will use this email to sign in.")}
                      </FieldDescription>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
            )}
            {isEdit ? null : (
              <form.Field
                name="password"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("Password")}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        autoComplete="new-password"
                      />
                      <FieldDescription>
                        {t("Must be at least 8 characters.")}
                      </FieldDescription>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
            )}
            <form.Field
              name="roleId"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                const selectedRole = roles.find(
                  (role) => role.id === field.state.value
                )

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>{t("Role")}</FieldLabel>
                    <Select
                      items={roleItems}
                      value={field.state.value || null}
                      onValueChange={(value) => {
                        if (value != null) {
                          field.handleChange(value)
                        }
                      }}
                    >
                      <SelectTrigger
                        id={field.name}
                        className="w-full min-w-0"
                        aria-invalid={isInvalid}
                      >
                        <SelectValue placeholder={t("Select a role")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {roleItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {selectedRole?.description ??
                        t("Controls what this person can do in the workspace.")}
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
          </FieldGroup>
        </form>
        <DialogFooter className="-mx-6 -mb-6 shrink-0">
          <Field orientation="horizontal" className="justify-end">
            <DialogClose render={<Button variant="outline" />}>
              {t("Cancel")}
            </DialogClose>
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
                      : t("Add User")}
                </Button>
              )}
            />
          </Field>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
