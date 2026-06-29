import { Suspense } from "react";
import { ShowsView } from "@/components/ytx/ShowsView";

export default function ShowsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-dim">Loading…</div>
      }
    >
      <ShowsView />
    </Suspense>
  );
}
