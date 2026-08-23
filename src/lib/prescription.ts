import type { Prescription } from "./types.ts"

export const DEFAULT_PRESCRIPTION: Prescription = {
  becoming:
    "I'm building software from a Mac Mini. I want first-hand writeups, worked examples, and systems that actually run. Recaps and outrage can wait.",
  goals: [
    "ship useful software, code, and tools; learn from builders, engineers, and practitioners",
    "understand systems, infrastructure, security, incentives, and how the world works",
    "prefer primary sources, papers, postmortems, and first-hand worked examples",
  ],
  hardNo: [
    "celebrity gossip",
    "outrage politics",
    "engagement bait",
    "get rich quick",
    "listicle slop",
    "dunking",
    "sports scores",
  ],
  usefulMeans:
    "It teaches me something I can use, or is a primary source on a system I am trying to understand, in under 30 minutes.",
  maxMinutes: 30,
  dailyDose: 7,
}

export function parseGoals(text: string): string[] {
  return text
    .split(/\n|;|(?:(?<=\.)\s+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
    .slice(0, 8)
}

export function parseHardNo(text: string): string[] {
  return text
    .split(/\n|,|;/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 2)
    .slice(0, 24)
}

export function fromForm(input: {
  becoming: string
  hardNo: string
  usefulMeans: string
  maxMinutes: number
  dailyDose: number
}): Prescription {
  const becoming = input.becoming.trim() || DEFAULT_PRESCRIPTION.becoming
  const parsed = parseGoals(becoming)
  const goals =
    becoming === DEFAULT_PRESCRIPTION.becoming
      ? DEFAULT_PRESCRIPTION.goals
      : parsed.length
        ? parsed
        : DEFAULT_PRESCRIPTION.goals
  return {
    becoming,
    goals,
    hardNo: parseHardNo(input.hardNo),
    usefulMeans: input.usefulMeans.trim() || DEFAULT_PRESCRIPTION.usefulMeans,
    maxMinutes: Math.min(180, Math.max(5, input.maxMinutes || 30)),
    dailyDose: Math.min(12, Math.max(3, input.dailyDose || 7)),
  }
}
