# ShiftBook: Work Roster & Payment Tracker

A mobile-first web app for tracking shifts across casual jobs. It calculates hours, expected pay, fortnightly earnings, unpaid wages and payment dates. You install it on your Android home screen like a normal app.

**Stack:** Next.js 15 (App Router, server actions) · Neon Postgres · Prisma 7 · Auth.js v5 · Tailwind CSS v4 · Zod · ExcelJS

---

## 1. What you need

- Node.js 20.9 or newer (22 recommended)
- A free [Neon](https://neon.tech) account
- A free [Vercel](https://vercel.com) account and a GitHub repo (for deployment)

## 2. Create the database (Neon)

1. In Neon, create a project. Pick the **Sydney (ap-southeast-2)** region, because it's the closest to you.
2. Open **Connect** and copy two connection strings:
   - the **pooled** one (host contains `-pooler`) → `DATABASE_URL`
   - the **direct** one (turn "Connection pooling" off) → `DIRECT_URL`

## 3. Run it locally

```bash
npm install
cp .env.example .env        # then fill in the values
npx auth secret             # writes AUTH_SECRET into .env.local; copy it into .env
npx prisma migrate dev --name init
npm run dev
```

Open http://localhost:3000, create your account, and tick **Start with the example roster** if you want the three sample shifts.

Optional demo account instead of signing up: `npm run db:seed` (login `demo@shiftbook.local` / `change-me-now`).

### Environment variables

| Name | What it's for |
|---|---|
| `DATABASE_URL` | Neon **pooled** URL, used by the running app |
| `DIRECT_URL` | Neon **direct** URL, used by Prisma migrations |
| `AUTH_SECRET` | Random secret that signs login sessions |
| `APP_TIMEZONE` | Used for "today", overdue payments and weeks. Default `Australia/Sydney` |
| `ALLOW_SIGNUP` | Set to `false` after creating your account so nobody else can register |

## 4. Deploy to Vercel

1. Push the project to a private GitHub repo.
2. In Vercel: **Add New → Project**, then import the repo.
3. Add the environment variables from the table above. You can leave out `DIRECT_URL` if you run migrations locally.
4. Deploy. The build runs `prisma generate` automatically.
5. Whenever you change `prisma/schema.prisma`, apply it to the production database from your computer:
   ```bash
   npx prisma migrate dev --name describe-change   # creates the migration locally
   npm run db:deploy                               # applies migrations to Neon
   ```
6. After signing up on the live site, set `ALLOW_SIGNUP=false` in Vercel and redeploy.

## 5. Install on your Android phone

1. Open your Vercel URL in **Chrome**.
2. Tap **⋮ → Add to Home screen → Install**.
3. ShiftBook now opens full-screen from its own icon. Long-press the icon for the **Add shift** and **Unpaid** shortcuts.

Want a real APK later? Put your URL into [PWABuilder](https://www.pwabuilder.com) and choose **Android**. It wraps the installed app as a Trusted Web Activity.

## 6. Moving data from the Claude version

1. In the old tracker, go to **Settings → Show backup text** and copy it into a file called `backup.json`, or paste it directly.
2. In ShiftBook, go to **Settings → Import a backup**, then choose the file or paste the text.
3. Tick **Replace** only if you want to wipe what's already in ShiftBook.

Statuses, rates, overtime rules and payment records all carry across.

---

## How it works

### Data safety rules
- **Pay dates:** saved on each shift. Editing an employer's pay rule never moves dates on paid shifts.
- **Snapshots:** each shift stores its own employer name, location, times, rate and overtime rule. Changing an employer's defaults only affects **new** shifts.
- **Filling missing rates:** saving a default rate offers to fill it into shifts that have **no** rate. It never overwrites a rate that's already set.
- **Renaming:** renaming an employer or location offers to update the names on old shifts. Times, rates and payments stay the same.
- **Removing an employer:** the employer is removed, but its shifts are kept.
- **Payment history:** changing a shift's status never clears its payment details.
- **Marking several shifts paid:** this runs in one database transaction, so either all of the shifts are updated or none are.

### Calculations (`lib/calc.ts`)
- **Hours** = end − start − unpaid break. Overnight shifts are handled.
- **Expected pay** = hours × rate. If the shift has an overtime rule, hours past the threshold are paid at rate × multiplier.
- **Pay dates** come from each employer's **pay cycle** (Settings → employer → How this employer pays):
  - *Pay period*: fixed weekly or fortnightly blocks counted from a start date (e.g. Mon 07/09/2026, so 07/09–20/09, 21/09–04/10 …)
  - *Official pay date*: the first chosen weekday **after** the period ends (e.g. Tuesday → Tue 22/09/2026)
  - *Expected pay date*: official date + "usually late by" days (e.g. 7 → Tue 29/09/2026). Editable per shift.
  - Employers without a pay cycle use *shift date + "paid after" days* instead.
  - Each shift saves its pay period and both dates. Changing a pay rule offers to recalculate **unpaid** shifts only.
- **Payment status** (always based on the *expected* date):
  - 🔴 overdue after the expected date
  - 🟡 due within the "due soon" window (default 3 days)
  - ⚪ not due yet
  - 🟢 paid
- **Lump-sum payments** are split across the selected shifts in proportion to their expected pay. The last shift absorbs the cents from rounding.
- **Fortnights** repeat every 14 days from the start date set in Settings. **FY** is the Australian financial year (1 July to 30 June).

### Project layout
```
app/
  (auth)/login, signup          Sign in / create account
  (app)/page.tsx                Dashboard (week / fortnight / month / FY)
  (app)/roster                  Week calendar with daily hours
  (app)/shifts                  All shifts, search + filters, export
  (app)/shifts/new, [id]        Add / edit shift
  (app)/unpaid                  Unpaid tracker, bulk mark-paid
  (app)/settings                Employers, payment rules, overtime, backup
  actions/                      Server actions (all validated with Zod, scoped to the signed-in user)
  api/export/[format]           CSV, Excel and JSON backup downloads
  manifest.ts                   PWA manifest
components/                     UI (ShiftForm, SiteForm, UnpaidList, BottomNav, ...)
lib/
  calc.ts                       Pure pay/hours/period logic (shared by server and client)
  dates.ts, format.ts           AU dates (DD/MM/YYYY), times (AM/PM), AUD
  data.ts, mappers.ts           Queries and DB → plain object mapping
  backup.ts                     Import parser (ShiftBook + Claude-artifact formats)
  validation.ts                 Zod schemas
prisma/schema.prisma            Database schema
public/sw.js, offline.html      Offline support
```

### Security
- **Passwords** are hashed with bcrypt, and sessions are signed JWTs (Auth.js).
- **Access control:** every query and action filters by the signed-in user's id. Middleware blocks every page for signed-out visitors.
- **Validation:** all form input goes through Zod on the server, and export and import sizes are limited.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests for pay dates, hours and pay |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Create the demo account |
| `npm run db:studio` | Browse data in Prisma Studio |
