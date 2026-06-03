-- Baseline changes that already exist in the current development database.
ALTER TYPE "RelationType" ADD VALUE 'FRIEND';
ALTER TYPE "RelationType" ADD VALUE 'ACQUAINTANCE';
ALTER TYPE "RelationType" ADD VALUE 'ROMANTIC';
ALTER TYPE "RelationType" ADD VALUE 'COLLEAGUE';
ALTER TYPE "RelationType" ADD VALUE 'TEAMMATE';
ALTER TYPE "RelationType" ADD VALUE 'MENTOR';
ALTER TYPE "RelationType" ADD VALUE 'STUDENT';
ALTER TYPE "RelationType" ADD VALUE 'PARTNER';
ALTER TYPE "RelationType" ADD VALUE 'OTHER';

ALTER TABLE "USER" ADD COLUMN "password" TEXT NOT NULL;
