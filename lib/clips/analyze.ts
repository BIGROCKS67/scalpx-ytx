import { getSettings } from "@/lib/store";
import type { ClipMoment } from "@/lib/clips/types";
import {
  detectAudioPeakTimes,
  detectSceneTimes,
  formatClipTime,
  probeDurationSec,
} from "@/lib/clips/ffmpegUtil";
import { resolveSourceFilePath } from "@/lib/clips/sourceFile";
import { fetchYouTubeTranscript, type TranscriptCue } from "@/lib/clips/transcript";
import { transcribeVideoFileWithWords, whisperConfigured } from "@/lib/clips/transcribe";
import { deleteMomentsForSource, upsertClipMoments } from "@/lib/clips/momentsStore";
import {
  upsertClipSource,
  getClipSource,
  updateClipSourceAnalysisProgress,
} from "@/lib/clips/store";
import { randomUUID } from "crypto";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

type MomentDraft = Omit<ClipMoment, "id" | "sourceId" | "clipUrl" | "createdAt" | "transcriptJson">;

export type AnalyzeProgress = {
  phase: "prepare" | "transcribe" | "scan" | "ai" | "save";
  message: string;
  progress?: number;
};

const PHASE_PROGRESS: Record<AnalyzeProgress["phase"], number> = {
  prepare: 8,
  transcribe: 42,
  scan: 58,
  ai: 88,
  save: 96,
};

type ClipDomain = "sports" | "crypto" | "general";

const GOAL_RE =
  /\b(go+a+l|scores?|it's in|in the net|back of the net|what a finish|equaliz|takes the lead|finds the net|into the corner)\b/i;
const SAVE_RE =
  /\b(save|saved|keeper|denied|off the line|parry|brilliant stop|great stop|tips it|keeps it out)\b/i;
const MISS_RE = /\b(miss|wide|over the bar|off the post|hits the post)\b/i;
const PENALTY_RE = /\b(penalty|from the spot|penalty kick)\b/i;
const CARD_RE = /\b(red card|yellow card|sent off|booked)\b/i;

function inferClipDomain(sourceTitle: string): ClipDomain {
  const t = sourceTitle.toLowerCase();
  if (
    /fifa|world cup|highlights?|football|soccer|premier league|champions league|\bvs\b| v |match|goalkeeper|striker|nfl|nba|mlb|touchdown|quarterback/i.test(
      t
    )
  ) {
    return "sports";
  }
  if (/crypto|bitcoin|btc|eth|trading|stream|pump|dump|liquidat/i.test(t)) {
    return "crypto";
  }
  return "general";
}

function cuesInRange(cues: TranscriptCue[], fromSec: number, toSec: number): TranscriptCue[] {
  return cues.filter((c) => c.startSec >= fromSec && c.startSec <= toSec);
}

function detectSportsEvent(text: string): "goal" | "save" | "miss" | "penalty" | "card" | "general" {
  if (CARD_RE.test(text)) return "card";
  if (PENALTY_RE.test(text)) return "penalty";
  if (GOAL_RE.test(text)) return "goal";
  if (SAVE_RE.test(text)) return "save";
  if (MISS_RE.test(text)) return "miss";
  return "general";
}

function detectSportsEventFromCues(cues: TranscriptCue[]): "goal" | "save" | "miss" | "penalty" | "card" | "general" {
  const goalCues = cues.filter((c) => GOAL_RE.test(c.text));
  const saveCues = cues.filter((c) => SAVE_RE.test(c.text));
  const goalScore = goalCues.length ? Math.max(...goalCues.map(scoreCue)) : 0;
  const saveScore = saveCues.length ? Math.max(...saveCues.map(scoreCue)) : 0;

  if (goalScore > 0 && goalScore >= saveScore) return "goal";
  if (saveScore > 0) return "save";

  const text = cues.map((c) => c.text).join(" ");
  return detectSportsEvent(text);
}

function scoreCue(cue: TranscriptCue): number {
  const t = cue.text;
  let score = 0;
  if (GOAL_RE.test(t)) score += 20;
  if (SAVE_RE.test(t)) score += 14;
  if (PENALTY_RE.test(t)) score += 16;
  if (CARD_RE.test(t)) score += 12;
  if (MISS_RE.test(t)) score += 8;
  if (/!/.test(t)) score += 3;
  if (t.length > 20) score += 2;
  score += Math.min(4, t.split(/\s+/).length);
  return score;
}

function findPeakCue(cues: TranscriptCue[]): TranscriptCue | null {
  if (cues.length === 0) return null;
  let best = cues[0];
  let bestScore = scoreCue(best);
  for (const c of cues.slice(1)) {
    const s = scoreCue(c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return bestScore > 0 ? best : cues[0];
}

function labelSaysEvent(label: string, event: string): boolean {
  const t = label.toLowerCase();
  if (event === "goal") return GOAL_RE.test(t) || /\bgoal\b/.test(t);
  if (event === "save") return SAVE_RE.test(t) || /\bsave/.test(t);
  if (event === "miss") return MISS_RE.test(t);
  if (event === "penalty") return PENALTY_RE.test(t);
  if (event === "card") return CARD_RE.test(t);
  return false;
}

function cleanCommentaryLine(line: string, max = 80): string {
  return line.replace(/\s+/g, " ").replace(/^\W+/, "").trim().slice(0, max);
}

function buildLabelFromCue(cue: TranscriptCue, event: string): { title: string; hook: string } {
  const line = cleanCommentaryLine(cue.text, 100);
  const short = cleanCommentaryLine(cue.text, 55);

  if (event === "goal") {
    const hook = short.length <= 45 ? short : short.split(/[.!?]/)[0]?.slice(0, 45) || "GOAL!";
    const title = GOAL_RE.test(line) ? line.slice(0, 120) : `GOAL - ${short}`;
    return { title, hook: hook.toUpperCase().includes("GOAL") ? hook : `GOAL! ${hook}` };
  }
  if (event === "save") {
    return {
      title: line.slice(0, 120),
      hook: short.length <= 50 ? short : `SAVE - ${short.slice(0, 40)}`,
    };
  }
  if (event === "penalty") {
    return { title: line.slice(0, 120), hook: short.slice(0, 50) || "Penalty moment" };
  }
  if (event === "card") {
    return { title: line.slice(0, 120), hook: short.slice(0, 50) || "Card moment" };
  }
  return {
    title: short.slice(0, 120) || "Highlight moment",
    hook: short.split(/[.!?]/)[0]?.slice(0, 50) || "Watch this",
  };
}

/** Rebuild title/hook/timing from transcript so labels match what was actually said (goal vs save etc). */
function groundMomentInTranscript(
  moment: MomentDraft,
  cues: TranscriptCue[],
  durationSec: number
): MomentDraft {
  const searchFrom = Math.max(0, moment.startSec - 12);
  const searchTo = Math.min(durationSec, moment.endSec + 10);
  const windowCues = cuesInRange(cues, searchFrom, searchTo);
  if (windowCues.length === 0) return moment;

  const event = detectSportsEventFromCues(windowCues);
  const peakCue =
    event === "goal"
      ? windowCues.find((c) => GOAL_RE.test(c.text)) ?? findPeakCue(windowCues)
      : findPeakCue(windowCues);
  if (!peakCue) return moment;

  const aiLabel = `${moment.title} ${moment.hook}`;
  const transcriptEvent = event;
  const aiEventGoal = labelSaysEvent(aiLabel, "goal");
  const aiEventSave = labelSaysEvent(aiLabel, "save");
  const transcriptIsGoal = transcriptEvent === "goal";
  const transcriptIsSave = transcriptEvent === "save";

  const labelsConflict =
    (aiEventSave && transcriptIsGoal) ||
    (aiEventGoal && transcriptIsSave) ||
    (transcriptEvent !== "general" && !labelSaysEvent(aiLabel, transcriptEvent));

  let title = moment.title;
  let hook = moment.hook;
  if (labelsConflict || transcriptEvent !== "general") {
    const built = buildLabelFromCue(peakCue, transcriptEvent);
    title = built.title;
    hook = built.hook;
  }

  const dur = Math.max(22, Math.min(55, moment.endSec - moment.startSec));
  const buildup = transcriptIsGoal || transcriptIsSave ? 2.5 : 1.5;
  const newStart = Math.max(0, Math.round((peakCue.startSec - buildup) * 10) / 10);
  let newEnd = Math.min(
    durationSec,
    Math.round((Math.max(peakCue.endSec + 10, newStart + dur)) * 10) / 10
  );
  if (newEnd - newStart < 22) {
    newEnd = Math.min(durationSec, Math.round((newStart + 28) * 10) / 10);
  }

  return { ...moment, title, hook, startSec: newStart, endSec: newEnd };
}

function systemPromptForDomain(domain: ClipDomain): string {
  if (domain === "sports") {
    return (
      "You are an elite sports highlights editor for TikTok/Reels. " +
      "You ONLY label moments using words the commentator actually says in the transcript. " +
      "Never invent or guess events (a goal is not a save). Respond with STRICT JSON only."
    );
  }
  if (domain === "crypto") {
    return (
      "You are an elite short-form clipping editor for crypto/trading live streams. " +
      "Label moments from transcript evidence only. Respond with STRICT JSON only."
    );
  }
  return (
    "You are an elite short-form clipping editor. Label moments from transcript evidence only. " +
    "Respond with STRICT JSON only."
  );
}

function userRulesForDomain(domain: ClipDomain, durationSec: number): string {
  const base = [
    "- 8 to 12 moments, sorted by virality",
    "- Each clip 22-55 seconds",
    "- startSec/endSec must match transcript timestamps - start 2-3s BEFORE the commentator reaction",
    "- title and hook MUST quote or closely paraphrase what the commentator says IN that window",
    "- Never guess events not spoken in the transcript",
    "- No overlapping windows",
    `- endSec <= ${Math.floor(durationSec)}`,
  ];

  if (domain === "sports") {
    base.push(
      "- CRITICAL: goal vs save vs miss vs penalty must match commentator words exactly",
      "- If commentator says GOAL / scores / it's in → it is a GOAL, never label as save",
      "- If commentator says save / keeper / denied → it is a SAVE, never label as goal",
      "- Include player names ONLY if spoken in the transcript for that window",
      "- Center each clip on the peak commentator reaction (goal call, save call, etc.)",
      "- Prefer: goals, near-misses, saves, penalties, cards, big plays"
    );
  } else if (domain === "crypto") {
    base.push(
      "- Prefer: hot takes, price calls, losses/wins, humor, controversy, clear standalone hooks"
    );
  }

  return base.join("\n");
}

async function pickMomentsWithAi(
  apiKey: string,
  sourceTitle: string,
  cues: TranscriptCue[],
  durationSec: number,
  energyTimes: number[]
): Promise<MomentDraft[]> {
  const domain = inferClipDomain(sourceTitle);
  const transcript = cues
    .map((c) => `[${formatClipTime(c.startSec)}] ${c.text}`)
    .join("\n")
    .slice(0, 18_000);

  const energyHint =
    energyTimes.length > 0
      ? `High-energy timestamps (seconds) from audio + scene analysis: ${energyTimes
          .slice(0, 20)
          .join(", ")}`
      : "";

  const system = systemPromptForDomain(domain);
  const user = `Source: "${sourceTitle}" (${Math.round(durationSec)}s)
Content type: ${domain}

Transcript (timestamped - this is ground truth for labels):
${transcript || "(limited transcript - lean on energy timestamps)"}

${energyHint}

Return JSON:
{
  "moments": [
    {
      "startSec": number,
      "endSec": number,
      "title": "short label from transcript",
      "hook": "on-screen hook from transcript (max 10 words)",
      "caption": "TikTok caption, 1-2 lines, 1 emoji",
      "score": 0-100
    }
  ]
}

Rules:
${userRulesForDomain(domain, durationSec)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 2500,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error("No AI response");
    const parsed = JSON.parse(raw) as { moments?: MomentDraft[] };
    const moments = (parsed.moments ?? []).filter(
      (m) =>
        Number.isFinite(m.startSec) &&
        Number.isFinite(m.endSec) &&
        m.endSec > m.startSec &&
        m.endSec - m.startSec >= 18 &&
        m.endSec - m.startSec <= 75
    );
    if (moments.length > 0) return moments.slice(0, 12);
  } finally {
    clearTimeout(timer);
  }
  return [];
}

function momentsFromEnergy(energyTimes: number[], durationSec: number, cues: TranscriptCue[]): MomentDraft[] {
  const times =
    energyTimes.length > 0
      ? energyTimes
      : (() => {
          const step = Math.min(120, durationSec / 8);
          const t: number[] = [];
          for (let x = step; x < durationSec - 30; x += step) t.push(x);
          return t;
        })();

  return times.slice(0, 10).map((t, i) => {
    const start = Math.max(0, t - 5);
    const end = Math.min(durationSec, start + 42);
    const nearCue = cues.find((c) => c.startSec >= start && c.startSec <= end);
    const snippet = nearCue?.text?.slice(0, 60) ?? "";
    return {
      startSec: start,
      endSec: end,
      title: snippet ? snippet.slice(0, 50) : `Moment ${i + 1} · ${formatClipTime(start)}`,
      hook: snippet ? snippet.split(/[.!?]/)[0]?.slice(0, 60) || "Watch this" : "This part hits different",
      caption: "From the stream - follow for more",
      score: 50 + i * 4,
    };
  });
}

/** Snap clip start to transcript peak - used when grounding is skipped (no cues). */
function snapMomentStartToHook(
  moment: MomentDraft,
  cues: TranscriptCue[],
  durationSec: number
): MomentDraft {
  const anchor = `${moment.hook} ${moment.title}`.toLowerCase();
  const words = anchor.split(/\W+/).filter((w) => w.length > 3);
  if (words.length === 0 || cues.length === 0) return moment;

  const dur = moment.endSec - moment.startSec;
  const searchFrom = Math.max(0, moment.startSec - 25);
  const searchTo = moment.endSec + 8;

  let bestCue: TranscriptCue | null = null;
  let bestScore = 0;
  for (const cue of cues) {
    if (cue.startSec < searchFrom || cue.startSec > searchTo) continue;
    const t = cue.text.toLowerCase();
    const score = words.filter((w) => t.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCue = cue;
    }
  }
  if (!bestCue || bestScore === 0) return moment;

  const newStart = Math.max(0, Math.round((bestCue.startSec - 0.5) * 10) / 10);
  let newEnd = Math.min(durationSec, Math.round((newStart + dur) * 10) / 10);
  if (newEnd - newStart < 18) {
    newEnd = Math.min(durationSec, Math.round(moment.endSec * 10) / 10);
  }
  return { ...moment, startSec: newStart, endSec: newEnd };
}

export async function analyzeClipSource(
  sourceId: string,
  onProgress?: (p: AnalyzeProgress) => void | Promise<void>
): Promise<ClipMoment[]> {
  const source = await getClipSource(sourceId);
  if (!source) throw new Error("Source not found");

  await upsertClipSource({
    ...source,
    analysisStatus: "running",
    analysisAt: new Date().toISOString(),
    analysisMessage: "Starting analysis…",
    analysisProgress: 2,
  });

  const { filePath, cleanup } = await resolveSourceFilePath(source);

  try {
    const report = async (phase: AnalyzeProgress["phase"], message: string, progress?: number) => {
      const pct = progress ?? PHASE_PROGRESS[phase];
      await updateClipSourceAnalysisProgress(sourceId, message, pct);
      await onProgress?.({ phase, message, progress: pct });
    };

    await report("prepare", "Preparing video…");

    const probedDur = await probeDurationSec(filePath);
    const durationSec = Math.max(probedDur, source.durationSec ?? 0);

    let cues: TranscriptCue[] = [];
    let transcriptWords: Array<{ startSec: number; endSec: number; word: string }> = [];

    if (source.youtubeVideoId) {
      await report("transcribe", "Pulling YouTube captions…");
      try {
        cues = await fetchYouTubeTranscript(
          `https://www.youtube.com/watch?v=${source.youtubeVideoId}`
        );
      } catch {
        cues = [];
      }
    }

    if (cues.length === 0 && whisperConfigured()) {
      const mins = Math.max(1, Math.round(durationSec / 60));
      await report("transcribe", `Transcribing full video (Whisper)… ~${mins} min`);
      try {
        const result = await transcribeVideoFileWithWords(filePath, durationSec, async (chunk, total) => {
          const chunkPct = PHASE_PROGRESS.transcribe + (28 * chunk) / total;
          await report(
            "transcribe",
            `Whisper chunk ${chunk}/${total} (${mins} min video)…`,
            Math.min(PHASE_PROGRESS.scan - 2, chunkPct)
          );
        });
        cues = result.cues;
        transcriptWords = result.words;
      } catch (e) {
        console.error("[clips/analyze] whisper", e);
        cues = [];
      }
    } else if (cues.length === 0) {
      await report("transcribe", "No Whisper key - using audio/scene scan only");
    }

    await report("scan", "Scanning scenes + audio peaks…");
    const sceneTimes = await detectSceneTimes(filePath, 24);
    const audioPeaks = await detectAudioPeakTimes(filePath, durationSec, 16);
    const energyTimes = [...new Set([...sceneTimes, ...audioPeaks])].sort((a, b) => a - b);

    const settings = await getSettings();
    const apiKey = settings.deepseekApiKey?.trim();

    let drafts: MomentDraft[] = [];
    if (apiKey && (cues.length > 0 || energyTimes.length > 0)) {
      await report(
        "ai",
        `AI ranking ${cues.length} transcript lines + ${energyTimes.length} energy hits…`
      );
      try {
        drafts = await pickMomentsWithAi(apiKey, source.title, cues, durationSec, energyTimes);
      } catch (e) {
        console.error("[clips/analyze] deepseek", e);
        drafts = [];
      }
    }

    if (drafts.length === 0) {
      await report("ai", "Building moments from energy map…");
      drafts = momentsFromEnergy(energyTimes, durationSec, cues);
    }

    if (cues.length > 0) {
      const domain = inferClipDomain(source.title);
      drafts = drafts.map((d) => {
        if (domain === "sports") {
          return groundMomentInTranscript(d, cues, durationSec);
        }
        return snapMomentStartToHook(d, cues, durationSec);
      });
    }

    await report("save", `Saving ${drafts.length} hot moments…`);

    await deleteMomentsForSource(sourceId);
    const now = new Date().toISOString();

    function transcriptForMoment(d: MomentDraft): string {
      const windowCues = cues.filter(
        (c) => c.startSec >= d.startSec - 1 && c.startSec <= d.endSec + 1
      );
      const windowWords = transcriptWords.filter(
        (w) => w.startSec >= d.startSec - 1 && w.startSec <= d.endSec + 1
      );
      return JSON.stringify({ cues: windowCues, words: windowWords });
    }

    const moments: ClipMoment[] = drafts
      .sort((a, b) => b.score - a.score)
      .map((d) => ({
        id: randomUUID(),
        sourceId,
        startSec: Math.round(d.startSec * 10) / 10,
        endSec: Math.round(d.endSec * 10) / 10,
        title: d.title?.slice(0, 120) || "Clip moment",
        hook: d.hook?.slice(0, 200) || "",
        caption: d.caption?.slice(0, 500) || "",
        score: Math.min(100, Math.max(0, Number(d.score) || 50)),
        clipUrl: "",
        transcriptJson: transcriptForMoment(d),
        createdAt: now,
      }));

    await upsertClipMoments(moments);
    await upsertClipSource({
      ...source,
      durationSec: durationSec || source.durationSec,
      analysisStatus: "done",
      analysisAt: now,
      analysisMessage: "",
      analysisProgress: 100,
    });

    return moments;
  } catch (e) {
    await upsertClipSource({
      ...source,
      analysisStatus: "error",
      analysisAt: new Date().toISOString(),
      analysisMessage: e instanceof Error ? e.message : "Analysis failed",
      analysisProgress: 0,
    });
    throw e;
  } finally {
    await cleanup();
  }
}
