# YTX vs Build Spec - coverage (updated)

**App:** http://localhost:3001/ytx · standalone · Scout adapters optional

Legend: ✅ Done · 🟡 Needs ops creds · ❌ Not in code

---

## Ship bar (3 Jul spec)

| Criterion | Status |
|-----------|--------|
| Standalone `/ytx` product | ✅ |
| 10-channel roster + Banter entity | ✅ |
| 38-task checklist UI | ✅ |
| Local Clips pipeline (Scout copy) | ✅ |
| Full lifecycle engine + Banter dry-run test | ✅ `npm run test:banter` |
| Checklist auto-complete on actions | ✅ 28/28 Auto tasks (3 QC-gated until approve) |
| YouTube Data API (waiting room · peak · metadata write) | ✅ when OAuth connected |
| OAuth connect flow | ✅ needs GCP creds in Settings |
| Deals / TrackingLink sponsor block | ✅ Scout HTTP · offline template fallback |
| Content cross-post (6 platforms) | ✅ local + Scout |
| EndScreenDB + post-show SEO | ✅ |
| Comment queue + A/B reminder | ✅ |
| Live ops (patch log · chapters) | ✅ |
| Track read-only panel | ✅ Roster → Track |
| Channel setup automation (3.1 · 3.2) | ✅ |
| Roster YouTube IDs | 🟡 `data/roster-channel-ids.json` or `YTX_ROSTER_CHANNEL_IDS` |
| OAuth on ≥1 real channel | 🟡 ops |
| Clips E2E with real YT download | 🟡 needs video URL + ffmpeg + OPENAI_API_KEY |
| **70% automation (27/38 tasks)** | ✅ **28 Auto defined · dry-run hits 27/38 done (70%) · QC tasks 1.5/1.22/2.4 pending until approve** |

---

## What “perfect” still needs from ops (not code)

1. Copy `data/roster-channel-ids.example.json` → `data/roster-channel-ids.json` with 10 real UC IDs
2. GCP OAuth client + redirect `http://localhost:3001/ytx/api/youtube/callback`
3. Scout URL + service key + TrackingLinks per deal
4. `OPENAI_API_KEY` for Whisper captions in Clips export
5. Connect OAuth on at least one channel in Settings/Roster

---

## Verify

```bash
npm run smoke        # build + unit + banter dry-run + API
npm run test:banter  # full lifecycle without Clips download
```
