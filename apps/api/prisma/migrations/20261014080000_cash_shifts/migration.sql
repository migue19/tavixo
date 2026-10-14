-- CreateEnum
CREATE TYPE "CashMovementKind" AS ENUM ('WITHDRAWAL', 'EXPENSE');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "shiftId" UUID;

-- CreateTable
CREATE TABLE "CashShift" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "openingCents" INTEGER NOT NULL,
    "openedByName" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "closedByName" TEXT NOT NULL DEFAULT '',
    "countedCents" INTEGER,
    "closeRequestId" UUID,
    "closeRequestHash" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "snapshot" JSONB,

    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "kind" "CashMovementKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashShift_restaurantId_branchId_openedAt_idx" ON "CashShift"("restaurantId", "branchId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashShift_id_branchId_restaurantId_key" ON "CashShift"("id", "branchId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "CashShift_branchId_requestId_key" ON "CashShift"("branchId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "CashShift_branchId_closeRequestId_key" ON "CashShift"("branchId", "closeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_branchId_requestId_key" ON "CashMovement"("branchId", "requestId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_shiftId_branchId_restaurantId_fkey" FOREIGN KEY ("shiftId", "branchId", "restaurantId") REFERENCES "CashShift"("id", "branchId", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_branchId_restaurantId_fkey" FOREIGN KEY ("branchId", "restaurantId") REFERENCES "Branch"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shiftId_branchId_restaurantId_fkey" FOREIGN KEY ("shiftId", "branchId", "restaurantId") REFERENCES "CashShift"("id", "branchId", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CashShift_one_open_per_branch" ON "CashShift"("branchId") WHERE "closedAt" IS NULL;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_amount_check" CHECK ("openingCents">=0 AND ("countedCents" IS NULL OR "countedCents">=0) AND revision>=0), ADD CONSTRAINT "CashShift_close_check" CHECK (("closedAt" IS NULL AND "countedCents" IS NULL AND snapshot IS NULL AND "closeRequestId" IS NULL AND "closeRequestHash" IS NULL AND "closedByName"='') OR ("closedAt" IS NOT NULL AND "countedCents" IS NOT NULL AND snapshot IS NOT NULL AND "closeRequestId" IS NOT NULL AND "closeRequestHash" IS NOT NULL AND length("closedByName")>0));
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_amount_check" CHECK ("amountCents">0), ADD CONSTRAINT "CashMovement_reason_check" CHECK (length(trim(reason)) BETWEEN 1 AND 500);
CREATE INDEX "Payment_shiftId_idx" ON "Payment"("shiftId");
CREATE INDEX "CashMovement_shiftId_createdAt_idx" ON "CashMovement"("shiftId","createdAt");
