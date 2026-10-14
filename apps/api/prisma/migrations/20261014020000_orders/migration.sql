-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('SENT', 'PREPARING', 'READY', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "tableName" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "requestId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'SENT',
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "actorName" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_restaurantId_branchId_status_idx" ON "Order"("restaurantId", "branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_id_branchId_restaurantId_key" ON "Order"("id", "branchId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_branchId_number_key" ON "Order"("branchId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_branchId_requestId_key" ON "Order"("branchId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_branchId_restaurantId_key" ON "Product"("id", "branchId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_id_branchId_restaurantId_key" ON "DiningTable"("id", "branchId", "restaurantId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_restaurantId_fkey" FOREIGN KEY ("branchId", "restaurantId") REFERENCES "Branch"("id", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_branchId_restaurantId_fkey" FOREIGN KEY ("tableId", "branchId", "restaurantId") REFERENCES "DiningTable"("id", "branchId", "restaurantId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_branchId_restaurantId_fkey" FOREIGN KEY ("orderId", "branchId", "restaurantId") REFERENCES "Order"("id", "branchId", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_branchId_restaurantId_fkey" FOREIGN KEY ("productId", "branchId", "restaurantId") REFERENCES "Product"("id", "branchId", "restaurantId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_branchId_restaurantId_fkey" FOREIGN KEY ("orderId", "branchId", "restaurantId") REFERENCES "Order"("id", "branchId", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "Order" ADD CONSTRAINT "Order_total_check" CHECK ("totalCents" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_check" CHECK (quantity BETWEEN 1 AND 100), ADD CONSTRAINT "OrderItem_price_check" CHECK ("unitPriceCents" BETWEEN 0 AND 99999999);
CREATE UNIQUE INDEX "Order_one_open_table" ON "Order"("tableId") WHERE status NOT IN ('CLOSED', 'CANCELLED');
