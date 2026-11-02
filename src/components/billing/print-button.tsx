"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-4 font-medium text-primary-foreground"
    >
      <Printer className="size-4" aria-hidden />
      {label}
    </button>
  );
}
