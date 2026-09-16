import { avatarColour, initialFor } from "@/lib/session-rules";

/** Profile photo, or the first letter of the name on a coloured circle. */
export function Avatar({ name, email, version, size = 36, className = "" }: {
  name: string | null; email: string; version: number | null; size?: number; className?: string;
}) {
  const label = name || email;
  if (version) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/avatar?v=${version}`} alt={label} width={size} height={size}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white/70 ${className}`} style={{ width: size, height: size }} />
    );
  }
  return (
    <span aria-label={label} role="img"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white ring-2 ring-white/70 ${className}`}
      style={{ width: size, height: size, background: avatarColour(label), fontSize: Math.round(size * 0.45) }}>
      {initialFor(name, email)}
    </span>
  );
}
