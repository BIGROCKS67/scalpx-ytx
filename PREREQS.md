# YTX prereqs - clear by 29 Jun 2026

Ops must complete these before engineering can ship on **3 Jul**. Engineering stubs with seed data until IDs arrive.

## 1. YouTube channel IDs (10 entities)

Collect **`youtubeChannelId`** (UC…) for each row:

| Slug | Display | Notes |
|------|---------|-------|
| chento | Chento Trades | Banter · education · stream |
| thomas | Thomas | |
| king-azoulay | King Azoulay | |
| paladin | Paladin | |
| dmitry | Dmitry | |
| piltr | PILTR | |
| madda | Madda | |
| nick-scalps | Nick | |
| yassin | Yassin | |
| **banter** | Banter | **Show format only** - not in Scout trader roster |

**Owner:** Jack + Victoria  
**Engineering:** seed into YTX `channels` table on first deploy

## 2. Google Cloud / YouTube OAuth (YTX app)

- Create GCP project + OAuth consent screen
- Enable **YouTube Data API v3**
- OAuth client (web) redirect URI: `{YTX_APP_URL}/api/youtube/callback`
- Store in YTX env / settings:
  - `YTX_GOOGLE_CLIENT_ID`
  - `YTX_GOOGLE_CLIENT_SECRET`
- Scopes (minimum): `youtube.readonly`, `youtube.force-ssl` (metadata write); add `youtube.upload` if auto-upload later

**Scout today:** X OAuth only (`lib/track/xOAuth.ts`) - use as **pattern reference**, build fresh in YTX.

## 3. TrackingLinks per active sponsor deal (Scout)

For each live sponsor deal used on shows:

- Create `TrackingLink` row in **Scout** with `dealId`, `destinationUrl`, optional `traderId`
- YTX Deals adapter reads sponsor block from Scout - **not** from a URL field on `SponsorDeal`

**Scout API:** `GET /api/tracking-links` · redirect `GET /r/[slug]`

## 4. API keys (Scout Settings - used via adapters)

| Key | Scout location | YTX use |
|-----|----------------|---------|
| `scrapeCreatorsKey` | Scout Settings | YT metadata read fallback via Scout (or duplicate key in YTX) |
| `OPENAI_API_KEY` | env | Whisper in Clips pipeline (Scout adapter) |
| `deepseekApiKey` | Scout Settings | SEO copy, moment AI (YTX native + Scout Content adapter) |

## 5. Scout ↔ YTX integration auth

Decide before Day 3:

- [ ] **Option A:** Service API key on Scout (`YTX_SERVICE_KEY`) for server-to-server adapter calls
- [ ] **Option B:** Same-domain cookie forwarding (only if YTX deployed on subdomain with shared auth)
- [ ] **Option C:** Duplicate minimal read endpoints on Scout with cron-scoped keys

**Recommended for ship:** Option A - single env `FLOWX_SCOUT_URL` + `FLOWX_SCOUT_SERVICE_KEY` in YTX.

## 6. Banter entity

- YTX-only `YtChannel` slug `banter`
- ShowRun format: `banter` | `stream` | `education`
- **Never** add Banter to Scout `lib/company-os/traderRoster.ts`

## Sign-off

- [ ] All 10 YouTube channel IDs collected
- [ ] GCP OAuth app created + creds in YTX
- [ ] Active deal TrackingLinks loaded in Scout
- [ ] Banter confirmed as show entity (not trader roster entry)
- [ ] Scout service key / integration auth agreed
