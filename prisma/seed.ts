/**
 * Seeds a demo account with the example roster from the brief.
 * Run: npm run db:seed
 * Log in with SEED_EMAIL / SEED_PASSWORD (defaults below). Change the password after logging in.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../lib/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL or DIRECT_URL in .env");
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const email = (process.env.SEED_EMAIL ?? "demo@shiftbook.local").toLowerCase();
const password = process.env.SEED_PASSWORD ?? "change-me-now";
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const SITES = [
  { employer: "Adairs", location: "Bondi", defaultStart: "07:00", defaultEnd: "09:00" },
  { employer: "Aldi", location: "Edgecliff", defaultStart: "09:00", defaultEnd: "11:00" },
  { employer: "Officeworks", location: "Northrocks", defaultStart: "18:00", defaultEnd: "21:00" },
];
// Fortnights from Mon 07/09/2026, officially paid the Tuesday after (22/09), usually 7 days late (29/09)
const CYCLE = { payPeriodStart: day("2026-09-07"), payPeriodDays: 14, payWeekday: 2, payLateDays: 7, payDelayDays: 14 };

async function main() {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists. Nothing to do.`);
    return;
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: "Demo",
      passwordHash: await bcrypt.hash(password, 12),
      settings: { create: { fortnightStart: day("2026-09-07") } },
    },
  });
  for (const s of SITES) {
    await prisma.site.create({
      data: {
        ...s,
        userId: user.id,
        payFrequency: "FORTNIGHTLY",
        ...CYCLE,
        shifts: {
          create: {
            userId: user.id, employer: s.employer, location: s.location, date: day("2026-09-14"),
            startTime: s.defaultStart, endTime: s.defaultEnd, status: "SCHEDULED",
            payPeriodStart: day("2026-09-07"), payPeriodEnd: day("2026-09-20"),
            officialPayDate: day("2026-09-22"), expectedPayDate: day("2026-09-29"),
          },
        },
      },
    });
  }
  console.log(`Seeded ${email} with ${SITES.length} example shifts. Password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
