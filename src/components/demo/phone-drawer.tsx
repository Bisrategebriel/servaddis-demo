"use client";

import { MessageSquareText, Smartphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SimulatedTag } from "@/components/simulated-tag";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

// Toolkit phone drawer (TRD §5.10, App Flow §10): the simulated SMS gateway's outbox, drawn as a
// phone's message list. Polls while open, so a text sent by an action on another window (an
// invite, a shortlist, a check-in) appears without touching anything.

type Sms = {
  id: string;
  toPhone: string;
  name: string | null;
  body: string;
  kind: "OTP" | "ALERT" | "CHECKIN" | "INVITE";
  createdAt: string;
};

const POLL_MS = 3000;

export function PhoneDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("demo");
  const locale = useLocale();
  const [items, setItems] = useState<Sms[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const load = async () => {
      const res = await fetch("/api/demo/sms").catch(() => null);
      if (live && res?.ok) setItems((await res.json()).items);
    };
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t("closePhone")}
        className="w-full gap-0 bg-navy-950 p-3 sm:max-w-sm"
        data-testid="phone-drawer"
      >
        {/* The phone: a rounded screen inside the dark bezel */}
        <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-background">
          <SheetHeader className="gap-1 border-b border-border bg-card px-4 pt-5 pb-3">
            <SheetTitle className="flex items-center gap-2 text-h3">
              <Smartphone className="size-5 text-text-secondary" aria-hidden />
              {t("phoneTitle")}
              <SimulatedTag />
            </SheetTitle>
            <SheetDescription className="text-caption text-text-secondary">
              {t("phoneHint")}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-3 py-4" aria-live="polite">
            {items?.length === 0 && (
              <p className="px-2 py-6 text-center text-small text-text-secondary">
                {t("smsEmpty")}
              </p>
            )}
            <ol className="flex flex-col gap-3">
              {items?.map((s) => (
                <li key={s.id} data-testid="sms" className="flex flex-col gap-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 px-1 text-caption text-text-secondary">
                    <span className="font-semibold text-foreground">
                      {s.name || t("unknownRecipient")}
                    </span>
                    <span>{formatPhone(s.toPhone)}</span>
                    <span>· {t(`smsKind.${s.kind}`)}</span>
                  </p>
                  <div className="flex items-start gap-2">
                    <MessageSquareText
                      className="mt-2 size-4 shrink-0 text-text-secondary"
                      aria-hidden
                    />
                    <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-small whitespace-pre-line shadow-card">
                      {s.body}
                    </p>
                  </div>
                  <p className="px-7 text-caption text-text-secondary">
                    {formatDateTime(s.createdAt, locale)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
