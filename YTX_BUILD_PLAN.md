# YTX - Master Build Plan

**ScalpX · Standalone Product · Build #1 · Roadmap p.26**

| Field | Value |
|-------|-------|
| Product | YTX - YouTube lifecycle ops for the conglomerate |
| Repo | `/Users/jackrockell/Desktop/FLOW X YT AUTOMATION` |
| Upstream toolkit | `/Users/jackrockell/Desktop/FLOWX SCOUT` (adapters only) |
| Deadline | **3 July 2026** |
| Channels | 10 (9 traders + Banter show entity) |
| Checklist | 38 tasks · 4 phases |
| Automation target | **70% Auto** by ship (~27 tasks) |
| Reusable from Scout | ~15% capability |
| Product built today | **0%** (greenfield) |

---

## 1. Product definition

### What YTX is

One **show-lifecycle engine** for every YouTube channel in the conglomerate:

```
Channel setup → Pre-show → Live → Post-show
```

Same checklist for **Chento Trades**, **Banter**, and all 9 traders. Ops pick a roster channel, create a ShowRun, run 38 tasks through four phases. **70% automated** by 3 Jul; remainder = **Assist** (templates + human approve) or **Manual** (checklist reminders).

### What YTX is NOT

| Not this | Why |
|----------|-----|
| A route inside FlowX Scout | User decision: **totally separate app** |
| An extension of `/studio` | Studio = legacy kanban; zero Scout changes |
| Bolted onto Clips/Content dashboards | YTX **calls** Scout via HTTP adapters |
| Banter in Scout `traderRoster.ts` | Banter = show-format `YtChannel` in YTX only |
| Sponsor URL on `SponsorDeal` | URLs live on Scout `TrackingLink` via `dealId` |

### End-to-end loop (ships 3 Jul)

```
YTX ShowRun
  → Deals adapter (sponsor URLs + #ad)
  → Content adapter (pre-show cross-post)
  → Live ops (OAuth · waiting room · peak viewers)
  → Clips adapter (Shorts + X moments)
  → Track adapter (performance read-back)
  → Convert (optional · tracked link attribution)
```

---

## 2. Architecture

### System boundary

```
┌──────────────────────────────────────────────────────────────┐
│  YTX APP (FLOW X YT AUTOMATION)                              │
│  Own: UI · auth · SQLite · OAuth · ShowRun · Checklist       │
│  Own: EndScreenDB · ShowAnalytics · SEO pack · Live ops      │
│  Route: / (standalone) · API: /api/*                         │
└────────────┬────────────┬────────────┬────────────┬───────────┘
             │ HTTP       │ HTTP       │ HTTP       │ HTTP
             ▼            ▼            ▼            ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
      │  Clips   │ │ Content  │ │  Deals   │ │  Track   │
      │  Scout   │ │  Scout   │ │  Scout   │ │  Scout   │
      └──────────┘ └──────────┘ └──────────┘ └──────────┘
             FlowX Scout - unchanged product surface
```

### Own vs reuse

| Layer | Owner | Notes |
|-------|-------|-------|
| App shell + nav | **YTX** | No Scout nav/auth sections |
| SQLite schema | **YTX** | `data/ytx.db` - not `flowx.db` |
| YouTube OAuth | **YTX** | Greenfield; Scout X OAuth = pattern only |
| YtChannel roster | **YTX** | 10 entities incl. Banter |
| ShowRun + checklist | **YTX** | 38 tasks, phase state machine |
| EndScreenDB | **YTX** | Video graph table |
| ShowAnalytics | **YTX** | Waiting room, peak, 24hr views |
| SEO pack generator | **YTX** | DeepSeek + prior YT data |
| Clips pipeline | **Scout** | yt-dlp · Whisper · ffmpeg · Shorts |
| Content drafts | **Scout** | `generatePlatformDrafts` |
| TrackingLinks | **Scout** | Sponsor URLs by `dealId` |
| Track metrics | **Scout** | Read-only dashboard API |
| Studio | **Scout** | Untouched |

---

## 3. Core data model (YTX-owned)

### Entities

| Entity | Stores | Table |
|--------|--------|-------|
| **YtChannel** | slug, displayName, youtubeChannelId, trackAccountId, descriptionTemplate, tags[], socialLinks{}, showFormats[], isShowFormat | `channels` |
| **ShowRun** | channelId, title, format, scheduledAt, guestName, dealId, youtubeVideoId, youtubeBroadcastId, status, seoTitle/Description/Tags | `show_runs` |
| **ChecklistItem** | showRunId, taskId, phase, status, mode, completedAt, notes | `checklist_items` |
| **OAuthToken** | channelId, accessToken, refreshToken, expiresAt, scopes[] | `oauth_tokens` |
| **CrossPostItem** | showRunId, platform, draftId (Scout ref), status, scheduledFor | `cross_post_queue` |
| **ClipBatch** | showRunId, clipSourceId (Scout ref), momentIds[], exportUrls[] | `clip_batches` |
| **EndScreenEdge** | fromVideoId, toVideoId, weight | `end_screen_edges` |
| **AnalyticsSnapshot** | showRunId, type, concurrentViewers, views24h, metadata | `analytics_snapshots` |

### Derived (not persisted as primary)

| Entity | Source |
|--------|--------|
| **SponsorBlock** | Deals adapter at runtime from Scout TrackingLinks |
| **SeoPack** | Generated on demand; cached on ShowRun fields |

### ShowRun formats

`banter` | `stream` | `education`

### ShowRun status

`draft` → `scheduled` → `live` → `completed`

### Checklist task status

`pending` → `in_progress` → `done` | `skipped`

---

## 4. Channel roster (10 entities)

| Slug | Display | Show formats | Type |
|------|---------|--------------|------|
| chento | Chento Trades | banter · education · stream | Trader |
| thomas | Thomas | stream · clips | Trader |
| king-azoulay | King Azoulay | stream | Trader |
| paladin | Paladin | stream | Trader |
| dmitry | Dmitry | stream | Trader |
| piltr | PILTR | stream | Trader |
| madda | Madda | stream | Trader |
| nick-scalps | Nick | stream | Trader |
| yassin | Yassin | stream | Trader |
| **banter** | Banter | banter · live talk · guests | **Show format entity** |

Seed from Scout trader roster data + Banter row. `youtubeChannelId` null until ops delivers (PREREQS.md).

---

## 5. Full checklist - 38 tasks → build map

**Legend:** Auto = YTX handles by 3 Jul · Assist = UI + templates · Manual = human judgment

### Phase: Channel setup (5 tasks)

| ID | Task | Mode | YTX build |
|----|------|------|-----------|
| 3.2 | Channel description | Auto | AI from roster template · editable · OAuth write |
| 3.1 | Channel tags | Auto | Generated from description · stored on YtChannel |
| 3.3 | Link social accounts | Assist | Roster stores X · IG · TG · Discord links |
| oauth | Connect YouTube OAuth | Assist | Per-channel connect flow |
| 1.5 | Channel trailer | Manual | Checklist reminder → YT Studio |

### Phase: Pre-show (16 tasks)

| ID | Task | Mode | YTX build |
|----|------|------|-----------|
| 1.1 | SEO title options | Auto | 3 options · prior YT data + brief |
| ab-thumb | A/B thumbnail variants | Assist | Variants on ShowRun · pre-live reminder |
| 1.2 | Video description | Auto | SEO pack · ~3 sentences · keywords |
| 2.1 | Sponsor links | Auto | Deals adapter · live URL check · #ad |
| 1.3 | Show tags (10–15) | Auto | Tag suggest from brief |
| 1.4 | Playlists | Assist | Checklist + playlist IDs on channel |
| 3.5 | Collab / guest | Assist | Guest fields → description block |
| 1.6 | Upload settings | Assist | Pre-flight checklist UI |
| 3.4 | Thumbnail brief | Assist | Export brief doc from ShowRun |
| social-yt | Pre-show · YouTube Community | Auto | CrossPostQueue → Content adapter |
| social-x | Pre-show · X | Auto | CrossPostQueue → Content adapter |
| social-ig | Pre-show · Instagram | Auto | CrossPostQueue → Content adapter |
| social-fb | Pre-show · Facebook | Auto | CrossPostQueue → Content adapter |
| social-reddit | Pre-show · Reddit | Auto | CrossPostQueue → Content adapter |
| social-tg | Pre-show · Telegram | Auto | CrossPostQueue → Content adapter |
| 1.11 | Waiting room baseline | Auto | YT API snapshot · OAuth · alert vs avg |

### Phase: Live (5 tasks)

| ID | Task | Mode | YTX build |
|----|------|------|-----------|
| 1.12 | Live SEO timestamps | Assist | Chapter paste helper · keyword templates |
| 1.13 | Update links live | Assist | Description patch log on ShowRun |
| 2.3 | Post value live | Manual | Checklist · optional Content quick-post |
| 3.7 | Peak live viewers | Auto | `concurrentViewers` log · OAuth + broadcast ID |
| 1.14 | Peak moments / topics | Auto | Spike log → Clips moment detect |

### Phase: Post-show (12 tasks)

| ID | Task | Mode | YTX build |
|----|------|------|-----------|
| 1.15 | A/B title & thumbnail | Assist | +48h reminder · YT Studio link |
| 1.16 | Tags cleanup | Auto | Post-show SEO pass from transcript |
| 1.17 | Timestamps cleanup | Auto | Post-show SEO pass from transcript |
| 1.18 | End screens & cards | Auto | EndScreenDB · suggest related videos |
| 1.19 | Transcript translate | Auto | Download · clean · multi-lang captions |
| 1.20 | Transcript → description | Auto | Keyword enrich + chapter accuracy |
| 3.8 | Tag guests / partners | Assist | Auto from ShowRun guest fields |
| 1.21 | End-screen bucket | Auto | Log to EndScreenDB graph |
| 1.22 | Comment replies | Assist | Queue + AI draft · human approve |
| 2.4 | IG carousels | Assist | Transcript → Content adapter draft |
| 1.23 | X clips | Auto | 2–3 moments · Clips adapter |
| 1.24 | YT Shorts (3–5) | Auto | Clips adapter · `format: "shorts"` |

### Automation scorecard

| Mode | Count | % |
|------|-------|---|
| Auto | 24 | 63% |
| Assist | 13 | 34% |
| Manual | 2 | 5% |

**Ship target 70% Auto** = automate 27 tasks. Gap of **3 Auto tasks** to close by 3 Jul (candidates: promote Assist → Auto where OAuth unlocks write paths: 3.3 social link sync, 1.4 playlists, 3.4 thumbnail brief generation).

---

## 6. Adapters (YTX → Scout HTTP)

See **`SCOUT_INVENTORY.md`** for full endpoint reference.

### Deals adapter

| | |
|---|---|
| **Input** | `ShowRun.dealId` |
| **Scout calls** | `GET /api/deals/[id]`, `GET /api/tracking-links` (filter dealId) |
| **Output** | `SponsorBlock { urls[], copy, requiresAd, linkHealth[] }` |
| **Tasks** | 2.1 |
| **Rule** | Never read URL from SponsorDeal directly |

### Content adapter

| | |
|---|---|
| **Input** | ShowRun metadata + CrossPostQueue platforms |
| **Scout calls** | `POST /api/content/generate-platform`, `PATCH /api/content/drafts/[id]` |
| **Output** | Draft IDs stored on CrossPostItem |
| **Tasks** | 1.7–3.6 (6 platforms), 2.3 optional, 2.4 |
| **Schedule** | T-60min before `ShowRun.scheduledAt` |

### Clips adapter

| | |
|---|---|
| **Input** | ShowRun YouTube URL or VOD ID post-live |
| **Scout calls** | `POST /api/clips/sources`, analyze, moments, export |
| **Output** | ClipBatch with 3–5 Shorts URLs + 2–3 X moments |
| **Tasks** | 1.14, 1.19–1.24 |
| **Export** | `format: "shorts"` always for 1.24 |

### Track adapter (read-only)

| | |
|---|---|
| **Input** | `YtChannel.trackAccountId` or youtubeVideoId |
| **Scout calls** | `GET /api/track/dashboard`, `GET /api/track/accounts/[id]` |
| **Output** | Prior performance context for SEO pack |
| **Tasks** | 1.1 context, post-show analytics comparison |
| **Rule** | Never call `/api/track/sync` from YTX |

### Convert (optional)

Use TrackingLink slugs in descriptions. Scout `/r/[slug]` handles clicks. No YTX write to Convert.

---

## 7. YouTube OAuth (YTX greenfield)

| Item | Detail |
|------|--------|
| Pattern reference | Scout `lib/track/xOAuth.ts` (PKCE, refresh, state) |
| Provider | Google OAuth 2.0 · YouTube Data API v3 |
| Scopes | `youtube.readonly`, `youtube.force-ssl`; optional `youtube.upload` |
| Storage | YTX `oauth_tokens` per channel |
| Routes | `/api/youtube/connect`, `/api/youtube/callback` |
| Settings | `YTX_GOOGLE_CLIENT_ID`, `YTX_GOOGLE_CLIENT_SECRET` |
| Fallback read | ScrapeCreators (Scout key or YTX duplicate) until OAuth connected |

### OAuth unlocks

- Channel description/tags write (3.1, 3.2)
- Waiting room + peak viewers (1.11, 3.7)
- Metadata patch during live (1.13)
- Optional caption upload (1.19)

---

## 8. YTX API surface

```
GET/POST   /api/channels              Roster list · seed
PATCH      /api/channels/[id]         Update youtubeChannelId, social, template

GET/POST   /api/shows                 List · create ShowRun + checklist seed
GET/PATCH  /api/shows/[id]            Show detail · status transitions
GET/PATCH  /api/shows/[id]/checklist  Task status updates

POST       /api/shows/[id]/seo-pack           Generate title/desc/tags
POST       /api/shows/[id]/sponsor-block      → Deals adapter
POST       /api/shows/[id]/cross-post         → Content adapter
POST       /api/shows/[id]/cross-post/schedule
POST       /api/shows/[id]/clips/import      → Clips adapter start
POST       /api/shows/[id]/clips/export       → Shorts batch
GET        /api/shows/[id]/analytics         Snapshots + live poll

GET        /api/youtube/connect?channelId=
GET        /api/youtube/callback

GET        /api/end-screen/suggest?videoId=
POST       /api/end-screen/edges

GET        /api/health
GET        /api/settings                      OAuth creds (masked)
```

---

## 9. YTX file tree (greenfield)

```
FLOW X YT AUTOMATION/
├── README.md
├── YTX_BUILD_PLAN.md          ← this doc
├── SCOUT_INVENTORY.md
├── PREREQS.md
├── package.json
├── app/
│   ├── layout.tsx
│   ├── page.tsx               → dashboard redirect
│   ├── channels/page.tsx
│   ├── shows/page.tsx
│   ├── shows/[id]/page.tsx    → show board + checklist + live ops
│   └── api/                   → routes from §8
├── components/
│   ├── shell/YtxShell.tsx
│   ├── roster/ChannelRoster.tsx
│   ├── shows/ShowBoard.tsx
│   ├── shows/ShowChecklist.tsx
│   ├── shows/LiveOpsPanel.tsx
│   ├── shows/SeoPackPanel.tsx
│   ├── shows/SponsorBlockPanel.tsx
│   ├── shows/CrossPostPanel.tsx
│   ├── shows/ClipsPipelinePanel.tsx
│   └── shows/PostShowPanel.tsx
├── lib/
│   ├── db.ts                  → SQLite init (ytx.db)
│   ├── types.ts
│   ├── store/
│   │   ├── channels.ts
│   │   ├── shows.ts
│   │   ├── checklist.ts
│   │   ├── analytics.ts
│   │   └── endScreen.ts
│   ├── checklistTasks.ts      → 38 task defs
│   ├── seoPack.ts
│   ├── youtubeOAuth.ts
│   ├── youtubeApi.ts          → Data API client
│   ├── adapters/
│   │   ├── scoutClient.ts     → base HTTP + service key
│   │   ├── deals.ts
│   │   ├── content.ts
│   │   ├── clips.ts
│   │   └── track.ts
│   └── rosterSeed.ts
└── tests/
    ├── checklist.test.ts
    ├── store.test.ts
    └── adapters.test.ts
```

---

## 10. Six-day sprint (28 Jun → 3 Jul 2026)

### Day 1 · Scaffold (28 Jun)

| # | Work item | Deliverable |
|---|-----------|-------------|
| 1.1 | Init Next.js 16 app in FLOW X YT AUTOMATION | `npm run dev` works |
| 1.2 | SQLite schema + store layer | All tables from §3 |
| 1.3 | Types + `checklistTasks.ts` (38 tasks) | Task defs + mode counts |
| 1.4 | Roster seed (10 channels) | Banter as show entity |
| 1.5 | App shell + ChannelRoster UI | Standalone nav, no Scout |
| 1.6 | `GET /api/channels` | Auto-seed on first load |

**Exit:** Roster visible · DB persists · zero Scout file changes

### Day 2 · ShowRun + OAuth foundation (29 Jun)

| # | Work item | Deliverable |
|---|-----------|-------------|
| 2.1 | ShowRun CRUD + checklist seed on create | 38 items per show |
| 2.2 | ShowBoard + ShowChecklist UI | Phase tabs · status toggles |
| 2.3 | YouTube OAuth connect/callback | Token per channel |
| 2.4 | Settings page for Google client creds | Env + UI |
| 2.5 | Ops: 10 channel IDs loaded | Patch roster PATCH API |

**Exit:** Create show · see checklist · OAuth on ≥1 test channel

**Ops gate:** PREREQS §1–2 due 29 Jun

### Day 3 · Pre-show automation (30 Jun)

| # | Work item | Deliverable |
|---|-----------|-------------|
| 3.1 | SEO pack generator (`seoPack.ts`) | Tasks 1.1, 1.2, 1.3 |
| 3.2 | Channel description/tags Auto (3.1, 3.2) | OAuth write or Assist fallback |
| 3.3 | **Deals adapter** + SponsorBlockPanel | Task 2.1 · URL health check |
| 3.4 | Scout service auth (if needed) | `FLOWX_SCOUT_SERVICE_KEY` |
| 3.5 | Thumbnail brief export (Assist 3.4) | PDF/markdown from ShowRun |

**Exit:** Pick deal → sponsor block renders · SEO pack generates

**Ops gate:** TrackingLinks loaded (PREREQS §3)

### Day 4 · Cross-post + live ops (1 Jul)

| # | Work item | Deliverable |
|---|-----------|-------------|
| 4.1 | **Content adapter** + CrossPostPanel | 6 platform drafts |
| 4.2 | T-60min scheduler (cron or queued job) | Tasks social-* |
| 4.3 | LiveOpsPanel · chapter helper | Tasks 1.12, 1.13 |
| 4.4 | Waiting room snapshot (1.11) | AnalyticsSnapshot |
| 4.5 | Peak viewer polling (3.7) | concurrentViewers log |

**Exit:** Pre-show drafts created in Scout · live panel logs peaks

### Day 5 · Post-show pipeline (2 Jul)

| # | Work item | Deliverable |
|---|-----------|-------------|
| 5.1 | **Clips adapter** one-click import | POST show URL → Scout source |
| 5.2 | Moment detect + Shorts export batch | Tasks 1.23, 1.24 |
| 5.3 | Transcript pipeline hooks | Tasks 1.19, 1.20, 1.16, 1.17 |
| 5.4 | EndScreenDB v1 | Tasks 1.18, 1.21 |
| 5.5 | Post-show panels | A/B reminder 1.15 · comment queue 1.22 |

**Exit:** Post-show → 3–5 Shorts in export queue · EndScreen suggestions

### Day 6 · Ship (3 Jul)

| # | Work item | Deliverable |
|---|-----------|-------------|
| 6.1 | All 10 channels runnable (stub IDs OK) | Roster complete |
| 6.2 | **Banter dry-run** full checklist | End-to-end sign-off |
| 6.3 | Adapter smoke tests | deals · content · clips · track |
| 6.4 | Auto task counter ≥ 27/38 (70%) | Scorecard |
| 6.5 | Deploy YTX app | Production URL |
| 6.6 | OAuth on ≥1 production channel | Live criteria |

**Exit = LIVE:** criteria in §12

---

## 11. Work breakdown structure (WBS)

| ID | Epic | Tasks | Owner |
|----|------|-------|-------|
| E1 | App foundation | 1.1–1.6 | Eng |
| E2 | Show lifecycle core | 2.1–2.2, ShowBoard, checklist state | Eng |
| E3 | YouTube OAuth + API | 2.3–2.4, youtubeApi.ts | Eng |
| E4 | Pre-show automation | 3.1–3.5, seoPack, sponsor | Eng |
| E5 | Scout Deals adapter | 3.3, scoutClient, service auth | Eng + Scout thin PR |
| E6 | Scout Content adapter | 4.1–4.2, CrossPostQueue | Eng |
| E7 | Live operations | 4.3–4.5, LiveOpsPanel | Eng |
| E8 | Scout Clips adapter | 5.1–5.2, ClipBatch | Eng |
| E9 | Post-show + EndScreen | 5.3–5.5 | Eng |
| E10 | Scout Track adapter | Read-only context | Eng |
| E11 | QA + Banter dry-run | 6.1–6.4 | Eng + Ops |
| E12 | Deploy + sign-off | 6.5–6.6 | Eng + Ops |
| E13 | Ops prereqs | Channel IDs, OAuth creds, TrackingLinks | Ops |

**Total engineering work items:** ~45 discrete tasks across 6 days.

---

## 12. Ship criteria (3 Jul - done = live)

- [ ] YTX app deployed (standalone URL)
- [ ] 10-channel roster seeded · Banter as show entity
- [ ] Full ShowChecklist (38 tasks) runnable per ShowRun
- [ ] YouTube OAuth connected on ≥1 channel
- [ ] Sponsor block via Scout TrackingLink + Deals adapter
- [ ] Post-show → Clips one-click · 3–5 Shorts export
- [ ] Pre-show cross-post via Content adapter (6 platforms)
- [ ] Live analytics on show day (waiting room + peak viewers)
- [ ] Banter dry-run passed end-to-end
- [ ] Zero dependency on Scout `/studio`
- [ ] Zero routes added to Scout codebase
- [ ] **≥70% of 38 tasks** marked Auto and functioning

---

## 13. Environment & credentials

### YTX app env

| Variable | Purpose |
|----------|---------|
| `YTX_DATA_DIR` | SQLite path (default `data/ytx.db`) |
| `YTX_GOOGLE_CLIENT_ID` | YouTube OAuth |
| `YTX_GOOGLE_CLIENT_SECRET` | YouTube OAuth |
| `YTX_APP_URL` | OAuth redirect base |
| `FLOWX_SCOUT_URL` | Scout base for adapters |
| `FLOWX_SCOUT_SERVICE_KEY` | Server-to-server auth |
| `DEEPSEEK_API_KEY` | SEO pack, comment drafts |
| `OPENAI_API_KEY` | Optional if not using Scout Whisper |

### Scout env (unchanged - adapters consume)

| Variable | Purpose |
|----------|---------|
| `scrapeCreatorsKey` | YT metadata fallback |
| `deepseekApiKey` | Content adapter AI |
| `OPENAI_API_KEY` | Clips Whisper |

---

## 14. Testing plan

| Layer | Tests |
|-------|-------|
| Unit | `checklistTasks` count/modes · store CRUD · seoPack output shape |
| Adapter | Mock Scout responses · dealId → sponsor URLs · clips export format |
| Integration | One ShowRun draft → checklist seed → phase transitions |
| OAuth | Connect/callback/token refresh on test channel |
| Smoke | Banter dry-run all 38 tasks touched |
| E2E | Pre-show SEO + sponsor + cross-post + live poll + clips export |

**Framework:** Vitest (match Scout `tests/` pattern)

---

## 15. Out of scope (3 Jul)

- Extending Scout `/studio` or adding `/ytx` to Scout
- Native YouTube video upload/scheduling (draft/approve OK; auto-upload stretch)
- CRM / Kralow funnel (parallel · Aug gate)
- HyperflowX · aggregated exchange (Phase 3–4)
- Shared auth SSO between Scout and YTX (unless explicitly added later)
- Merging YTX nav into Scout top bar

---

## 16. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ops misses channel IDs by 29 Jun | Roster incomplete | Seed null IDs · PATCH when arrive |
| GCP OAuth approval delay | Blocks live tasks | ScrapeCreators read fallback · Assist mode |
| Scout has no service API key | Adapters fail auth | Add thin middleware PR to Scout (PREREQS §5) |
| YouTube API quota | Peak/waiting room fails | Quota plan · cache snapshots · poll interval |
| Clips import timeout on long VOD | Post-show blocked | Async import job polling (Scout supports) |
| 70% Auto not reached | Miss ship metric | Promote 3 Assist tasks with OAuth write paths |

---

## 17. Current status

| Item | Status |
|------|--------|
| YTX standalone repo | **Plan docs only** - no app code yet |
| Scout `/ytx` routes | **Removed / never shipped** (correct) |
| Scout reusable libs | **Ready** - see SCOUT_INVENTORY.md |
| Ops prereqs | **Pending** - see PREREQS.md |
| Day 1 scaffold | **Not started** in FLOW X YT AUTOMATION |

### Next action

1. Confirm Scout service-key approach (PREREQS §5)
2. Init Next.js app in FLOW X YT AUTOMATION
3. Execute Day 1 WBS (§10)

---

## 18. Related documents

| Doc | Location |
|-----|----------|
| Scout inventory (reuse map) | `SCOUT_INVENTORY.md` |
| Ops prereqs | `PREREQS.md` |
| Original handoff (repo path outdated) | `/Users/jackrockell/Desktop/YTX AGENT HANDOFF/` |
| Build spec HTML | `YTX AGENT HANDOFF/docs/SCALPX_YTX_BUILD_SPEC.html` |
| Roadmap HTML | `YTX AGENT HANDOFF/docs/FLOWX_ROADMAP.html` (p.26) |

---

*ScalpX · YTX · Standalone · Ship 3 Jul 2026 · 38 tasks · 10 channels · 70% Auto · Build #1*
