"use client";

import { Zap } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

// SCR-A01 queue: polls every 4 s (TRD §7.2), so new items appear without a reload.

type QueueItem = {
  id: string;
  type: "LICENSE" | "JOB" | "REPORT";
  title: string;
  fileName: string | null;
  ageMinutes: number;
  flagCount: number;
  isFastApprove: boolean;
};

const fetcher = async (url: string): Promise<{ items: QueueItem[] }> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

export function ModerationQueue() {
  const t = useTranslations("moderation");
  const [tab, setTab] = useState<"LICENSE" | "JOB">("LICENSE");
  const { data, error } = useSWR("/api/admin/moderation?status=PENDING", fetcher, {
    refreshInterval: 4000,
    keepPreviousData: true,
  });

  const count = (type: QueueItem["type"]) => data?.items.filter((i) => i.type === type).length ?? 0;
  const items = data?.items.filter((i) => i.type === tab) ?? [];
  const age = (m: number) =>
    m < 60
      ? t("ageMinutes", { count: m })
      : m < 1440
        ? t("ageHours", { count: Math.floor(m / 60) })
        : t("ageDays", { count: Math.floor(m / 1440) });

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-h1">{t("title")}</h1>
      <div role="tablist" aria-label={t("title")} className="flex gap-1 border-b border-border">
        {(["LICENSE", "JOB"] as const).map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={tab === type}
            onClick={() => setTab(type)}
            className={cn(
              "min-h-10 border-b-2 px-3 text-small font-medium",
              tab === type
                ? "border-primary text-foreground"
                : "border-transparent text-text-secondary hover:text-foreground",
            )}
          >
            {type === "LICENSE" ? t("licenses") : t("jobs")} ({count(type)})
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-small text-danger-fg">
          {t("loadFailed")}
        </p>
      )}
      {!data && !error && <p className="text-text-secondary">{t("loading")}</p>}
      {data && items.length === 0 && <p className="text-text-secondary">{t("empty")}</p>}

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-small">
            <thead className="border-b border-border text-text-secondary">
              <tr>
                <th className="px-4 py-2 font-medium">{t("colItem")}</th>
                <th className="px-4 py-2 font-medium">{t("colAge")}</th>
                <th className="px-4 py-2 font-medium">{t("colFlags")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/queue/${item.id}`}
                      className="font-semibold text-navy-700 underline-offset-4 hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.fileName && (
                      <span className="block text-caption break-all text-text-secondary">
                        {item.fileName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{age(item.ageMinutes)}</td>
                  <td className="px-4 py-3">
                    {item.flagCount > 0 ? t("flags", { count: item.flagCount }) : "—"}
                    {item.isFastApprove && (
                      <span className="ml-2 inline-flex items-center gap-1 text-caption text-info-fg">
                        <Zap className="size-3" aria-hidden />
                        {t("fastApprove")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
