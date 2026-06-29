import { Suspense } from "react";
import { SettingsView } from "@/components/ytx/SettingsView";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-dim">Loading…</div>}>
      <SettingsView />
    </Suspense>
  );
}
