export default function Loading() {
  return (
    <div>
      <div className="mb-6 h-9 w-40 animate-pulse rounded bg-paper-dim" />
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse bg-paper" />
        ))}
      </div>
    </div>
  );
}
