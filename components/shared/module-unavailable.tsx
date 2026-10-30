import Link from "next/link";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { businessTypeConfig } from "@/lib/business-types";
import type { BusinessType } from "@/lib/types";

export function ModuleUnavailable({ module, type }: { module: string; type: BusinessType }) {
  return (
    <div className="space-y-4">
      <EmptyState
        icon={Lock}
        title={`${module} is not part of this business`}
        description={`${businessTypeConfig[type].title} keeps this module hidden. Nothing was deleted. Switch business, or change the type in Settings.`}
      />
      <Link href="/" className="inline-flex text-sm font-medium text-accent">
        Back to overview
      </Link>
    </div>
  );
}
