"use client"

import { useEffect, useMemo, useState } from "react"
import { assembleDose } from "@/lib/dose"
import { DEFAULT_PRESCRIPTION, fromForm } from "@/lib/prescription"
import { scoreItem } from "@/lib/score"
import {
  addFeedback,
  hasOnboarded,
  loadDay,
  loadExtraFeeds,
  loadFeedback,
  loadPrescription,
  markOnboarded,
  msUntilTomorrow,
  saveDay,
  saveExtraFeeds,
  savePrescription,
  todayStamp,
} from "@/lib/state"
import type { DayLog, FeedbackMark, Prescription, RankedItem, RawItem } from "@/lib/types"

type Screen = "onboard" | "dose" | "done" | "rejects" | "rx"

function hostedDemo(): boolean {
  if (typeof window === "undefined") return false
  return window.location.hostname.endsWith("polyfeeds.dev")
}

function shortGoal(goal: string): string {
  const cut = goal
    .replace(/^i('m| am) (becoming a person who |working on )/i, "")
    .trim()
  return cut.length > 78 ? `${cut.slice(0, 75)}…` : cut
}

function fmtRemain(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

export function App() {
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<Screen>("dose")
  const [hosted, setHosted] = useState(false)
  const [prescription, setPrescription] = useState<Prescription>(DEFAULT_PRESCRIPTION)
  const [items, setItems] = useState<RawItem[]>([])
  const [ingested, setIngested] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [day, setDay] = useState<DayLog>({ date: todayStamp(), itemIds: [], consumed: {} })
  const [cursor, setCursor] = useState(0)
  const [holding, setHolding] = useState(false)
  const [remain, setRemain] = useState(msUntilTomorrow())
  const [feedsText, setFeedsText] = useState("")
  const [form, setForm] = useState({
    becoming: DEFAULT_PRESCRIPTION.becoming,
    hardNo: DEFAULT_PRESCRIPTION.hardNo.join("\n"),
    usefulMeans: DEFAULT_PRESCRIPTION.usefulMeans,
    maxMinutes: DEFAULT_PRESCRIPTION.maxMinutes,
    dailyDose: DEFAULT_PRESCRIPTION.dailyDose,
  })

  useEffect(() => {
    const demo = hostedDemo()
    setHosted(demo)
    const rx = loadPrescription() ?? DEFAULT_PRESCRIPTION
    const onboarded = hasOnboarded()
    const extra = loadExtraFeeds()
    setPrescription(rx)
    setForm({
      becoming: rx.becoming,
      hardNo: rx.hardNo.join("\n"),
      usefulMeans: rx.usefulMeans,
      maxMinutes: rx.maxMinutes,
      dailyDose: rx.dailyDose,
    })
    setFeedsText(extra.join("\n"))
    setDay(loadDay())
    setScreen(demo || onboarded ? "dose" : "onboard")
    setReady(true)
    const extraFeeds = extra
    ;(async () => {
      try {
        const res = await fetch("/api/inbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extraFeeds }),
        })
        if (!res.ok) throw new Error(`inbox ${res.status}`)
        const data = (await res.json()) as { items: RawItem[] }
        setItems(data.items ?? [])
        setIngested(data.items?.length ?? 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the inbox")
      }
    })()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setRemain(msUntilTomorrow()), 30_000)
    return () => clearInterval(t)
  }, [])

  const feedback = useMemo(() => (ready ? loadFeedback() : []), [ready, day])
  const assembled = useMemo(() => {
    if (!items.length) return { dose: [] as RankedItem[], rejected: [] as RankedItem[], ingested: 0 }
    const existing = day.itemIds
      .map((id) => items.find((it) => it.id === id))
      .filter((it): it is RawItem => Boolean(it))
    if (existing.length) {
      const rankedExisting: RankedItem[] = existing.map((item) => ({
        ...item,
        score: scoreItem(item, prescription, feedback),
      }))
      const rest = assembleDose(
        items,
        prescription,
        feedback,
        [...day.itemIds, ...Object.keys(day.consumed)],
      )
      const merged = [...rankedExisting]
      for (const item of rest.dose) {
        if (merged.length >= prescription.dailyDose) break
        if (merged.some((m) => m.id === item.id)) continue
        merged.push(item)
      }
      return { dose: merged, rejected: rest.rejected, ingested: rest.ingested }
    }
    return assembleDose(items, prescription, feedback, Object.keys(day.consumed))
  }, [items, prescription, feedback, day])

  useEffect(() => {
    if (!ready || !assembled.dose.length) return
    if (day.itemIds.length) return
    const next = { ...day, itemIds: assembled.dose.map((d) => d.id) }
    setDay(next)
    saveDay(next)
  }, [assembled.dose, day, ready])

  const consumedCount = Object.keys(day.consumed).length
  const current = assembled.dose.find((item) => !day.consumed[item.id]) ?? assembled.dose[cursor] ?? null
  const finished = ready && items.length > 0 && assembled.dose.length > 0 && assembled.dose.every((item) => day.consumed[item.id])

  function commit(item: RankedItem, mark: FeedbackMark) {
    addFeedback({ itemId: item.id, mark, at: new Date().toISOString(), sourceId: item.sourceId })
    const next = { ...day, consumed: { ...day.consumed, [item.id]: mark } }
    setDay(next)
    saveDay(next)
    setCursor((c) => c + 1)
  }

  function saveRx() {
    const next = fromForm(form)
    setPrescription(next)
    savePrescription(next)
    const feeds = feedsText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8)
    saveExtraFeeds(feeds)
    markOnboarded()
    setScreen("dose")
  }

  if (!ready) {
    return (
      <main className="shell">
        <div className="rx-row">
          <div className="mark">Finite</div>
          <div className="meta">{hosted ? "demo" : "local"}</div>
        </div>
        <h1>A short list. Then it stops.</h1>
        <p className="lede">
          {hosted
            ? "A demo of a reading list with a stop condition."
            : "Write what you are working toward. Scoring stays on this device."}
        </p>
        <p className="loading">Pulling public feeds…</p>
      </main>
    )
  }

  if (screen === "onboard" || screen === "rx") {
    return (
      <main className="shell">
        <div className="rx-row">
          <div className="mark">Finite</div>
          <div className="meta">{hosted ? "demo" : "local"}</div>
        </div>
        <h1>{screen === "onboard" ? "A short list. Then it stops." : "What you're working toward."}</h1>
        <p className="lede">
          {hosted
            ? "This hosted copy is a demo. Change the intent if you want to poke at it — nothing is saved as an account. Clone the repo to run your own."
            : "Write the work. Public feeds come in. Only items that can quote a reason survive. Scoring stays on this device."}
        </p>
        <label htmlFor="becoming">What are you working toward</label>
        <textarea
          id="becoming"
          value={form.becoming}
          onChange={(e) => setForm({ ...form, becoming: e.target.value })}
        />
        <label htmlFor="useful">Useful means</label>
        <textarea
          id="useful"
          value={form.usefulMeans}
          onChange={(e) => setForm({ ...form, usefulMeans: e.target.value })}
          style={{ minHeight: 72 }}
        />
        <label htmlFor="hardno">Hard no</label>
        <textarea
          id="hardno"
          value={form.hardNo}
          onChange={(e) => setForm({ ...form, hardNo: e.target.value })}
          style={{ minHeight: 88 }}
        />
        <div className="row">
          <div>
            <label htmlFor="dose">Today's list</label>
            <input
              id="dose"
              type="number"
              min={3}
              max={12}
              value={form.dailyDose}
              onChange={(e) => setForm({ ...form, dailyDose: Number(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="mins">Max minutes</label>
            <input
              id="mins"
              type="number"
              min={5}
              max={180}
              value={form.maxMinutes}
              onChange={(e) => setForm({ ...form, maxMinutes: Number(e.target.value) })}
            />
          </div>
        </div>
        <label htmlFor="feeds">Extra feeds (RSS / YouTube Atom)</label>
        <textarea
          id="feeds"
          placeholder="https://…"
          value={feedsText}
          onChange={(e) => setFeedsText(e.target.value)}
          style={{ minHeight: 72 }}
        />
        <div style={{ height: 18 }} />
        <button className="btn" onClick={saveRx}>
          {screen === "onboard" ? "Make today's list" : "Save"}
        </button>
        {screen === "rx" && (
          <button className="btn ghost" onClick={() => setScreen(finished ? "done" : "dose")}>
            Back
          </button>
        )}
        <DemoNote hosted={hosted} />
      </main>
    )
  }

  if (screen === "rejects") {
    return (
      <main className="shell">
        <div className="rx-row">
          <div className="mark">Finite</div>
          <div className="nav">
            <button type="button" onClick={() => setScreen(finished ? "done" : "dose")}>
              Close
            </button>
          </div>
        </div>
        <h1>Held back.</h1>
        <p className="lede">
          {assembled.rejected.length} items did not make the list. This pile is supposed to feel like a chore.
        </p>
        <ul className="reject-list">
          {assembled.rejected.slice(0, 40).map((item) => (
            <li key={item.id}>
              <div className="source">{item.sourceName}</div>
              <h3>{item.title}</h3>
              <p>{item.score.rejectReasons.slice(0, 3).join(" · ") || "weak goal fit"}</p>
            </li>
          ))}
        </ul>
      </main>
    )
  }

  if (error && !items.length) {
    return (
      <main className="shell">
        <div className="rx-row">
          <div className="mark">Finite</div>
          <div className="meta">{hosted ? "demo" : "local"}</div>
        </div>
        <p className="error">{error}</p>
      </main>
    )
  }

  if (!items.length) {
    return (
      <main className="shell">
        <p className="loading">Pulling public feeds…</p>
      </main>
    )
  }

  if (finished || screen === "done") {
    const useful = Object.values(day.consumed).filter((m) => m === "useful").length
    return (
      <main className="shell">
        <div className="rx-row">
          <div className="mark">Finite</div>
          <div className="meta">{hosted ? "demo" : "local"}</div>
        </div>
        <div className="status">
          <h1>That&apos;s the list.</h1>
          <p className="lede">
            The stop is the product. Next list in {fmtRemain(remain)}.
          </p>
          <p className="count">
            {ingested} fetched · {assembled.rejected.length} held back · {useful} kept
          </p>
        </div>
        <HoldToOpen onOpen={() => setScreen("rejects")} holding={holding} setHolding={setHolding} />
        <div className="nav">
          <button type="button" onClick={() => setScreen("rx")}>
            Intent
          </button>
        </div>
        <DemoNote hosted={hosted} />
      </main>
    )
  }

  if (!current) {
    return (
      <main className="shell">
        <p className="loading">Nothing made the list. Sharpen what you&apos;re working toward, or add a feed.</p>
        <button className="btn secondary" onClick={() => setScreen("rx")}>
          Edit intent
        </button>
        <HoldToOpen onOpen={() => setScreen("rejects")} holding={holding} setHolding={setHolding} />
      </main>
    )
  }

  const n = assembled.dose.findIndex((item) => item.id === current.id) + 1

  return (
    <main className="shell">
      <div className="rx-row">
        <div className="mark">Finite</div>
        <div className="meta">
          {consumedCount}/{assembled.dose.length} read
        </div>
      </div>
      <p className="dose-index">
        {n} of {assembled.dose.length} · {current.score.timeCost} min
      </p>
      <p className="source">{current.sourceName}</p>
      <h2 className="item-title">{current.title}</h2>
      <div className="pills">
        <span className="pill good">fit {Math.round(current.score.goalFit * 100)}</span>
        <span className="pill">noise {Math.round(current.score.slopRisk * 100)}</span>
      </div>
      {current.score.evidence && (
        <div className="because">
          <p className="k">Because</p>
          <p>
            “{current.score.evidence}”
            {current.score.matchedGoal ? ` → ${shortGoal(current.score.matchedGoal)}` : ""}
          </p>
        </div>
      )}
      <div className="actions">
        <a className="btn" href={current.url} target="_blank" rel="noopener noreferrer">
          Open the source
        </a>
        <button className="btn secondary" onClick={() => commit(current, "useful")}>
          Keep
        </button>
        <button className="btn secondary" onClick={() => commit(current, "slop")}>
          Drop
        </button>
        <button className="btn ghost" onClick={() => commit(current, "skip")}>
          Skip (still counts)
        </button>
      </div>
      <div className="nav">
        <button type="button" onClick={() => setScreen("rx")}>
          Intent
        </button>
      </div>
      <DemoNote hosted={hosted} />
    </main>
  )
}

function DemoNote({ hosted }: { hosted: boolean }) {
  return (
    <p className="hero-note">
      {hosted ? "This is a demo. " : ""}
      <a href="https://github.com/pauljump/finite" rel="noreferrer">
        github.com/pauljump/finite
      </a>
      {hosted ? " to run yours." : ""}
    </p>
  )
}

function HoldToOpen({
  onOpen,
  holding,
  setHolding,
}: {
  onOpen: () => void
  holding: boolean
  setHolding: (v: boolean) => void
}) {
  useEffect(() => {
    if (!holding) return
    const t = setTimeout(onOpen, 1400)
    return () => clearTimeout(t)
  }, [holding, onOpen])

  return (
    <div
      className={`hold${holding ? " armed" : ""}`}
      onPointerDown={() => setHolding(true)}
      onPointerUp={() => setHolding(false)}
      onPointerLeave={() => setHolding(false)}
      onPointerCancel={() => setHolding(false)}
    >
      Press and hold to see what was held back
      <span className="bar" />
    </div>
  )
}
