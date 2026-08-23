# Finite

@AGENTS.md

## What this is

A short reading list with a stop condition. The public site is a demo. Clone the repo to run your own.

## Commands

```bash
pnpm install
pnpm dev       # localhost:8180
pnpm ingest
pnpm dose
pnpm build
```

After a production build on the Mini:

```bash
pnpm build
cp -R .next/static .next/standalone/.next/static
cp -R public .next/standalone/public
node /Users/mini-home/Desktop/Monorepo/control-plane/scripts/migrate-pm2-fleet.mjs --apply --only deslop
```

PM2 process name remains `deslop` (port 8180). Public hostname is `finite.polyfeeds.dev`.

## Current state

Public at [github.com/pauljump/finite](https://github.com/pauljump/finite). Demo at [finite.polyfeeds.dev](https://finite.polyfeeds.dev) (`deslop.polyfeeds.dev` is an alias). OG share card is `/og.png`. Pulse property is `finite` (legacy hits under `deslop`); beacon is fleet-standard but only fires on the hosted demo, not GitHub clones.

Canonical local root: `/Users/mini-home/projects/finite`.
