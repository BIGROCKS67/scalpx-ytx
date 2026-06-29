"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="ytx-copy-field">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-dim">{label}</span>
        <Button size="sm" variant="secondary" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <code className="ytx-copy-value">{value}</code>
      {hint ? <p className="text-[11px] text-dim mt-1.5">{hint}</p> : null}
    </div>
  );
}
