"use client";

import { startTransition, useActionState, useState } from "react";
import { removeAvatar, updateAutoLogout, updateProfile, uploadAvatar } from "@/app/actions/profile";
import { IDLE_OPTIONS } from "@/lib/session-rules";
import { Avatar } from "./Avatar";
import { SubmitButton } from "./SubmitButton";
import { Alert, btn, Field } from "./ui";

const SIZE = 256;

/** Crop to a centred square and shrink to 256×256 JPEG in the browser before uploading. */
async function resizeToSquare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85));
}

export function AvatarUploader({ name, email, version }: { name: string | null; email: string; version: number | null }) {
  const [state, action, pending] = useActionState(uploadAvatar, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  const onFile = async (file: File | undefined) => {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a photo (JPG, PNG or WebP).");
    try {
      const blob = await resizeToSquare(file);
      setPreview(URL.createObjectURL(blob));
      const fd = new FormData();
      fd.append("avatar", blob, "avatar.jpg");
      startTransition(() => action(fd));
    } catch {
      setError("Couldn't read that photo. Try a JPG or PNG.");
    }
  };

  return (
    <div className="flex items-center gap-4">
      {preview && pending ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" width={80} height={80} className="h-20 w-20 rounded-full object-cover opacity-70" />
      ) : (
        <Avatar name={name} email={email} version={version} size={80} className="ring-slate-200" />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <label className={`${btn.ghost} w-full cursor-pointer`}>
          {pending ? "Uploading…" : version ? "Change photo" : "Add photo"}
          <input type="file" accept="image/*" className="sr-only" disabled={pending} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {version && !pending && (
          <form action={removeAvatar}>
            <SubmitButton variant="danger" pendingText="Removing…" className="w-full py-2 text-sm">Remove photo</SubmitButton>
          </form>
        )}
        {(error || state?.error) && <Alert tone="error">{error || state?.error}</Alert>}
        {!version && !error && <p className="text-xs text-slate-500">Without a photo, your first initial is shown.</p>}
      </div>
    </div>
  );
}

export function NameForm({ name }: { name: string | null }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action}>
      <Field label="Name" htmlFor="name" hint="Shown in the greeting and your profile icon">
        <input id="name" name="name" defaultValue={name ?? ""} autoComplete="given-name" maxLength={80} className="input" />
      </Field>
      {state?.error && <div className="mb-2"><Alert tone="error">{state.error}</Alert></div>}
      {state?.ok && <div className="mb-2"><Alert tone="ok">{state.message}</Alert></div>}
      <SubmitButton variant="ghost" className="w-full">Save name</SubmitButton>
    </form>
  );
}

export function AutoLogoutForm({ minutes }: { minutes: number }) {
  const [state, action] = useActionState(updateAutoLogout, undefined);
  const [value, setValue] = useState(minutes);
  return (
    <form action={action}>
      <input type="hidden" name="idleTimeoutMinutes" value={value} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Log out after no activity for">
        {IDLE_OPTIONS.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => setValue(o.value)}
            className={`rounded-xl border px-2 py-3 text-sm font-semibold ${o.value === 0 ? "col-span-2" : ""} ${value === o.value ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            {o.value === 0 ? "Never" : o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        You get a 60-second warning first. For safety, every login also ends after the maximum session length, even if you stay active.
      </p>
      {state?.error && <div className="mt-2"><Alert tone="error">{state.error}</Alert></div>}
      {state?.ok && <div className="mt-2"><Alert tone="ok">{state.message}</Alert></div>}
      <SubmitButton className="mt-3 w-full">Save auto logout</SubmitButton>
    </form>
  );
}
