-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "officialPayDate" DATE,
ADD COLUMN     "payPeriodEnd" DATE,
ADD COLUMN     "payPeriodStart" DATE;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "payLateDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payPeriodDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "payPeriodStart" DATE,
ADD COLUMN     "payWeekday" INTEGER;
