# FlowX Scout - Reusable inventory for YTX

**Scout repo:** `/Users/jackrockell/Desktop/FLOWX SCOUT`  
**Stack:** Next.js 16 · App Router · SQLite (`better-sqlite3`) · no Prisma · Vercel Blob/S3 for assets

YTX **does not import Scout code**. This doc maps what exists so adapters call the right HTTP endpoints.

---

## Summary

| Area | Scout status | YTX integration |
|------|--------------|-----------------|
| Clips pipeline | **Built** - yt-dlp, Whisper, ffmpeg, moments, Shorts export | HTTP adapter → `/api/clips/*` |
| Content cross-post | **Built** - multi-platform draft generator | HTTP adapter → `/api/content/*` |
| Deals + TrackingLinks | **Built** - CRM + redirect links | HTTP adapter → `/api/deals`, `/api/tracking-links` |
| Track analytics | **Built** - owned accounts, posts, snapshots | HTTP read-only → `/api/track/*` |
| Convert attribution | **Built** - click tracking, funnel | Optional hook via TrackingLink slugs |
| YouTube OAuth | **Not built** - X OAuth only | **YTX owns** (pattern: `lib/track/xOAuth.ts`) |
| YouTube metadata read | **Built** - ScrapeCreators via `lib/social.ts` | YTX direct or via Scout |
| Studio kanban | **Built** - legacy Chento workflow | **Do not extend** - reference UI only |
| `/ytx` product | **Does not exist** (correct - separate app) | Greenfield in FLOW X YT AUTOMATION |

**Reusable capability ≈ 15% of YTX ship scope.** The other 85% is YTX-owned product (roster, ShowRun, checklist, OAuth, live ops, EndScreenDB, UI).

---

## Clips (post-show pipeline)

### Scout libs - `lib/clips/`

| File | Capability | YTX task(s) |
|------|------------|-------------|
| `youtubeImport.ts` | Download YT video as clip source (yt-dlp) | 1.24 YT Shorts |
| `transcript.ts` | YT auto-captions via yt-dlp VTT | 1.19, 1.20, 1.23 |
| `transcribe.ts` | OpenAI Whisper fallback | 1.19, 1.20 |
| `analyze.ts` | Captions/Whisper → moment detection | 1.14, 1.23, 1.24 |
| `exportMoment.ts` | ffmpeg cut + captions | 1.23, 1.24 |
| `clipFormats.ts` | Export preset **`shorts`** (9:16, 1080×1920) | 1.24 |
| `store.ts` | SQLite CRUD sources/moments | Adapter stores `clipSourceId` on ShowRun |
| `importJobs.ts` | Async import job polling | Long VOD imports |
| `types.ts` | `ClipCampaign.dealId` link pattern | Sponsor clip campaigns |

### Scout API - `app/api/clips/`

| Method | Route | Request | Response | YTX use |
|--------|-------|---------|----------|---------|
| GET | `/api/clips/sources` | - | `{ sources }` | List imports |
| POST | `/api/clips/sources` | `{ youtubeUrl }` or multipart file | `{ source }` | One-click post-show import |
| POST | `/api/clips/sources/import` | async job start | `{ jobId }` | Long streams |
| GET | `/api/clips/sources/import/[jobId]` | - | job status | Poll import |
| POST | `/api/clips/sources/[id]/analyze` | - | analysis result | Moment detect |
| GET | `/api/clips/sources/[id]/moments` | - | `{ moments }` | Pick Shorts |
| POST | `/api/clips/moments/[momentId]/export` | `{ format: "shorts", withCaptions, withHook }` | `{ clipUrl }` | 3–5 Shorts queue |
| GET/POST | `/api/clips/campaigns` | `{ dealId? }` | campaigns | Link sponsor deal |
| GET/POST | `/api/clips/submissions` | clipper workflow | submissions | Optional review queue |

**Export format for YTX:** always `format: "shorts"` for task 1.24.

### Scout deps (Clips)

- `yt-dlp-static` + `scripts/install-yt-dlp.mjs` (postinstall)
- `ffmpeg-static`, `ffprobe-static`
- `@vercel/blob` (prod clip storage)
- `OPENAI_API_KEY` (Whisper)

---

## Content (cross-post)

### Scout libs - `lib/content/`

| File | Capability | YTX task(s) |
|------|------------|-------------|
| `platformGenerator.ts` | One topic → drafts per platform | 1.7–3.6 pre-show social |
| `platformFormats.ts` | YT Shorts/Long templates | CrossPostQueue |
| `engine.ts` | Draft lifecycle, trend hooks | Queue management |
| `handoff.ts` | URL builders | YTX → Content handoff pattern |
| `ai.ts` | DeepSeek post body generation | Social copy |

### Scout API - `app/api/content/`

| Method | Route | Request | Response | YTX use |
|--------|-------|---------|----------|---------|
| GET | `/api/content/dashboard` | - | drafts queue | Monitor scheduled |
| POST | `/api/content/generate-platform` | `{ accountId, topic, platforms[] }` | `{ drafts }` | Pre-show T-60min posts |
| PATCH | `/api/content/drafts/[id]` | status/body/schedule | draft | Approve Assist tasks |
| POST | `/api/content/publish/telegram` | - | - | Only native publish today |

**Gap:** No YouTube upload/Community post API in Scout. YTX OAuth fills metadata write; publish may stay manual Assist until API wired.

**Platforms for pre-show (6):** YouTube Community, X, IG, FB, Reddit, Telegram - map to Scout `Platform` types where available.

---

## Deals & Convert (sponsor URLs)

### Scout types - `lib/company-os/types.ts`

```typescript
// SponsorDeal - NO destination URL on deal itself
interface SponsorDeal {
  id: string;
  sponsorName: string;
  status: DealStatus; // pipeline | active | ...
  assignedTraderId: string | null;
  // ... fees, deliverables, wallets
}

// TrackingLink - THIS is where sponsor URLs live
interface TrackingLink {
  id: string;
  slug: string;           // public redirect /r/[slug]
  label: string;
  destinationUrl: string; // ← YTX SponsorBlock source
  traderId: string | null;
  exchangeSlug: ExchangeSlug | null;
  dealId: string | null;  // ← join key from ShowRun.dealId
  clicks: number;
}
```

### Scout API

| Method | Route | YTX use |
|--------|-------|---------|
| GET | `/api/deals` | List deals for ShowRun picker |
| GET | `/api/deals/[id]` | Deal detail + payment status |
| GET | `/api/tracking-links` | `?traderId=` optional filter |
| POST | `/api/tracking-links` | Ops creates links (not YTX) |
| GET | `/r/[slug]` | Public redirect + click count |
| POST | `/api/convert/attribute` | Cron attribution (don't call from YTX UI) |

**YTX Deals adapter logic:**
1. Read `ShowRun.dealId`
2. `GET /api/tracking-links` → filter `dealId`
3. Build `SponsorBlock`: `{ urls[], copy, requiresAd: true }`
4. Live URL check before go-live (task 2.1)

---

## Track (read-only analytics)

### Scout libs - `lib/track/`

| File | Capability | YTX use |
|------|------------|---------|
| `analytics.ts` | Leaderboards, ranked posts | Prior YT performance for SEO (task 1.1) |
| `ownedPull.ts` | ScrapeCreators pull YT/IG/TikTok | Fallback without OAuth |
| `sync.ts` | `runTrackSync()` | **Don't call from YTX** - cron only |
| `metrics.ts` | Normalize post metrics | 24hr views context |

### Scout API

| Method | Route | YTX use |
|--------|-------|---------|
| GET | `/api/track/dashboard` | Accounts, posts, snapshots, alerts |
| GET | `/api/track/accounts/[id]` | Channel-linked account detail |
| GET | `/api/track/posts/[id]/snapshots` | View history for a video |
| POST | `/api/track/sync` | **Don't call** - Scout cron |

**Link:** `YtChannel.trackAccountId` → Scout `accounts.id` where platform = YouTube owned account.

---

## YouTube utilities (Scout)

| File | Capability | YTX use |
|------|------------|---------|
| `lib/youtube/video.ts` | Parse video ID, thumbnail, `isYouTubeUrl()` | Port to YTX or duplicate (small) |
| `lib/social.ts` | `getYouTubeChannel`, `getYouTubeVideo`, `getYouTubeVideos` | Read-only until OAuth |
| `lib/bd-scout/scanSocial.ts` | `fetchYouTubeTranscript` | BD only - not primary path |

**ScrapeCreators:** configured via Scout Settings `scrapeCreatorsKey`. YTX can call Scout or hold own key.

---

## OAuth (pattern only - build in YTX)

Scout has **X OAuth**, not YouTube:

| File | Purpose |
|------|---------|
| `lib/track/xOAuth.ts` | PKCE, token refresh, authorize URL builder |
| `app/api/track/x/connect/route.ts` | Start OAuth |
| `app/api/track/x/callback/route.ts` | Exchange code, store tokens on account |

**YTX equivalent (greenfield):**
- `lib/youtubeOAuth.ts`
- `app/api/youtube/connect/route.ts`
- `app/api/youtube/callback/route.ts`
- Store tokens in YTX DB per `YtChannel`
- Scopes: metadata read/write, live broadcast stats (`concurrentViewers`)

---

## Studio (do not extend)

| File | Note |
|------|------|
| `lib/studio/constants.ts` | `CHENTO_STUDIO_CHANNEL_ID` - legacy |
| `lib/studio/youtubeSync.ts` | Studio item stats → Track |
| `app/api/studio/items/sync-youtube/route.ts` | Refresh views |
| `components/studio/StudioYouTube.tsx` | UI reference only |

YTX replaces show-lifecycle overlap over time. **Zero Scout changes for Studio.**

---

## Trader roster (reference data)

**Scout file:** `lib/company-os/traderRoster.ts`

| Slug | Display | X handle (when known) |
|------|---------|---------------------|
| chento | Chento | chentotrades |
| king-azoulay | King Azoulay | - |
| paladin | Paladin | - |
| dmitry | Dmitry | - |
| thomas | Thomas | tfxtradez |
| piltr | PILTR | nico_pltrs |
| madda | Madda | - |
| nick-scalps | Nick | - |
| yassin | Yassin | tagouguiy |

**Banter is NOT in this list.** YTX seeds Banter separately.

Helper: `traderIdFromSlug("chento")` → `trader_chento` (for TrackingLink `traderId` joins).

---

## Scout database tables (YTX does not write)

| Table | Relevant to YTX |
|-------|-----------------|
| `accounts` | Track account link on YtChannel |
| `posts` / `post_snapshots` | Read-only analytics |
| `content_drafts` | CrossPostQueue output lands here via adapter |
| `clip_sources` / `clip_source_moments` | Post-show pipeline |
| `sponsor_deals` | ShowRun deal picker |
| `tracking_links` | SponsorBlock URLs |
| `traders` | Roster cross-ref |
| `settings` | Shared API keys (via Scout only) |
| `studio_items` | **Ignore** |

YTX owns its own SQLite DB - separate file e.g. `data/ytx.db`.

---

## Scout Settings & credentials

| Credential | Scout storage | Used for |
|------------|---------------|----------|
| `scrapeCreatorsKey` | Settings | YT/TikTok/IG metadata |
| `xApiClientId` + `xApiClientSecret` | Settings | X OAuth (pattern for YTX Google OAuth) |
| `deepseekApiKey` | Settings | AI copy (SEO, social, moments) |
| `OPENAI_API_KEY` | env | Whisper |
| `AUTH_SESSION_SECRET` | env | Scout auth (not shared with YTX unless SSO) |
| `FLOWX_DATA_DIR` | env | Scout SQLite path |

---

## Scout API surface (full list - 123 routes)

YTX touches **~15 routes**. Full inventory for reference:

**YTX-relevant (primary):**
- `/api/clips/sources`, `/api/clips/sources/[id]/analyze`, `/api/clips/sources/[id]/moments`, `/api/clips/moments/[momentId]/export`, `/api/clips/sources/import/*`
- `/api/content/generate-platform`, `/api/content/drafts/[id]`, `/api/content/dashboard`
- `/api/deals`, `/api/deals/[id]`, `/api/tracking-links`
- `/api/track/dashboard`, `/api/track/accounts/[id]`, `/api/track/posts/[id]/snapshots`
- `/r/[slug]` (public)

**Not used by YTX:** signal, trader-desk, scout, bd-scout, convert cron, exchange, studio, plan, admin, auth (except integration key pattern).

---

## What Scout cannot do today (YTX must own)

| Capability | Gap |
|------------|-----|
| YouTube OAuth | Greenfield in YTX |
| Live `concurrentViewers` | YT Data API + OAuth in YTX |
| Waiting room baseline | YTX ShowAnalytics |
| ShowRun / checklist lifecycle | YTX entirely |
| EndScreenDB video graph | YTX entirely |
| Channel description/tags write | YTX OAuth → YT API |
| YT Community native publish | Manual Assist or future API |
| Banter show entity | YTX roster only |

---

## Adapter implementation sketch (YTX side)

```typescript
// lib/adapters/scout/clips.ts
const SCOUT = process.env.FLOWX_SCOUT_URL!;
const KEY = process.env.FLOWX_SCOUT_SERVICE_KEY!;

export async function importShowVideo(youtubeUrl: string) {
  const res = await fetch(`${SCOUT}/api/clips/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ youtubeUrl }),
  });
  return res.json();
}
```

**Note:** Scout may need a thin **service auth middleware** added for server-to-server calls - track as Scout-side prerequisite (see PREREQS.md §5).
