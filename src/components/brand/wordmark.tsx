import Image from "next/image";
import { cn } from "@/lib/utils";

// Reversed wordmark for navy app bars and sidebars (doc 04 §2.1): white "Serv" + amber "አዲስ".
// Amber is only legible on navy (6.87:1), never on white. Live text until the vector wordmark
// arrives (D-5). Uses the reversed icon (amber badge, navy bell) for dark surfaces.
// `labelClassName` lets the sidebar hide the text on the icon rail.
export function Wordmark({
  className,
  labelClassName,
}: {
  className?: string;
  labelClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image src="/icons/servaddis-icon-reversed.svg" alt="" width={32} height={32} priority />
      <span className={cn("text-h3 font-bold text-white", labelClassName)}>
        Serv<span className="text-amber-500">አዲስ</span>
      </span>
    </span>
  );
}
