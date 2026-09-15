"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/** A submit button that needs two taps, so records aren't deleted by accident. */
export function ConfirmSubmit({ label, confirmLabel, className = "" }: { label: React.ReactNode; confirmLabel: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      className={`inline-flex items-center justify-center rounded-xl border px-4 py-3 text-base font-semibold ${armed ? "border-red-600 bg-red-600 text-white" : "border-red-300 bg-white text-red-700"} ${className}`}
    >
      {pending ? "Working…" : armed ? confirmLabel : label}
    </button>
  );
}
