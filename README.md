# Finite

A short reading list with a stop condition.

The public site is a **demo** of that list. It is not a hosted product and not an account. If you want one of your own, clone this repo and run it locally.

You write what you are working toward. Public RSS and YouTube Atom come in. A small, inspectable scorer keeps only items that can quote a reason. You get a short list. Then it stops until tomorrow.

No account. No API key. Intent stays in the browser.

Demo: https://finite.polyfeeds.dev

To have an AI set it up on your machine:

```
Read https://vibecheck.polyfeeds.dev/finite.txt and clone https://github.com/pauljump/finite onto this machine. Inspect first, ask before installs, and verify localhost.
```

## Run locally

Needs Node 22+ and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/pauljump/finite.git
cd finite
pnpm install
pnpm dev
```

Open http://localhost:8180

```bash
pnpm ingest   # fetch default public feeds
pnpm dose     # print today's list
```

Feed cache lives in `~/.local/state/finite`. Override with `FINITE_DATA_DIR`.

## How scoring works

The scorer is in `src/lib/score.ts`. It is not an LLM.

- `goalFit` comes from overlapping content words between the item title and your written intent
- `evidence` must be a verbatim span from the title or snippet; no quote, no pass
- `noise` flags clickbait, rage, engagement bait, and your hard-nos
- The list is hard-capped. Skip still counts as a slot

This does not log into YouTube or X. It does not read a personalized homepage. Public feeds only.

## License

MIT
