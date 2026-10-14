-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD');

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "receivedCents" INTEGER NOT NULL,
    "changeCents" INTEGER NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_restaurantId_branchId_createdAt_idx" ON "Payment"("restaurantId", "branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_branchId_restaurantId_key" ON "Payment"("orderId", "branchId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_branchId_requestId_key" ON "Payment"("branchId", "requestId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_branchId_restaurantId_fkey" FOREIGN KEY ("orderId", "branchId", "restaurantId") REFERENCES "Order"("id", "branchId", "restaurantId") ON DELETE NO ACTION ON UPDATE CASCADE;


ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK ("amountCents" >= 0 AND "receivedCents" >= "amountCents" AND "changeCents" = "receivedCents" - "amountCents"), ADD CONSTRAINT "Payment_method_check" CHECK ((method = 'CASH' AND reference = '') OR (method = 'CARD' AND "receivedCents" = "amountCents" AND length(trim(reference)) BETWEEN 1 AND 80));
