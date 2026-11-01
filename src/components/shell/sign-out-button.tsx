"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh(); // drop any server-rendered, signed-in content from the router cache
  }
  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      aria-label={label}
      title={label}
      className="inline-flex size-10 items-center justify-center rounded-lg text-text-secondary hover:bg-muted hover:text-foreground"
    >
      <LogOut className="size-5" aria-hidden />
    </button>
  );
}
