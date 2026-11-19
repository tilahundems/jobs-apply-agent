import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ingestJobs } from "./jobs-api"

/**
 * Runs the agent over every configured channel and refreshes everything that
 * reads postings. Used by both the console and the matches list.
 */
export function useScanChannels() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ingestJobs,
    onSuccess: (summary) => {
      void queryClient.invalidateQueries({ queryKey: ["jobs"] })
      void queryClient.invalidateQueries({ queryKey: ["profile"] })
      const detail = [
        `${summary.added} kept`,
        `${summary.belowThreshold} below your threshold`,
        `${summary.expired} closed`,
        `${summary.excluded} excluded`,
        `from ${summary.fetched} posts in ${summary.channels} channel(s)`,
      ].join(", ")
      toast.success(`Scan finished: ${detail}`)
      for (const warning of summary.warnings) toast.warning(warning)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
