/** Shown the instant you tap a tab, while the page's data loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="sticky top-0 z-20 bg-ink" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="h-5 w-28 rounded bg-white/25" />
            <div className="mt-1.5 h-3 w-40 rounded bg-white/15" />
          </div>
          <div className="h-9 w-9 rounded-full bg-white/25" />
        </div>
      </div>
      <main className="pb-nav mx-auto max-w-md space-y-3 px-3 pt-3">
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-64 w-full" />
        <div className="skeleton h-40 w-full" />
      </main>
    </div>
  );
}
