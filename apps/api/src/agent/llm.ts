/**
 * Any OpenAI-compatible chat-completions endpoint, tried in order.
 *
 * `AI_PROVIDERS` (or `AI_FALLBACKS`) is a comma-separated chain such as
 * `groq,openrouter,gemini`. Each provider is read from its own key variable, so
 * nothing else in the code changes. The legacy single-provider variables
 * (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`) still work and, when set, run
 * ahead of the chain.
 */
import { HttpStatus } from "@nestjs/common"
import { apiError } from "../http/api-error.js"

export type LlmProvider = {
  name: string
  apiKey: string
  baseUrl: string
  model: string
}

type ProviderSpec = {
  /** Key variables, checked in order. */
  keyEnvs: string[]
  baseUrl: string
  modelEnvs: string[]
  defaultModel: string
}

const PROVIDERS: Record<string, ProviderSpec> = {
  groq: {
    keyEnvs: ["GROQ_API_KEY"],
    baseUrl: "https://api.groq.com/openai/v1",
    modelEnvs: ["GROQ_MODEL", "AI_MODEL"],
    defaultModel: "openai/gpt-oss-120b",
  },
  openrouter: {
    keyEnvs: ["OPENROUTER_API_KEY"],
    baseUrl: "https://openrouter.ai/api/v1",
    modelEnvs: ["OPENROUTER_MODEL", "AI_MODEL"],
    defaultModel: "openrouter/auto",
  },
  gemini: {
    keyEnvs: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    modelEnvs: ["GEMINI_MODEL", "AI_MODEL"],
    defaultModel: "gemini-2.5-flash",
  },
  openai: {
    keyEnvs: ["OPENAI_API_KEY"],
    baseUrl: "https://api.openai.com/v1",
    modelEnvs: ["OPENAI_MODEL", "AI_MODEL"],
    defaultModel: "gpt-4o-mini",
  },
}

function firstValue(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return undefined
}

function specFor(name: string): ProviderSpec | undefined {
  return PROVIDERS[name] ?? undefined
}

/** The ordered chain, skipping providers with no key or an unknown name. */
export function llmProviders(): LlmProvider[] {
  const chain = (process.env.AI_PROVIDERS ?? process.env.AI_FALLBACKS ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)

  const providers: LlmProvider[] = []
  const seen = new Set<string>()

  const push = (provider: LlmProvider) => {
    if (seen.has(provider.name)) return
    seen.add(provider.name)
    providers.push(provider)
  }

  // An explicit endpoint wins, whatever the chain says.
  const explicitKey = firstValue(["LLM_API_KEY"])
  if (explicitKey) {
    push({
      name: "llm",
      apiKey: explicitKey,
      baseUrl: (
        process.env.LLM_BASE_URL ?? "https://api.openai.com/v1"
      ).replace(/\/+$/, ""),
      model: process.env.LLM_MODEL?.trim() || "gpt-4o-mini",
    })
  }

  for (const name of chain) {
    const spec = specFor(name)
    if (!spec) continue
    const apiKey = firstValue(spec.keyEnvs)
    if (!apiKey) continue
    push({
      name,
      apiKey,
      baseUrl: spec.baseUrl,
      model: firstValue(spec.modelEnvs) ?? spec.defaultModel,
    })
  }

  return providers
}

async function callProvider(
  provider: LlmProvider,
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(
      `${provider.name} returned ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`
    )
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error(`${provider.name} returned an empty response.`)
  return content
}

export async function complete(
  providers: LlmProvider[],
  system: string,
  user: string,
  maxTokens = 1800
): Promise<string> {
  if (!providers.length) {
    apiError(
      HttpStatus.BAD_REQUEST,
      "No LLM provider configured. Set AI_PROVIDERS with a matching key (GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, or LLM_API_KEY), then prepare the application again."
    )
  }

  const failures: string[] = []
  for (const provider of providers) {
    try {
      return await callProvider(provider, system, user, maxTokens)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      failures.push(reason)
    }
  }

  apiError(
    HttpStatus.BAD_GATEWAY,
    `Every LLM provider failed. ${failures.join(" | ")}`
  )
}
