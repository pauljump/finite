import type { FeedbackMark, RankedItem } from "./types.ts"

type ToolInputSchema = Record<string, unknown>

type ToolResult = {
  content: Array<{ type: "text"; text: string }>
}

type WebMcpTool = {
  name: string
  title: string
  description: string
  inputSchema: ToolInputSchema
  annotations?: {
    readOnlyHint?: boolean
    untrustedContentHint?: boolean
  }
  execute: (input: Record<string, unknown>) => ToolResult
}

type ModelContext = {
  registerTool: (tool: WebMcpTool) => void
  unregisterTool?: (name: string) => void
}

export type ReadingPlanInput = {
  becoming?: string
  usefulMeans?: string
  hardNo?: string
  dailyDose?: number
  maxMinutes?: number
}

export type FiniteSnapshot = {
  screen: string
  goal: string
  usefulMeans: string
  dailyDose: number
  maxMinutes: number
  consumedCount: number
  doseCount: number
  remainingUntilTomorrow: string
  current: RankedItem | null
  rejected: RankedItem[]
}

export type FiniteToolHandlers = {
  getSnapshot: () => FiniteSnapshot
  markCurrent: (mark: FeedbackMark) => unknown
  setPlan: (input: ReadingPlanInput) => unknown
  closeForToday: () => unknown
}

function result(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
  }
}

function itemForAgent(item: RankedItem | null) {
  if (!item) return null
  return {
    id: item.id,
    title: item.title,
    source: item.sourceName,
    url: item.url,
    minutes: item.score.timeCost,
    fit: Math.round(item.score.goalFit * 100),
    noise: Math.round(item.score.slopRisk * 100),
    evidence: item.score.evidence,
    matchedGoal: item.score.matchedGoal,
  }
}

function snapshotForAgent(snapshot: FiniteSnapshot) {
  return {
    screen: snapshot.screen,
    goal: snapshot.goal,
    usefulMeans: snapshot.usefulMeans,
    progress: `${snapshot.consumedCount}/${snapshot.doseCount}`,
    dailyDose: snapshot.dailyDose,
    maxMinutes: snapshot.maxMinutes,
    remainingUntilTomorrow: snapshot.remainingUntilTomorrow,
    current: itemForAgent(snapshot.current),
  }
}

function currentTool(getHandlers: () => FiniteToolHandlers | null, fn: (handlers: FiniteToolHandlers) => unknown) {
  const handlers = getHandlers()
  return handlers ? result(fn(handlers)) : result({ status: "not_ready" })
}

export function getModelContext(): ModelContext | null {
  if (typeof document !== "undefined") {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext
    if (context) return context
  }
  if (typeof navigator !== "undefined") {
    const context = (navigator as Navigator & { modelContext?: ModelContext }).modelContext
    if (context) return context
  }
  return null
}

export function registerFiniteTools(
  getHandlers: () => FiniteToolHandlers | null,
): () => void {
  const context = getModelContext()
  if (!context) return () => undefined

  const tools: WebMcpTool[] = [
    {
      name: "get_reading_state",
      title: "Get reading state",
      description: "Return Finite's current goal, dose progress, and the item waiting for the reader.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => currentTool(getHandlers, (handlers) => snapshotForAgent(handlers.getSnapshot())),
    },
    {
      name: "get_current_item",
      title: "Get current item",
      description: "Return the current reading item's source, evidence, fit, noise, and URL.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => currentTool(getHandlers, (handlers) => itemForAgent(handlers.getSnapshot().current)),
    },
    {
      name: "mark_current_item",
      title: "Mark current item",
      description: "Mark the current item useful, slop, or skipped. Every mark consumes today's slot.",
      inputSchema: {
        type: "object",
        properties: {
          mark: {
            type: "string",
            enum: ["useful", "slop", "skip"],
            description: "The reader's judgment of the current item.",
          },
        },
        required: ["mark"],
      },
      execute: (input) => currentTool(getHandlers, (handlers) => {
        const mark = input.mark
        if (mark !== "useful" && mark !== "slop" && mark !== "skip") {
          return { status: "invalid_mark", allowed: ["useful", "slop", "skip"] }
        }
        return handlers.markCurrent(mark)
      }),
    },
    {
      name: "set_reading_plan",
      title: "Set reading plan",
      description: "Update what the reader is working toward and rebuild today's finite dose.",
      inputSchema: {
        type: "object",
        properties: {
          becoming: { type: "string", description: "What the reader is working toward." },
          usefulMeans: { type: "string", description: "What makes an item useful." },
          hardNo: { type: "string", description: "Topics or patterns to exclude, one per line." },
          dailyDose: { type: "number", description: "Number of items in today's dose." },
          maxMinutes: { type: "number", description: "Maximum minutes for one item." },
        },
      },
      execute: (input) => currentTool(getHandlers, (handlers) => handlers.setPlan({
        becoming: typeof input.becoming === "string" ? input.becoming : undefined,
        usefulMeans: typeof input.usefulMeans === "string" ? input.usefulMeans : undefined,
        hardNo: typeof input.hardNo === "string" ? input.hardNo : undefined,
        dailyDose: typeof input.dailyDose === "number" ? input.dailyDose : undefined,
        maxMinutes: typeof input.maxMinutes === "number" ? input.maxMinutes : undefined,
      })),
    },
    {
      name: "close_for_today",
      title: "Close reading for today",
      description: "Stop the dose now; any remaining slots are recorded as skipped until tomorrow.",
      inputSchema: { type: "object", properties: {} },
      execute: () => currentTool(getHandlers, (handlers) => handlers.closeForToday()),
    },
    {
      name: "get_held_back",
      title: "Get held-back items",
      description: "Return a short sample of items Finite rejected and the evidence-based reasons.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => currentTool(getHandlers, (handlers) => handlers.getSnapshot().rejected.slice(0, 6).map(itemForAgent)),
    },
  ]

  for (const tool of tools) context.registerTool(tool)

  return () => {
    for (const tool of tools) context.unregisterTool?.(tool.name)
  }
}

