-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "autoCompleteShifts" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "autoStatus" BOOLEAN NOT NULL DEFAULT true;
