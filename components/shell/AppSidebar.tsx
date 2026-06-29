"use client";

import Link from "next/link";
import { YtxLogoMark } from "@/components/YtxLogo";
import { APP_NAV } from "@/lib/nav";
import { usePathname } from "next/navigation";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      <div id="app-chrome" className="ytx-mobile-bar lg:hidden">
        <Link href="/" className="ytx-mobile-logo" aria-label="YTX home">
          <YtxLogoMark className="h-6 w-auto" />
        </Link>
      </div>

      <aside className="ytx-sidebar hidden lg:flex">
        <div className="ytx-sidebar-head">
          <Link href="/" className="flex items-center min-h-[44px]">
            <YtxLogoMark className="h-7 w-auto" />
          </Link>
        </div>
        <nav className="ytx-sidebar-nav" aria-label="Main">
          {APP_NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/" || pathname === ""
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`ytx-sidebar-link ${active ? "ytx-sidebar-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
