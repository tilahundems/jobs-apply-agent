import { useForm } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { CalendarIcon, FlagIcon, PlusIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
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
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
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
import type { AppAbility } from "@/features/authz"
import { Can, subject, useAbility, useCurrentUserId } from "@/features/authz"
import { useI18n } from "@/features/i18n/i18n-provider"
import { projectsQueryOptions } from "@/features/projects"
import { usersQueryOptions } from "@/features/users"
import { useDialogOpen } from "@/hooks/use-dialog-open"
import {
  TASK_PRIORITY_ICON_CLASS,
  TASK_STATUS_ICON_CLASS,
  TASK_STATUS_ICONS,
} from "./task-values"
import type {
  CreateTaskInput,
  Task,
  TaskPriority,
  TaskStatus,
} from "./tasks-api"
import {
  createTask,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  tasksQueryOptions,
  updateTask,
} from "./tasks-api"

const formSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required.")
    .max(80, "Title must be at most 80 characters."),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters."),
  status: z.enum(TASK_STATUSES, { error: "Status is required." }),
  priority: z.enum(TASK_PRIORITIES, { error: "Priority is required." }),
  projectId: z.string(),
  assigneeId: z.string(),
  dueDate: z
    .string()
    .refine(
      (value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Enter a valid date."
    ),
})

const statusItems = TASK_STATUSES.map((value) => ({
  label: TASK_STATUS_LABELS[value],
  value,
}))

const priorityItems = TASK_PRIORITIES.map((value) => ({
  label: TASK_PRIORITY_LABELS[value],
  value,
}))

function parseDueDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }

  const [year, month, day] = value.split("-").map(Number)

  return new Date(year, month - 1, day)
}

function TaskDueDatePicker({
  id,
  value,
  invalid,
  onBlur,
  onChange,
}: {
  id: string
  value: string
  invalid: boolean
  onBlur: () => void
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const { language, t } = useI18n()
  const selectedDate = parseDueDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            data-empty={selectedDate == null}
            aria-invalid={invalid}
            className="w-full min-w-0 justify-start font-normal data-[empty=true]:text-muted-foreground"
          />
        }
      >
        <CalendarIcon />
        {selectedDate
          ? new Intl.DateTimeFormat(language === "am" ? "am-ET" : "en-US", {
              dateStyle: "long",
            }).format(selectedDate)
          : t("Pick a date")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-2xs max-w-dvw p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          className="w-full"
          classNames={{
            root: "w-full",
            months: "w-full",
            month: "w-full",
          }}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "")
            onBlur()
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function taskFormValues(
  task?: Task,
  defaultProjectId?: string,
  defaultAssigneeId?: string
) {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? ("todo" satisfies TaskStatus),
    priority: task?.priority ?? ("medium" satisfies TaskPriority),
    projectId: task?.projectId ?? defaultProjectId ?? "",
    assigneeId: task?.assigneeId ?? defaultAssigneeId ?? "",
    dueDate: task?.dueDate ?? "",
  }
}

export function TasksForm({
  task,
  open: openProp,
  onOpenChange,
  showTrigger,
  defaultProjectId,
}: {
  task?: Task
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
  defaultProjectId?: string
}) {
  const { t } = useI18n()
  const isEdit = task != null
  const dialog = useDialogOpen(openProp, onOpenChange)
  const { open } = dialog
  const queryClient = useQueryClient()
  const ability = useAbility<AppAbility>()
  const currentUserId = useCurrentUserId()
  const defaultAssigneeId = isEdit ? undefined : (currentUserId ?? undefined)
  const canPickAssignee = ability.can(
    isEdit ? "update" : "create",
    subject(
      "Task",
      task ?? taskFormValues(undefined, defaultProjectId, defaultAssigneeId)
    ),
    "assigneeId"
  )
  const { data: loadedProjects } = useQuery({
    ...projectsQueryOptions,
    enabled: ability.can("read", "Project"),
  })
  const { data: loadedUsers } = useQuery({
    ...usersQueryOptions,
    enabled: ability.can("read", "User"),
  })
  const projectOptions = loadedProjects ?? (task?.project ? [task.project] : [])
  const userOptions = loadedUsers ?? (task?.assignee ? [task.assignee] : [])
  const formId = isEdit ? `tasks-form-${task.id}` : "tasks-form"
  const saveTask = useMutation({
    mutationFn: (input: CreateTaskInput) =>
      isEdit ? updateTask(task.id, input) : createTask(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries(tasksQueryOptions)
    },
  })
  const form = useForm({
    defaultValues: taskFormValues(task, defaultProjectId, defaultAssigneeId),
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await saveTask.mutateAsync({
          title: value.title,
          description: value.description,
          status: value.status,
          priority: value.priority,
          projectId: value.projectId,
          assigneeId: value.assigneeId,
          dueDate: value.dueDate,
        })
        toast.success(t(isEdit ? "Task updated" : "Task created"), {
          description: value.title,
        })
        dialog.setOpen(false)
        form.reset(taskFormValues(task, defaultProjectId, defaultAssigneeId))
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : isEdit
              ? t("Unable to update task")
              : t("Unable to create task")
        )
      }
    },
  })

  React.useEffect(() => {
    if (!open) {
      return
    }

    form.reset(taskFormValues(task, defaultProjectId, defaultAssigneeId))
  }, [defaultAssigneeId, defaultProjectId, form, open, task])

  function handleOpenChange(nextOpen: boolean) {
    dialog.setOpen(nextOpen)
    if (!nextOpen) {
      form.reset(taskFormValues(task, defaultProjectId, defaultAssigneeId))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {isEdit || showTrigger === false ? null : (
        <Can I="create" a="Task">
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon />
            <span className="hidden lg:inline">{t("Add Task")}</span>
          </DialogTrigger>
        </Can>
      )}
      <DialogContent className="flex max-h-[min(40rem,calc(100vh-2rem))] flex-col overflow-hidden p-6 sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t(isEdit ? "Edit Task" : "Add Task")}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("Update this task's details, project, and assignee.")
              : t(
                  "Create a task with a title and optional project and assignee."
                )}
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
              name="title"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>{t("Title")}</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Write the launch checklist"
                      autoComplete="off"
                    />
                    <FieldDescription>
                      {t("A short name for this task.")}
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
                    <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                    <InputGroup>
                      <InputGroupTextarea
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={t("What needs to be done")}
                        rows={6}
                        className="min-h-24 resize-none"
                        aria-invalid={isInvalid}
                      />
                      <InputGroupAddon align="block-end">
                        <InputGroupText className="tabular-nums">
                          {field.state.value.length}/500 characters
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>
                      {t(
                        "Optional details so others know what this task covers."
                      )}
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
            <div className="grid min-w-0 gap-5 sm:grid-cols-2">
              <form.Field
                name="status"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("Status")}
                      </FieldLabel>
                      <Select
                        items={statusItems.map((item) => ({
                          ...item,
                          label: t(item.label),
                        }))}
                        value={field.state.value}
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
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {statusItems.map((item) => {
                              const Icon = TASK_STATUS_ICONS[item.value]
                              return (
                                <SelectItem key={item.value} value={item.value}>
                                  <Icon
                                    className={
                                      TASK_STATUS_ICON_CLASS[item.value]
                                    }
                                  />
                                  {t(item.label)}
                                </SelectItem>
                              )
                            })}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
              <form.Field
                name="priority"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("Priority")}
                      </FieldLabel>
                      <Select
                        items={priorityItems.map((item) => ({
                          ...item,
                          label: t(item.label),
                        }))}
                        value={field.state.value}
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
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {priorityItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                <FlagIcon
                                  className={
                                    TASK_PRIORITY_ICON_CLASS[item.value]
                                  }
                                />
                                {t(item.label)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
            </div>
            <form.Field
              name="projectId"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                const selectedProject =
                  projectOptions.find(
                    (item) => item.id === field.state.value
                  ) ?? null

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>{t("Project")}</FieldLabel>
                    <Combobox
                      items={projectOptions}
                      value={selectedProject}
                      onValueChange={(value) =>
                        field.handleChange(value?.id ?? "")
                      }
                      itemToStringLabel={(item) => item.name}
                      itemToStringValue={(item) => item.id}
                      isItemEqualToValue={(left, right) => left.id === right.id}
                    >
                      <ComboboxInput
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        placeholder={t("Search projects")}
                        className="w-full min-w-0"
                        showClear
                        aria-invalid={isInvalid}
                        autoComplete="off"
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>{t("No projects found.")}</ComboboxEmpty>
                        <ComboboxList>
                          {(item) => (
                            <ComboboxItem key={item.id} value={item}>
                              {item.name}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    <FieldDescription>
                      {t(
                        "Optional. Leave empty to keep this task unassigned to a project."
                      )}
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
            {canPickAssignee ? (
              <form.Field
                name="assigneeId"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  const selectedUser =
                    userOptions.find((item) => item.id === field.state.value) ??
                    null

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("Assignee")}
                      </FieldLabel>
                      <Combobox
                        items={userOptions}
                        value={selectedUser}
                        onValueChange={(value) =>
                          field.handleChange(value?.id ?? "")
                        }
                        itemToStringLabel={(item) => item.name}
                        itemToStringValue={(item) => item.id}
                        isItemEqualToValue={(left, right) =>
                          left.id === right.id
                        }
                      >
                        <ComboboxInput
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          placeholder={t("Search people")}
                          className="w-full min-w-0"
                          showClear
                          aria-invalid={isInvalid}
                          autoComplete="off"
                        />
                        <ComboboxContent>
                          <ComboboxEmpty>{t("No people found.")}</ComboboxEmpty>
                          <ComboboxList>
                            {(item) => (
                              <ComboboxItem key={item.id} value={item}>
                                <span className="flex min-w-0 flex-col">
                                  <span>{item.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {item.email}
                                  </span>
                                </span>
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                      <FieldDescription>
                        {t(
                          "Optional. Leave empty to keep this task unassigned."
                        )}
                      </FieldDescription>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
            ) : (
              <Field>
                <FieldLabel>{t("Assignee")}</FieldLabel>
                <FieldDescription>
                  {t("The existing assignment will be preserved.")}
                </FieldDescription>
              </Field>
            )}
            <div className="grid min-w-0 sm:grid-cols-2">
              <form.Field
                name="dueDate"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("Due date")}
                      </FieldLabel>
                      <TaskDueDatePicker
                        id={field.name}
                        value={field.state.value}
                        invalid={isInvalid}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                      />
                      <FieldDescription>
                        {t("Optional. When this task should be finished.")}
                      </FieldDescription>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
            </div>
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
                      : t("Add Task")}
                </Button>
              )}
            />
          </Field>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
