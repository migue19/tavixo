-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningTable" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_id_branchId_restaurantId_key" ON "MenuCategory"("id", "branchId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_branchId_name_key" ON "MenuCategory"("branchId", "name");

-- CreateIndex
CREATE INDEX "Product_restaurantId_branchId_active_idx" ON "Product"("restaurantId", "branchId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Product_branchId_name_key" ON "Product"("branchId", "name");

-- CreateIndex
CREATE INDEX "DiningTable_restaurantId_branchId_active_idx" ON "DiningTable"("restaurantId", "branchId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_branchId_name_key" ON "DiningTable"("branchId", "name");

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_branchId_restaurantId_fkey" FOREIGN KEY ("branchId", "restaurantId") REFERENCES "Branch"("id", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_branchId_restaurantId_fkey" FOREIGN KEY ("branchId", "restaurantId") REFERENCES "Branch"("id", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_branchId_restaurantId_fkey" FOREIGN KEY ("categoryId", "branchId", "restaurantId") REFERENCES "MenuCategory"("id", "branchId", "restaurantId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_branchId_restaurantId_fkey" FOREIGN KEY ("branchId", "restaurantId") REFERENCES "Branch"("id", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Defense in depth for values used by future orders.
ALTER TABLE "Product" ADD CONSTRAINT "Product_priceCents_check" CHECK ("priceCents" >= 0 AND "priceCents" <= 99999999);
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_capacity_check" CHECK ("capacity" >= 1 AND "capacity" <= 100);
