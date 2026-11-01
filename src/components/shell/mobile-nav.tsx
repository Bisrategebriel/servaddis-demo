"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Below 768 px the sidebar becomes a sheet opened from the top bar (doc 04 §4).
export function MobileNav({
  children,
  openLabel,
  closeLabel,
  title,
}: {
  children: ReactNode;
  openLabel: string;
  closeLabel: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close after navigating to another page ("adjust state when a value changes", no effect).
  const [shownFor, setShownFor] = useState(pathname);
  if (pathname !== shownFor) {
    setShownFor(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex size-11 items-center justify-center rounded-lg text-foreground hover:bg-muted md:hidden"
        aria-label={openLabel}
      >
        <Menu className="size-6" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="surface-navy w-70 border-0 bg-sidebar p-4"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="mb-4 flex items-center justify-between">
          <Wordmark />
          <SheetClose
            aria-label={closeLabel}
            className="inline-flex size-11 items-center justify-center rounded-lg text-gray-300 hover:bg-sidebar-accent hover:text-white"
          >
            <X className="size-5" aria-hidden />
          </SheetClose>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
