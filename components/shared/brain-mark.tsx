import { Sparkles } from "lucide-react";

export function BrainMark({ label = "Business Brain" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-chip-lavender-ink">
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
