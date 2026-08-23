import { assembleDose } from "./lib/dose.ts"
import { ingest } from "./lib/ingest.ts"
import { DEFAULT_PRESCRIPTION } from "./lib/prescription.ts"

const cmd = process.argv[2] ?? "dose"

const inbox = await ingest([], cmd === "ingest")
if (cmd === "ingest") {
  const by = new Map<string, number>()
  for (const item of inbox.items) by.set(item.sourceName, (by.get(item.sourceName) ?? 0) + 1)
  console.log(`fetched ${inbox.items.length} items from ${inbox.sourceCount} sources at ${inbox.fetchedAt}`)
  for (const [name, n] of [...by.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${name}`)
  }
  process.exit(0)
}

const { dose, rejected, ingested } = assembleDose(inbox.items, DEFAULT_PRESCRIPTION)
console.log(`ingested ${ingested}  ·  dose ${dose.length}  ·  slop ${rejected.length}`)
console.log("")
for (const [i, item] of dose.entries()) {
  console.log(`${i + 1}. ${item.title}`)
  console.log(`   ${item.sourceName}  ·  ${item.score.timeCost} min  ·  fit ${item.score.goalFit}  ·  slop ${item.score.slopRisk}`)
  console.log(`   because: ${item.score.evidence}`)
  console.log(`   ${item.url}`)
  console.log("")
}
