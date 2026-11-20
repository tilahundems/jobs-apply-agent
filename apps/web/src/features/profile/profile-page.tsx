import { JOB_SENIORITIES } from "@et/contracts"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChipPicker } from "./chip-picker"
import {
  HEADLINE_OPTIONS,
  SKILL_OPTIONS,
  TITLE_OPTIONS,
} from "./picker-options"
import {
  type CandidateProfile,
  type ProfileInput,
  profileQueryOptions,
  remindersQueryOptions,
  saveProfile,
  sendTestReminder,
} from "./profile-api"

const TITLE_LIMIT = 20

const lines = (values: string[]) => values.join("\n")
const splitLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

const experienceToText = (profile: CandidateProfile | null) =>
  (profile?.experience ?? [])
    .map((item) =>
      [
        item.company,
        item.title,
        item.start,
        item.end,
        item.bullets.join("; "),
      ].join(" | ")
    )
    .join("\n")

function textToExperience(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [company = "", title = "", start = "", end = "", bullets = ""] =
        line.split("|").map((part) => part.trim())
      return {
        company,
        title,
        start,
        end,
        bullets: bullets
          ? bullets
              .split(";")
              .map((bullet) => bullet.trim())
              .filter(Boolean)
          : [],
      }
    })
    .filter((item) => item.company && item.title)
}

const educationToText = (profile: CandidateProfile | null) =>
  (profile?.education ?? [])
    .map((item) => [item.degree, item.school, item.year].join(" | "))
    .join("\n")

function textToEducation(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [degree = "", school = "", year = ""] = line
        .split("|")
        .map((part) => part.trim())
      return { degree, school, year }
    })
    .filter((item) => item.degree && item.school)
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function DeadlineReminders() {
  const { data: status } = useSuspenseQuery(remindersQueryOptions)
  const test = useMutation({
    mutationFn: sendTestReminder,
    onSuccess: () => toast.success("Test message sent. Check Telegram."),
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Section
      title="Closing-date reminders"
      description="A Telegram message before a posting closes, so nothing expires before you apply."
    >
      {status.enabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            On. You get one message per posting, {status.days} day(s) before it
            closes.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={test.isPending}
            onClick={() => test.mutate()}
          >
            {test.isPending ? "Sending…" : "Send test message"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Off. Create a bot with @BotFather on Telegram, then set{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            TELEGRAM_BOT_TOKEN
          </code>{" "}
          and{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            TELEGRAM_CHAT_ID
          </code>{" "}
          in the server <code className="text-xs">.env</code> and restart the
          API. Both are free.
        </p>
      )}
    </Section>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 border-b pb-6 last:border-0">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export function ProfilePage() {
  const { data: profile } = useSuspenseQuery(profileQueryOptions)
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => ({
    name: profile?.name ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    location: profile?.location ?? "",
    headline: profile?.headline ?? "",
    summary: profile?.summary ?? "",
    skills: profile?.skills ?? [],
    linkedin: profile?.links.linkedin ?? "",
    github: profile?.links.github ?? "",
    portfolio: profile?.links.portfolio ?? "",
    experience: experienceToText(profile),
    education: educationToText(profile),
    titles: profile?.preferences.titles ?? [],
    locations: lines(profile?.preferences.locations ?? []),
    seniority: profile?.preferences.seniority ?? "",
    remoteOk: profile?.preferences.remoteOk ?? true,
    minMatchScore: profile?.preferences.minMatchScore ?? 70,
    excludeKeywords: lines(profile?.preferences.excludeKeywords ?? []),
    avoidKeywords: lines(profile?.preferences.avoidKeywords ?? []),
    channels: lines(profile?.sources.channels ?? []),
    messagesPerChannel: profile?.sources.messagesPerChannel ?? 50,
  }))

  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => setForm((current) => ({ ...current, [key]: value }))

  const save = useMutation({
    mutationFn: (input: ProfileInput) => saveProfile(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] })
      toast.success("Profile saved. The next scan uses it.")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-12 lg:px-6">
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate({
            name: form.name,
            email: form.email,
            phone: form.phone,
            location: form.location,
            headline: form.headline,
            summary: form.summary,
            links: {
              linkedin: form.linkedin,
              github: form.github,
              portfolio: form.portfolio,
            },
            skills: form.skills,
            experience: textToExperience(form.experience),
            education: textToEducation(form.education),
            preferences: {
              titles: form.titles,
              seniority:
                form.seniority as ProfileInput["preferences"]["seniority"],
              locations: splitLines(form.locations),
              remoteOk: form.remoteOk,
              minMatchScore: form.minMatchScore,
              excludeKeywords: splitLines(form.excludeKeywords),
              avoidKeywords: splitLines(form.avoidKeywords),
            },
            sources: {
              channels: splitLines(form.channels),
              messagesPerChannel: form.messagesPerChannel,
            },
          })
        }}
      >
        <Section
          title="Identity"
          description="Only the facts written here can appear in your CV. Nothing is invented."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                required
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                required
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </Field>
            <Field label="Location">
              <Input
                value={form.location}
                onChange={(event) => update("location", event.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Headline"
            hint="Pick a starting point or write your own. It appears at the top of your CV."
          >
            <div className="flex flex-col gap-2">
              <Input
                value={form.headline}
                onChange={(event) => update("headline", event.target.value)}
              />
              <ChipPicker
                multiple={false}
                searchable={false}
                options={HEADLINE_OPTIONS}
                selected={form.headline ? [form.headline] : []}
                onChange={(next) => update("headline", next[0] ?? "")}
              />
            </div>
          </Field>
          <Field
            label="Summary"
            hint="Two or three sentences on what you do and where you are going."
          >
            <Textarea
              rows={4}
              value={form.summary}
              onChange={(event) => update("summary", event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="LinkedIn">
              <Input
                value={form.linkedin}
                onChange={(event) => update("linkedin", event.target.value)}
              />
            </Field>
            <Field label="GitHub">
              <Input
                value={form.github}
                onChange={(event) => update("github", event.target.value)}
              />
            </Field>
            <Field label="Portfolio">
              <Input
                value={form.portfolio}
                onChange={(event) => update("portfolio", event.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Skills and history"
          description="Skills drive the match score, so list only what you can defend in an interview."
        >
          <Field
            label="Skills"
            hint="Tick everything you can defend in an interview. Each one adds points to a posting."
          >
            <ChipPicker
              options={SKILL_OPTIONS}
              selected={form.skills}
              onChange={(next) => update("skills", next)}
              searchPlaceholder="Search skills or add your own"
            />
          </Field>
          <Field
            label="Experience"
            hint="One job per line: Company | Title | Start | End | bullet one; bullet two"
          >
            <Textarea
              rows={6}
              className="font-mono text-xs"
              value={form.experience}
              onChange={(event) => update("experience", event.target.value)}
            />
          </Field>
          <Field
            label="Education"
            hint="One entry per line: Degree | School | Year"
          >
            <Textarea
              rows={3}
              className="font-mono text-xs"
              value={form.education}
              onChange={(event) => update("education", event.target.value)}
            />
          </Field>
        </Section>

        <Section
          title="What to look for"
          description="A posting must clear the threshold to reach your list."
        >
          <Field
            label="Target titles"
            hint="Tick the roles you want. A posting whose title matches one of these scores highest."
          >
            <ChipPicker
              options={TITLE_OPTIONS}
              selected={form.titles}
              onChange={(next) => update("titles", next)}
              max={TITLE_LIMIT}
              searchPlaceholder="Search titles or add your own"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target locations" hint="One per line.">
              <Textarea
                rows={4}
                value={form.locations}
                onChange={(event) => update("locations", event.target.value)}
              />
            </Field>
            <div className="flex flex-col gap-4">
              <Field label="Seniority">
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={form.seniority}
                  onChange={(event) => update("seniority", event.target.value)}
                >
                  <option value="">No preference</option>
                  {JOB_SENIORITIES.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Minimum match score">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.minMatchScore}
                  onChange={(event) =>
                    update("minMatchScore", Number(event.target.value))
                  }
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={form.remoteOk}
                  onChange={(event) => update("remoteOk", event.target.checked)}
                />
                Remote roles count as a location match
              </label>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Never show these"
              hint="One per line. A posting containing any of them is dropped."
            >
              <Textarea
                rows={4}
                value={form.excludeKeywords}
                onChange={(event) =>
                  update("excludeKeywords", event.target.value)
                }
              />
            </Field>
            <Field
              label="Rank lower"
              hint="One per line. Shown, but scored down."
            >
              <Textarea
                rows={4}
                value={form.avoidKeywords}
                onChange={(event) =>
                  update("avoidKeywords", event.target.value)
                }
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Channels"
          description="Public Telegram channels to read, one per line: @channel_name or t.me/channel_name."
        >
          <Field label="Telegram channels">
            <Textarea
              rows={5}
              className="font-mono text-xs"
              value={form.channels}
              onChange={(event) => update("channels", event.target.value)}
            />
          </Field>
          <Field label="Posts to read per channel" hint="Between 5 and 200.">
            <Input
              type="number"
              min={5}
              max={200}
              value={form.messagesPerChannel}
              onChange={(event) =>
                update("messagesPerChannel", Number(event.target.value))
              }
            />
          </Field>
        </Section>

        <DeadlineReminders />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Saved for this workspace only.
          </p>
        </div>
      </form>
    </div>
  )
}
