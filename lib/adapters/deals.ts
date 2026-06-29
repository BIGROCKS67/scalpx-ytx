import { scoutFetch } from "@/lib/adapters/scoutClient";
import type { SponsorBlock } from "@/lib/types";

type TrackingLink = {
  id: string;
  slug: string;
  label: string;
  destinationUrl: string;
  dealId: string | null;
};

type Deal = {
  id: string;
  sponsorName: string;
  status: string;
};

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

export async function buildSponsorBlock(dealId: string | null): Promise<SponsorBlock> {
  if (!dealId) {
    return {
      dealId: null,
      sponsorName: "No deal linked",
      urls: [],
      copy: "",
      requiresAd: false,
    };
  }

  const [dealRes, linksRes] = await Promise.all([
    scoutFetch<{ deal?: Deal }>(`/api/deals/${dealId}`),
    scoutFetch<{ links: TrackingLink[] }>("/api/tracking-links"),
  ]);

  const sponsorName =
    dealRes.ok && "deal" in dealRes.data && dealRes.data.deal
      ? dealRes.data.deal.sponsorName
      : dealRes.ok
        ? (dealRes.data as unknown as Deal).sponsorName ?? "Sponsor"
        : "Sponsor (offline)";

  const links =
    linksRes.ok && linksRes.data.links
      ? linksRes.data.links.filter((l) => l.dealId === dealId)
      : [];

  const urls = await Promise.all(
    links.map(async (l) => ({
      label: l.label,
      url: l.destinationUrl,
      slug: l.slug,
      healthy: await checkUrl(l.destinationUrl),
    }))
  );

  const linkLines = urls.map((u) => `${u.label}: ${u.url}`).join("\n");
  const copy = urls.length
    ? `#ad · Sponsored by ${sponsorName}\n\n${linkLines}\n\nNot financial advice.`
    : `Link active sponsor TrackingLinks in FlowX Scout for deal ${dealId}.`;

  return {
    dealId,
    sponsorName,
    urls,
    copy,
    requiresAd: urls.length > 0,
  };
}

export async function listScoutDeals() {
  const res = await scoutFetch<{ deals: Deal[] }>("/api/deals");
  if (!res.ok) return [];
  return res.data.deals.filter((d) => d.status === "active" || d.status === "pipeline");
}
