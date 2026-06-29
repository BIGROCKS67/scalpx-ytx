import { scoutFetch } from "@/lib/adapters/scoutClient";

type TrackAccount = {
  id: string;
  handle: string;
  platform: string;
  followers: number;
  engagementRate: number;
};

type TrackPost = {
  id: string;
  views: number;
  likes: number;
  postedAt: string;
};

export async function getTrackContext(accountId: string | null) {
  if (!accountId) return null;
  const res = await scoutFetch<{
    accounts: TrackAccount[];
    postsByAccount: Record<string, TrackPost[]>;
  }>("/api/track/dashboard");
  if (!res.ok) return null;
  const account = res.data.accounts.find((a) => a.id === accountId);
  const posts = res.data.postsByAccount[accountId] ?? [];
  const avgViews =
    posts.length > 0 ? posts.reduce((s, p) => s + p.views, 0) / posts.length : 0;
  return { account, posts: posts.slice(0, 10), avgViews };
}

export async function getRecentVideoPerformance(accountId: string | null) {
  const ctx = await getTrackContext(accountId);
  if (!ctx) return [];
  return ctx.posts;
}
