import { SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <div className="mb-6 h-9 w-32 animate-pulse rounded bg-paper-dim" />
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded-xl border border-line bg-paper-dim p-3">
            <div className="mb-3 h-5 w-24 animate-pulse rounded bg-paper" />
            <SkeletonList count={3} itemClass="h-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
