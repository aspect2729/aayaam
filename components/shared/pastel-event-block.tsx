import { cn } from "@/lib/utils";
import { toneClasses } from "@/components/shared/status-chip";
import type { ChipTone } from "@/lib/types";

export function PastelEventBlock({
  title,
  time,
  detail,
  tone,
  className,
}: {
  title: string;
  time?: string;
  detail?: string;
  tone: ChipTone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-inner border px-3 py-2", toneClasses[tone], className)}>
      <p className="text-[13px] font-semibold leading-snug">{title}</p>
      {time ? <p className="mt-0.5 text-[12px]">{time}</p> : null}
      {detail ? <p className="mt-0.5 text-[12px]">{detail}</p> : null}
    </div>
  );
}
