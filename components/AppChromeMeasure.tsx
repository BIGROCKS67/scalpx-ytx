"use client";

import { useEffect } from "react";

/** Sets --app-chrome-h from the fixed nav height (matches FlowX Scout). */
export function AppChromeMeasure() {
  useEffect(() => {
    const el = document.getElementById("app-chrome");
    if (!el) return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--app-chrome-h", `${el.offsetHeight}px`);
    });
    ro.observe(el);
    document.documentElement.style.setProperty("--app-chrome-h", `${el.offsetHeight}px`);
    return () => ro.disconnect();
  }, []);
  return null;
}
