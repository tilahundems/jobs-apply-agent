import { useForm } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
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
import type { AppAbility } from "@/features/authz"
import { Can, useAbility } from "@/features/authz"
import { useI18n } from "@/features/i18n/i18n-provider"
import { tagsQueryOptions } from "@/features/tags"
import { tasksQueryOptions } from "@/features/tasks"
import { useDialogOpen } from "@/hooks/use-dialog-open"
import type { CreateProjectInput, Project } from "./projects-api"
import { createProject, updateProject } from "./projects-api"

const formSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(80, "Name must be at most 80 characters."),
  description: z
    .string()
    .min(1, "Description is required.")
    .max(100, "Description must be at most 100 characters."),
  tags: z
    .array(z.string().min(1, "Tag is required."))
    .max(10, "You can add up to 10 tags."),
})

function projectFormValues(project?: Project) {
  return {
    name: project?.name ?? "",
    description: project?.description ?? "",
    tags: project?.tags.map((item) => item.id) ?? [],
  }
}

export function ProjectsForm({
  project,
  open: openProp,
  onOpenChange,
  showTrigger,
}: {
  project?: Project
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}) {
  const { t } = useI18n()
  const isEdit = project != null
  const dialog = useDialogOpen(openProp, onOpenChange)
  const { open } = dialog
  const queryClient = useQueryClient()
  const ability = useAbility<AppAbility>()
  const { data: loadedTags } = useQuery({
    ...tagsQueryOptions,
    enabled: ability.can("read", "Tag"),
  })
  const tagOptions = loadedTags ?? project?.tags ?? []
  const tagAnchor = useComboboxAnchor()
  const formId = isEdit ? `projects-form-${project.id}` : "projects-form"
  const saveProject = useMutation({
    mutationFn: (input: CreateProjectInput) =>
      isEdit ? updateProject(project.id, input) : createProject(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries(tasksQueryOptions),
      ])
    },
  })
  const form = useForm({
    defaultValues: projectFormValues(project),
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await saveProject.mutateAsync({
          name: value.name,
          description: value.description,
          tagIds: value.tags,
        })
        toast.success(t(isEdit ? "Project updated" : "Project created"), {
          description: value.name,
        })
        dialog.setOpen(false)
        form.reset(projectFormValues(project))
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : isEdit
              ? t("Unable to update project")
              : t("Unable to create project")
        )
      }
    },
  })

  React.useEffect(() => {
    if (!open) {
      return
    }

    form.reset(projectFormValues(project))
  }, [form, open, project])

  function handleOpenChange(nextOpen: boolean) {
    dialog.setOpen(nextOpen)
    if (!nextOpen) {
      form.reset(projectFormValues(project))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {isEdit || showTrigger === false ? null : (
        <Can I="create" a="Project">
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon data-icon="inline-start" />
            {t("Add Project")}
          </DialogTrigger>
        </Can>
      )}
      <DialogContent className="flex max-h-[min(40rem,calc(100vh-2rem))] flex-col overflow-hidden p-6 sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {t(isEdit ? "Edit Project" : "Add Project")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("Update this project's name, description, and tags.")
              : t("Create a project with a name, description, and tags.")}
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
                      placeholder="Website redesign"
                      autoComplete="off"
                    />
                    <FieldDescription>
                      {t("A short name for this project.")}
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
                        placeholder={t("What this project is for")}
                        rows={6}
                        className="min-h-24 resize-none"
                        aria-invalid={isInvalid}
                      />
                      <InputGroupAddon align="block-end">
                        <InputGroupText className="tabular-nums">
                          {field.state.value.length}/100 characters
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>
                      {t("Describe the project so others know what it covers.")}
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
            <form.Field
              name="tags"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                const selectedIds = field.state.value
                const selectedTags = tagOptions.filter((tag) =>
                  selectedIds.includes(tag.id)
                )

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>{t("Tags")}</FieldLabel>
                    <Combobox
                      items={tagOptions}
                      multiple
                      value={selectedTags}
                      onValueChange={(value) =>
                        field.handleChange(value.map((tag) => tag.id))
                      }
                      itemToStringLabel={(tag) => tag.label}
                      itemToStringValue={(tag) => tag.id}
                      isItemEqualToValue={(left, right) => left.id === right.id}
                    >
                      <ComboboxChips
                        ref={tagAnchor}
                        className="w-full"
                        aria-invalid={isInvalid}
                      >
                        <ComboboxValue>
                          {selectedTags.map((tag) => (
                            <ComboboxChip key={tag.id}>
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.label}
                            </ComboboxChip>
                          ))}
                        </ComboboxValue>
                        <ComboboxChipsInput
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          placeholder={
                            selectedTags.length > 0 ? "" : t("Search tags")
                          }
                          aria-invalid={isInvalid}
                          autoComplete="off"
                        />
                      </ComboboxChips>
                      <ComboboxContent anchor={tagAnchor}>
                        <ComboboxEmpty>{t("No tags found.")}</ComboboxEmpty>
                        <ComboboxList>
                          {(tag) => (
                            <ComboboxItem key={tag.id} value={tag}>
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.label}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    <FieldDescription>
                      {t(
                        "Choose from existing tags. Create new tags on the Tags page."
                      )}
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
                      : t("Add Project")}
                </Button>
              )}
            />
          </Field>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
