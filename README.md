# YTX - Standalone ScalpX Product

**YouTube lifecycle ops** - separate app, FlowX Scout branding, full 38-task show engine.

| | |
|---|---|
| **Repo** | `/Users/jackrockell/Desktop/FLOW X YT AUTOMATION` |
| **Scout adapters** | `/Users/jackrockell/Desktop/FLOWX SCOUT` (HTTP only) |
| **Local URL** | http://localhost:3001/ytx |
| **Ship** | 3 July 2026 |

## One-click start

```bash
cd "/Users/jackrockell/Desktop/FLOW X YT AUTOMATION"
cp .env.example .env.local   # optional - edit Scout URL + OAuth
npm install
npm run dev
```

Open **http://localhost:3001/ytx** (or **http://localhost:3001** — redirects to `/ytx`)

## Quality / audit

```bash
npm test          # unit + store smoke (temp DB)
npm run test:api  # HTTP smoke (server on :3001)
npm run smoke     # build + unit + API (full audit)
```

See **`AUDIT.md`** for full audit report and sign-off checklist.

## What's included

- **Command** - dashboard, metrics, recent shows
- **Roster** - 10 channels (9 traders + Banter), OAuth connect per channel
- **Shows** - create ShowRun (live or pre-recorded pipeline) → auto-seeds **38 checklist tasks**
- **Show board** - AI YouTube Studio UX · QC panels (comments, IG carousel, trailer) · auto live chapters/links
- **Settings** - Google OAuth + FlowX Scout adapter URL
- **APIs** - SEO pack, sponsor block, cross-post, **local Clips pipeline** (Scout fallback), analytics, EndScreenDB, comment queue
- **SQLite** - `data/ytx.db` (standalone, not Scout's DB)
- **UI** - same FlowX instrument glass / accent green design system

## Scout integration

Set in Settings or `.env.local`:

```
FLOWX_SCOUT_URL=http://localhost:3000
FLOWX_SCOUT_SERVICE_KEY=...
```

Run Scout on `:3000`, YTX on `:3001`. Adapters call Clips · Content · Deals · Track APIs.

## Docs

| File | Purpose |
|------|---------|
| `YTX_BUILD_PLAN.md` | Master build plan + sprint |
| `SCOUT_INVENTORY.md` | Everything reusable from Scout |
| `SPEC_COVERAGE.md` | Honest spec vs built matrix |

## Hard rules

1. **Never add `/ytx` to FlowX Scout** - this repo is the product
2. **Banter** = show-format channel only (not in Scout trader roster)
3. **Sponsor URLs** from Scout `TrackingLink` via `dealId`
