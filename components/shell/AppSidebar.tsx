"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { YtxLogoMark } from "@/components/YtxLogo";
import { APP_NAV } from "@/lib/nav";

export function AppSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const nav = (
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
  );

  return (
    <>
      <div id="app-chrome" className="ytx-mobile-bar lg:hidden">
        <button
          type="button"
          className="ytx-mobile-menu-btn"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          Menu
        </button>
        <Link href="/" className="flex items-center min-h-[44px]">
          <YtxLogoMark className="h-6 w-auto" />
        </Link>
      </div>

      {open ? (
        <button
          type="button"
          className="ytx-sidebar-backdrop lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside className={`ytx-sidebar ${open ? "ytx-sidebar-open" : ""}`}>
        <div className="ytx-sidebar-head">
          <Link href="/" className="flex items-center min-h-[44px]">
            <YtxLogoMark className="h-7 w-auto" />
          </Link>
          <button
            type="button"
            className="ytx-sidebar-close lg:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        {nav}
      </aside>
    </>
  );
}
