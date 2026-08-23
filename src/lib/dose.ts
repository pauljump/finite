import { scoreItem } from "./score.ts"
import type { Feedback, Prescription, RankedItem, RawItem } from "./types.ts"

export function assembleDose(
  items: RawItem[],
  prescription: Prescription,
  feedback: Feedback[] = [],
  alreadyConsumed: string[] = [],
): { dose: RankedItem[]; rejected: RankedItem[]; ingested: number } {
  const consumed = new Set(alreadyConsumed)
  const ranked: RankedItem[] = items
    .filter((item) => !consumed.has(item.id))
    .map((item) => ({ ...item, score: scoreItem(item, prescription, feedback) }))
    .sort((a, b) => b.score.composite - a.score.composite || +new Date(b.publishedAt) - +new Date(a.publishedAt))

  const passed = ranked.filter((item) => item.score.pass)
  const rejected = ranked.filter((item) => !item.score.pass)
  const picked: RankedItem[] = []
  const perSource = new Map<string, number>()

  for (const item of passed) {
    if (picked.length >= prescription.dailyDose) break
    const used = perSource.get(item.sourceId) ?? 0
    if (used >= 2) continue
    picked.push(item)
    perSource.set(item.sourceId, used + 1)
  }

  if (picked.length < prescription.dailyDose) {
    for (const item of passed) {
      if (picked.length >= prescription.dailyDose) break
      if (picked.some((p) => p.id === item.id)) continue
      picked.push(item)
    }
  }

  return { dose: picked, rejected: rejected.slice(0, 80), ingested: items.length }
}
