"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="text-slate-600">The page couldn&apos;t load. Check your connection, then try again.</p>
      <button type="button" onClick={reset} className="rounded-xl bg-ink px-4 py-3 font-semibold text-white">Try again</button>
    </main>
  );
}
