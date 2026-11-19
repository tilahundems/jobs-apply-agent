import type { ReactNode } from "react"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type RecordField = { label: string; value: ReactNode }
export type RecordTab = { value: string; label: string; content: ReactNode }

export function RecordDetails({
  title,
  badges,
  description,
  actions,
  fields,
  tabs = [],
}: {
  title: string
  badges?: ReactNode
  description?: ReactNode
  actions: ReactNode
  fields: RecordField[]
  tabs?: RecordTab[]
}) {
  const [active, setActive] = useState("overview")
  const overview = (
    <dl className="flex max-w-3xl flex-col gap-6">
      {fields.map(({ label, value }) => (
        <div key={label} className="flex min-w-0 flex-col gap-1 text-sm">
          <dt className="font-medium text-muted-foreground">{label}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pt-6 pb-4 lg:pt-8 lg:pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-xl leading-tight font-semibold tracking-tight break-words">
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-5 whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
                {description}
              </p>
            ) : null}
          </div>
          {badges ? (
            <div className="flex flex-wrap items-center gap-2">{badges}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </header>
      {tabs.length ? (
        <Tabs value={active} onValueChange={setActive} className="gap-4">
          <TabsList variant="line" className="mx-4 lg:mx-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview" className="px-4 lg:px-6">
            {overview}
          </TabsContent>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="px-4 lg:px-6">{overview}</div>
      )}
    </div>
  )
}
