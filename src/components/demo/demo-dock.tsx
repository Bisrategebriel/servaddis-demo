"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { DemoStatus } from "@/lib/demo";

// Presenter toolkit (doc 04 §4). Asks the API whether demo mode is on, so pages stay static, and
// loads the panel lazily so its code never counts against the jobseeker bundle budget.
const DemoPanel = dynamic(() => import("./demo-panel"), { ssr: false });

export function DemoDock() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/demo/status")
      .then((res) => (res.ok ? (res.json() as Promise<DemoStatus>) : null))
      .then((s) => {
        if (live) setStatus(s);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return status ? <DemoPanel status={status} /> : null;
}
