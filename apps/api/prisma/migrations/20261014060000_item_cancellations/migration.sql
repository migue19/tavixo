-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "cancelledQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ItemCancellation" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemCancellation_branchId_requestId_key" ON "ItemCancellation"("branchId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_id_orderId_branchId_restaurantId_key" ON "OrderItem"("id", "orderId", "branchId", "restaurantId");

-- AddForeignKey
ALTER TABLE "ItemCancellation" ADD CONSTRAINT "ItemCancellation_itemId_orderId_branchId_restaurantId_fkey" FOREIGN KEY ("itemId", "orderId", "branchId", "restaurantId") REFERENCES "OrderItem"("id", "orderId", "branchId", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_cancelled_check" CHECK ("cancelledQuantity" BETWEEN 0 AND quantity);
ALTER TABLE "ItemCancellation" ADD CONSTRAINT "ItemCancellation_quantity_check" CHECK (quantity BETWEEN 1 AND 100), ADD CONSTRAINT "ItemCancellation_reason_check" CHECK (length(trim(reason)) BETWEEN 1 AND 500);
