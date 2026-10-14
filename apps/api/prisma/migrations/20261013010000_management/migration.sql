-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "branchId" UUID;

-- CreateTable
CREATE TABLE "Branch" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Branch_restaurantId_active_idx" ON "Branch"("restaurantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_id_restaurantId_key" ON "Branch"("id", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_restaurantId_name_key" ON "Branch"("restaurantId", "name");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_branchId_restaurantId_fkey" FOREIGN KEY ("branchId", "restaurantId") REFERENCES "Branch"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve existing users by assigning every current tenant a main branch.
INSERT INTO "Branch" ("id", "restaurantId", "name", "address", "active", "createdAt")
SELECT gen_random_uuid(), "id", 'Sucursal Principal', '', true, CURRENT_TIMESTAMP FROM "Restaurant";
UPDATE "Membership" m SET "branchId" = b."id"
FROM "Branch" b WHERE b."restaurantId" = m."restaurantId" AND b."name" = 'Sucursal Principal';
