import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/password";
const db = new PrismaClient();
async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!email || password.length < 12 || password.startsWith("replace_"))
    throw new Error(
      "Set SEED_ADMIN_EMAIL and a unique SEED_ADMIN_PASSWORD (12+ characters)",
    );
  await db.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.upsert({
      where: { slug: "birria-el-cachanilla" },
      update: {},
      create: { slug: "birria-el-cachanilla", name: "Birria El Cachanilla" },
    });
    const branch = await tx.branch.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: "Sucursal Principal",
        },
      },
      update: {},
      create: { restaurantId: restaurant.id, name: "Sucursal Principal" },
    });
    const user = await tx.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: "Administrador",
        passwordHash: await hashPassword(password),
      },
    });
    await tx.membership.upsert({
      where: {
        userId_restaurantId: { userId: user.id, restaurantId: restaurant.id },
      },
      update: {},
      create: {
        userId: user.id,
        restaurantId: restaurant.id,
        branchId: branch.id,
        role: Role.OWNER,
      },
    });
  });
  console.log(
    "Piloto preparado. El seed no sobrescribe contraseñas ni roles existentes.",
  );
}
seed()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
