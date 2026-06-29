import { buildShowDraftIntel } from "@/lib/showDraftIntel";
import { draftReplyForComment } from "@/lib/commentIntel";
import { getSettings } from "@/lib/store";
import type { CommentReply, ShowRun, YtChannel } from "@/lib/types";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

function formatChapterTime(atSec: number): string {
  const m = Math.floor(atSec / 60);
  const s = String(Math.floor(atSec % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function voiceGuide(channel: YtChannel | null): string {
  if (channel?.slug === "banter") {
    return `You reply as Crypto Banter (hosted by Chento Trades) — a live talk show, NOT a signal channel.
Tone: casual, witty, short (1-3 sentences max). Like real YouTube comment replies on Banter streams.
- Answer ONLY what they asked or said — quote their point if helpful
- Use "haha", "fair", "lol" sparingly when it fits
- Timestamp requests → give chapter time from context if available
- Never say "Great question", "Solid point", "touched on this during the live Q&A"
- Never sign off with "— Crypto Banter" or channel name
- Don't repost exact trade levels in comments — point to VOD/chapters (NFA)
- Thanks/praise → often just "🙏" or one short line
- Pinned/mod comments → reply "🙏" only`;
  }
  if (channel?.slug === "chento") {
    return `You reply as Chento Trades — live Bitcoin/crypto trading streams, real execution on chart.
Tone: direct, terse, trader voice. 1-2 sentences usually. Sometimes just "🙏".
- Answer the specific comment — stops, timestamps, alts, prop firm, etc.
- Never give "you should long/short" — say what was done live on chart (NFA)
- Don't paste levels in comments — "rewind that segment" / "chapters in desc"
- No corporate AI filler or signatures`;
  }
  return `You reply as the channel host on YouTube. Short, human, specific to each comment. No AI filler.`;
}

function buildPrompt(
  show: ShowRun,
  channel: YtChannel | null,
  comments: Pick<CommentReply, "id" | "authorHint" | "commentText" | "likeCount" | "replyCount">[]
): { system: string; user: string } {
  const intel = channel ? buildShowDraftIntel(show, channel) : null;
  const chapters =
    show.liveChapters.length > 0
      ? show.liveChapters
          .map((c) => `${formatChapterTime(c.atSec)} · ${c.label}`)
          .join("\n")
      : "none listed";

  const system = `${voiceGuide(channel)}

Return JSON only: { "replies": [ { "id": "<comment id>", "reply": "<your reply text>" } ] }
One unique reply per comment id. Each reply must be different and directly about that comment.`;

  const user = `Show title: ${show.title}
Channel: ${channel?.displayName ?? "Unknown"}
Format: ${show.format}${show.guestName ? ` · guest: ${show.guestName}` : ""}
Topics: ${intel?.topics.join(", ") ?? "crypto"}
Stream hook: ${intel?.hookLine ?? ""}

Chapters (use for timestamp answers):
${chapters}

Comments to reply to (JSON):
${JSON.stringify(
  comments.map((c) => ({
    id: c.id,
    author: c.authorHint,
    text: c.commentText,
    likes: c.likeCount,
    threadReplies: c.replyCount,
  })),
  null,
  2
)}`;

  return { system, user };
}

function parseAiReplies(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  const parsed = JSON.parse(raw) as {
    replies?: { id?: string; reply?: string; text?: string }[];
  };
  for (const row of parsed.replies ?? []) {
    if (!row.id) continue;
    const text = (row.reply ?? row.text ?? "").trim();
    if (text) out.set(row.id, text.slice(0, 500));
  }
  return out;
}

function templateFallback(
  show: ShowRun,
  channel: YtChannel | null,
  comments: Pick<CommentReply, "id" | "commentText">[]
): Map<string, string> {
  return new Map(
    comments.map((c) => [c.id, draftReplyForComment(show, c, channel)])
  );
}

/** Generate unique draft replies via DeepSeek; falls back to templates if no key or API error. */
export async function generateCommentReplyDrafts(
  show: ShowRun,
  channel: YtChannel | null,
  comments: Pick<CommentReply, "id" | "authorHint" | "commentText" | "likeCount" | "replyCount">[]
): Promise<Map<string, string>> {
  if (!comments.length) return new Map();

  const settings = await getSettings();
  const apiKey = settings.deepseekApiKey?.trim() || process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return templateFallback(show, channel, comments);

  const { system, user } = buildPrompt(show, channel, comments);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);

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
        temperature: 0.85,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("[commentReplies] DeepSeek", res.status, await res.text().catch(() => ""));
      return templateFallback(show, channel, comments);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return templateFallback(show, channel, comments);

    const ai = parseAiReplies(raw);
    const merged = templateFallback(show, channel, comments);
    for (const [id, reply] of ai) {
      if (reply.trim()) merged.set(id, reply);
    }
    return merged;
  } catch (e) {
    console.error("[commentReplies] DeepSeek error", e);
    return templateFallback(show, channel, comments);
  } finally {
    clearTimeout(timer);
  }
}
