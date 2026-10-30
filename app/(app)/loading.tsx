import { ListSkeleton } from "@/components/shared/list-skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <Card className="p-6">
      <ListSkeleton rows={6} />
    </Card>
  );
}
