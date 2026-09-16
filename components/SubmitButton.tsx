"use client";

import { useFormStatus } from "react-dom";
import { btn } from "./ui";

export function SubmitButton({ children, pendingText = "Saving…", className = "", variant = "primary", disabled = false }: {
  children: React.ReactNode; pendingText?: string; className?: string; variant?: keyof typeof btn; disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={`${btn[variant]} disabled:opacity-50 ${className}`}>
      {pending ? pendingText : children}
    </button>
  );
}
