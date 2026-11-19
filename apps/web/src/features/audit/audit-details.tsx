import type { CSSProperties } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import type { AuditLog } from "./audit-api"
import {
  actionLabel,
  actorLabel,
  changes,
  humanize,
  isChangeEvent,
  targetLabel,
  valueLabel,
} from "./audit-display"

function Property({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === "") return null
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all">{valueLabel(value)}</dd>
    </div>
  )
}

export function AuditDetails({
  event,
  onClose,
}: {
  event: AuditLog | null
  onClose: () => void
}) {
  if (!event) return null
  const metadata = event.metadata ?? {}
  const requestFields = [
    ["IP address", event.ipAddress],
    ["HTTP method", metadata.httpMethod ?? metadata.method],
    ["API endpoint", metadata.endpoint ?? metadata.path],
    ["HTTP status", metadata.httpStatusCode ?? metadata.statusCode],
    ["Request ID", event.requestId],
    ["Session ID", metadata.sessionId],
    ["User agent", event.userAgent],
  ] as const
  const contextKeys = new Set([
    "httpMethod",
    "method",
    "endpoint",
    "path",
    "httpStatusCode",
    "statusCode",
    "sessionId",
    "status",
    "targetName",
  ])
  const extra = Object.entries(metadata).filter(
    ([key]) => !contextKeys.has(key)
  )

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      swipeDirection="right"
    >
      <DrawerContent
        style={
          { "--drawer-content-width": "min(48rem, 100vw)" } as CSSProperties
        }
      >
        <DrawerHeader className="border-b pb-4">
          <DrawerTitle>Audit event</DrawerTitle>
          <DrawerDescription>{event.id}</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <section className="space-y-2">
            <h2 className="font-medium">Event</h2>
            <dl className="space-y-2">
              <Property label="Action" value={actionLabel(event.action)} />
              <Property label="Resource" value={humanize(event.resourceType)} />
              <Property label="Target" value={targetLabel(event)} />
              <Property label="Resource ID" value={event.resourceId} />
              <Property label="Organization ID" value={event.organizationId} />
              <Property
                label="Timestamp"
                value={new Date(event.createdAt).toLocaleString()}
              />
            </dl>
            <Badge
              variant={event.status === "failed" ? "destructive" : "secondary"}
            >
              {event.status === "failed" ? "Failed" : "Success"}
            </Badge>
          </section>
          <section className="space-y-2">
            <h2 className="font-medium">Actor</h2>
            <dl className="space-y-2">
              <Property label="Name" value={actorLabel(event)} />
              <Property label="Email" value={event.actorEmail} />
              <Property label="User ID" value={event.actorId} />
              <Property label="Actor type" value={humanize(event.actorType)} />
            </dl>
          </section>
          {isChangeEvent(event) && changes(event).length > 0 && (
            <section className="space-y-2">
              <h2 className="font-medium">Changes</h2>
              {changes(event).map((change) => (
                <div
                  key={change.field}
                  className="rounded-md border p-3 text-sm"
                >
                  <h3 className="font-medium">{change.field}</h3>
                  <p>
                    <span className="text-muted-foreground">Before:</span>{" "}
                    {change.before}
                  </p>
                  <p>
                    <span className="text-muted-foreground">After:</span>{" "}
                    {change.after}
                  </p>
                </div>
              ))}
            </section>
          )}
          {requestFields.some(([, value]) => value != null && value !== "") && (
            <section className="space-y-2">
              <h2 className="font-medium">Request context</h2>
              <dl className="space-y-2">
                {requestFields.map(([label, value]) => (
                  <Property key={label} label={label} value={value} />
                ))}
              </dl>
            </section>
          )}
          {extra.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-medium">Additional metadata</h2>
              <dl className="space-y-2">
                {extra.map(([key, value]) => (
                  <Property key={key} label={humanize(key)} value={value} />
                ))}
              </dl>
            </section>
          )}
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Raw data</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(event, null, 2)}
            </pre>
          </details>
        </div>
        <div className="flex justify-end border-t p-4">
          <DrawerClose render={<Button variant="outline" />}>Close</DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
