"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui";

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div>
      {label ? <p className="mb-2 text-[13px] font-medium">{label}</p> : null}
      <div className="flex items-stretch gap-2">
        <code className="block min-w-0 flex-1 overflow-x-auto rounded-[8px] border border-line bg-surface-2 px-3 py-2.5 text-xs text-text sm:text-sm">
          {value}
        </code>
        <Button type="button" variant="secondary" onClick={copy} className="shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
