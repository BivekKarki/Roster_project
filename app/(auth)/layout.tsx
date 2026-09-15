export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="" width={48} height={48} className="rounded-xl" />
        <div>
          <div className="text-xl font-bold text-ink">ShiftBook</div>
          <div className="text-sm text-slate-600">Roster and pay for your casual jobs</div>
        </div>
      </div>
      {children}
    </main>
  );
}
