"use client";

import { useFormStatus } from "react-dom";
import { btn } from "./ui";

export function SubmitButton({ children, pendingText = "Saving…", className = "", variant = "primary" }: {
  children: React.ReactNode; pendingText?: string; className?: string; variant?: keyof typeof btn;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${btn[variant]} ${className}`}>
      {pending ? pendingText : children}
    </button>
  );
}
