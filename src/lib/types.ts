export type SourceKind = "youtube" | "rss" | "hn" | "x"

export type Source = {
  id: string
  name: string
  kind: SourceKind
  url: string
}

export type RawItem = {
  id: string
  sourceId: string
  sourceName: string
  sourceKind: SourceKind
  title: string
  url: string
  snippet: string
  publishedAt: string
  author?: string
  durationSeconds?: number
  commentsUrl?: string
}

export type Prescription = {
  becoming: string
  goals: string[]
  hardNo: string[]
  usefulMeans: string
  maxMinutes: number
  dailyDose: number
}

export type Score = {
  itemId: string
  goalFit: number
  slopRisk: number
  timeCost: number
  evidence: string | null
  matchedGoal: string | null
  rejectReasons: string[]
  pass: boolean
  composite: number
}

export type RankedItem = RawItem & { score: Score }

export type FeedbackMark = "useful" | "slop" | "skip"

export type Feedback = {
  itemId: string
  mark: FeedbackMark
  at: string
  sourceId: string
}

export type DayLog = {
  date: string
  itemIds: string[]
  consumed: Record<string, FeedbackMark>
}
