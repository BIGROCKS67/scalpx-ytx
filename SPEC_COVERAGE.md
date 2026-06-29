# YTX vs Build Spec - coverage (DK handoff · 29 Jun 2026)

**Demo:** https://scalpx-ytx.vercel.app/ytx  
**Repo:** https://github.com/BIGROCKS67/scalpx-ytx  
**Local:** http://localhost:3001/ytx  

**Demo data:** Auto-seeds on first API load (13 shows · 10 channels with hosts, tags, descriptions, SEO). Reset locally: `npm run seed:demo`. Disable: `YTX_DEMO_SEED=false`.
**Build spec (print/PDF):** `docs/SCALPX_YTX_BUILD_SPEC.html` · page 7 = DK handoff

Legend: ✅ Done in code · 🟡 Needs ops / real show validation · ⏳ Validate label on live run (Chento)

---

## Ship bar (3 Jul spec)

| Criterion | Status |
|-----------|--------|
| Standalone `/ytx` product | ✅ |
| 10-channel roster + Banter entity | ✅ |
| 38-task checklist UI | ✅ |
| Live + pre-recorded pipelines | ✅ |
| Local Clips pipeline (Scout copy) | ✅ |
| Full lifecycle engine + Banter dry-run test | ✅ `npm run test:banter` |
| Checklist auto-complete on actions | ✅ 28 Auto · 5 QC-gated until approve |
| YouTube Data API (read) | ✅ API key fallback |
| YouTube metadata write (OAuth) | ✅ code · 🟡 needs GCP + channel connect |
| OAuth connect flow | ✅ code · 🟡 needs GCP creds |
| Deals / TrackingLink sponsor block | ✅ Scout HTTP · offline template fallback |
| Content cross-post (6 platforms) | ✅ local + Scout |
| EndScreenDB + post-show SEO | ✅ |
| Comment queue + A/B reminder | ✅ |
| Live ops (patch log · chapters · links) | ✅ |
| Track read-only panel | ✅ Roster → Track |
| Channel setup automation (3.1 · 3.2) | ✅ |
| Vercel demo deploy | ✅ |
| Roster YouTube IDs | 🟡 `data/roster-channel-ids.json` |
| OAuth on ≥1 real channel | 🟡 ops |
| Clips E2E with real YT download | 🟡 ffmpeg + OPENAI_API_KEY + real URL |
| **70% automation (27/38 tasks)** | ✅ dry-run hits 27/38 done (70%) |

---

## Checklist · all 39 tasks

| ID | Task | Mode | Code | Notes |
|----|------|------|------|-------|
| 3.2 | Channel description | Auto | ✅ | lifecycle + channel-setup |
| 3.1 | Channel tags | Auto | ✅ | lifecycle + channel-setup |
| 3.3 | Link social accounts | Assist | ✅ | roster fields |
| oauth | Connect YouTube OAuth | Assist | ✅ | 🟡 needs GCP creds |
| 1.5 | Channel trailer | Auto+QC | ✅ | trailer API · QC on roster |
| 1.1 | SEO title options | Auto | ✅ | SEO pack |
| ab-thumb | A/B thumbnail variants | Assist+QC | ✅ | QC panel |
| 1.2 | Video description | Auto | ✅ | SEO pack |
| 2.1 | Sponsor links | Auto | ✅ | ⏳ validate Scout TrackingLinks |
| 1.3 | Show tags | Auto | ✅ | SEO pack |
| 1.4 | Playlists | Assist | ✅ | checklist |
| 3.5 | Collab / guest | Assist | ✅ | ShowRun fields |
| 1.6 | Upload settings pre-flight | Assist | ✅ | checklist |
| 3.4 | Thumbnail brief | Assist+QC | ✅ | QC panel |
| social-yt | Pre-show · YouTube Community | Auto | ✅ | cross-post |
| social-x | Pre-show · X | Auto | ✅ | cross-post |
| social-ig | Pre-show · Instagram | Auto | ✅ | cross-post |
| social-fb | Pre-show · Facebook | Auto | ✅ | cross-post |
| social-reddit | Pre-show · Reddit | Auto | ✅ | cross-post |
| social-tg | Pre-show · Telegram | Auto | ✅ | cross-post |
| 1.11 | Waiting room baseline | Auto | ✅ | ⏳ validate live YT API |
| 1.12 | Live SEO timestamps | Auto | ✅ | ⏳ validate OAuth write |
| 1.13 | Update links live | Auto | ✅ | ⏳ validate OAuth write |
| 2.3 | Post value live | Manual | ✅ | checklist only |
| 3.7 | Peak live viewers | Auto | ✅ | ⏳ validate live broadcast |
| 1.14 | Peak moments / topics | Auto | ✅ | spike log |
| 1.15 | A/B title & thumbnail | Assist+QC | ✅ | post-show reminder |
| 1.16 | Tags cleanup | Auto | ✅ | post-show SEO |
| 1.17 | Timestamps cleanup | Auto | ✅ | post-show SEO |
| 1.18 | End screens & cards | Auto | ✅ | EndScreenDB |
| 1.19 | Transcript translate | Auto | ✅ | ⏳ validate real transcript |
| 1.20 | Transcript → description | Auto | ✅ | post-show SEO |
| 3.8 | Tag guests / partners | Assist | ✅ | guest fields |
| 1.21 | End-screen bucket | Auto | ✅ | EndScreenDB |
| 1.22 | Comment replies | Auto+QC | ✅ | comments API · QC |
| 2.4 | IG carousels | Auto+QC | ✅ | ig-carousel · QC |
| 1.23 | X clips | Auto | ✅ | ⏳ validate ffmpeg E2E |
| 1.24 | YT Shorts (3–5) | Auto | ✅ | ⏳ validate ffmpeg E2E |

---

## DK next steps (ops)

1. Clone repo · `npm install` · `npm run dev`
2. `data/roster-channel-ids.example.json` → `data/roster-channel-ids.json` (10 UC IDs)
3. GCP OAuth + redirects (local + Vercel — see build spec page 7)
4. Settings: API key + OAuth · Scout URL + service key
5. Connect OAuth on ≥1 channel · run one real ShowRun lifecycle
6. Re-label tasks in `lib/checklistTasks.ts` if Auto doesn't hold (Chento direction)
7. Clips E2E: real YT URL + `OPENAI_API_KEY`

---

## Verify

```bash
npm run smoke        # build + unit + banter dry-run + API
npm run test:banter  # full lifecycle without Clips download
```
