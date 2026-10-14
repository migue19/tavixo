-- CreateTable
CREATE TABLE "CashCut" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "day" TEXT NOT NULL,
    "requestId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "openingCents" INTEGER NOT NULL,
    "countedCents" INTEGER NOT NULL,
    "actorName" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashCut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashCut_restaurantId_branchId_day_createdAt_idx" ON "CashCut"("restaurantId", "branchId", "day", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashCut_branchId_requestId_key" ON "CashCut"("branchId", "requestId");

-- AddForeignKey
ALTER TABLE "CashCut" ADD CONSTRAINT "CashCut_branchId_restaurantId_fkey" FOREIGN KEY ("branchId", "restaurantId") REFERENCES "Branch"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Guard stored input amounts and date shape independently of API validation.
ALTER TABLE "CashCut" ADD CONSTRAINT "CashCut_amounts_check" CHECK ("openingCents" >= 0 AND "countedCents" >= 0), ADD CONSTRAINT "CashCut_day_check" CHECK (day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
