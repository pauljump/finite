# DeSlop

A short reading list with a stop condition.

You write what you are working toward. The app fetches public RSS and YouTube Atom feeds. A small, inspectable scorer keeps only items that can quote a reason from the title or snippet. You get a short list. Then it stops until tomorrow.

No account. No API key. Your intent never leaves the device.

Live demo: https://deslop.polyfeeds.dev

To have an AI set this up on your machine:

```
Read https://vibecheck.polyfeeds.dev/finite.txt and set up a local finite reading list on this machine. Inspect first, ask before installs, and verify localhost.
```

## Run locally

Needs Node 22+ and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/pauljump/deslop.git
cd deslop
pnpm install
pnpm dev
```

Open http://localhost:8180

```bash
pnpm ingest   # fetch default public feeds
pnpm dose     # print today's list against the default intent
```

Feed cache lives in `~/.local/state/deslop`. Override with `DESLOP_DATA_DIR`.

## How scoring works

The scorer is in `src/lib/score.ts`. It is not an LLM.

- `goalFit` comes from overlapping content words between the item title and your written intent
- `evidence` must be a verbatim span from the title or snippet; no quote, no pass
- `noise` flags clickbait, rage, engagement bait, and your hard-nos
- The list is hard-capped. Skip still counts as a slot

Add extra RSS or YouTube Atom URLs in the intent screen. YouTube channel feeds look like:

```
https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
```

This does not log into YouTube or X. It does not read a personalized homepage. Public feeds only.

## License

MIT
