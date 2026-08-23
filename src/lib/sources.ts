import type { Source } from "./types.ts"

const yt = (id: string, name: string, channelId: string): Source => ({
  id,
  name,
  kind: "youtube",
  url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
})

export const DEFAULT_SOURCES: Source[] = [
  { id: "hn-best", name: "Hacker News", kind: "hn", url: "https://hnrss.org/best" },
  yt("yt-3b1b", "3Blue1Brown", "UCYO_jab_esuFRV4b17AJtAw"),
  yt("yt-veritasium", "Veritasium", "UCHnyfMqiRRG1u-2MsSQLbXA"),
  yt("yt-yc", "Y Combinator", "UCcefcZRL2oaA_uBNeo5UOWg"),
  yt("yt-fireship", "Fireship", "UCsBjURrPoezykLs9EqgamOA"),
  yt("yt-tmp", "Two Minute Papers", "UCbfYPyITQ-7l4upoX8nvctg"),
  yt("yt-practical", "Practical Engineering", "UCMOqf8ab-42UUQIdVoKwjlQ"),
  { id: "simonw", name: "Simon Willison", kind: "rss", url: "https://simonwillison.net/atom/everything/" },
  { id: "danluu", name: "Dan Luu", kind: "rss", url: "https://danluu.com/atom.xml" },
  { id: "overreacted", name: "Overreacted", kind: "rss", url: "https://overreacted.io/rss.xml" },
  { id: "arxiv-ai", name: "arXiv cs.AI", kind: "rss", url: "https://rss.arxiv.org/rss/cs.AI" },
]

export function extraSource(url: string, index: number): Source | null {
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  let host = "feed"
  try {
    host = new URL(trimmed).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
  const kind: Source["kind"] = /youtube\.com\/feeds\/videos\.xml/i.test(trimmed)
    ? "youtube"
    : /hnrss\.org|news\.ycombinator\.com/i.test(trimmed)
      ? "hn"
      : /nitter|rsshub|x\.com|twitter/i.test(trimmed)
        ? "x"
        : "rss"
  return { id: `extra-${index}`, name: host, kind, url: trimmed }
}
