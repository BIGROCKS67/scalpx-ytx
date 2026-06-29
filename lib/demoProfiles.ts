import type { ChannelTrailerDraft, ShowFormat, ShowPipeline, ShowRunStatus } from "@/lib/types";

/** Demo UC IDs (UI + handoff · replace with real IDs in roster-channel-ids.json). */
const DEMO_YOUTUBE_IDS: Record<string, string> = {
  chento: "UCcH3nT0Tr4d3sD3m0Ch001",
  thomas: "UCtH0m4sTr4d3sD3m0Ch002",
  "king-azoulay": "UCK1ngAz0ul4yD3m0Ch003",
  paladin: "UCp4l4d1nTr4d3sD3m0Ch004",
  dmitry: "UCdM1tryTr4d3sD3m0Ch005",
  piltr: "UCp1ltrTr4d3sD3m0Ch006",
  madda: "UCm4dd4Tr4d3sD3m0Ch007",
  "nick-scalps": "UCn1ckSc4lpsD3m0Ch008",
  yassin: "UCy4ss1nTr4d3sD3m0Ch009",
  banter: "UCb4nt3rSh0wD3m0Ch010",
};

export function demoYoutubeIdForSlug(slug: string): string | null {
  return DEMO_YOUTUBE_IDS[slug] ?? null;
}

export type ChannelProfile = {
  slug: string;
  displayName: string;
  hostLabel: string;
  youtubeChannelId: string;
  trackAccountId: string;
  descriptionTemplate: string;
  tags: string[];
  socialLinks: Record<string, string>;
  showFormats: ShowFormat[];
  isShowFormat: boolean;
  channelTrailerDraft: ChannelTrailerDraft | null;
};

export type DemoShowDef = {
  channelSlug: string;
  title: string;
  format: ShowFormat;
  pipeline: ShowPipeline;
  status: ShowRunStatus;
  scheduledAt: string | null;
  guestName: string | null;
  dealId: string | null;
  seoTitle: string;
  seoDescription: string;
  seoTags: string[];
  doneTaskIds: string[];
  withComments?: boolean;
  withIgCarousel?: boolean;
  withCrossPosts?: boolean;
  withAnalytics?: boolean;
  liveChapters?: { atSec: number; label: string }[];
};

export const CHANNEL_PROFILES: ChannelProfile[] = [
  {
    slug: "chento",
    displayName: "Chento Trades",
    hostLabel: "Chento",
    youtubeChannelId: DEMO_YOUTUBE_IDS.chento,
    trackAccountId: "chento-trades",
    descriptionTemplate: `Hosted by Chento · daily crypto live streams, Banter talk shows, and market education.

What you get: live BTC/ETH breakdowns, alt rotations, risk frameworks, and community Q&A. Banter format = guests + macro banter. Education = structured lessons.

🔔 Subscribe · 🔔 Bell on · Not financial advice.`,
    tags: [
      "crypto",
      "bitcoin",
      "trading",
      "live stream",
      "altcoins",
      "banter",
      "education",
      "scalping",
      "macro",
    ],
    socialLinks: {
      x: "https://x.com/chentotrades",
      instagram: "https://instagram.com/chentotrades",
      telegram: "https://t.me/chentotrades",
      discord: "https://discord.gg/chentotrades",
    },
    showFormats: ["banter", "stream", "education"],
    isShowFormat: false,
    channelTrailerDraft: {
      hook: "Why Chento Trades? Real markets. Real streams. Zero fluff.",
      script: `[0:00] Why Chento Trades? Real markets. Real streams. Zero fluff.
[0:08] Daily live crypto · Banter with guests · Education series for serious traders.
[0:22] Best moments: macro calls · alt season playbooks · community AMA highlights
[0:38] Subscribe + hit the bell — we go live every week across stream, Banter, and education formats.`,
      cta: "Subscribe for live alerts",
      suggestedClips: ["Banter guest highlight (15s)", "BTC weekly setup hook", "Education risk lesson clip"],
      status: "approved",
    },
  },
  {
    slug: "thomas",
    displayName: "Thomas",
    hostLabel: "Thomas",
    youtubeChannelId: DEMO_YOUTUBE_IDS.thomas,
    trackAccountId: "tfxtradez",
    descriptionTemplate: `Hosted by Thomas · London-session scalps and intraday crypto breakdowns.

Live order flow, quick hits, and post-session recap clips. Part of the FlowX trader roster.

Not financial advice.`,
    tags: ["crypto", "scalping", "bitcoin", "trading", "live", "london session", "flowx"],
    socialLinks: { x: "https://x.com/tfxtradez" },
    showFormats: ["stream"],
    isShowFormat: false,
    channelTrailerDraft: {
      hook: "Thomas · London open scalps in real time.",
      script: `[0:00] Thomas · London open scalps in real time.
[0:10] Intraday BTC/ETH · tight risk · no hype.
[0:25] Subscribe for session alerts.`,
      cta: "Subscribe",
      suggestedClips: ["London open entry clip", "Session recap montage"],
      status: "pending_qc",
    },
  },
  {
    slug: "king-azoulay",
    displayName: "King Azoulay",
    hostLabel: "King Azoulay",
    youtubeChannelId: DEMO_YOUTUBE_IDS["king-azoulay"],
    trackAccountId: "king-azoulay",
    descriptionTemplate: `Hosted by King Azoulay · premium setups, swing context, and live chart reviews.

Weekly streams + deep-dive education on structure and confluence. FlowX roster.`,
    tags: ["crypto", "swing trading", "bitcoin", "charts", "premium setups", "education"],
    socialLinks: { x: "https://x.com/kingazoulay" },
    showFormats: ["stream", "education"],
    isShowFormat: false,
    channelTrailerDraft: null,
  },
  {
    slug: "paladin",
    displayName: "Paladin",
    hostLabel: "Paladin",
    youtubeChannelId: DEMO_YOUTUBE_IDS.paladin,
    trackAccountId: "paladin-trades",
    descriptionTemplate: `Hosted by Paladin · disciplined swing and position trading on major crypto pairs.

Live reviews, journal walkthroughs, and risk-first frameworks.`,
    tags: ["crypto", "swing", "position trading", "risk management", "bitcoin"],
    socialLinks: {},
    showFormats: ["stream"],
    isShowFormat: false,
    channelTrailerDraft: null,
  },
  {
    slug: "dmitry",
    displayName: "Dmitry",
    hostLabel: "Dmitry",
    youtubeChannelId: DEMO_YOUTUBE_IDS.dmitry,
    trackAccountId: "dmitry-trades",
    descriptionTemplate: `Hosted by Dmitry · US session live trading and macro-aware intraday plans.

Streams focus on liquidity, levels, and execution under volatility.`,
    tags: ["crypto", "us session", "trading", "liquidity", "macro", "live"],
    socialLinks: {},
    showFormats: ["stream"],
    isShowFormat: false,
    channelTrailerDraft: null,
  },
  {
    slug: "piltr",
    displayName: "PILTR",
    hostLabel: "Nico (PILTR)",
    youtubeChannelId: DEMO_YOUTUBE_IDS.piltr,
    trackAccountId: "nico-pltrs",
    descriptionTemplate: `Hosted by Nico · PILTR live altcoin rotations and momentum plays.

High-energy streams · clip-friendly moments · community-driven watchlists.`,
    tags: ["crypto", "altcoins", "momentum", "live trading", "piltr", "rotations"],
    socialLinks: { x: "https://x.com/nico_pltrs" },
    showFormats: ["stream"],
    isShowFormat: false,
    channelTrailerDraft: null,
  },
  {
    slug: "madda",
    displayName: "Madda",
    hostLabel: "Madda",
    youtubeChannelId: DEMO_YOUTUBE_IDS.madda,
    trackAccountId: "madda-edu",
    descriptionTemplate: `Hosted by Madda · education-first channel: risk, psychology, and process over picks.

Pre-recorded lessons + occasional live Q&A. Built for traders levelling up.`,
    tags: ["crypto education", "risk management", "trading psychology", "process", "bitcoin"],
    socialLinks: {},
    showFormats: ["education", "stream"],
    isShowFormat: false,
    channelTrailerDraft: null,
  },
  {
    slug: "nick-scalps",
    displayName: "Nick",
    hostLabel: "Nick",
    youtubeChannelId: DEMO_YOUTUBE_IDS["nick-scalps"],
    trackAccountId: "nick-scalps",
    descriptionTemplate: `Hosted by Nick · fast scalps, quick market reads, and short-form clip fuel.

Short live blocks · high clip output · FlowX roster.`,
    tags: ["scalping", "crypto", "quick hits", "live", "shorts", "bitcoin"],
    socialLinks: {},
    showFormats: ["stream"],
    isShowFormat: false,
    channelTrailerDraft: null,
  },
  {
    slug: "yassin",
    displayName: "Yassin",
    hostLabel: "Yassin",
    youtubeChannelId: DEMO_YOUTUBE_IDS.yassin,
    trackAccountId: "tagouguiy",
    descriptionTemplate: `Hosted by Yassin · London-fix session trading and structured daily plans.

Live execution · end-of-day recap · community levels thread.`,
    tags: ["crypto", "london", "trading", "daily plan", "live stream", "bitcoin"],
    socialLinks: { x: "https://x.com/tagouguiy" },
    showFormats: ["stream"],
    isShowFormat: false,
    channelTrailerDraft: null,
  },
  {
    slug: "banter",
    displayName: "Banter",
    hostLabel: "Chento Trades (show host)",
    youtubeChannelId: DEMO_YOUTUBE_IDS.banter,
    trackAccountId: "banter-show",
    descriptionTemplate: `Banter · live talk show entity (not a signal channel).

Hosted by Chento Trades with rotating guests: macro, memes, market banter, and community Q&A. Separate from individual trader channels.

Show formats: Banter live · guest episodes · community AMA.`,
    tags: ["banter", "live talk", "crypto", "guests", "macro", "community", "memes"],
    socialLinks: {
      x: "https://x.com/chentotrades",
      youtube: "https://youtube.com/@BanterShow",
    },
    showFormats: ["banter", "stream"],
    isShowFormat: true,
    channelTrailerDraft: {
      hook: "Banter — crypto talk without the cringe.",
      script: `[0:00] Banter — crypto talk without the cringe.
[0:07] Guests · hot takes · macro · memes · your questions live.
[0:20] Hosted by Chento Trades · new episode every week.
[0:32] Subscribe — you won't hate it.`,
      cta: "Subscribe to Banter",
      suggestedClips: ["Guest one-liner hook", "Macro vs memes debate clip", "AMA best question"],
      status: "approved",
    },
  },
];

const PRE_SHOW_DONE = [
  "3.2",
  "3.1",
  "3.3",
  "1.1",
  "1.2",
  "2.1",
  "1.3",
  "1.4",
  "3.5",
  "1.6",
  "3.4",
  "social-yt",
  "social-x",
  "social-ig",
  "social-fb",
  "social-reddit",
  "social-tg",
  "1.11",
];

const LIVE_DONE = [...PRE_SHOW_DONE, "1.12", "1.13", "3.7", "1.14"];

const POST_DONE = [
  ...LIVE_DONE,
  "1.16",
  "1.17",
  "1.18",
  "1.19",
  "1.20",
  "1.21",
  "1.23",
  "1.24",
];

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400000).toISOString();
}

export const DEMO_SHOWS: DemoShowDef[] = [
  {
    channelSlug: "chento",
    title: "Bitcoin Weekly · Alt Season Playbook",
    format: "stream",
    pipeline: "live",
    status: "scheduled",
    scheduledAt: hoursFromNow(4),
    guestName: null,
    dealId: "deal-demo-001",
    seoTitle: "Bitcoin Weekly · Alt Season Playbook | Chento Trades LIVE",
    seoDescription: `Bitcoin Weekly · Alt Season Playbook — Chento Trades live stream session.

Hosted by Chento · BTC structure, alt rotations, and levels for the week ahead.

🔔 Subscribe · Not financial advice.`,
    seoTags: ["bitcoin", "alt season", "crypto live", "trading", "chento trades", "btc", "altcoins"],
    doneTaskIds: PRE_SHOW_DONE,
    withCrossPosts: true,
    withAnalytics: true,
  },
  {
    channelSlug: "chento",
    title: "Macro Monday · Fed, Rates & Risk",
    format: "stream",
    pipeline: "live",
    status: "completed",
    scheduledAt: daysAgo(3),
    guestName: null,
    dealId: null,
    seoTitle: "Macro Monday · Fed, Rates & Risk | Chento Trades",
    seoDescription: "Full macro breakdown from Monday's live — Fed path, rates, and risk positioning.",
    seoTags: ["macro", "fed", "rates", "bitcoin", "crypto", "chento trades"],
    doneTaskIds: POST_DONE,
    withComments: true,
    withIgCarousel: true,
  },
  {
    channelSlug: "banter",
    title: "Banter Live · King Azoulay on Memecoins & Macro",
    format: "banter",
    pipeline: "live",
    status: "live",
    scheduledAt: hoursFromNow(-1),
    guestName: "King Azoulay",
    dealId: "deal-demo-002",
    seoTitle: "Banter Live · King Azoulay on Memecoins & Macro",
    seoDescription: `Banter Live with guest King Azoulay — memecoins, macro, and market banter.

Hosted by Chento Trades · live Q&A in chat.`,
    seoTags: ["banter", "memecoins", "macro", "king azoulay", "crypto talk", "live"],
    doneTaskIds: LIVE_DONE,
    withComments: true,
    withCrossPosts: true,
    withAnalytics: true,
    liveChapters: [
      { atSec: 0, label: "Cold open · guest intro" },
      { atSec: 720, label: "Memecoin cycle debate" },
      { atSec: 2100, label: "Macro vs degen portfolios" },
      { atSec: 3600, label: "Community Q&A" },
    ],
  },
  {
    channelSlug: "banter",
    title: "Community AMA · June Best Moments",
    format: "banter",
    pipeline: "live",
    status: "completed",
    scheduledAt: daysAgo(7),
    guestName: null,
    dealId: null,
    seoTitle: "Community AMA · June Best Moments | Banter",
    seoDescription: "June community AMA recap — top questions, guest clips, and Banter highlights.",
    seoTags: ["banter", "ama", "community", "crypto", "highlights"],
    doneTaskIds: POST_DONE,
    withComments: true,
  },
  {
    channelSlug: "thomas",
    title: "London Open Scalps · BTC & ETH",
    format: "stream",
    pipeline: "live",
    status: "scheduled",
    scheduledAt: hoursFromNow(18),
    guestName: null,
    dealId: null,
    seoTitle: "London Open Scalps · BTC & ETH | Thomas LIVE",
    seoDescription: "Thomas · London session intraday scalps on BTC and ETH.",
    seoTags: ["scalping", "london", "btc", "eth", "thomas", "live trading"],
    doneTaskIds: PRE_SHOW_DONE.slice(0, 14),
    withCrossPosts: true,
  },
  {
    channelSlug: "king-azoulay",
    title: "Premium Setups · BTC & ETH Swing Map",
    format: "education",
    pipeline: "live",
    status: "scheduled",
    scheduledAt: hoursFromNow(30),
    guestName: null,
    dealId: null,
    seoTitle: "Premium Setups · BTC & ETH Swing Map | King Azoulay",
    seoDescription: "Swing structure and premium setup review for BTC and ETH.",
    seoTags: ["swing trading", "premium setups", "btc", "eth", "education"],
    doneTaskIds: PRE_SHOW_DONE.slice(0, 12),
  },
  {
    channelSlug: "paladin",
    title: "Swing Trade Review · Weekly Journal",
    format: "stream",
    pipeline: "live",
    status: "draft",
    scheduledAt: hoursFromNow(48),
    guestName: null,
    dealId: null,
    seoTitle: "Swing Trade Review · Weekly Journal | Paladin",
    seoDescription: "Weekly journal walkthrough and open swing positions review.",
    seoTags: ["swing", "journal", "review", "crypto", "paladin"],
    doneTaskIds: ["3.2", "3.1", "1.1", "1.2"],
  },
  {
    channelSlug: "dmitry",
    title: "US Session Open · Liquidity & Levels",
    format: "stream",
    pipeline: "live",
    status: "scheduled",
    scheduledAt: hoursFromNow(8),
    guestName: null,
    dealId: null,
    seoTitle: "US Session Open · Liquidity & Levels | Dmitry LIVE",
    seoDescription: "US open live plan — liquidity pools, levels, and execution.",
    seoTags: ["us session", "liquidity", "levels", "live trading", "dmitry"],
    doneTaskIds: PRE_SHOW_DONE.slice(0, 10),
  },
  {
    channelSlug: "piltr",
    title: "PILTR Live · Altcoin Rotations",
    format: "stream",
    pipeline: "live",
    status: "completed",
    scheduledAt: daysAgo(2),
    guestName: null,
    dealId: null,
    seoTitle: "PILTR Live · Altcoin Rotations",
    seoDescription: "Altcoin rotation stream — momentum plays and watchlist updates.",
    seoTags: ["altcoins", "rotations", "piltr", "momentum", "live"],
    doneTaskIds: POST_DONE,
  },
  {
    channelSlug: "madda",
    title: "Education · Risk Management 101",
    format: "education",
    pipeline: "prerecorded",
    status: "completed",
    scheduledAt: daysAgo(5),
    guestName: null,
    dealId: null,
    seoTitle: "Risk Management 101 | Madda Education",
    seoDescription: "Pre-recorded lesson: position sizing, drawdown rules, and process.",
    seoTags: ["education", "risk management", "trading psychology", "madda"],
    doneTaskIds: POST_DONE.filter((id) => !["1.11", "1.12", "1.13", "3.7", "1.14"].includes(id)),
  },
  {
    channelSlug: "nick-scalps",
    title: "Quick Hits · 30-Min Scalp Block",
    format: "stream",
    pipeline: "live",
    status: "scheduled",
    scheduledAt: hoursFromNow(22),
    guestName: null,
    dealId: null,
    seoTitle: "Quick Hits · 30-Min Scalp Block | Nick",
    seoDescription: "Short live scalp session — fast reads, tight stops.",
    seoTags: ["scalping", "quick hits", "nick", "live", "crypto"],
    doneTaskIds: PRE_SHOW_DONE.slice(0, 8),
  },
  {
    channelSlug: "yassin",
    title: "London Fix · Daily Plan & Execution",
    format: "stream",
    pipeline: "live",
    status: "completed",
    scheduledAt: daysAgo(1),
    guestName: null,
    dealId: null,
    seoTitle: "London Fix · Daily Plan & Execution | Yassin",
    seoDescription: "Daily plan stream with live execution and recap.",
    seoTags: ["london fix", "daily plan", "yassin", "live trading"],
    doneTaskIds: POST_DONE,
  },
  {
    channelSlug: "chento",
    title: "Education · Reading Order Flow",
    format: "education",
    pipeline: "prerecorded",
    status: "completed",
    scheduledAt: daysAgo(10),
    guestName: null,
    dealId: null,
    seoTitle: "Reading Order Flow · Chento Education",
    seoDescription: "Education upload: order flow basics for crypto futures and spot.",
    seoTags: ["order flow", "education", "chento trades", "bitcoin", "lesson"],
    doneTaskIds: POST_DONE.filter((id) => !["1.11", "1.12", "1.13", "3.7", "1.14"].includes(id)),
  },
];

export function profileBySlug(slug: string): ChannelProfile | undefined {
  return CHANNEL_PROFILES.find((p) => p.slug === slug);
}
