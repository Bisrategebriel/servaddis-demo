"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

// Bell with unread badge and list (TRD §5.8). Polls every 4 s, not the TRD's 10 s: the demo
// script needs the Verified notification on screen within 5 s of approval (S3, script step 4).

type Item = {
  id: string;
  titleEn: string;
  titleAm: string;
  bodyEn: string | null;
  bodyAm: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};
type Feed = { items: Item[]; unreadCount: number; now: string };

const fetcher = async (url: string): Promise<Feed> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

const markRead = (ids?: string[]) =>
  fetch("/api/notifications/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  });

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const t = useTranslations("shell");
  const format = useFormatter();
  const am = useLocale() === "am";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data, mutate } = useSWR("/api/notifications", fetcher, {
    refreshInterval: 4000,
    keepPreviousData: true,
  });
  const count = data?.unreadCount ?? initialCount;

  async function select(item: Item) {
    setOpen(false);
    if (!item.readAt) {
      await markRead([item.id]);
      void mutate();
    }
    if (item.href) router.push(item.href);
  }

  async function readAll() {
    await markRead();
    void mutate();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${t("notifications")}: ${t("unread", { count })}`}
        className="relative inline-flex size-10 items-center justify-center rounded-lg text-text-secondary hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" aria-hidden />
        {count > 0 && (
          <span
            data-testid="bell-count"
            className="absolute top-1 right-1 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] leading-4 font-bold text-navy-900"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="z-50 flex max-h-[70vh] w-80 max-w-[calc(100vw-1rem)] flex-col rounded-2xl border border-border bg-popover text-popover-foreground shadow-overlay"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
            <h2 className="text-h3">{t("notifications")}</h2>
            {count > 0 && (
              <button
                type="button"
                onClick={readAll}
                className="min-h-10 text-small text-navy-700 underline underline-offset-4"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>
          {data?.items.length ? (
            <ul className="overflow-y-auto">
              {data.items.map((item) => (
                <li key={item.id} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() => select(item)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-accent",
                      !item.readAt && "bg-navy-50",
                    )}
                  >
                    <span className={cn("text-small", !item.readAt && "font-semibold")}>
                      {am ? item.titleAm : item.titleEn}
                    </span>
                    {(am ? item.bodyAm : item.bodyEn) && (
                      <span className="text-small text-text-secondary">
                        {am ? item.bodyAm : item.bodyEn}
                      </span>
                    )}
                    <span className="text-caption text-text-secondary">
                      {format.relativeTime(new Date(item.createdAt), new Date(data.now))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-small text-text-secondary">{t("noNotifications")}</p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
