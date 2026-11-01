"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { OtpInput } from "./otp-input";

// SCR-01 Sign-in: phone → OTP, with an extra choice for new numbers (App Flow §2).

type Intent = "EMPLOYER" | "JOBSEEKER";
type ApiError = {
  error?: {
    message: string;
    messageAm: string;
    details?: { reason?: string; retryAfterSec?: number };
  };
};

const post = async (path: string, body: unknown) => {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: (await res.json()) as ApiError & Record<string, unknown> };
};

/** Only same-site paths: `next` comes from the URL, so it must never leave the app. */
const safeNext = (next: string | null) =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : null;

export function LoginForm() {
  const t = useTranslations("login");
  const landing = useTranslations("landing");
  const locale = useLocale();
  const params = useSearchParams();
  const landingIntent = params.get("intent");

  const [step, setStep] = useState<"phone" | "code" | "intent">("phone");
  const [input, setInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [intent, setIntent] = useState<Intent | undefined>(
    landingIntent === "EMPLOYER" || landingIntent === "JOBSEEKER" ? landingIntent : undefined,
  );
  const [demoHint, setDemoHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function showError(data: ApiError) {
    const e = data.error;
    setError(e ? (locale === "am" ? e.messageAm : e.message) : t("networkError"));
    if (e?.details?.reason === "LOCKED") setLocked(true);
    if (e?.details?.reason === "RESEND_COOLDOWN") setResendIn(e.details.retryAfterSec ?? 30);
  }

  async function sendCode(e164: string) {
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/auth/otp/request", { phone: e164 });
      if (ok) {
        setPhone(e164);
        setCode("");
        setStep("code");
        setResendIn((data.resendInSec as number) ?? 30);
        setDemoHint(data.demoHint === true);
      } else {
        showError(data);
      }
    } catch {
      setError(t("networkError"));
    }
    setBusy(false);
  }

  function submitPhone(e: FormEvent) {
    e.preventDefault();
    const e164 = normalizePhone(input);
    if (e164) void sendCode(e164);
    else setError(t("invalidPhone"));
  }

  async function verify(fullCode: string, chosen?: Intent) {
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/auth/otp/verify", {
        phone,
        code: fullCode,
        intent: chosen,
      });
      if (ok) {
        // A full load: the user's saved language may switch the root layout.
        const target = safeNext(params.get("next")) ?? (data.redirectTo as string);
        window.location.replace(new URL(target, window.location.origin).href);
        return;
      }
      if (data.error?.details?.reason === "INTENT_REQUIRED") {
        setStep("intent");
      } else {
        showError(data);
        setCode("");
      }
    } catch {
      setError(t("networkError"));
    }
    setBusy(false);
  }

  function onCodeChange(next: string) {
    setCode(next);
    if (next.length === 6 && !busy) void verify(next, intent);
  }

  function choose(chosen: Intent) {
    setIntent(chosen);
    void verify(code, chosen);
  }

  return (
    <div className="flex flex-col gap-4 py-6">
      {step === "phone" && (
        <form onSubmit={submitPhone} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="phone" className="text-h2">
              {t("phoneLabel")}
            </label>
            <div className="flex h-12 items-center rounded-sm border border-input bg-card focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
              <span className="px-3 text-text-secondary" aria-hidden>
                +251
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-describedby="phone-hint"
                aria-invalid={error ? true : undefined}
                className="h-full min-w-0 flex-1 bg-transparent pr-3 outline-none"
              />
            </div>
            <p id="phone-hint" className="text-small text-text-secondary">
              {t("phoneHint")}
            </p>
          </div>
          <Button type="submit" disabled={busy || !input} className="h-12 text-body">
            {busy ? t("sending") : t("sendCode")}
          </Button>
        </form>
      )}

      {step === "code" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 id="code-label" className="text-h2">
              {t("enterCode")}
            </h1>
            <p className="text-small text-text-secondary">
              {t("codeSentTo", { phone: formatPhone(phone) })}
            </p>
          </div>
          <OtpInput
            value={code}
            onChange={onCodeChange}
            disabled={busy || locked}
            labelledBy="code-label"
          />
          {demoHint && (
            <p className="w-fit rounded-sm bg-amber-100 px-2 py-1 text-caption text-warning-fg">
              {t("demoHint")}
            </p>
          )}
          {busy && <p role="status">{t("verifying")}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="link"
              className="h-11 px-0 text-small"
              disabled={busy || locked || resendIn > 0}
              onClick={() => sendCode(phone)}
            >
              {resendIn > 0 ? t("resendIn", { seconds: resendIn }) : t("resend")}
            </Button>
            <Button
              variant="link"
              className="h-11 px-0 text-small"
              disabled={busy}
              onClick={() => {
                setStep("phone");
                setError(null);
                setLocked(false);
              }}
            >
              {t("changeNumber")}
            </Button>
          </div>
        </div>
      )}

      {step === "intent" && (
        <div className="flex flex-col gap-3">
          <h1 className="text-h2">{t("chooseIntent")}</h1>
          <Button className="h-12 text-body" disabled={busy} onClick={() => choose("EMPLOYER")}>
            {landing("hiring")}
          </Button>
          <Button
            variant="outline"
            className="h-12 text-body"
            disabled={busy}
            onClick={() => choose("JOBSEEKER")}
          >
            {landing("looking")}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
