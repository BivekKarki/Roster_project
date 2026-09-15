import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-bold">Not found</h1>
      <p className="text-slate-600">That shift or page doesn&apos;t exist. It may have been deleted.</p>
      <Link href="/" className="rounded-xl bg-ink px-4 py-3 font-semibold text-white">Go to dashboard</Link>
    </main>
  );
}
