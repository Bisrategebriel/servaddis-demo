import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";

// Bell with unread badge. The dropdown list and polling arrive with T1.5.
export async function NotificationBell({ count }: { count: number }) {
  const t = await getTranslations("shell");
  return (
    <span
      className="relative inline-flex size-10 items-center justify-center rounded-lg text-text-secondary"
      role="img"
      aria-label={`${t("notifications")}: ${t("unread", { count })}`}
    >
      <Bell className="size-5" aria-hidden />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] leading-4 font-bold text-navy-900">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </span>
  );
}
