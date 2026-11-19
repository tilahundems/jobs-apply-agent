/**
 * Reading postings from Telegram channels.
 *
 * Uses the public channel preview (`https://t.me/s/<channel>`), which needs no
 * account, session or API key and works for every public channel. Private
 * groups and invite-only channels have no public preview, so they are reported
 * as warnings instead of silently returning nothing.
 */

export type ChannelPost = {
  key: string
  channel: string
  messageId: number | null
  postedAt: Date | null
  text: string
  url: string
}

export type ChannelFetch = { posts: ChannelPost[]; warnings: string[] }

const USER_AGENT =
  "Mozilla/5.0 (compatible; job-apply-agent/1.0; +https://core.telegram.org)"

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

function decodeEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const code =
        entity.startsWith("#x") || entity.startsWith("#X")
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<wbr\s*\/?>/gi, "")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .trim()
}

/** `@name`, `https://t.me/name`, and `t.me/s/name` all become `name`. */
export function channelHandle(channel: string) {
  return channel
    .trim()
    .replace(/^https?:\/\/(?:www\.)?t\.me\//i, "")
    .replace(/^s\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .trim()
}

export function parseChannelPage(
  html: string,
  handle: string,
  limit: number
): ChannelPost[] {
  const posts: ChannelPost[] = []
  const blocks = html.split(/data-post="/).slice(1)

  for (const block of blocks) {
    const [reference = ""] = block.split('"', 1)
    const textMatch = /js-message_text[^>]*>([\s\S]*?)<\/div>/.exec(block)
    if (!textMatch?.[1]) continue

    const text = htmlToText(textMatch[1])
    if (text.length < 40) continue

    const messageId = Number(reference.split("/").pop()) || null
    const postedAtRaw = /datetime="([^"]+)"/.exec(block)?.[1]
    const postedAt = postedAtRaw ? new Date(postedAtRaw) : null

    posts.push({
      key: `${handle}:${messageId ?? reference}`,
      channel: handle,
      messageId,
      postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
      text,
      url: messageId
        ? `https://t.me/${handle}/${messageId}`
        : `https://t.me/${handle}`,
    })
  }

  return posts.slice(-limit)
}

export async function fetchChannelPosts(
  channel: string,
  limit: number
): Promise<ChannelFetch> {
  const handle = channelHandle(channel)
  if (!handle) {
    return { posts: [], warnings: [`"${channel}" is not a channel name.`] }
  }

  try {
    const response = await fetch(
      `https://t.me/s/${encodeURIComponent(handle)}`,
      {
        headers: { "user-agent": USER_AGENT, accept: "text/html" },
        signal: AbortSignal.timeout(20_000),
      }
    )
    if (!response.ok) {
      return {
        posts: [],
        warnings: [
          `@${handle}: Telegram returned HTTP ${response.status}. Private channels and groups have no public preview.`,
        ],
      }
    }
    const html = await response.text()
    const posts = parseChannelPage(html, handle, limit)
    return posts.length > 0
      ? { posts, warnings: [] }
      : {
          posts: [],
          warnings: [
            `@${handle}: no messages found in the public preview. Check the channel name, or that it is public.`,
          ],
        }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { posts: [], warnings: [`@${handle}: ${reason}`] }
  }
}
