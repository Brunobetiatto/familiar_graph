/*
  Warnings:

  - You are about to drop the column `femaleLabel` on the `GLOBAL_TAG` table. All the data in the column will be lost.
  - You are about to drop the column `maleLabel` on the `GLOBAL_TAG` table. All the data in the column will be lost.
  - You are about to drop the column `otherLabel` on the `GLOBAL_TAG` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GLOBAL_TAG" DROP COLUMN "femaleLabel",
DROP COLUMN "maleLabel",
DROP COLUMN "otherLabel";
