"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

// Six boxes with auto-advance and paste support (doc 04 §5 OtpInput).
export function OtpInput({
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  labelledBy: string;
}) {
  const t = useTranslations("login");
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  function setFrom(start: number, digits: string) {
    const next = (value.padEnd(6, " ").slice(0, start) + digits).slice(0, 6);
    onChange(next.replace(/ /g, "").slice(0, 6));
    boxes.current[Math.min(start + digits.length, 5)]?.focus();
  }

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex justify-between gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          value={value[i] ?? ""}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? 6 : 1}
          aria-label={t("digit", { position: i + 1 })}
          autoFocus={i === 0}
          onChange={(e) => setFrom(i, e.target.value.replace(/\D/g, ""))}
          onPaste={(e) => {
            e.preventDefault();
            setFrom(0, e.clipboardData.getData("text").replace(/\D/g, ""));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              onChange(value.slice(0, i - 1));
              boxes.current[i - 1]?.focus();
            }
          }}
          className="h-12 w-full min-w-0 rounded-sm border border-input bg-card text-center text-h2 tabular-nums disabled:opacity-50"
        />
      ))}
    </div>
  );
}
