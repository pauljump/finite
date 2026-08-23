import { ingest } from "@/lib/ingest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const result = await ingest()
  return Response.json(result)
}

export async function POST(req: Request) {
  let extra: string[] = []
  let force = false
  try {
    const body = (await req.json()) as { extraFeeds?: unknown; force?: unknown }
    if (Array.isArray(body.extraFeeds)) {
      extra = body.extraFeeds.filter((u): u is string => typeof u === "string").slice(0, 8)
    }
    force = body.force === true
  } catch {
    extra = []
  }
  const result = await ingest(extra, force)
  return Response.json(result)
}
