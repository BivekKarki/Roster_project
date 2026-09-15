export default function Loading() {
  return (
    <div className="mx-auto max-w-md space-y-3 px-3 pt-16" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}
    </div>
  );
}
