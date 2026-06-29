/** Single source of truth for YTX app navigation. */
export const APP_NAV = [
  { href: "/", label: "Home" },
  { href: "/shows", label: "Shows" },
  { href: "/viral", label: "Viral" },
  { href: "/channels", label: "Roster" },
  { href: "/settings", label: "Settings" },
] as const;

export type AppNavHref = (typeof APP_NAV)[number]["href"];
