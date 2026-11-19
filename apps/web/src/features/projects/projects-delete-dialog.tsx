import { useQueryClient } from "@tanstack/react-query"
import {
  ConfirmDeleteDialog,
  RecordName,
} from "@/components/confirm-delete-dialog"
import { tasksQueryOptions } from "@/features/tasks"
import type { Project } from "./projects-api"
import { deleteProject } from "./projects-api"

export function ProjectsDeleteDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const queryClient = useQueryClient()
  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Project"
      description={
        <>
          This will delete <RecordName>{project.name}</RecordName> from your
          projects.
        </>
      }
      success="Project deleted"
      successDescription={project.name}
      failure="Unable to delete project"
      onConfirm={async () => {
        await deleteProject(project.id)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["projects"] }),
          queryClient.invalidateQueries(tasksQueryOptions),
        ])
      }}
      onDone={onDeleted}
    />
  )
}
