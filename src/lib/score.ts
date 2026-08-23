import type { Feedback, Prescription, RawItem, Score } from "./types.ts"

const STOP = new Set(
  `a an the and or of to for in on with from by as is are was were be been being it this that those these you your i we they he she at into over after before about than then so if but not no yes just more most some any all can will than via per its it's i'm you're that's what's who's there's they're we're`.split(
    /\s+/,
  ),
)

const CLICKBAIT =
  /\b(you won'?t believe|gone wrong|goes (?:viral|hard)|wait for it|what happens next|unhinged|destroyed|owned|ratio(?:ed)?|shocking|mind[- ]?blown|this is fine|let that sink|the internet is|everyone is talking)\b/i
const ENGAGEMENT = /\b(like if|comment if|drop a like|smash that|subscribe|link in bio|follow for more|rt if)\b/i
const RAGE = /\b(woke|libtard|sheeple|raging|meltdown|destroyed the|owns the|get wrecked|triggered)\b/i
const LISTICLE = /^\s*\d+\s+.*(ways|tips|tricks|reasons|hacks|signs)/i
const CELEB =
  /\b(kardashian|jenner|swifties|rihanna|beyonce|celebrity|red carpet|box office|dating rumors)\b/i

function stem(word: string): string {
  return word.replace(/'(s|re|ve|d|ll)$/g, "").replace(/(ing|ers|ies|ied|ed|ly|es|s)$/g, "")
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9+#.\- ]+/g, " ")
    .split(/\s+/)
    .map(stem)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w))
}

function unique(words: string[]): string[] {
  return [...new Set(words)]
}

const BUILDER_TERMS = new Set(
  "software code coding engineer engineering programmer program computer science api linux kernel compiler database sql rust python typescript javascript llm model models neural train training inference github git commit debug debugging postmortem paper arxiv algorithm protocol security malware firmware architecture system systems infrastructure compute cluster tool tools build builder".split(
    /\s+/,
  ),
)

function expandGoalTokens(goal: string): string[] {
  const base = unique(tokenize(goal))
  if (base.some((t) => BUILDER_TERMS.has(t) || t === "build" || t === "builder" || t === "ship")) {
    return unique([...base, ...BUILDER_TERMS])
  }
  return base
}

function findEvidence(haystack: string, tokens: string[]): string | null {
  if (!tokens.length) return null
  const lower = haystack.toLowerCase()
  for (const token of tokens) {
    const idx = lower.indexOf(token)
    if (idx === -1) continue
    const start = Math.max(0, haystack.lastIndexOf(" ", Math.max(0, idx - 28)) + (idx > 28 ? 1 : 0))
    const end = Math.min(haystack.length, haystack.indexOf(" ", idx + token.length + 36) === -1 ? haystack.length : haystack.indexOf(" ", idx + token.length + 36))
    const span = haystack.slice(start, end).trim()
    if (span.length >= token.length) return span.slice(0, 140)
  }
  return null
}

function sourcePrior(kind: RawItem["sourceKind"]): number {
  if (kind === "hn") return 0.04
  if (kind === "rss") return 0.03
  if (kind === "youtube") return 0.02
  return 0
}

function timeCost(item: RawItem): number {
  if (item.durationSeconds && item.durationSeconds > 0) return Math.round(item.durationSeconds / 60)
  if (item.sourceKind === "youtube") return 12
  if (item.sourceKind === "hn") return 8
  return 11
}

function timeFactor(minutes: number): number {
  if (minutes < 2) return 0.45
  if (minutes <= 25) return 1
  if (minutes <= 40) return 0.7
  return 0.4
}

function slopBase(item: RawItem, prescription: Prescription): { risk: number; reasons: string[] } {
  const text = `${item.title} ${item.snippet}`
  const reasons: string[] = []
  let risk = 0
  if (CLICKBAIT.test(text)) {
    risk += 0.34
    reasons.push("clickbait")
  }
  if (ENGAGEMENT.test(text)) {
    risk += 0.3
    reasons.push("engagement bait")
  }
  if (RAGE.test(text)) {
    risk += 0.4
    reasons.push("ragebait")
  }
  if (LISTICLE.test(item.title)) {
    risk += 0.28
    reasons.push("listicle")
  }
  if (CELEB.test(text)) {
    risk += 0.35
    reasons.push("celebrity")
  }
  const letters = item.title.replace(/[^A-Za-z]/g, "")
  const caps = item.title.replace(/[^A-Z]/g, "")
  if (letters.length > 8 && caps.length / letters.length > 0.55) {
    risk += 0.18
    reasons.push("shouting")
  }
  if ((item.title.match(/[\u{1F300}-\u{1FAFF}]/gu) ?? []).length >= 3) {
    risk += 0.16
    reasons.push("emoji bait")
  }
  const hay = text.toLowerCase()
  for (const term of prescription.hardNo) {
    if (term.length > 2 && hay.includes(term.toLowerCase())) {
      risk += 0.42
      reasons.push(`hard no: ${term}`)
      break
    }
  }
  if (item.sourceKind === "youtube" && item.durationSeconds && item.durationSeconds < 60) {
    risk += 0.35
    reasons.push("short")
  }
  return { risk: Math.min(1, risk), reasons }
}

function feedbackBias(item: RawItem, feedback: Feedback[]): number {
  const forSource = feedback.filter((f) => f.sourceId === item.sourceId)
  if (!forSource.length) return 0
  const useful = forSource.filter((f) => f.mark === "useful").length
  const slop = forSource.filter((f) => f.mark === "slop").length
  const n = useful + slop
  if (!n) return 0
  return ((useful - slop) / n) * 0.12
}

export function scoreItem(item: RawItem, prescription: Prescription, feedback: Feedback[] = []): Score {
  const titleTokens = unique(tokenize(item.title))
  const bodyTokens = unique(tokenize(`${item.title} ${item.snippet}`))
  const titleSet = new Set(titleTokens)
  const bodySet = new Set(bodyTokens)
  let bestFit = 0
  let matchedGoal: string | null = null
  let overlapTokens: string[] = []

  for (const goal of prescription.goals) {
    const core = unique(tokenize(goal))
    const coreOverlap = core.filter((t) => titleSet.has(t) || bodySet.has(t))
    const expanded = expandGoalTokens(goal)
    const domainOverlap = expanded.filter((t) => BUILDER_TERMS.has(t) && titleSet.has(t))
    const overlap = unique([...coreOverlap.filter((t) => titleSet.has(t)), ...domainOverlap])
    if (!overlap.length) continue
    const fit = Math.min(1, coreOverlap.filter((t) => titleSet.has(t)).length * 0.28 + Math.min(3, domainOverlap.length) * 0.18)
    if (fit > bestFit) {
      bestFit = fit
      matchedGoal = goal
      overlapTokens = overlap
    }
  }

  const becomingTokens = unique(tokenize(prescription.becoming))
  const becomingOverlap = becomingTokens.filter((t) => titleSet.has(t))
  if (becomingOverlap.length) {
    const becomingFit = Math.min(0.5, becomingOverlap.length * 0.2)
    if (becomingFit > bestFit) {
      bestFit = becomingFit
      overlapTokens = becomingOverlap
      matchedGoal = matchedGoal ?? prescription.goals[0] ?? prescription.becoming
    }
  }

  const evidence = findEvidence(item.title, overlapTokens) ?? findEvidence(item.snippet.slice(0, 240), overlapTokens)
  if (!evidence) bestFit *= 0.35

  bestFit = Math.min(1, bestFit + sourcePrior(item.sourceKind) + feedbackBias(item, feedback))

  const slop = slopBase(item, prescription)
  const minutes = timeCost(item)
  const rejectReasons = [...slop.reasons]
  if (!evidence) rejectReasons.push("no quoted evidence")
  if (minutes > prescription.maxMinutes) rejectReasons.push(`too long (${minutes} min)`)
  if (bestFit < 0.22) rejectReasons.push("weak goal fit")

  const pass = bestFit >= 0.22 && slop.risk < 0.55 && minutes <= prescription.maxMinutes && Boolean(evidence)
  const composite = Number((bestFit * (1 - slop.risk) * timeFactor(minutes)).toFixed(4))

  return {
    itemId: item.id,
    goalFit: Number(bestFit.toFixed(3)),
    slopRisk: Number(slop.risk.toFixed(3)),
    timeCost: minutes,
    evidence,
    matchedGoal: pass || bestFit >= 0.22 ? matchedGoal : null,
    rejectReasons,
    pass,
    composite,
  }
}

export function scoreAll(items: RawItem[], prescription: Prescription, feedback: Feedback[] = []): Score[] {
  return items.map((item) => scoreItem(item, prescription, feedback))
}
