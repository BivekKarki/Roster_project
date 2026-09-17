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
| `RESEND_API_KEY` | Sends verification emails through [Resend](https://resend.com). Without it in development, emails print in the terminal |
| `EMAIL_FROM` | Sender, e.g. `ShiftBook <noreply@yourdomain.com>` |
| `APP_URL` | Public address used in email links, e.g. `https://shiftbook.vercel.app` |
| `REQUIRE_EMAIL_VERIFICATION` | `true` by default. `false` skips email confirmation |
| `SESSION_MAX_DAYS` | Every login ends after this many days, even if active. Default `30` |

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
- **Pay dates** come from each employer's **pay cycle**. Set it for everyone at once in Settings → Pay cycle for all employers, or per employer:
  - *Pay period*: fixed weekly or fortnightly blocks counted from a start date, e.g. Mon 14/09/2026 gives 14/09–27/09, 28/09–11/10, and so on.
  - *Supposed pay date*: the first chosen weekday **after** the period ends. Every shift from 14/09 to 27/09 gets Tue 29/09/2026.
  - *Real pay date*: the supposed date plus the days payroll is usually late. With 7 days, that's Tue 06/10/2026. You can edit it per shift.
  - Employers without a pay cycle fall back to *shift date + "paid after" days*. The dashboard warns about them.
  - Each shift saves its pay period and both dates. Changing a pay rule offers to recalculate **unpaid** shifts only.
- **Payment status** (always based on the *real* pay date):
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
  (app)/roster                  Month calendar (dot per shift, today highlighted) + week view
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

### Email verification
- **Sign-up flow:** new accounts must confirm their email before they can log in. One email contains a **6-digit code** and a **"Confirm my email" link**; either works, and both sign you straight in.
- **Expiry and limits:** the code and link expire after 30 minutes. A new email replaces the old code and link. 5 wrong codes lock that code. Resending waits 60 seconds between emails, with at most 5 per hour.
- **Unconfirmed accounts:** logging in with the right password sends a new code and opens the confirm screen.
- **Storage:** codes, links and one-time login tickets are stored only as HMAC-SHA256 hashes.
- **Resend setup:**
  1. Create an API key at resend.com and set `RESEND_API_KEY`.
  2. To start, leave `EMAIL_FROM` as `onboarding@resend.dev`. Resend then only delivers to the email you registered with, which is fine for a personal app.
  3. To email anyone, verify a domain in Resend and change `EMAIL_FROM`.
- **Locally:** without a key, `npm run dev` prints the email, code and link in the terminal.
- **Accounts created before this update** are asked to confirm their email the next time they log in.

### Sessions and auto logout
- **Auto logout:** each user picks 15 min, 30 min (default), 1 h, 4 h, 1 day or Never in **Profile**. After that long with no activity, a 60-second warning appears and then the app logs out. It checks immediately when the phone wakes up, and all open tabs share the same timer.
- **Enforced on the server too:** the session cookie stores the login time and last activity, and every request checks them (`auth.config.ts`, `lib/session-rules.ts`). A stale cookie from a closed tab or a sleeping phone doesn't work.
- **Maximum length:** every login ends after `SESSION_MAX_DAYS`, even for active users.

### Profile icon
- **Top right of every page:** your photo, or the first letter of your name (or email) on a coloured circle. Tap it for Profile, Settings and Log out.
- **Photos:** resized in the browser to a 256×256 JPEG (usually under 40 KB), checked on the server, stored in the database and served privately from `/api/avatar`.

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
