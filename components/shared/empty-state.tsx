import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-inner border border-dashed border-line bg-[#F8FAFF] px-6 py-12 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-tint text-accent">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-secondary">{description}</p>
    </div>
  );
}
