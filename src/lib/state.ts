import { DEFAULT_PRESCRIPTION } from "./prescription.ts"
import type { DayLog, Feedback, Prescription } from "./types.ts"

const PREFIX = "finite.v1."

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export function todayStamp(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function loadPrescription(): Prescription | null {
  return read<Prescription | null>("prescription", null)
}

export function savePrescription(p: Prescription) {
  write("prescription", p)
}

export function loadExtraFeeds(): string[] {
  return read<string[]>("feeds", [])
}

export function saveExtraFeeds(urls: string[]) {
  write("feeds", urls.slice(0, 8))
}

export function loadFeedback(): Feedback[] {
  return read<Feedback[]>("feedback", []).slice(-400)
}

export function addFeedback(entry: Feedback) {
  const next = [...loadFeedback().filter((f) => f.itemId !== entry.itemId), entry].slice(-400)
  write("feedback", next)
}

export function loadDay(date = todayStamp()): DayLog {
  const log = read<DayLog | null>("day", null)
  if (log && log.date === date) return log
  return { date, itemIds: [], consumed: {} }
}

export function saveDay(log: DayLog) {
  write("day", log)
}

export function hasOnboarded(): boolean {
  return Boolean(loadPrescription()) || read("onboarded", false)
}

export function markOnboarded() {
  write("onboarded", true)
  if (!loadPrescription()) savePrescription(DEFAULT_PRESCRIPTION)
}

export function msUntilTomorrow(): number {
  const now = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return next.getTime() - now.getTime()
}
