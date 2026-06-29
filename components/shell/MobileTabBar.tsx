"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV } from "@/lib/nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="ytx-mobile-tabbar lg:hidden" aria-label="Main navigation">
      {APP_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`ytx-mobile-tab ${active ? "ytx-mobile-tab-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
