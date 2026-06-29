# Chento addendum · 29 Jun 2026

Product direction updates from Chento (approved by Jack). These override the original PDF/HTML spec where noted.

## 1. Product vision: AI YouTube Studio

**Assignment:** YTX is not a checklist bolted onto Scout. It is **YouTube Studio, except AI fills in the blanks** instead of a human typing everything.

- Every field (title, description, tags, sponsor block, chapters, comments, carousels) is **AI-generated first**
- Human role = **QC only**: approve · reject · edit · re-run
- Do **not** extend `/studio` kanban - YTX replaces that workflow for YouTube lifecycle

## 2. Two pipelines (not one)

| Pipeline | When | Different behaviour |
|----------|------|---------------------|
| **Live stream** | Going live on YouTube | Waiting room · auto chapters during show · auto link patches · peak viewers · spike moments |
| **Pre-recorded** | Upload / VOD first | Upload pre-flight · no waiting room · post-publish SEO + Clips heavier · skip live-only tasks |

Pick pipeline when creating a ShowRun. Checklist auto-skips tasks that do not apply.

## 3. Task mode changes (was spec → now)

| Task | Old | New | Notes |
|------|-----|-----|-------|
| 1.5 Channel trailer | Manual | **Auto + QC** | AI script + highlight picks from channel/show metadata |
| 1.12 Live SEO timestamps | Assist | **Auto** | Chapters generated from transcript / live markers · push to description |
| 1.13 Update links live | Assist | **Auto** | Sponsor + tracked links patched to YT description during show |
| 1.22 Comment replies | Assist | **Auto + QC** | AI drafts all replies · human approve/reject/edit before post |
| 2.4 IG carousels | Assist | **Auto + QC** | AI carousel slides + caption · human approve/reject/edit |

## 4. Human QC pattern (global)

Most "Auto" tasks follow:

1. YTX generates draft
2. QC panel shows: **Approve** · **Reject** · **Edit**
3. On approve → task marked done · optional publish to YT / Content

Tasks with `needsQc: true` in checklist config show the QC panel in the show board.

## 5. Over-deliver checklist

- ✅ Full lifecycle button (Banter dry-run tested · `npm run test:banter`)
- ✅ Local Clips pipeline (Scout libs copied)
- ✅ YouTube Data API · API key read fallback + OAuth write paths when connected
- ✅ Track read-only on roster
- ✅ EndScreenDB + post-show SEO pass
- ✅ Vercel demo + GitHub repo (see `SPEC_COVERAGE.md` · build spec page 7)
- 🟡 DK: ops creds · first real show · validate Auto labels (Chento 29 Jun)

## Source

WhatsApp · 29/06/2026 · Chento → Jack ("aight can add all")
