import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Can } from "@/features/authz"
import { useI18n } from "@/features/i18n/i18n-provider"
import { useDialogOpen } from "@/hooks/use-dialog-open"
import type { CreateTagInput, Tag } from "./tags-api"
import { createTag, tagsQueryOptions, updateTag } from "./tags-api"

const DEFAULT_TAG_COLOR = "#64748b"

const hexColorSchema = z
  .string()
  .trim()
  .min(1, "Color is required.")
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Enter a valid hex color.")
  .transform((value) => {
    if (value.length === 4) {
      const chars = value.slice(1)
      return `#${chars[0]}${chars[0]}${chars[1]}${chars[1]}${chars[2]}${chars[2]}`.toLowerCase()
    }

    return value.toLowerCase()
  })

const formSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Label is required.")
    .max(40, "Label must be at most 40 characters."),
  color: hexColorSchema,
})

function tagFormValues(tag?: Tag) {
  return {
    label: tag?.label ?? "",
    color: tag?.color ?? DEFAULT_TAG_COLOR,
  }
}

function colorPickerValue(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_TAG_COLOR
}

export function TagsForm({
  tag,
  open: openProp,
  onOpenChange,
  showTrigger,
}: {
  tag?: Tag
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}) {
  const { t } = useI18n()
  const isEdit = tag != null
  const dialog = useDialogOpen(openProp, onOpenChange)
  const { open } = dialog
  const queryClient = useQueryClient()
  const formId = isEdit ? `tags-form-${tag.id}` : "tags-form"
  const saveTag = useMutation({
    mutationFn: (input: CreateTagInput) =>
      isEdit ? updateTag(tag.id, input) : createTag(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(tagsQueryOptions),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ])
    },
  })
  const form = useForm({
    defaultValues: tagFormValues(tag),
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await saveTag.mutateAsync(value)
        toast.success(t(isEdit ? "Tag updated" : "Tag created"), {
          description: value.label,
        })
        dialog.setOpen(false)
        form.reset(tagFormValues(tag))
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : isEdit
              ? t("Unable to update tag")
              : t("Unable to create tag")
        )
      }
    },
  })

  React.useEffect(() => {
    if (!open) {
      return
    }

    form.reset(tagFormValues(tag))
  }, [form, open, tag])

  function handleOpenChange(nextOpen: boolean) {
    dialog.setOpen(nextOpen)
    if (!nextOpen) {
      form.reset(tagFormValues(tag))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {isEdit || showTrigger === false ? null : (
        <Can I="create" a="Tag">
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon />
            <span className="hidden lg:inline">{t("Add Tag")}</span>
          </DialogTrigger>
        </Can>
      )}
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(isEdit ? "Edit Tag" : "Add Tag")}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("Update this tag's label and color.")
              : t("Create a tag with a label and color.")}
          </DialogDescription>
        </DialogHeader>
        <form
          id={formId}
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field
              name="label"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>{t("Label")}</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Frontend"
                      autoComplete="off"
                    />
                    <FieldDescription>
                      {t("A short name for this tag.")}
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
            <form.Field
              name="color"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>{t("Color")}</FieldLabel>
                    <InputGroup className="w-1/2 max-w-1/2">
                      <InputGroupAddon align="inline-start">
                        <input
                          type="color"
                          aria-label={t("Pick a color")}
                          value={colorPickerValue(field.state.value)}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          className="size-5 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                        />
                      </InputGroupAddon>
                      <InputGroupInput
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder={DEFAULT_TAG_COLOR}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </InputGroup>
                    <FieldDescription>
                      {t("Pick a color or enter a hex value.")}
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
        <DialogFooter className="-mx-6 -mb-6">
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
                      : t("Add Tag")}
                </Button>
              )}
            />
          </Field>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
