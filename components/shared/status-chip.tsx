import { cn } from "@/lib/utils";
import type { ChipTone } from "@/lib/types";

export const toneClasses: Record<ChipTone, string> = {
  blue: "bg-chip-blue border-chip-blue-border text-chip-blue-ink",
  sand: "bg-chip-sand border-chip-sand-border text-chip-sand-ink",
  lavender: "bg-chip-lavender border-chip-lavender-border text-chip-lavender-ink",
  mint: "bg-chip-mint border-chip-mint-border text-chip-mint-ink",
  rose: "bg-chip-rose border-chip-rose-border text-chip-rose-ink",
};

export function StatusChip({
  tone,
  children,
  className,
}: {
  tone: ChipTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-medium leading-5",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
