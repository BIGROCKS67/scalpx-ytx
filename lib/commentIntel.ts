import type { CommentReply, LiveChapter, ShowRun, YtChannel } from "@/lib/types";

export type CommentSeed = {
  authorHint: string;
  commentText: string;
  likeCount: number;
  replyCount: number;
};

type ChannelVoice = "chento" | "banter" | "trader";

function voiceFor(channel: YtChannel | null): ChannelVoice {
  if (channel?.slug === "banter") return "banter";
  if (channel?.slug === "chento") return "chento";
  return "trader";
}

function formatChapterTime(ch: LiveChapter): string {
  const m = Math.floor(ch.atSec / 60);
  const s = String(Math.floor(ch.atSec % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function chapterAt(show: Pick<ShowRun, "liveChapters">, pattern: RegExp): string | null {
  const hit = show.liveChapters.find((c) => pattern.test(c.label));
  return hit ? formatChapterTime(hit) : null;
}

function firstChapter(show: Pick<ShowRun, "liveChapters">): string | null {
  return show.liveChapters[0] ? formatChapterTime(show.liveChapters[0]) : null;
}

/** Old template replies — regenerate these on load. */
export function isStaleGenericDraft(draft: string): boolean {
  if (!draft.trim()) return true;
  return (
    /great question|solid point|fair pushback|appreciate you watching|touched on this during the live q&a|full timestamp in the description|check the chapters in the description|we stayed measured on price targets|separating treasury narrative|mapped leaders vs laggards|guest segment is in the chapter list|bell on for the next one|more on that in the weekly playbook|— chento|— crypto banter|— the team/i.test(
      draft
    )
  );
}

function replyBanter(
  comment: string,
  show: Pick<ShowRun, "title" | "liveChapters" | "guestName">
): string {
  const c = comment.trim();
  const lower = c.toLowerCase();
  const mstrTime = chapterAt(show, /mstr|premium|btc spot|saylor/i) ?? "34:12";
  const altTime = chapterAt(show, /alt|rotation/i) ?? "35:00";
  const qaTime = chapterAt(show, /q&a|community/i) ?? "57:00";

  if (/pinned:|chapters updated|jump to macro/i.test(lower)) {
    return "🙏";
  }
  if (/saylor.*long|everyone long|literally the signal/i.test(lower)) {
    return "haha headline ≠ position size — we said the same thing live: you can agree with Saylor and still not YOLO. watch the MSTR bit before going max long";
  }
  if (/timestamp|what time|when did you talk|mstr premium/i.test(lower)) {
    return `${mstrTime} — “MSTR premium vs BTC spot” is in the chapters`;
  }
  if (/best banter|guest segment|fire|goat stream|best stream/i.test(lower)) {
    return show.guestName
      ? `means a lot — ${show.guestName} segment is the one people rewatched most in chat too`
      : "means a lot — which bit was your favourite? helps us line up the next guest";
  }
  if (/pump narrative|show the levels|invalidate|invalidation/i.test(lower)) {
    return "fair pushback — we gave the invalidation live (daily losing the level we had on screen). if you want the number not the narrative, skip to that chapter";
  }
  if (/alts follow|rotate late|alt season|alts lag/i.test(lower)) {
    return `alts usually lag a vertical BTC move — we walked through that around ${altTime}. not financial advice but that was the framework we used live`;
  }
  if (/first live|eu timezone|recap|replay gang|missed it/i.test(lower)) {
    return "same upload on the channel — chapters in the description so you can jump straight to the Saylor/macro chunk without sitting through the full VOD";
  }
  if (/liquidity grab|that call|insane|called it/i.test(lower)) {
    return "yeah that was the cleanest read on the stream — glad you were in chat for it";
  }
  if (/meme when|saylor did it meme|clip/i.test(lower)) {
    return "lol fair — shorts/clips usually drop a day after. bell on if you want the clip upload";
  }
  if (/not financial advice.*invalidation|showing invalidation|respect.*nfa/i.test(lower)) {
    return "appreciate that — we try to show the level we'd be wrong at, not just the hopium";
  }
  if (/thanks|subbed|honest take|love this|great stream/i.test(lower)) {
    return "🙏 see you on the next one";
  }
  if (/guest.*back|next episode|who was the guest/i.test(lower)) {
    return show.guestName
      ? `${show.guestName} is always welcome back if the calendar works — drop who you want next in the comments`
      : "no guest this one but we're booking for next week — who do you want on?";
  }
  if (/timestamp|best moment|which part/i.test(lower)) {
    const t = firstChapter(show);
    return t ? `chapters are in the desc — start around ${t} or use the Q&A block at ${qaTime}` : "chapters in the description — Q&A block has most of the back-and-forth";
  }
  if (/aged well|called it|you were right/i.test(lower)) {
    return "we'll take it 😅 market still has to follow through though";
  }
  if (/stop loss|where was.*stop|invalidation level/i.test(lower)) {
    return "stop/invalidation was whatever we marked live on the chart — rewind that segment, we don't repost levels in comments (NFA)";
  }
  if (/levels.*next week|watching next|what levels/i.test(lower)) {
    return "levels change every session — next live we map it fresh on the chart. bell on for the stream";
  }
  if (/recap|main thesis|what was.*about/i.test(lower)) {
    return `tl;dr from this stream: Saylor/MSTR headline vs what spot was actually doing — full breakdown in the VOD, chapters split it up`;
  }
  if (/\?/.test(c)) {
    return `good q — we probably answered it in the ${qaTime} Q&A block if you want the long version`;
  }
  return "appreciate you watching — drop a timestamp if you're looking for a specific moment and we'll point you to it";
}

function replyChento(
  comment: string,
  show: Pick<ShowRun, "title" | "liveChapters" | "format">
): string {
  const c = comment.trim();
  const lower = c.toLowerCase();
  const levelTime = chapterAt(show, /level|setup|btc|structure/i) ?? chapterAt(show, /intro/i);
  const altTime = chapterAt(show, /alt|rotation|playbook/i);

  if (/timestamp|what time|when did/i.test(lower)) {
    return levelTime
      ? `${levelTime} in the chapters — scroll the description`
      : "timestamps in the description";
  }
  if (/stop loss|stop was|where.*stop|invalidation/i.test(lower)) {
    return "stop was where we marked it live on chart — not reposting levels in comments. rewind that part of the VOD (NFA)";
  }
  if (/levels.*next|watching next|what level/i.test(lower)) {
    return "levels get redrawn every live — next stream we map it again. bell on";
  }
  if (/long|short|should i|what would you do/i.test(lower)) {
    return "can't tell you what to do in a comment — we traded what we traded live with size and invalidation on screen (NFA)";
  }
  if (/prop firm|challenge|payout/i.test(lower)) {
    return "prop stuff is in the title for a reason — rules + risk were on screen the whole session. watch the execution not the headline";
  }
  if (/alt season|altcoin|rotation/i.test(lower)) {
    return altTime
      ? `alt rotation bit is around ${altTime} — leaders vs laggards on the board`
      : "alt rotation was on the board this stream — check chapters";
  }
  if (/thanks|subbed|great stream|goat|helpful/i.test(lower)) {
    return "🙏";
  }
  if (/paper trading|demo|fake/i.test(lower)) {
    return "real account live — same as every stream on this channel";
  }
  if (/recap|thesis|what was.*about/i.test(lower)) {
    return `this one was ${show.title.slice(0, 60)} — chapters break down BTC structure + what we actually traded`;
  }
  if (/\?/.test(c)) {
    return "check the description chapters first — if it's not there we'll cover it on the next live";
  }
  return "🙏";
}

function replyTrader(comment: string, show: Pick<ShowRun, "title" | "liveChapters">): string {
  const lower = comment.trim().toLowerCase();
  if (/timestamp|chapter|what time/i.test(lower)) {
    const t = firstChapter(show);
    return t ? `${t} in the chapters` : "chapters in the description";
  }
  if (/thanks|subbed|great/i.test(lower)) {
    return "🙏";
  }
  if (/\?/.test(comment)) {
    return "likely covered in the VOD — check chapters in the description";
  }
  return "🙏";
}

export function draftReplyForComment(
  show: Pick<ShowRun, "title" | "liveChapters" | "format" | "guestName">,
  comment: Pick<CommentReply, "commentText">,
  channel: YtChannel | null
): string {
  const voice = voiceFor(channel);
  const text = comment.commentText;

  if (voice === "banter") return replyBanter(text, show);
  if (voice === "chento") return replyChento(text, show);
  return replyTrader(text, show);
}

export function demoCommentsForShow(show: Pick<ShowRun, "title">): CommentSeed[] {
  const title = show.title;
  const saylor = /saylor|bitcoin.*pump|microstrategy/i.test(title);

  if (saylor) {
    return [
      {
        authorHint: "@CryptoMaxi",
        commentText: "Saylor buying again is literally the signal. Why isn't everyone long?",
        likeCount: 842,
        replyCount: 47,
      },
      {
        authorHint: "@MacroDave",
        commentText: "Can you timestamp when you talked about MSTR premium vs BTC spot?",
        likeCount: 612,
        replyCount: 31,
      },
      {
        authorHint: "@BanterRegular",
        commentText: "Best Banter stream this month. The guest segment was fire.",
        likeCount: 489,
        replyCount: 22,
      },
      {
        authorHint: "@SkepticTrader",
        commentText: "Pump narrative again? Show the levels that invalidate this.",
        likeCount: 401,
        replyCount: 58,
      },
      {
        authorHint: "@AltSeasonHunter",
        commentText: "If BTC pumps do alts follow this week or do we rotate late?",
        likeCount: 356,
        replyCount: 19,
      },
      {
        authorHint: "@NewSub",
        commentText: "First live I caught — where's the recap for EU timezone?",
        likeCount: 287,
        replyCount: 8,
      },
      {
        authorHint: "@ChartWizard",
        commentText: "That liquidity grab call before the move was insane",
        likeCount: 264,
        replyCount: 14,
      },
      {
        authorHint: "@MemeLord",
        commentText: "Saylor did it meme when",
        likeCount: 231,
        replyCount: 41,
      },
      {
        authorHint: "@RiskFirst",
        commentText: "Appreciate you saying not financial advice AND showing invalidation",
        likeCount: 198,
        replyCount: 6,
      },
      {
        authorHint: "@CommunityMod",
        commentText: "Pinned: chapters updated in description — jump to macro block at 34:12",
        likeCount: 176,
        replyCount: 3,
      },
    ];
  }

  return [
    {
      authorHint: "@ViewerOne",
      commentText: `Great stream — can you recap the main thesis from "${title}"?`,
      likeCount: 420,
      replyCount: 18,
    },
    {
      authorHint: "@ChartFan",
      commentText: "What levels are you watching next week?",
      likeCount: 380,
      replyCount: 24,
    },
    {
      authorHint: "@Regular",
      commentText: "Timestamp for the best moment please",
      likeCount: 310,
      replyCount: 12,
    },
    {
      authorHint: "@BullRun",
      commentText: "This aged well already",
      likeCount: 275,
      replyCount: 9,
    },
    {
      authorHint: "@Question",
      commentText: "Guest coming back next episode?",
      likeCount: 240,
      replyCount: 15,
    },
    {
      authorHint: "@Thanks",
      commentText: "Thanks for the honest take — subbed",
      likeCount: 210,
      replyCount: 4,
    },
    {
      authorHint: "@EUViewer",
      commentText: "Replay gang — worth watching live?",
      likeCount: 185,
      replyCount: 7,
    },
    {
      authorHint: "@Risk",
      commentText: "Where was stop loss on that first trade idea?",
      likeCount: 162,
      replyCount: 11,
    },
    {
      authorHint: "@Clip",
      commentText: "Someone clip the macro rant",
      likeCount: 148,
      replyCount: 20,
    },
    {
      authorHint: "@Mod",
      commentText: "Chapters in description — use those before asking repeat Qs",
      likeCount: 132,
      replyCount: 2,
    },
  ];
}

export function sortCommentsByEngagement(items: CommentReply[]): CommentReply[] {
  return [...items].sort((a, b) => {
    const scoreA = a.likeCount * 2 + a.replyCount;
    const scoreB = b.likeCount * 2 + b.replyCount;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function topComments(items: CommentReply[], limit = 10): CommentReply[] {
  return sortCommentsByEngagement(items).slice(0, limit);
}
