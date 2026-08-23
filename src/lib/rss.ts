import type { RawItem, Source } from "./types.ts"

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function stripHtml(html: string): string {
  return decode(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tag(block: string, name: string): string {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")
  const m = block.match(re)
  return m ? decode(m[1]).trim() : ""
}

function attr(block: string, name: string, attrName: string): string {
  const re = new RegExp(`<${name}[^>]*\\s${attrName}="([^"]+)"[^>]*/?>`, "i")
  const m = block.match(re)
  return m ? decode(m[1]).trim() : ""
}

function chunks(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}\\b[\\s\\S]*?</${tagName}>`, "gi")
  return xml.match(re) ?? []
}

function isoDate(raw: string): string {
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function hashId(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

export function parseFeed(xml: string, source: Source): RawItem[] {
  const entries = [...chunks(xml, "item"), ...chunks(xml, "entry")]
  const items: RawItem[] = []
  for (const block of entries) {
    const title = stripHtml(tag(block, "title"))
    if (!title) continue
    const url =
      attr(block, "link", "href") ||
      tag(block, "link") ||
      tag(block, "guid") ||
      tag(block, "id")
    if (!url || !/^https?:\/\//i.test(url)) continue
    const snippet = stripHtml(
      tag(block, "description") ||
        tag(block, "summary") ||
        tag(block, "content") ||
        tag(block, "media:description"),
    ).slice(0, 600)
    const published =
      tag(block, "pubDate") ||
      tag(block, "published") ||
      tag(block, "updated") ||
      tag(block, "dc:date")
    const author =
      stripHtml(tag(block, "dc:creator") || tag(block, "author") || tag(block, "name")) ||
      undefined
    const commentsUrl = tag(block, "comments") || undefined
    const durationRaw =
      tag(block, "yt:duration") || attr(block, "media:content", "duration") || ""
    const durationSeconds = durationRaw && /^\d+$/.test(durationRaw) ? Number(durationRaw) : undefined
    const id = tag(block, "yt:videoId") || tag(block, "guid") || tag(block, "id") || hashId(url)
    items.push({
      id: `${source.id}:${id}`.slice(0, 180),
      sourceId: source.id,
      sourceName: source.name,
      sourceKind: source.kind,
      title,
      url,
      snippet,
      publishedAt: isoDate(published),
      author,
      durationSeconds,
      commentsUrl,
    })
  }
  return items
}
