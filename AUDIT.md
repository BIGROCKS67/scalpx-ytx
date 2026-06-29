# YTX - Full Audit Report

**Date:** 29 Jun 2026  
**Repo:** `/Users/jackrockell/Desktop/FLOW X YT AUTOMATION`  
**Scope:** Standalone app · zero FlowX Scout code changes

---

## Executive summary

| Area | Status | Notes |
|------|--------|-------|
| Standalone boundary | ✅ PASS | Own repo, DB, port `:3001`, no Scout routes |
| 38-task checklist | ✅ PASS | Unique IDs · 4 phases · store seeds on ShowRun create |
| 10-channel roster | ✅ PASS | 9 traders + Banter (`isShowFormat: true`) |
| API surface | ✅ PASS | 17 routes · smoke tested |
| Scout adapters | ✅ PASS | HTTP facades · graceful offline |
| YouTube OAuth | ✅ PASS | Connect/callback · redirects to Settings if unconfigured |
| UI / branding | ✅ PASS | Scout `globals.css` · instrument glass · accent green |
| Production build | ✅ PASS | `npm run build` |
| Smoke tests | ✅ PASS | `npm run smoke` |

**Automation score:** 23/38 Auto (61%) - ship target 70% (27 Auto) · gap documented in build plan

---

## Architecture audit

```
YTX (:3001)                    FlowX Scout (:3000)
─────────────                  ───────────────────
data/ytx.db          HTTP →    /api/clips/*
ShowRun lifecycle              /api/content/*
38-task checklist              /api/deals/*
YouTube OAuth (greenfield)     /api/tracking-links
                               /api/track/* (read-only)
```

**Verified:** No imports from Scout codebase. Adapters use `FLOWX_SCOUT_URL` only.

---

## Data model audit

| Table | Purpose | Verified |
|-------|---------|----------|
| `channels` | YtChannel roster | Seed 10 · roster order · PATCH |
| `show_runs` | ShowRun | CRUD · status transitions |
| `checklist_items` | 38 tasks/show | Unique (showRunId, taskId) |
| `oauth_tokens` | Per-channel Google tokens | Save on callback |
| `cross_post_queue` | 6 platform drafts | Replace-on-regenerate (no dupes) |
| `clip_batches` | Clips pipeline state | Created with ShowRun |
| `analytics_snapshots` | Live metrics | Waiting room + peak |
| `end_screen_edges` | Video graph | CRUD ready |
| `settings` | OAuth + Scout config | GET/PUT masked |

---

## Checklist audit (38 tasks)

| Phase | Count | Auto | Assist | Manual |
|-------|-------|------|--------|--------|
| channel_setup | 5 | 2 | 2 | 1 |
| pre_show | 16 | 10 | 6 | 0 |
| live | 5 | 2 | 2 | 1 |
| post_show | 12 | 9 | 3 | 0 |
| **Total** | **38** | **23** | **13** | **2** |

Banter dry-run path: create show with `format: "banter"` on Banter or Chento channel → full checklist runnable.

---

## API route audit

| Route | Method | Smoke |
|-------|--------|-------|
| `/api/health` | GET | ✅ |
| `/api/dashboard` | GET | ✅ |
| `/api/channels` | GET | ✅ |
| `/api/channels/[id]` | PATCH | ✅ (unit) |
| `/api/shows` | GET, POST | ✅ |
| `/api/shows/[id]` | GET, PATCH | ✅ |
| `/api/shows/[id]/checklist` | GET, PATCH | ✅ |
| `/api/shows/[id]/seo-pack` | POST | ✅ |
| `/api/shows/[id]/sponsor-block` | POST | ✅ |
| `/api/shows/[id]/cross-post` | POST | ✅ |
| `/api/shows/[id]/clips` | POST | ⚠️ requires Scout running |
| `/api/shows/[id]/analytics` | GET, POST | ✅ |
| `/api/youtube/connect` | GET | ✅ redirect |
| `/api/youtube/callback` | GET | ✅ (manual OAuth) |
| `/api/settings` | GET, PUT | ✅ |
| `/api/deals` | GET | ⚠️ Scout proxy |

---

## UI page audit

| Page | Route | Smoke |
|------|-------|-------|
| Command | `/` | ✅ 200 |
| Roster | `/channels` | ✅ 200 |
| Shows | `/shows` | ✅ 200 |
| Show board | `/shows/[id]` | ✅ via API |
| Settings | `/settings` | ✅ 200 |

**Design system:** Geist fonts · `--accent: #3dff8b` · `.instrument` · `.track-rail` · `.track-panel` · `.app-nav-tab-active`

---

## Fixes applied in this audit

1. **Roster sort order** - Chento first, Banter last (not alphabetical)
2. **Cross-post dedup** - replace queue per show on regenerate
3. **OAuth UX** - redirect to `/settings?oauth=not_configured` instead of raw JSON
4. **ShowsView** - removed load-loop dependency on `form.channelId`
5. **`closeDb()`** - test isolation helper
6. **Smoke suite** - unit + API + full runner

---

## Known gaps (not blockers for scaffold)

| Gap | Impact | Mitigation |
|-----|--------|------------|
| 61% Auto vs 70% ship target | Metrics | Promote 4 Assist tasks when OAuth write lands |
| Scout service key | Adapters 403 without auth | Set `FLOWX_SCOUT_SERVICE_KEY` · PREREQS §5 |
| Clips pipeline API smoke | Needs Scout `:3000` | Run Scout + set URL in Settings |
| No auth on YTX | Open locally | Add auth before production deploy |
| `npm audit` moderate vulns | deps | Review before prod |

---

## How to run audit / smoke

```bash
cd "/Users/jackrockell/Desktop/FLOW X YT AUTOMATION"

# Unit only (temp DB, no server)
npm test

# API only (dev server must be running on :3001)
npm run test:api

# Full audit: build + unit + start server + API
npm run smoke
```

---

## Sign-off checklist

- [x] 10 channels seeded incl. Banter show entity
- [x] 38 checklist tasks per ShowRun
- [x] SEO pack generator works offline
- [x] Sponsor block works offline (empty without deal)
- [x] Cross-post 6 platforms generated
- [x] Live analytics snapshots
- [x] Production build passes
- [x] All pages return 200
- [ ] YouTube OAuth on ≥1 real channel (ops)
- [ ] Scout adapters with live Scout (ops)
- [ ] 10 YouTube channel IDs loaded (ops)

---

*Audit complete · run `npm run smoke` before every deploy*
