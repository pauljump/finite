# Finite project contract

This is the provider-neutral instruction entrypoint for this repository. Portfolio behavior comes from the global agent core; this file adds only project-local facts.

- Canonical root: `/Users/mini-home/projects/finite`.
- Git owner: this directory has an independent history. Public remote: `https://github.com/pauljump/finite`.
- Product: a finite local reading list. The public site is a demo, not a hosted tool.
- Do not add accounts, infinite scroll, in-app video, or a paid LLM call unless the current task explicitly authorizes spend.
- Runtime data lives in `~/.local/state/finite` (or `FINITE_DATA_DIR`). Do not add secrets to this repo.
- Commands: `pnpm dev` (port 8180), `pnpm build`, `pnpm ingest`, `pnpm dose`.
- Live demo: `https://finite.polyfeeds.dev`. Setup guide: `https://vibecheck.polyfeeds.dev/finite.txt`.
