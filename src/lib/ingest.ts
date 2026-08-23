import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { parseFeed } from "./rss.ts"
import { DEFAULT_SOURCES, extraSource } from "./sources.ts"
import type { RawItem, Source } from "./types.ts"

const TTL_MS = 15 * 60 * 1000
const FETCH_MS = 8000

function dataDir(): string {
  return (
    process.env.FINITE_DATA_DIR ??
    process.env.DESLOP_DATA_DIR ??
    join(homedir(), ".local/state/finite")
  )
}

function cachePath(): string {
  return join(dataDir(), "inbox.json")
}

type CacheFile = { fetchedAt: string; items: RawItem[] }

async function readCache(): Promise<CacheFile | null> {
  try {
    const raw = await readFile(cachePath(), "utf8")
    const parsed = JSON.parse(raw) as CacheFile
    if (!parsed.fetchedAt || !Array.isArray(parsed.items)) return null
    return parsed
  } catch {
    return null
  }
}

async function writeCache(items: RawItem[]): Promise<void> {
  await mkdir(dataDir(), { recursive: true })
  const body: CacheFile = { fetchedAt: new Date().toISOString(), items }
  await writeFile(cachePath(), JSON.stringify(body), "utf8")
}

async function fetchSource(source: Source): Promise<RawItem[]> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), FETCH_MS)
  try {
    const res = await fetch(source.url, {
      signal: ac.signal,
      headers: {
        Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml",
        "User-Agent": "Finite/0.1 (+https://finite.polyfeeds.dev)",
      },
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseFeed(xml, source)
  } catch {
    return []
  } finally {
    clearTimeout(t)
  }
}

function dedupe(items: RawItem[]): RawItem[] {
  const seen = new Set<string>()
  const out: RawItem[] = []
  for (const item of items) {
    const key = item.url.replace(/\/+$/, "").toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export async function ingest(extraUrls: string[] = [], force = false): Promise<{
  items: RawItem[]
  fetchedAt: string
  sourceCount: number
}> {
  const extras = extraUrls
    .slice(0, 8)
    .map((url, i) => extraSource(url, i))
    .filter((s): s is Source => s !== null)
  const sources = [...DEFAULT_SOURCES, ...extras]

  const cached = force ? null : await readCache()
  const fresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < TTL_MS
  if (fresh && extras.length === 0) {
    return { items: cached.items, fetchedAt: cached.fetchedAt, sourceCount: DEFAULT_SOURCES.length }
  }

  const batches = await Promise.all(sources.map(fetchSource))
  let items = dedupe(batches.flat())
  items.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
  items = items.slice(0, 400)

  if (extras.length === 0) await writeCache(items)
  else if (cached) {
    items = dedupe([...items, ...cached.items]).slice(0, 400)
  }

  return {
    items,
    fetchedAt: new Date().toISOString(),
    sourceCount: sources.length,
  }
}
