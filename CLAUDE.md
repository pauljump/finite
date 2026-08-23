# DeSlop

@AGENTS.md

## What this is

A finite reading list. Write what you are working toward. Public RSS/Atom comes in. A local scorer keeps only items that can quote a reason. You get a short list. Then it stops.

## Commands

```bash
pnpm install
pnpm dev       # localhost:8180
pnpm ingest    # fetch default sources
pnpm dose      # print today's list
pnpm build
```

After a production build on the Mini:

```bash
pnpm build
cp -R .next/static .next/standalone/.next/static
cp -R public .next/standalone/public
node /Users/mini-home/Desktop/Monorepo/control-plane/scripts/migrate-pm2-fleet.mjs --apply --only deslop
```

## Current state

Public at [github.com/pauljump/deslop](https://github.com/pauljump/deslop). Demo at [deslop.polyfeeds.dev](https://deslop.polyfeeds.dev). Vibecheck guide at `/finite`.
