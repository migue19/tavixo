-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "roundId" UUID;

-- CreateTable
CREATE TABLE "OrderRound" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'SENT',
    "requestId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderRound_id_orderId_branchId_restaurantId_key" ON "OrderRound"("id", "orderId", "branchId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRound_orderId_number_key" ON "OrderRound"("orderId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRound_branchId_requestId_key" ON "OrderRound"("branchId", "requestId");

-- Backfill the first round without changing orders, items, events or payments.
INSERT INTO "OrderRound" (id,"orderId","restaurantId","branchId",number,status,"requestId","requestHash",notes,"createdByName","createdAt","updatedAt")
SELECT gen_random_uuid(),id,"restaurantId","branchId",1,CASE WHEN status='CLOSED' THEN 'DELIVERED'::"OrderStatus" ELSE status END,"requestId","requestHash",notes,"createdByName","createdAt","updatedAt" FROM "Order";
UPDATE "OrderItem" i SET "roundId"=r.id FROM "OrderRound" r WHERE r."orderId"=i."orderId" AND r.number=1;
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_number_check" CHECK (number BETWEEN 1 AND 100), ADD CONSTRAINT "OrderRound_status_check" CHECK (status IN ('SENT','PREPARING','READY','DELIVERED','CANCELLED'));

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_roundId_orderId_branchId_restaurantId_fkey" FOREIGN KEY ("roundId", "orderId", "branchId", "restaurantId") REFERENCES "OrderRound"("id", "orderId", "branchId", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_orderId_branchId_restaurantId_fkey" FOREIGN KEY ("orderId", "branchId", "restaurantId") REFERENCES "Order"("id", "branchId", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;

