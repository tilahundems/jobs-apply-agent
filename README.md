# job-apply-agent

A pnpm + Turborepo workspace for building authenticated, permission-aware products.

## The job agent

The starter kit's demo domains stay as references. On top of them this workspace
adds a job-search agent:

1. **Tell it about yourself** on `/profile`: skills, experience, the titles and
   locations you want, what to exclude, and which Telegram channels to read.
2. **Scan channels** from `/jobs`. Each post is parsed (title, company,
   location, apply link) and scored against your profile with a rule-based
   scorer: title match, skill overlap, location or remote, seniority, plus your
   exclusion keywords. Postings below your threshold are dropped, so the list
   only holds roles worth your time. Every score is explained.
3. **Prepare application** on a posting asks an OpenAI-compatible model for a CV
   rewrite aimed at that job and a cover letter. The prompt only allows
   re-wording, re-ordering and omitting what is in your profile: it may not
   invent an employer, a skill or a number.
4. **You decide.** Read both texts, download the CV as `.docx`, open the
   original post, apply yourself, then mark the job applied or dismissed.

The agent never submits an application on your behalf, and never stores a
password for a job board. That is deliberate: unattended submissions break
tenant terms on most boards and produce applications recruiters can spot.

### Configuration

| Variable | Meaning |
| --- | --- |
| `AGENT_INGEST_MINUTES` | Minutes between automatic channel scans. `0` (default) disables the loop and leaves scanning to the button. |
| `CRON_SECRET` | Shared secret for `POST /api/v1/cron/scan`, which starts one scan and answers with its summary. An outside scheduler sends it as the `x-cron-secret` header. Empty disables the endpoint. |
| `AI_PROVIDERS` | Ordered fallback chain, e.g. `groq,openrouter,gemini`. Each provider with a key is tried in turn until one answers; the error lists every attempt. No key configured means preparing an application returns a clear error instead of failing silently. |
| `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `GEMINI_API_KEY` | Keys for the providers in the chain. `AI_MODEL`, `OPENROUTER_MODEL`, and `GEMINI_MODEL` choose the model per provider; each has a sensible default. |
| `LLM_API_KEY` | Legacy single endpoint for any OpenAI-compatible provider. When set it runs ahead of `AI_PROVIDERS`, with `LLM_BASE_URL` (default `https://api.openai.com/v1`) and `LLM_MODEL` (default `gpt-4o-mini`). |

#### Scanning on a free host

A free instance sleeps when nothing calls it, and a sleeping process runs no
`setInterval`, so `AGENT_INGEST_MINUTES` alone will miss postings there. Set
`CRON_SECRET` and point any free scheduler at the scan endpoint every 10 minutes;
the request wakes the instance, scans the channels and announces anything new:

```
curl -fsS -X POST https://<host>/api/v1/cron/scan -H "x-cron-secret: <secret>"
```

`.github/workflows/scan.yml` does this on a cron schedule once the `API_URL` and
`CRON_SECRET` repository secrets exist. GitHub's schedule can lag, so a
free service such as cron-job.org is a closer alternative.

### Limits worth knowing

- Channels are read through Telegram's public preview (`t.me/s/<channel>`), so
  the channel must be public. Private groups and invite-only channels are
  reported as warnings rather than silently returning nothing.
- Matching is deterministic and local; the model is only used for writing, so a
  scan costs nothing.
- `libs/contracts` holds the request shapes, `libs/db/src/schemas/agent-schema.ts`
  the tables, and `apps/api/src/agent` the scorer, channel reader and prompts.

## What is included

- `apps/web` — React SPA with TanStack Router, Query, Form, and Table (`@et/web`)
- `apps/api` — NestJS API with the Better Auth server (`@et/api`)
- `libs/contracts` — shared request and response validation (`@et/contracts`)
- `libs/db` — Drizzle schema, client, and migrations (`@et/db`)
- `libs/authz` — CASL permissions, `@UsePermision()`, and Drizzle conditions (`@et/authz`)

Always included: accounts and sessions, roles and permissions with delegation, logging, metrics, rate limiting, and realtime notifications. Projects, Tasks, and Tags are connected demo domains to study and replace.

Optional features, each in its own folders:

- Audit logging of security-sensitive and project changes

Organization multi-tenancy is a deployment mode, off by default.

## Start a project

```bash
git clone https://github.com/your-org/et-starter-kit.git my-project
cd my-project
pnpm new
pnpm install
pnpm check:fix
```

`pnpm new` runs once from the repository root. It renames the project (the name defaults to the directory), creates `.env` with a secure auth secret, and starts a fresh Git history. It asks which optional features to keep: each defaults to included, and multi-tenancy defaults to off. Removing a feature deletes its folders, dependencies, and every line marked `feature:<name>`; it cannot be restored from `.env`.

Skip the prompts with `pnpm new --yes` (all features, add `--name=my-project` to rename), or script it with `node scripts/new.mjs --non-interactive --name=my-project --without=auditLogging,apiDocs,payment,i18n,mobile --with=multiTenancy`, using any subset.

Then follow [the new-product guide](docs/new-product.md) to add features and replace the demo domains.

## Local database

```bash
pnpm db:setup
```

Data lives in a single SQLite file, `data/job-apply-agent.db` by default (`DATABASE_FILE` in `.env`). There is no database server to install or start. `pnpm db:setup` runs the migrations and the seed; delete the file to start over.

Open a SQL browser with `pnpm db:studio`.

The development seed creates two users:

```text
Admin (full access)                      demo@example.com / demo-password
User (CRUD on projects, tasks, and tags) user@example.com / user-password
```

Override `SEED_USER_*` and `SEED_MEMBER_*` in `.env` to change them; the seed leaves existing users unchanged and refuses to run when `NODE_ENV=production`. Public sign-up creates an account with no role, so an administrator must grant access.

## Commands

```bash
pnpm dev               # API and web app
pnpm dev:web           # same, filtered
pnpm dev:api
pnpm build
pnpm check             # lint and format (check:fix to apply)
pnpm typecheck
pnpm test              # unit tests
pnpm test:setup        # pnpm new script
pnpm test:generated    # generate projects and build them
pnpm db:generate       # new migration from the schema
```

Integration and browser tests create their own throwaway SQLite file in the system temp directory, so they never touch `data/`.

```bash
pnpm test:integration
pnpm --filter @et/web exec playwright install chromium   # once
pnpm test:e2e                                            # ports 3000 and 4000 must be free
```

## Plan and build with skills

Agents read [`AGENTS.md`](AGENTS.md) and the skills in `.agents/skills`. In Codex, name a skill in your request:

1. `$to-prd` turns the full requirement into `docs/product/prd.md`.
2. `$scope` picks the next increment (the MVP first) and records its vertical slices in `docs/scope/scope.md`.
3. `$implement` builds and verifies one ready slice, or the whole increment when asked.

Review each artifact before the next request. For an ordinary feature or fix, ask for it directly.

## Guides

- [New product](docs/new-product.md) — feature file map and demo replacement checklist
- [Permissions and roles](docs/permissions.md)
- [Multi-tenancy](docs/multi-tenancy.md)
- [Deployment and rate limiting](docs/deployment.md)
- [Observability](docs/observability.md)
- [Audit logging](docs/audit.md)
- [List and detail pages](apps/web/src/components/detail-page.md)
