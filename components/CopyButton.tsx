"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * Copies `text` to the clipboard and briefly shows "Copied ✓". Pass a function
 * to build the text at click time (e.g. from window.location).
 */
export default function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string | (() => string);
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (e.g. insecure context); callers also
      // show the text itself for manual copying.
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={copy} className={className}>
      {copied ? "Copied ✓" : label}
    </Button>
  );
}
