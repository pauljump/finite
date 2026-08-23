# DeSlop — architecture

A finite reading list. You write what you are working toward. Public RSS/Atom comes in. A small scorer keeps only items that can quote a reason. You get a short list. Then it stops.

Source: `https://github.com/pauljump/deslop`
Live demo: `https://deslop.polyfeeds.dev`
Local setup guide: `https://vibecheck.polyfeeds.dev/finite.txt`

This document is the contract for the MVP. The web app is Phase 1, shipped. Native TestFlight is not.

---

## 0. The original idea

Feeds do not have a stop condition. This one does.

That is the whole product. Not a personal AI sitting in front of YouTube. Not a better homepage. A written intent, public sources, an inspectable scorer, a hard ceiling.

- The unit is **today's list**, not a feed.
- Hitting the ceiling is success, not a prompt to continue.
- The platforms on the other side optimize for time-on-site. This optimizes for goal-fit per minute.
- Infinite scroll, autoplay, related, streaks, and notifications are absent, not toned down.

If the UI is pleasant to linger in, it is wrong.

---

## 1. Data ingestion

### The three options, judged for this product

| Path | What it gets you | Cost | Failure mode | Verdict |
|---|---|---|---|---|
| Official APIs (YouTube Data, X API) | Personalized home feeds, search, quotas | YouTube quota is workable; X API is expensive and ToS-hostile for a filter product | OAuth onboarding kills the first-run; X pricing makes a public demo impossible | **Phase 3**, after a user exists who will sign in |
| Headless scrape (Playwright / twitter-bridge) | Whatever the logged-in homepage shows | Compute, ban risk, ToS | Breaks weekly; cannot ship a public URL that scrapes other people's sessions | **Not for the product.** The existing `twitter-bridge` collector stays Paul's private pipe |
| Browser extension → local app | True intercept: the actual homepage, with cookies, without impersonating the user from our servers | Extension review, per-browser work | Users have to install something | **Phase 4**, the real intercept |
| Public RSS / Atom | YouTube channel uploads (official), HN, blogs, newsletters, any source that still publishes a feed | $0, no auth | You get the channel, not the personalized homepage | **MVP** |

YouTube still publishes per-channel Atom at `https://www.youtube.com/feeds/videos.xml?channel_id=…`. That is an official, documented, unauthenticated surface. It is not the homepage algorithm — and that is a feature. The homepage *is* the thing we are trying to stop.

X has no public RSS. Honest options: the user pastes an RSSHub / Nitter / third-party feed URL, or we wait for the extension. We do not scrape x.com from the Mini.

### MVP ingest shape

```
sources.ts  →  rss.ts parser  →  ingest.ts (parallel fetch, 8s timeout)
                                    ↓
                         ~/.local/state/deslop/inbox.json
                                    ↓
                         GET/POST /api/inbox
                                    ↓
                         browser (prescription never leaves the device)
```

- Default sources are a short, high-signal list: HN Best, a handful of YouTube channels that teach, a handful of practitioner blogs.
- The user may add extra feed URLs. Those are posted to `/api/inbox` at request time and are not stored as an account.
- Server cache TTL is 15 minutes. We do not fetch on every page view.
- Raw items only: id, title, url, snippet, source, publishedAt. No ranking on the server.

### What we will not do in v1

- Log into YouTube/X as the user.
- Run a headless browser against those sites from this host.
- Call a paid social API.

---

## 2. The filtering layer

### Why not "just ask an LLM if this is relevant"

LLMs hallucinate relevance. Given a vague goal like "become a better builder" they will bless almost anything that mentions AI, startups, or "lessons." That recreates the original problem with extra latency and a bill.

The scoring system is therefore **evidence-gated** and **runs on the device**.

### Score object

Every item gets:

| Field | Range | Rule |
|---|---|---|
| `goalFit` | 0–1 | Max over goals of (content-word overlap with that goal) |
| `evidence` | string or null | Must be a verbatim substring of title or snippet. If we cannot quote it, `goalFit` is forced down |
| `matchedGoal` | string or null | The goal that produced the max |
| `slopRisk` | 0–1 | Sum of detectors: clickbait, rage, engagement-bait, celebrity, hard-no terms, ALL-CAPS, listicle |
| `timeCost` | minutes | From duration if present, else a type prior (HN ~8, blog ~12, YouTube 10–20) |
| `pass` | bool | `goalFit ≥ 0.22` AND `slopRisk < 0.55` AND `timeCost ≤ maxMinutes` |
| `composite` | 0–1 | `goalFit * (1 - slopRisk) * timeFactor` |

`timeFactor` prefers 5–25 minute items. A 3-hour podcast and a 12-second Short both lose.

### Anti-hallucination rules (non-negotiable)

1. The model (heuristic today, LLM later) may only cite text that appears in the item payload.
2. If evidence is missing, the item does not pass, even if the source is trusted.
3. Hard-no terms are a veto, not a suggestion.
4. Source prestige is a tiny prior (±0.05), never a pass by itself.
5. Feedback (`useful` / `slop`) adjusts per-source and per-token weights locally. It never silently rewrites the user's goals.

### Local vs cloud

| | Latency | Privacy | Cost | Accuracy on edge cases |
|---|---|---|---|---|
| On-device structured scorer (shipped) | <5ms | Prescription never leaves the phone | $0 | Weak on metaphor / sarcasm |
| Local LLM (Ollama on the Mini) | 1–8s/item | Stays on LAN | $0 | Better prose judgment |
| Cloud LLM (xAI / others) | 0.5–3s/item + network | Goals and titles leave the device | billable | Best, if the prompt is evidence-gated |

**MVP decision:** on-device structured scorer. The Mini does not have a live Ollama server, and there is no `XAI_API_KEY` in the vault. Agent-core forbids firing a paid provider without an explicit yes in the current turn.

**Phase 3 (when a key or a local model is authorized):** a judge that receives `{goals, hardNo, title, snippet}` and must return JSON `{pass, goalFit, slopRisk, evidence, matchedGoal}`. The same evidence rule is enforced in code after the model returns — if `evidence` is not a substring, the item is rejected regardless of `pass`. Cloud is used for the ambiguous middle band (`0.15 < goalFit < 0.35`), not for every item.

We do not need a multi-agent orchestra for this. One judge, one schema, one post-condition. Extra agents invent relevance.

### Prompt shape for the future judge

```
You are a bouncer, not a recommender.
The user is becoming: <goals>
Hard no: <list>
Item title: ...
Item snippet: ...
Return JSON only.
evidence MUST be copied verbatim from title or snippet.
If you cannot copy a supporting span, set pass=false and goalFit=0.
Do not infer hidden relevance. "Kind of related to building" is a fail.
```

---

## 3. Client architecture and UI

### Stack (MVP)

- **Web:** Next.js 15 standalone, React 19, no CSS framework, no component library. Port 8180. PM2 + Cloudflare Tunnel → `deslop.polyfeeds.dev`.
- **State:** `localStorage` only. Prescription, extra feeds, feedback, today's dose. No account.
- **iOS today:** PWA (`apple-web-app-capable`, standalone manifest). Add to Home Screen is the TestFlight of a one-day build.
- **iOS next:** SwiftUI shell, same `/api/inbox`, scoring in Swift (port of `score.ts`). TestFlight after the dose loop is proven on the web.
- **watchOS:** a complication that shows remaining dose count. Not before iOS native.

### Healthy friction (the actual product)

| Pattern we refuse | Replacement |
|---|---|
| Infinite scroll | Hard ceiling (default 7). The last card is "that's your dose" |
| Skip-as-more | Skip consumes the slot |
| Autoplay / in-app player | Open the source in a new tab. We are not a host |
| Thumbnails on by default | Title, source, minutes, the quoted evidence |
| Related / up next | Nothing after the item |
| Streaks, badges, notifications | A clock until tomorrow |
| Easy access to the junk | Reject pile opens only after a 1.4s press-and-hold |
| "Refresh feed" | Ingest cache. Curiosity is not a reason to re-roll the dose |

The UI is a short list on paper. It should feel finished, not like a nicer Twitter.

---

## 4. Build sequence

### Phase 1 — today (this directory)

Bare-minimum proof in the terminal:

```bash
cd deslop
pnpm ingest     # fetch default sources, print counts
pnpm dose       # score against the default prescription, print the 7
```

Then the web app: prescription → dose of 7 → useful/slop → locked until tomorrow. Ship to `deslop.polyfeeds.dev`.

### Phase 2 — personal sources

- OPML import
- YouTube channel URL → channel_id resolution
- Extra feeds persist across devices via a link-token, still no account

### Phase 3 — judge

- Evidence-gated LLM on the ambiguous band
- Local Ollama first; xAI only with an explicit key and spend cap
- Same schema, same substring check

### Phase 4 — intercept

- Browser extension: reads the DOM of youtube.com / x.com on the user's machine, POSTs titles+snippets to the local scorer (or the Mini), replaces the homepage with the dose.
- This is the only honest way to sit "between you and the algorithm."

### Phase 5 — native

- SwiftUI iOS + TestFlight
- watchOS remaining-count complication
- On-device scoring stays on-device

Do not start Phase 4 or 5 until a real person has taken a dose for a week and the reject pile matches their taste.

---

## 5. Logical flow

```
user writes prescription (goals, hard-no, dose size)
        │
        ▼
server fetches public feeds ──► inbox (raw items)
        │
        ▼
device scores each item against the prescription
        │
        ├── pass  → ranked, diversified, cut to N
        └── fail  → reject pile (hold to view)
        │
        ▼
user takes the dose, one item at a time
        │
        ├── open source (leaves the app)
        ├── mark useful → boost source/tokens
        ├── mark slop   → penalize source/tokens
        └── skip        → slot consumed
        │
        ▼
N reached → lock until local midnight
```

---

## 6. Privacy and credentials

- Prescription, feedback, and extra feeds live in the browser.
- The Mini stores a cache of public feed items, not people.
- No runtime secrets required for Phase 1.
- If a cloud judge is added later, the key comes from `/Users/mini-home/.secrets` via the PM2 vault runner, never from a project `.env`.
