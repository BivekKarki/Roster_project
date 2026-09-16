"use server";

import { revalidatePath } from "next/cache";
import { parseBackup } from "@/lib/backup";
import { isoToDb } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";
import { requireUserId } from "@/lib/session";
import type { ActionState } from "@/lib/types";

const MAX_BYTES = 5 * 1024 * 1024;

export async function importBackup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const file = formData.get("file");
  const pasted = String(formData.get("text") ?? "").trim();
  const replace = formData.get("replace") === "on";

  let raw = pasted;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: "That file is larger than 5 MB." };
    raw = await file.text();
  }
  if (!raw) return { error: "Choose a backup file or paste the backup text." };

  let backup: ReturnType<typeof parseBackup>;
  try {
    backup = parseBackup(raw);
  } catch (error) {
    return { error: (error as Error).message };
  }

  await prisma.$transaction(async (tx) => {
    if (replace) {
      await tx.shift.deleteMany({ where: { userId } });
      await tx.site.deleteMany({ where: { userId } });
    }
    if (backup.sites.length) {
      await tx.site.createMany({
        data: backup.sites.map((s) => ({ ...s, userId, payPeriodStart: s.payPeriodStart ? isoToDb(s.payPeriodStart) : null })),
        skipDuplicates: true,
      });
    }
    const sites = await tx.site.findMany({ where: { userId }, select: { id: true, employer: true, location: true } });
    const siteIds = new Map(sites.map((s) => [`${s.employer}|${s.location}`, s.id]));
    if (backup.shifts.length) {
      await tx.shift.createMany({
        data: backup.shifts.map((s) => ({
          ...s,
          userId,
          siteId: siteIds.get(`${s.employer}|${s.location}`) ?? null,
          date: isoToDb(s.date),
          payPeriodStart: s.payPeriodStart ? isoToDb(s.payPeriodStart) : null,
          payPeriodEnd: s.payPeriodEnd ? isoToDb(s.payPeriodEnd) : null,
          officialPayDate: s.officialPayDate ? isoToDb(s.officialPayDate) : null,
          expectedPayDate: s.expectedPayDate ? isoToDb(s.expectedPayDate) : null,
          actualPayDate: s.actualPayDate ? isoToDb(s.actualPayDate) : null,
        })),
      });
    }
    if (replace && backup.settings) {
      const { fortnightStart, ...rest } = backup.settings;
      const data = { ...rest, ...(fortnightStart ? { fortnightStart: isoToDb(fortnightStart) } : {}) };
      await tx.settings.upsert({
        where: { userId },
        update: data,
        create: { userId, ...rest, fortnightStart: isoToDb(fortnightStart ?? "2026-09-07") },
      });
    }
  }, { timeout: 30_000 });

  revalidatePath("/", "layout");
  const skippedNote = backup.skipped ? ` ${plural(backup.skipped, "row")} skipped (missing date, times or names).` : "";
  return { ok: true, message: `Imported ${plural(backup.shifts.length, "shift")} and ${plural(backup.sites.length, "employer")}.${skippedNote}` };
}
