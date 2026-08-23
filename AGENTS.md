# DeSlop project contract

This is the provider-neutral instruction entrypoint for this repository. Portfolio behavior comes from the global agent core; this file adds only project-local facts.

- Canonical root: `/Users/mini-home/projects/deslop`.
- Git owner: this directory has an independent history. Public remote: `https://github.com/pauljump/deslop`.
- Product: a finite local reading list. Public RSS in, inspectable scorer, hard daily stop. Architecture is in [ARCHITECTURE.md](./ARCHITECTURE.md). MIT.
- Do not add accounts, infinite scroll, in-app video, or a paid LLM call unless the current task explicitly authorizes spend.
- Runtime data lives in `~/.local/state/deslop` (or `DESLOP_DATA_DIR`). Do not add secrets to this repo.
- Commands: `pnpm dev` (port 8180), `pnpm build`, `pnpm ingest`, `pnpm dose`.
- Live demo: `https://deslop.polyfeeds.dev`. Local setup guide: `https://vibecheck.polyfeeds.dev/finite.txt`.
