import {
  BANTER_REPLY_RULES,
  formatBanterFewShotBlock,
  isBadBanterReplyDraft,
} from "@/lib/banterReplyVoice";
import { draftReplyForComment, isStaleGenericDraft } from "@/lib/commentIntel";
import { buildShowDraftIntel } from "@/lib/showDraftIntel";
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
    return `${BANTER_REPLY_RULES}

Study these real Banter-style pairs — match this energy exactly (unique reply per new comment):

${formatBanterFewShotBlock()}`;
  }
  if (channel?.slug === "chento") {
    return `You reply as Chento Trades on YouTube — live Bitcoin/crypto trading streams.
Tone: direct, terse, trader voice. 1-2 sentences. Sometimes just "🙏".
- Answer the specific comment — stops, timestamps, alts, prop firm
- Never give "you should long/short" — what was done live on chart (NFA)
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
Every reply must be UNIQUE, short, and sound like a human Banter mod — not an AI assistant.`;

  const user = `Show title: ${show.title}
Channel: ${channel?.displayName ?? "Unknown"}
Format: ${show.format}${show.guestName ? ` · guest: ${show.guestName}` : ""}
Topics: ${intel?.topics.join(", ") ?? "crypto"}
Stream hook: ${intel?.hookLine ?? ""}

Chapters (use exact times for timestamp answers):
${chapters}

Comments to reply to — write like the examples above, but specific to each comment:
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

function isBadDraft(draft: string, channel: YtChannel | null): boolean {
  if (isStaleGenericDraft(draft)) return true;
  if (channel?.slug === "banter" && isBadBanterReplyDraft(draft)) return true;
  return false;
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

function mergeReplies(
  show: ShowRun,
  channel: YtChannel | null,
  comments: Pick<CommentReply, "id" | "commentText">[],
  ai: Map<string, string>
): Map<string, string> {
  const merged = templateFallback(show, channel, comments);
  for (const c of comments) {
    const aiReply = ai.get(c.id)?.trim();
    if (aiReply && !isBadDraft(aiReply, channel)) {
      merged.set(c.id, aiReply);
    }
  }
  return merged;
}

/** Generate unique draft replies via DeepSeek; falls back to Banter-voice templates if no key or bad output. */
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
        temperature: 0.72,
        max_tokens: 1800,
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

    return mergeReplies(show, channel, comments, parseAiReplies(raw));
  } catch (e) {
    console.error("[commentReplies] DeepSeek error", e);
    return templateFallback(show, channel, comments);
  } finally {
    clearTimeout(timer);
  }
}
