import type { ReactNode } from "react";

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] md:text-[20px]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-secondary">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
