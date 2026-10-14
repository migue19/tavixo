import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { cashRange, mexicoDay } from "../src/cash.service";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma.service";
import { hashPassword } from "../src/password";

const origin = "http://localhost:6001";
let app: INestApplication, db: PrismaService;
let a: string, b: string, membership: string;
const password = "test-password-very-long";
const suffix = randomUUID().slice(0, 8);
const email = `owner-${suffix}@example.com`;
const waiterEmail = `waiter-${suffix}@example.com`;
let users: string[] = [];
let extraRestaurants: string[] = [];
const slug = `restaurant-a-${suffix}`;
const cookie = (res: request.Response): string =>
  (res.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
let loginCounter = 1;
const login = (who = email) =>
  request(app.getHttpServer())
    .post("/api/auth/login")
    .set("X-Forwarded-For", `192.0.2.${loginCounter++}`)
    .set("Origin", origin)
    .send({ email: who, password, restaurantSlug: slug });

before(
  async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !new URL(url).pathname.endsWith("_test"))
      throw new Error(
        "Use a dedicated TEST_DATABASE_URL whose database name ends in _test",
      );
    process.env.DATABASE_URL = url;
    process.env.JWT_SECRET = "a-test-only-secret-with-at-least-32-characters";
    process.env.WEB_ORIGIN = origin;
    process.env.COOKIE_SECURE = "false";
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    const ra = await db.restaurant.create({ data: { slug, name: "A" } });
    a = ra.id;
    const rb = await db.restaurant.create({
      data: { slug: `restaurant-b-${suffix}`, name: "B" },
    });
    b = rb.id;
    const hashed = await hashPassword(password);
    const owner = await db.user.create({
      data: { email, name: "Owner", passwordHash: hashed },
    });
    const waiter = await db.user.create({
      data: { email: waiterEmail, name: "Waiter", passwordHash: hashed },
    });
    users = [owner.id, waiter.id];
    const member = await db.membership.create({
      data: { userId: owner.id, restaurantId: a, role: Role.OWNER },
    });
    membership = member.id;
    await db.membership.create({
      data: { userId: waiter.id, restaurantId: a, role: Role.WAITER },
    });
    await db.membership.create({
      data: { userId: owner.id, restaurantId: b, role: Role.MANAGER },
    });
  },
  { timeout: 30000 },
);
after(async () => {
  if (db) {
    await db.itemCancellation.deleteMany({
      where: {
        restaurantId: { in: [a, b, ...extraRestaurants].filter(Boolean) },
      },
    });
    await db.cashCut.deleteMany({
      where: {
        restaurantId: { in: [a, b, ...extraRestaurants].filter(Boolean) },
      },
    });
    await db.payment.deleteMany({
      where: {
        restaurantId: { in: [a, b, ...extraRestaurants].filter(Boolean) },
      },
    });
    await db.cashMovement.deleteMany({
      where: {
        restaurantId: { in: [a, b, ...extraRestaurants].filter(Boolean) },
      },
    });
    await db.cashShift.deleteMany({
      where: {
        restaurantId: { in: [a, b, ...extraRestaurants].filter(Boolean) },
      },
    });
    await db.order.deleteMany({
      where: {
        restaurantId: { in: [a, b, ...extraRestaurants].filter(Boolean) },
      },
    });
    await db.restaurant.deleteMany({
      where: { id: { in: [a, b, ...extraRestaurants].filter(Boolean) } },
    });
    await db.user.deleteMany({ where: { id: { in: users } } });
  }
  if (app) await app.close();
});

it("health checks PostgreSQL; unauthenticated requests fail", async () => {
  await request(app.getHttpServer()).get("/api/health").expect(200);
  await request(app.getHttpServer()).get("/api/restaurant").expect(401);
});
it("validates credentials, DTOs and request origin", async () => {
  await request(app.getHttpServer())
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email, password: "wrong", restaurantSlug: slug })
    .expect(401);
  await request(app.getHttpServer())
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email, password, restaurantSlug: slug, role: "OWNER" })
    .expect(400);
  await request(app.getHttpServer())
    .post("/api/auth/login")
    .set("Origin", "https://evil.example")
    .send({ email, password, restaurantSlug: slug })
    .expect(403);
  const res = await login();
  assert.equal(res.status, 201);
  assert.equal(res.body.refreshToken, undefined);
  assert.match(res.headers["set-cookie"][0], /HttpOnly/);
  assert.match(res.headers["set-cookie"][0], /SameSite=Strict/);
});
it("scopes reads and updates to JWT tenant despite forged header, body or path", async () => {
  const res = await login();
  const auth = `Bearer ${res.body.accessToken}`;
  const restaurant = await request(app.getHttpServer())
    .get("/api/restaurant")
    .set("Authorization", auth)
    .set("X-Tenant-Id", b)
    .expect(200);
  assert.equal(restaurant.body.id, a);
  const members = await request(app.getHttpServer())
    .get("/api/restaurant/members")
    .set("Authorization", auth)
    .expect(200);
  assert.equal(members.body.length, 2);
  assert.ok(!JSON.stringify(members.body).includes("passwordHash"));
  await request(app.getHttpServer())
    .patch("/api/restaurant")
    .set("Authorization", auth)
    .send({ name: "A updated", restaurantId: b })
    .expect(400);
  await request(app.getHttpServer())
    .patch("/api/restaurant")
    .set("Authorization", auth)
    .send({ name: "A updated" })
    .expect(200);
  assert.equal(
    (await db.restaurant.findUniqueOrThrow({ where: { id: b } })).name,
    "B",
  );
  await request(app.getHttpServer())
    .get(`/api/restaurants/${b}`)
    .set("Authorization", auth)
    .expect(404);
  const second = await request(app.getHttpServer())
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email, password, restaurantSlug: `restaurant-b-${suffix}` })
    .expect(201);
  const other = await request(app.getHttpServer())
    .get("/api/restaurant")
    .set("Authorization", `Bearer ${second.body.accessToken}`)
    .expect(200);
  assert.equal(other.body.id, b);
});
it("enforces roles and live membership revocation", async () => {
  const waiter = await login(waiterEmail);
  await request(app.getHttpServer())
    .get("/api/restaurant")
    .set("Authorization", `Bearer ${waiter.body.accessToken}`)
    .expect(200);
  await request(app.getHttpServer())
    .patch("/api/restaurant")
    .set("Authorization", `Bearer ${waiter.body.accessToken}`)
    .send({ name: "Invalid" })
    .expect(403);
  await request(app.getHttpServer())
    .get("/api/restaurant/members")
    .set("Authorization", `Bearer ${waiter.body.accessToken}`)
    .expect(403);
  const owner = await login();
  await db.membership.update({
    where: { id: membership },
    data: { active: false },
  });
  await request(app.getHttpServer())
    .get("/api/me")
    .set("Authorization", `Bearer ${owner.body.accessToken}`)
    .expect(401);
  await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set("Origin", origin)
    .set("Cookie", cookie(owner))
    .expect(401);
  await db.membership.update({
    where: { id: membership },
    data: { active: true },
  });
});
it("rejects tampered and expired JWTs", async () => {
  const res = await login();
  const jwt = app.get(JwtService);
  const payload = jwt.decode(res.body.accessToken);
  const { exp, iat, iss, aud, ...claims } = payload;
  const expired = await jwt.signAsync(claims, { expiresIn: -1 });
  await request(app.getHttpServer())
    .get("/api/me")
    .set("Authorization", `Bearer ${expired}`)
    .expect(401);
  await request(app.getHttpServer())
    .get("/api/me")
    .set("Authorization", `Bearer ${res.body.accessToken.slice(0, -8)}tampered`)
    .expect(401);
});
it("rotates refresh token and revokes family on reuse", async () => {
  const first = await login();
  const oldCookie = cookie(first);
  const refreshed = await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set("Origin", origin)
    .set("Cookie", oldCookie)
    .expect(201);
  assert.notEqual(cookie(refreshed), oldCookie);
  await request(app.getHttpServer())
    .get("/api/me")
    .set("Authorization", `Bearer ${first.body.accessToken}`)
    .expect(401);
  await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set("Origin", origin)
    .set("Cookie", oldCookie)
    .expect(401);
  await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set("Origin", origin)
    .set("Cookie", cookie(refreshed))
    .expect(401);
  await request(app.getHttpServer())
    .get("/api/me")
    .set("Authorization", `Bearer ${refreshed.body.accessToken}`)
    .expect(401);
});
it("blocks cross-origin refresh and revokes access and refresh on logout", async () => {
  const res = await login();
  await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set("Origin", "https://evil.example")
    .set("Cookie", cookie(res))
    .expect(403);
  await request(app.getHttpServer())
    .post("/api/auth/logout")
    .set("Origin", origin)
    .set("Cookie", cookie(res))
    .expect(201);
  await request(app.getHttpServer())
    .get("/api/me")
    .set("Authorization", `Bearer ${res.body.accessToken}`)
    .expect(401);
  await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set("Origin", origin)
    .set("Cookie", cookie(res))
    .expect(401);
});

it("limits brute-force login attempts by client IP", async () => {
  for (let i = 0; i < 10; i++) {
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .set("X-Forwarded-For", "192.0.2.250")
      .set("Origin", origin)
      .send({ email, password: "wrong", restaurantSlug: slug })
      .expect(401);
  }
  await request(app.getHttpServer())
    .post("/api/auth/login")
    .set("X-Forwarded-For", "192.0.2.250")
    .set("Origin", origin)
    .send({ email, password, restaurantSlug: slug })
    .expect(429);
});

it("creates branches with tenant isolation and enforces operational branch scope", async () => {
  const owner = await login();
  const auth = `Bearer ${owner.body.accessToken}`;
  const created = await request(app.getHttpServer())
    .post("/api/restaurant/branches")
    .set("Authorization", auth)
    .send({ name: "Centro", address: "Calle 1" })
    .expect(201);
  const branch = created.body.id;
  await request(app.getHttpServer())
    .post("/api/restaurant/branches")
    .set("Authorization", auth)
    .send({ name: "Centro" })
    .expect(409);
  await request(app.getHttpServer())
    .post("/api/restaurant/branches")
    .set("Authorization", auth)
    .send({ name: "   " })
    .expect(400);
  const foreign = await db.branch.create({
    data: { restaurantId: b, name: "Foreign" },
  });
  await request(app.getHttpServer())
    .patch(`/api/restaurant/branches/${foreign.id}`)
    .set("Authorization", auth)
    .send({ name: "Intrusion" })
    .expect(404);
  await request(app.getHttpServer())
    .patch("/api/restaurant/branches/not-a-uuid")
    .set("Authorization", auth)
    .send({ name: "Invalid" })
    .expect(400);
  const waiter = await login(waiterEmail);
  await request(app.getHttpServer())
    .post("/api/restaurant/branches")
    .set("Authorization", `Bearer ${waiter.body.accessToken}`)
    .send({ name: "No permission" })
    .expect(403);
  const waiterMember = await db.membership.findFirstOrThrow({
    where: { restaurantId: a, user: { email: waiterEmail } },
  });
  await assert.rejects(
    db.membership.update({
      where: { id: waiterMember.id },
      data: { branchId: foreign.id },
    }),
  );
  await db.membership.update({
    where: { id: waiterMember.id },
    data: { branchId: branch },
  });
  const assigned = await login(waiterEmail);
  const list = await request(app.getHttpServer())
    .get("/api/restaurant/branches")
    .set("Authorization", `Bearer ${assigned.body.accessToken}`)
    .expect(200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].id, branch);
  await request(app.getHttpServer())
    .patch(`/api/restaurant/branches/${branch}`)
    .set("Authorization", auth)
    .send({ active: false })
    .expect(400);
  const other = await request(app.getHttpServer())
    .post("/api/restaurant/branches")
    .set("Authorization", auth)
    .send({ name: "Norte" })
    .expect(201);
  await request(app.getHttpServer())
    .patch(`/api/restaurant/branches/${branch}`)
    .set("Authorization", auth)
    .send({ active: false })
    .expect(200);
  await request(app.getHttpServer())
    .get("/api/me")
    .set("Authorization", `Bearer ${assigned.body.accessToken}`)
    .expect(401);
  await login(waiterEmail).expect(401);
  await request(app.getHttpServer())
    .patch(`/api/restaurant/members/${waiterMember.id}`)
    .set("Authorization", auth)
    .send({ branchId: other.body.id })
    .expect(200);
  await login(waiterEmail).expect(201);
});
it("manages employees without changing other tenants, ownership or existing global accounts", async () => {
  const owner = await login();
  const auth = `Bearer ${owner.body.accessToken}`;
  const branch = await db.branch.findFirstOrThrow({
    where: { restaurantId: a, active: true },
  });
  const foreign = await db.branch.findFirstOrThrow({
    where: { restaurantId: b },
  });
  const newEmail = `new-${suffix}@example.com`;
  await request(app.getHttpServer())
    .post("/api/restaurant/members")
    .set("Authorization", auth)
    .send({
      email: newEmail,
      name: "New employee",
      password,
      role: "WAITER",
      branchId: foreign.id,
    })
    .expect(400);
  await request(app.getHttpServer())
    .post("/api/restaurant/members")
    .set("Authorization", auth)
    .send({
      email: newEmail,
      name: "New employee",
      password,
      role: "OWNER",
      branchId: branch.id,
    })
    .expect(403);
  const created = await request(app.getHttpServer())
    .post("/api/restaurant/members")
    .set("Authorization", auth)
    .send({
      email: newEmail,
      name: "New employee",
      password,
      role: "CASHIER",
      branchId: branch.id,
    })
    .expect(201);
  users.push(created.body.user.id);
  assert.ok(!JSON.stringify(created.body).includes("passwordHash"));
  await request(app.getHttpServer())
    .patch(`/api/restaurant/members/${created.body.id}`)
    .set("Authorization", auth)
    .send({ branchId: null })
    .expect(400);
  await request(app.getHttpServer())
    .patch(`/api/restaurant/members/${created.body.id}`)
    .set("Authorization", auth)
    .send({ active: null })
    .expect(400);
  await request(app.getHttpServer())
    .post("/api/restaurant/members")
    .set("Authorization", auth)
    .send({
      email,
      name: "Overwrite",
      password: "new-password-overwrite",
      role: "WAITER",
      branchId: branch.id,
    })
    .expect(409);
  const initial = await login(newEmail).expect(201);
  await request(app.getHttpServer())
    .patch(`/api/restaurant/members/${created.body.id}`)
    .set("Authorization", auth)
    .send({ role: "KITCHEN" })
    .expect(200);
  await request(app.getHttpServer())
    .get("/api/me")
    .set("Authorization", `Bearer ${initial.body.accessToken}`)
    .expect(401);
  await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set("Origin", origin)
    .set("Cookie", cookie(initial))
    .expect(401);
  await request(app.getHttpServer())
    .patch(`/api/restaurant/members/${created.body.id}`)
    .set("Authorization", auth)
    .send({ active: false })
    .expect(200);
  await login(newEmail).expect(401);
  await request(app.getHttpServer())
    .patch(`/api/restaurant/members/${created.body.id}`)
    .set("Authorization", auth)
    .send({ active: true })
    .expect(200);
  await login(newEmail).expect(201);
  const foreignMember = await db.membership.findFirstOrThrow({
    where: { restaurantId: b },
  });
  await request(app.getHttpServer())
    .patch(`/api/restaurant/members/${foreignMember.id}`)
    .set("Authorization", auth)
    .send({ active: false })
    .expect(404);
  await request(app.getHttpServer())
    .patch(`/api/restaurant/members/${membership}`)
    .set("Authorization", auth)
    .send({ active: false })
    .expect(400);
});
it("prevents managers from granting or editing manager and owner privileges", async () => {
  const owner = await login();
  const auth = `Bearer ${owner.body.accessToken}`;
  const branch = await db.branch.findFirstOrThrow({
    where: { restaurantId: a, active: true },
  });
  const managerEmail = `manager-${suffix}@example.com`;
  const manager = await request(app.getHttpServer())
    .post("/api/restaurant/members")
    .set("Authorization", auth)
    .send({
      email: managerEmail,
      name: "Manager",
      password,
      role: "MANAGER",
      branchId: branch.id,
    })
    .expect(201);
  users.push(manager.body.user.id);
  const entered = await login(managerEmail).expect(201);
  const managerAuth = `Bearer ${entered.body.accessToken}`;
  await request(app.getHttpServer())
    .post("/api/restaurant/members")
    .set("Authorization", managerAuth)
    .send({
      email: `blocked-${suffix}@example.com`,
      name: "Blocked",
      password,
      role: "MANAGER",
      branchId: branch.id,
    })
    .expect(403);
  await request(app.getHttpServer())
    .patch(`/api/restaurant/members/${membership}`)
    .set("Authorization", managerAuth)
    .send({ role: "WAITER" })
    .expect(403);
  const waiter = await db.membership.findFirstOrThrow({
    where: { restaurantId: a, user: { email: waiterEmail } },
  });
  await request(app.getHttpServer())
    .patch(`/api/restaurant/members/${waiter.id}`)
    .set("Authorization", managerAuth)
    .send({ role: "MANAGER" })
    .expect(403);
  await request(app.getHttpServer())
    .patch(`/api/restaurant/members/${waiter.id}`)
    .set("Authorization", managerAuth)
    .send({ role: "CASHIER" })
    .expect(200);
  await request(app.getHttpServer())
    .post("/api/restaurants")
    .set("Authorization", managerAuth)
    .send({ name: "Forbidden", slug: `forbidden-${suffix}` })
    .expect(403);
});
it("creates a separate restaurant and switches only to authorized memberships", async () => {
  const first = await login();
  const auth = `Bearer ${first.body.accessToken}`;
  const created = await request(app.getHttpServer())
    .post("/api/restaurants")
    .set("Authorization", auth)
    .send({ name: "New Restaurant", slug: `new-${suffix}` })
    .expect(201);
  extraRestaurants.push(created.body.id);
  const list = await request(app.getHttpServer())
    .get("/api/restaurants")
    .set("Authorization", auth)
    .expect(200);
  assert.equal(list.body.length, 3);
  await request(app.getHttpServer())
    .post("/api/auth/switch")
    .set("Origin", origin)
    .set("Authorization", auth)
    .set("Cookie", cookie(first))
    .send({ restaurantId: randomUUID() })
    .expect(401);
  const switched = await request(app.getHttpServer())
    .post("/api/auth/switch")
    .set("Origin", origin)
    .set("Authorization", auth)
    .set("Cookie", cookie(first))
    .send({ restaurantId: created.body.id })
    .expect(201);
  await request(app.getHttpServer())
    .get("/api/me")
    .set("Authorization", auth)
    .expect(401);
  const token = `Bearer ${switched.body.accessToken}`;
  const branches = await request(app.getHttpServer())
    .get("/api/restaurant/branches")
    .set("Authorization", token)
    .expect(200);
  assert.equal(branches.body.length, 1);
  assert.equal(branches.body[0].name, "Sucursal Principal");
  const team = await request(app.getHttpServer())
    .get("/api/restaurant/members")
    .set("Authorization", token)
    .expect(200);
  assert.equal(team.body.length, 1);
  const waiter = await login(waiterEmail).expect(201);
  await request(app.getHttpServer())
    .post("/api/auth/switch")
    .set("Origin", origin)
    .set("Authorization", `Bearer ${waiter.body.accessToken}`)
    .set("Cookie", cookie(waiter))
    .send({ restaurantId: created.body.id })
    .expect(401);
});
it("lets a user change their password and revokes all their sessions", async () => {
  const first = await login(waiterEmail).expect(201);
  const second = await login(waiterEmail).expect(201);
  const auth = `Bearer ${first.body.accessToken}`;
  await request(app.getHttpServer())
    .patch("/api/me/password")
    .set("Authorization", auth)
    .send({
      currentPassword: "incorrect",
      newPassword: "replacement-password-long",
    })
    .expect(401);
  await request(app.getHttpServer())
    .patch("/api/me/password")
    .set("Authorization", auth)
    .send({
      currentPassword: password,
      newPassword: "replacement-password-long",
    })
    .expect(200);
  for (const session of [first, second]) {
    await request(app.getHttpServer())
      .get("/api/me")
      .set("Authorization", `Bearer ${session.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Origin", origin)
      .set("Cookie", cookie(session))
      .expect(401);
  }
  await login(waiterEmail).expect(401);
  await request(app.getHttpServer())
    .post("/api/auth/login")
    .set("X-Forwarded-For", "192.0.2.230")
    .set("Origin", origin)
    .send({
      email: waiterEmail,
      password: "replacement-password-long",
      restaurantSlug: slug,
    })
    .expect(201);
});

it("manages menu with integer prices, soft states and category/branch isolation", async () => {
  const owner = await login();
  const auth = `Bearer ${owner.body.accessToken}`;
  const branch = await db.branch.findFirstOrThrow({
    where: { restaurantId: a, active: true },
  });
  const foreign = await db.branch.findFirstOrThrow({
    where: { restaurantId: b },
  });
  const sameTenantOther = await db.branch.create({
    data: { restaurantId: a, name: "Catalog Other" },
  });
  const base = `/api/restaurant/branches/${branch.id}`;
  const category = await request(app.getHttpServer())
    .post(`${base}/categories`)
    .set("Authorization", auth)
    .send({ name: "Bebidas" })
    .expect(201);
  await request(app.getHttpServer())
    .post(`${base}/categories`)
    .set("Authorization", auth)
    .send({ name: "Bebidas" })
    .expect(409);
  await request(app.getHttpServer())
    .post(`${base}/categories`)
    .set("Authorization", auth)
    .send({ name: "   " })
    .expect(400);
  const otherCategory = await db.menuCategory.create({
    data: { restaurantId: a, branchId: sameTenantOther.id, name: "Other" },
  });
  await request(app.getHttpServer())
    .post(`${base}/products`)
    .set("Authorization", auth)
    .send({
      name: "Wrong branch",
      categoryId: otherCategory.id,
      priceCents: 100,
    })
    .expect(400);
  for (const value of [-1, 12.5, 100000000, null, "100"]) {
    await request(app.getHttpServer())
      .post(`${base}/products`)
      .set("Authorization", auth)
      .send({
        name: "Invalid price",
        categoryId: category.body.id,
        priceCents: value,
      })
      .expect(400);
  }
  const product = await request(app.getHttpServer())
    .post(`${base}/products`)
    .set("Authorization", auth)
    .send({
      name: "Agua",
      description: "Test fixture",
      categoryId: category.body.id,
      priceCents: 12345,
    })
    .expect(201);
  assert.equal(product.body.priceCents, 12345);
  await request(app.getHttpServer())
    .post(`${base}/products`)
    .set("Authorization", auth)
    .send({ name: "Agua", categoryId: category.body.id, priceCents: 0 })
    .expect(409);
  await request(app.getHttpServer())
    .patch(`${base}/products/${product.body.id}`)
    .set("Authorization", auth)
    .send({ categoryId: otherCategory.id })
    .expect(400);
  await assert.rejects(
    db.product.update({
      where: { id: product.body.id },
      data: { categoryId: otherCategory.id },
    }),
  );
  await assert.rejects(
    db.product.update({
      where: { id: product.body.id },
      data: { priceCents: -1 },
    }),
  );
  await request(app.getHttpServer())
    .patch(
      `/api/restaurant/branches/${sameTenantOther.id}/products/${product.body.id}`,
    )
    .set("Authorization", auth)
    .send({ priceCents: 1 })
    .expect(404);
  await request(app.getHttpServer())
    .get(`/api/restaurant/branches/${foreign.id}/products`)
    .set("Authorization", auth)
    .expect(404);
  await request(app.getHttpServer())
    .patch(`${base}/products/${product.body.id}`)
    .set("Authorization", auth)
    .send({ restaurantId: b, priceCents: 1 })
    .expect(400);
  await request(app.getHttpServer())
    .patch(`${base}/products/${product.body.id}`)
    .set("Authorization", auth)
    .send({ priceCents: null })
    .expect(400);
  await request(app.getHttpServer())
    .patch(`${base}/products/${product.body.id}`)
    .set("Authorization", auth)
    .send({ priceCents: 0, available: false })
    .expect(200);
  const listed = await request(app.getHttpServer())
    .get(`${base}/products`)
    .set("Authorization", auth)
    .expect(200);
  assert.equal(listed.body[0].priceCents, 0);
  assert.equal(listed.body[0].available, false);
  await request(app.getHttpServer())
    .patch(`${base}/categories/${category.body.id}`)
    .set("Authorization", auth)
    .send({ active: false })
    .expect(200);
  await request(app.getHttpServer())
    .post(`${base}/products`)
    .set("Authorization", auth)
    .send({
      name: "Hidden parent",
      categoryId: category.body.id,
      priceCents: 1,
    })
    .expect(400);
  await request(app.getHttpServer())
    .patch(`${base}/products/${product.body.id}`)
    .set("Authorization", auth)
    .send({ active: true })
    .expect(400);
});
it("limits operational catalog reads to assigned branch and hides inactive entities", async () => {
  const owner = await login();
  const auth = `Bearer ${owner.body.accessToken}`;
  const member = await db.membership.findFirstOrThrow({
    where: { restaurantId: a, user: { email: waiterEmail } },
  });
  assert.ok(member.branchId);
  const base = `/api/restaurant/branches/${member.branchId}`;
  const entered = await request(app.getHttpServer())
    .post("/api/auth/login")
    .set("X-Forwarded-For", "192.0.2.231")
    .set("Origin", origin)
    .send({
      email: waiterEmail,
      password: "replacement-password-long",
      restaurantSlug: slug,
    })
    .expect(201);
  const staff = `Bearer ${entered.body.accessToken}`;
  const other = await db.branch.findFirstOrThrow({
    where: { restaurantId: a, id: { not: member.branchId! }, active: true },
  });
  for (const kind of ["categories", "products", "tables"]) {
    await request(app.getHttpServer())
      .get(`/api/restaurant/branches/${other.id}/${kind}`)
      .set("Authorization", staff)
      .expect(403);
    const listed = await request(app.getHttpServer())
      .get(`${base}/${kind}`)
      .set("Authorization", staff)
      .expect(200);
    assert.equal(listed.body.length, 0);
  }
  await request(app.getHttpServer())
    .post(`${base}/categories`)
    .set("Authorization", staff)
    .send({ name: "Forbidden" })
    .expect(403);
  const category = await request(app.getHttpServer())
    .post(`${base}/categories`)
    .set("Authorization", auth)
    .send({ name: "Comida" })
    .expect(201);
  const product = await request(app.getHttpServer())
    .post(`${base}/products`)
    .set("Authorization", auth)
    .send({
      name: "Fixture product",
      categoryId: category.body.id,
      priceCents: 99,
    })
    .expect(201);
  await request(app.getHttpServer())
    .patch(`${base}/products/${product.body.id}`)
    .set("Authorization", staff)
    .send({ priceCents: 1 })
    .expect(403);
  await request(app.getHttpServer())
    .patch(`${base}/products/${product.body.id}`)
    .set("Authorization", auth)
    .send({ available: false })
    .expect(200);
  const available = await request(app.getHttpServer())
    .get(`${base}/products`)
    .set("Authorization", staff)
    .expect(200);
  assert.equal(available.body[0].available, false);
  await request(app.getHttpServer())
    .patch(`${base}/products/${product.body.id}`)
    .set("Authorization", auth)
    .send({ active: false })
    .expect(200);
  const hidden = await request(app.getHttpServer())
    .get(`${base}/products`)
    .set("Authorization", staff)
    .expect(200);
  assert.equal(hidden.body.length, 0);
  await request(app.getHttpServer())
    .patch(`${base}/products/${product.body.id}`)
    .set("Authorization", auth)
    .send({ active: true })
    .expect(200);
  await request(app.getHttpServer())
    .patch(`${base}/categories/${category.body.id}`)
    .set("Authorization", auth)
    .send({ active: false })
    .expect(200);
  const parentHidden = await request(app.getHttpServer())
    .get(`${base}/products`)
    .set("Authorization", staff)
    .expect(200);
  assert.equal(parentHidden.body.length, 0);
});
it("manages branch tables and rejects capacity, duplicates and inactive branch writes", async () => {
  const owner = await login();
  const auth = `Bearer ${owner.body.accessToken}`;
  const branch = await db.branch.findFirstOrThrow({
    where: { restaurantId: a, active: true },
  });
  const base = `/api/restaurant/branches/${branch.id}`;
  for (const capacity of [0, 101, 1.5, null]) {
    await request(app.getHttpServer())
      .post(`${base}/tables`)
      .set("Authorization", auth)
      .send({ name: "Invalid", capacity })
      .expect(400);
  }
  const table = await request(app.getHttpServer())
    .post(`${base}/tables`)
    .set("Authorization", auth)
    .send({ name: "Mesa 1", capacity: 4 })
    .expect(201);
  await request(app.getHttpServer())
    .post(`${base}/tables`)
    .set("Authorization", auth)
    .send({ name: "Mesa 1", capacity: 4 })
    .expect(409);
  await assert.rejects(
    db.diningTable.update({
      where: { id: table.body.id },
      data: { capacity: 0 },
    }),
  );
  const other = await db.branch.findFirstOrThrow({
    where: { restaurantId: a, id: { not: branch.id }, active: true },
  });
  await request(app.getHttpServer())
    .patch(`/api/restaurant/branches/${other.id}/tables/${table.body.id}`)
    .set("Authorization", auth)
    .send({ capacity: 8 })
    .expect(404);
  await request(app.getHttpServer())
    .patch(`${base}/tables/${table.body.id}`)
    .set("Authorization", auth)
    .send({ capacity: 8, active: false })
    .expect(200);
  const listed = await request(app.getHttpServer())
    .get(`${base}/tables`)
    .set("Authorization", auth)
    .expect(200);
  assert.equal(listed.body[0].capacity, 8);
  assert.equal(listed.body[0].active, false);
  await request(app.getHttpServer())
    .patch(`${base}/tables/${table.body.id}`)
    .set("Authorization", auth)
    .send({ active: true })
    .expect(200);
  const inactive = await db.branch.create({
    data: { restaurantId: a, name: "Inactive catalog", active: false },
  });
  await request(app.getHttpServer())
    .post(`/api/restaurant/branches/${inactive.id}/tables`)
    .set("Authorization", auth)
    .send({ name: "No", capacity: 4 })
    .expect(400);
  await request(app.getHttpServer())
    .get("/api/restaurant/branches/invalid-uuid/tables")
    .set("Authorization", auth)
    .expect(400);
});

async function orderFixture() {
  const branch = await db.branch.create({
    data: { restaurantId: a, name: `Orders ${randomUUID()}` },
  });
  const other = await db.branch.create({
    data: { restaurantId: b, name: `Foreign ${randomUUID()}` },
  });
  const category = await db.menuCategory.create({
    data: { restaurantId: a, branchId: branch.id, name: "Tacos" },
  });
  const product = await db.product.create({
    data: {
      restaurantId: a,
      branchId: branch.id,
      categoryId: category.id,
      name: "Taco",
      priceCents: 2900,
    },
  });
  const table = await db.diningTable.create({
    data: { restaurantId: a, branchId: branch.id, name: "Mesa 1" },
  });
  const table2 = await db.diningTable.create({
    data: { restaurantId: a, branchId: branch.id, name: "Mesa 2" },
  });
  const foreignCategory = await db.menuCategory.create({
    data: { restaurantId: b, branchId: other.id, name: "Foreign" },
  });
  const foreignProduct = await db.product.create({
    data: {
      restaurantId: b,
      branchId: other.id,
      categoryId: foreignCategory.id,
      name: "Foreign",
      priceCents: 100,
    },
  });
  const foreignTable = await db.diningTable.create({
    data: { restaurantId: b, branchId: other.id, name: "Foreign" },
  });
  const owner = await login();
  const auth = `Bearer ${owner.body.accessToken}`;
  const staff: Record<string, string> = {};
  const hashed = await hashPassword(password);
  for (const role of [Role.WAITER, Role.CASHIER, Role.KITCHEN, Role.MANAGER]) {
    const user = await db.user.create({
      data: {
        email: `${role.toLowerCase()}-${randomUUID()}@example.com`,
        name: role,
        passwordHash: hashed,
      },
    });
    users.push(user.id);
    await db.membership.create({
      data: { userId: user.id, restaurantId: a, branchId: branch.id, role },
    });
    const res = await login(user.email);
    assert.equal(res.status, 201);
    staff[role] = `Bearer ${res.body.accessToken}`;
  }
  return {
    branch,
    other,
    category,
    product,
    table,
    table2,
    foreignProduct,
    foreignTable,
    auth,
    staff,
    base: `/api/restaurant/branches/${branch.id}/orders`,
    body: {
      requestId: randomUUID(),
      tableId: table.id,
      notes: "Para compartir",
      items: [{ productId: product.id, quantity: 3, notes: "Sin cebolla" }],
    },
  };
}
it("creates immutable priced orders, retries once and isolates tenant/branch", async () => {
  const f = await orderFixture();
  const first = await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.staff.WAITER)
    .send(f.body)
    .expect(201);
  assert.equal(first.body.totalCents, 8700);
  assert.equal(first.body.items[0].unitPriceCents, 2900);
  assert.equal(first.body.events[0].actorName, "WAITER");
  assert.equal(first.body.status, "SENT");
  await db.product.update({
    where: { id: f.product.id },
    data: { priceCents: 4300, name: "Taco grande", available: false },
  });
  const retry = await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.staff.WAITER)
    .send(f.body)
    .expect(201);
  assert.equal(retry.body.id, first.body.id);
  assert.equal(retry.body.totalCents, 8700);
  assert.equal(retry.body.items[0].name, "Taco");
  await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send({ ...f.body, notes: "Changed" })
    .expect(409);
  await request(app.getHttpServer())
    .get(`/api/restaurant/branches/${f.other.id}/orders`)
    .set("Authorization", f.auth)
    .expect(404);
  const sibling = await db.branch.create({
    data: { restaurantId: a, name: `Sibling ${randomUUID()}` },
  });
  await request(app.getHttpServer())
    .get(`/api/restaurant/branches/${sibling.id}/orders`)
    .set("Authorization", f.staff.WAITER)
    .expect(403);
  await request(app.getHttpServer())
    .patch(
      `/api/restaurant/branches/${sibling.id}/orders/${first.body.id}/status`,
    )
    .set("Authorization", f.auth)
    .send({ status: "PREPARING", expectedStatus: "SENT" })
    .expect(404);
  const list = await request(app.getHttpServer())
    .get(f.base)
    .set("Authorization", f.staff.KITCHEN)
    .expect(200);
  assert.equal(list.body.length, 1);
});
it("rejects unavailable or foreign menu/table, duplicate lines and invalid quantities or client prices", async () => {
  const f = await orderFixture();
  const send = (body: object) =>
    request(app.getHttpServer())
      .post(f.base)
      .set("Authorization", f.auth)
      .send(body);
  for (const quantity of [0, 101, 1.5, null])
    await send({
      ...f.body,
      items: [{ productId: f.product.id, quantity }],
    }).expect(400);
  await send({ ...f.body, items: [] }).expect(400);
  await send({ ...f.body, items: [...f.body.items, ...f.body.items] }).expect(
    400,
  );
  await send({ ...f.body, totalCents: 1 }).expect(400);
  await send({
    ...f.body,
    items: [{ productId: f.product.id, quantity: 1, unitPriceCents: 1 }],
  }).expect(400);
  await send({
    ...f.body,
    items: [{ productId: f.foreignProduct.id, quantity: 1 }],
  }).expect(400);
  await send({ ...f.body, tableId: f.foreignTable.id }).expect(400);
  await db.product.update({
    where: { id: f.product.id },
    data: { available: false },
  });
  await send(f.body).expect(400);
  await db.product.update({
    where: { id: f.product.id },
    data: { available: true },
  });
  await db.menuCategory.update({
    where: { id: f.category.id },
    data: { active: false },
  });
  await send(f.body).expect(400);
  await db.menuCategory.update({
    where: { id: f.category.id },
    data: { active: true },
  });
  await db.diningTable.update({
    where: { id: f.table.id },
    data: { active: false },
  });
  await send(f.body).expect(400);
  await db.diningTable.update({
    where: { id: f.table.id },
    data: { active: true },
  });
  await db.product.update({
    where: { id: f.product.id },
    data: { priceCents: 99999999 },
  });
  await send({
    ...f.body,
    items: [{ productId: f.product.id, quantity: 100 }],
  }).expect(400);
  await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.staff.KITCHEN)
    .send(f.body)
    .expect(403);
  assert.equal(await db.order.count({ where: { branchId: f.branch.id } }), 0);
});
it("allows only authorized state transitions, records audit and releases table after closure", async () => {
  const f = await orderFixture();
  const created = await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.staff.CASHIER)
    .send(f.body)
    .expect(201);
  const path = `${f.base}/${created.body.id}/status`;
  const change = (token: string, status: string, expectedStatus: string) =>
    request(app.getHttpServer())
      .patch(path)
      .set("Authorization", token)
      .send({ status, expectedStatus });
  await change(f.staff.WAITER, "PREPARING", "SENT").expect(403);
  await change(f.staff.KITCHEN, "READY", "SENT").expect(409);
  await change(f.staff.KITCHEN, "PREPARING", "SENT").expect(200);
  await change(f.staff.MANAGER, "PREPARING", "SENT").expect(409);
  await change(f.staff.KITCHEN, "READY", "PREPARING").expect(200);
  await change(f.staff.KITCHEN, "DELIVERED", "READY").expect(403);
  await change(f.staff.WAITER, "DELIVERED", "READY").expect(200);
  await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send({ ...f.body, requestId: randomUUID() })
    .expect(409);
  await change(f.staff.CASHIER, "CLOSED", "DELIVERED").expect(400);
  const closed = await request(app.getHttpServer())
    .post(`${f.base}/${created.body.id}/payment`)
    .set("Authorization", f.staff.CASHIER)
    .send({
      requestId: randomUUID(),
      method: "CASH",
      receivedCents: 10000,
      expectedTotalCents: 8700,
    })
    .expect(201);
  assert.equal(closed.body.events.length, 5);
  assert.deepEqual(
    closed.body.events.map((e: { status: string }) => e.status),
    ["SENT", "PREPARING", "READY", "DELIVERED", "CLOSED"],
  );
  await change(f.auth, "SENT", "CLOSED").expect(409);
  const next = await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send({ ...f.body, requestId: randomUUID() })
    .expect(201);
  assert.equal(next.body.number, 2);
});
it("requires manager cancellation reason and rejects terminal cancellation", async () => {
  const f = await orderFixture();
  const order = await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send(f.body)
    .expect(201);
  const path = `${f.base}/${order.body.id}/status`;
  const body = {
    status: "CANCELLED",
    expectedStatus: "SENT",
    reason: "Cliente se retiró",
  };
  for (const role of ["WAITER", "CASHIER", "KITCHEN"])
    await request(app.getHttpServer())
      .patch(path)
      .set("Authorization", f.staff[role])
      .send(body)
      .expect(403);
  await request(app.getHttpServer())
    .patch(path)
    .set("Authorization", f.auth)
    .send({ ...body, reason: " " })
    .expect(400);
  const cancelled = await request(app.getHttpServer())
    .patch(path)
    .set("Authorization", f.staff.MANAGER)
    .send(body)
    .expect(200);
  assert.equal(cancelled.body.events[1].reason, body.reason);
  await request(app.getHttpServer())
    .patch(path)
    .set("Authorization", f.auth)
    .send({ ...body, expectedStatus: "CANCELLED" })
    .expect(409);
});
it("serializes simultaneous submissions and enforces database tenant references", async () => {
  const f = await orderFixture();
  const send = (body: object) =>
    request(app.getHttpServer())
      .post(f.base)
      .set("Authorization", f.auth)
      .send(body);
  const retries = await Promise.all([send(f.body), send(f.body)]);
  assert.deepEqual(
    retries.map((r) => r.status),
    [201, 201],
  );
  assert.equal(retries[0].body.id, retries[1].body.id);
  const races = await Promise.all([
    send({ ...f.body, tableId: f.table2.id, requestId: randomUUID() }),
    send({ ...f.body, tableId: f.table2.id, requestId: randomUUID() }),
  ]);
  assert.deepEqual(races.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await db.order.count({ where: { branchId: f.branch.id } }), 2);
  await assert.rejects(
    db.order.update({
      where: { id: retries[0].body.id },
      data: { tableId: f.foreignTable.id },
    }),
  );
  await assert.rejects(
    db.orderItem.update({
      where: { id: retries[0].body.items[0].id },
      data: { productId: f.foreignProduct.id },
    }),
  );
  await assert.rejects(
    db.orderItem.update({
      where: { id: retries[0].body.items[0].id },
      data: { quantity: 0 },
    }),
  );
});

async function paymentFixture() {
  const f = await orderFixture();
  const order = await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send(f.body)
    .expect(201);
  await db.order.update({
    where: { id: order.body.id },
    data: { status: "DELIVERED" },
  });
  await db.orderRound.updateMany({
    where: { orderId: order.body.id },
    data: { status: "DELIVERED" },
  });
  return {
    ...f,
    order: order.body,
    path: `${f.base}/${order.body.id}/payment`,
    payment: {
      requestId: randomUUID(),
      method: "CASH",
      receivedCents: 10000,
      expectedTotalCents: 8700,
    },
  };
}
it("registers cash and change atomically, closes account and retries the exact payment", async () => {
  const f = await paymentFixture();
  const pay = (body: object) =>
    request(app.getHttpServer())
      .post(f.path)
      .set("Authorization", f.staff.CASHIER)
      .send(body);
  const paid = await pay(f.payment).expect(201);
  assert.equal(paid.body.status, "CLOSED");
  assert.equal(paid.body.payment.amountCents, 8700);
  assert.equal(paid.body.payment.receivedCents, 10000);
  assert.equal(paid.body.payment.changeCents, 1300);
  assert.equal(paid.body.payment.actorName, "CASHIER");
  const replay = await pay(f.payment).expect(201);
  assert.equal(replay.body.payment.id, paid.body.payment.id);
  assert.equal(replay.body.events.length, paid.body.events.length);
  await pay({ ...f.payment, receivedCents: 20000 }).expect(409);
  await pay({ ...f.payment, requestId: randomUUID() }).expect(409);
  await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send({ ...f.body, requestId: randomUUID() })
    .expect(201);
  assert.equal(await db.payment.count({ where: { branchId: f.branch.id } }), 1);
});
it("requires exact card amount and terminal reference without cash change", async () => {
  const f = await paymentFixture();
  const card = {
    ...f.payment,
    method: "CARD",
    receivedCents: 8700,
    reference: "AUTH-481",
  };
  const pay = (body: object) =>
    request(app.getHttpServer())
      .post(f.path)
      .set("Authorization", f.staff.MANAGER)
      .send(body);
  await pay({ ...card, reference: " " }).expect(400);
  await pay({ ...card, receivedCents: 10000 }).expect(400);
  const paid = await pay(card).expect(201);
  assert.equal(paid.body.payment.changeCents, 0);
  assert.equal(paid.body.payment.reference, "AUTH-481");
  assert.equal(paid.body.payment.method, "CARD");
  await pay(card).expect(201);
  await request(app.getHttpServer())
    .patch(`${f.base}/${f.order.id}/status`)
    .set("Authorization", f.auth)
    .send({ status: "CANCELLED", expectedStatus: "CLOSED", reason: "No" })
    .expect(409);
});
it("rejects invalid cash amounts, stale totals, client payment totals and premature or cancelled accounts", async () => {
  const f = await paymentFixture();
  const pay = (body: object) =>
    request(app.getHttpServer())
      .post(f.path)
      .set("Authorization", f.auth)
      .send(body);
  for (const receivedCents of [-1, 1.5, null, "10000", 2147483648, 8600])
    await pay({ ...f.payment, receivedCents }).expect(400);
  await pay({ ...f.payment, expectedTotalCents: 8600 }).expect(409);
  await pay({ ...f.payment, amountCents: 1 }).expect(400);
  await pay({ ...f.payment, reference: "Not cash" }).expect(400);
  await pay({ ...f.payment, method: "OTHER" }).expect(400);
  await pay({ ...f.payment, method: "CARD", reference: "x".repeat(81) }).expect(
    400,
  );
  await db.order.update({
    where: { id: f.order.id },
    data: { status: "SENT" },
  });
  await pay(f.payment).expect(409);
  await db.order.update({
    where: { id: f.order.id },
    data: { status: "CANCELLED" },
  });
  await pay(f.payment).expect(409);
  assert.equal(await db.payment.count({ where: { branchId: f.branch.id } }), 0);
});
it("enforces cashier roles, branch and restaurant isolation for payments and replay", async () => {
  const f = await paymentFixture();
  for (const role of ["WAITER", "KITCHEN"])
    await request(app.getHttpServer())
      .post(f.path)
      .set("Authorization", f.staff[role])
      .send(f.payment)
      .expect(403);
  const other = await db.branch.create({
    data: { restaurantId: a, name: `Payment sibling ${randomUUID()}` },
  });
  await request(app.getHttpServer())
    .post(`/api/restaurant/branches/${other.id}/orders/${f.order.id}/payment`)
    .set("Authorization", f.staff.CASHIER)
    .send(f.payment)
    .expect(403);
  await request(app.getHttpServer())
    .post(`/api/restaurant/branches/${other.id}/orders/${f.order.id}/payment`)
    .set("Authorization", f.auth)
    .send(f.payment)
    .expect(404);
  await request(app.getHttpServer())
    .post(`/api/restaurant/branches/${f.other.id}/orders/${f.order.id}/payment`)
    .set("Authorization", f.auth)
    .send(f.payment)
    .expect(404);
  await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send(f.payment)
    .expect(201);
  const second = await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send({ ...f.body, tableId: f.table2.id, requestId: randomUUID() })
    .expect(201);
  await request(app.getHttpServer())
    .post(`${f.base}/${second.body.id}/payment`)
    .set("Authorization", f.auth)
    .send(f.payment)
    .expect(409);
});
it("handles concurrent payments exactly once and protects database amounts and tenant keys", async () => {
  const f = await paymentFixture();
  const pay = (body: object) =>
    request(app.getHttpServer())
      .post(f.path)
      .set("Authorization", f.auth)
      .send(body);
  const results = await Promise.all([pay(f.payment), pay(f.payment)]);
  assert.deepEqual(
    results.map((r) => r.status),
    [201, 201],
  );
  assert.equal(results[0].body.payment.id, results[1].body.payment.id);
  const paymentId = results[0].body.payment.id;
  await assert.rejects(
    db.payment.update({ where: { id: paymentId }, data: { changeCents: 0 } }),
  );
  await assert.rejects(
    db.payment.update({ where: { id: paymentId }, data: { restaurantId: b } }),
  );
  const second = await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send({ ...f.body, tableId: f.table2.id, requestId: randomUUID() })
    .expect(201);
  await db.order.update({
    where: { id: second.body.id },
    data: { status: "DELIVERED" },
  });
  await db.orderRound.updateMany({
    where: { orderId: second.body.id },
    data: { status: "DELIVERED" },
  });
  const nextPath = `${f.base}/${second.body.id}/payment`;
  const races = await Promise.all(
    [1, 2].map(() =>
      request(app.getHttpServer())
        .post(nextPath)
        .set("Authorization", f.auth)
        .send({ ...f.payment, requestId: randomUUID() }),
    ),
  );
  assert.deepEqual(races.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await db.payment.count({ where: { branchId: f.branch.id } }), 2);
});

it("generates account and paid ticket from snapshots without claiming an unpaid receipt", async () => {
  const f = await paymentFixture();
  const path = `${f.base}/${f.order.id}/ticket`;
  const account = await request(app.getHttpServer())
    .get(path)
    .set("Authorization", f.staff.WAITER)
    .expect(200);
  assert.equal(account.body.title, "Cuenta");
  assert.equal(account.body.notice, "Cuenta pendiente de pago");
  assert.equal(account.body.order.totalCents, 8700);
  assert.equal(account.body.order.items[0].lineTotalCents, 8700);
  assert.equal(account.body.payment, null);
  assert.ok(!JSON.stringify(account.body).includes("passwordHash"));
  assert.ok(!JSON.stringify(account.body).includes("requestHash"));
  assert.ok(!JSON.stringify(account.body).includes("notes"));
  await request(app.getHttpServer())
    .get(path + "?kind=PAYMENT")
    .set("Authorization", f.auth)
    .expect(409);
  await db.product.update({
    where: { id: f.product.id },
    data: { name: "Changed", priceCents: 100 },
  });
  const paid = await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.staff.CASHIER)
    .send(f.payment)
    .expect(201);
  const receipt = await request(app.getHttpServer())
    .get(path + "?kind=PAYMENT")
    .set("Authorization", f.staff.CASHIER)
    .expect(200);
  assert.equal(receipt.body.title, "Comprobante de pago");
  assert.equal(receipt.body.notice, "Pago registrado");
  assert.equal(receipt.body.order.items[0].name, "Taco");
  assert.equal(receipt.body.payment.id, paid.body.payment.id);
  assert.equal(receipt.body.payment.changeCents, 1300);
  const before = await db.order.findUniqueOrThrow({
    where: { id: f.order.id },
    include: { events: true, payment: true },
  });
  const pdf = await request(app.getHttpServer())
    .get(path + ".pdf?kind=PAYMENT")
    .set("Authorization", f.auth)
    .expect(200);
  assert.match(pdf.headers["content-type"], /application\/pdf/);
  assert.match(
    pdf.headers["content-disposition"],
    /attachment; filename="tavixo-payment-/,
  );
  assert.match(pdf.headers["cache-control"], /no-store/);
  assert.ok(Buffer.isBuffer(pdf.body));
  assert.ok(pdf.body.subarray(0, 5).equals(Buffer.from("%PDF-")));
  assert.ok(pdf.body.toString("latin1").trimEnd().endsWith("%%EOF"));
  const after = await db.order.findUniqueOrThrow({
    where: { id: f.order.id },
    include: { events: true, payment: true },
  });
  assert.deepEqual(after, before);
});
it("isolates ticket and PDF access by role, tenant/branch and rejects cancelled or legacy paid receipts", async () => {
  const f = await paymentFixture();
  const path = `${f.base}/${f.order.id}/ticket`;
  for (const suffix of ["", ".pdf"]) {
    await request(app.getHttpServer())
      .get(path + suffix)
      .expect(401);
    await request(app.getHttpServer())
      .get(path + suffix)
      .set("Authorization", f.staff.KITCHEN)
      .expect(403);
  }
  const sibling = await db.branch.create({
    data: { restaurantId: a, name: `Ticket sibling ${randomUUID()}` },
  });
  await request(app.getHttpServer())
    .get(`/api/restaurant/branches/${sibling.id}/orders/${f.order.id}/ticket`)
    .set("Authorization", f.staff.WAITER)
    .expect(403);
  await request(app.getHttpServer())
    .get(`/api/restaurant/branches/${sibling.id}/orders/${f.order.id}/ticket`)
    .set("Authorization", f.auth)
    .expect(404);
  await request(app.getHttpServer())
    .get(
      `/api/restaurant/branches/${f.other.id}/orders/${f.order.id}/ticket.pdf`,
    )
    .set("Authorization", f.auth)
    .expect(404);
  await request(app.getHttpServer())
    .get(path + "?kind=OTHER")
    .set("Authorization", f.auth)
    .expect(400);
  await request(app.getHttpServer())
    .get(path + "?kind=ACCOUNT&tenantId=forged")
    .set("Authorization", f.auth)
    .expect(400);
  await db.order.update({
    where: { id: f.order.id },
    data: { status: "CLOSED" },
  });
  const legacy = await request(app.getHttpServer())
    .get(path)
    .set("Authorization", f.auth)
    .expect(200);
  assert.match(legacy.body.notice, /sin pago registrado/);
  await request(app.getHttpServer())
    .get(path + ".pdf?kind=PAYMENT")
    .set("Authorization", f.auth)
    .expect(409);
  await db.order.update({
    where: { id: f.order.id },
    data: { status: "CANCELLED" },
  });
  await request(app.getHttpServer())
    .get(path)
    .set("Authorization", f.auth)
    .expect(409);
});
it("renders long digital accounts across PDF pages and preserves Spanish names and card receipt amounts", async () => {
  const f = await paymentFixture();
  const path = `${f.base}/${f.order.id}/ticket`;
  await db.orderItem.update({
    where: { id: f.order.items[0].id },
    data: { name: "Quesabirría con consomé" },
  });
  await db.orderItem.createMany({
    data: Array.from({ length: 99 }, (_, i) => ({
      orderId: f.order.id,
      restaurantId: a,
      branchId: f.branch.id,
      productId: f.product.id,
      name: `Producto ${i} con nombre largo para comprobar saltos de página`,
      quantity: 1,
      unitPriceCents: 0,
    })),
  });
  const long = await request(app.getHttpServer())
    .get(path + ".pdf")
    .set("Authorization", f.auth)
    .expect(200);
  assert.ok(
    (long.body.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length > 1,
  );
  await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send({
      ...f.payment,
      method: "CARD",
      receivedCents: 8700,
      reference: "DEMO-TICKET",
    })
    .expect(201);
  const receipt = await request(app.getHttpServer())
    .get(path + "?kind=PAYMENT")
    .set("Authorization", f.auth)
    .expect(200);
  assert.equal(receipt.body.payment.reference, "DEMO-TICKET");
  assert.equal(receipt.body.payment.amountCents, 8700);
  assert.equal(receipt.body.payment.changeCents, 0);
});

it("adds priced rounds without resending delivered products and waits for every delivery before payment", async () => {
  const f = await paymentFixture();
  await db.product.update({
    where: { id: f.product.id },
    data: { priceCents: 4300, name: "Taco grande" },
  });
  const body = {
    requestId: randomUUID(),
    expectedTotalCents: 8700,
    notes: "Segunda ronda",
    items: [{ productId: f.product.id, quantity: 2, notes: "Con todo" }],
  };
  const path = `${f.base}/${f.order.id}/rounds`;
  const added = await request(app.getHttpServer())
    .post(path)
    .set("Authorization", f.staff.WAITER)
    .send(body)
    .expect(201);
  assert.equal(added.body.totalCents, 17300);
  assert.equal(added.body.rounds[0].status, "DELIVERED");
  assert.equal(added.body.rounds[0].items[0].unitPriceCents, 2900);
  assert.equal(added.body.rounds[1].items[0].unitPriceCents, 4300);
  assert.equal(added.body.rounds[1].items[0].name, "Taco grande");
  assert.equal(added.body.status, "SENT");
  await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send({ ...f.payment, expectedTotalCents: 17300, receivedCents: 20000 })
    .expect(409);
  const roundPath = `${path}/${added.body.rounds[1].id}/status`;
  for (const [expectedStatus, status, role] of [
    ["SENT", "PREPARING", "KITCHEN"],
    ["PREPARING", "READY", "KITCHEN"],
    ["READY", "DELIVERED", "WAITER"],
  ]) {
    await request(app.getHttpServer())
      .patch(roundPath)
      .set("Authorization", f.staff[role])
      .send({ expectedStatus, status })
      .expect(200);
  }
  const paid = await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send({ ...f.payment, expectedTotalCents: 17300, receivedCents: 20000 })
    .expect(201);
  assert.equal(paid.body.payment.changeCents, 2700);
  const ticket = await request(app.getHttpServer())
    .get(`${f.base}/${f.order.id}/ticket?kind=PAYMENT`)
    .set("Authorization", f.auth)
    .expect(200);
  assert.equal(ticket.body.order.totalCents, 17300);
  assert.equal(ticket.body.order.items.length, 2);
  const retry = await request(app.getHttpServer())
    .post(path)
    .set("Authorization", f.staff.WAITER)
    .send(body)
    .expect(201);
  assert.equal(retry.body.rounds.length, 2);
  assert.equal(retry.body.status, "CLOSED");
});

it("serializes duplicate and competing rounds and rejects stale totals and reused requests", async () => {
  const f = await paymentFixture();
  const path = `${f.base}/${f.order.id}/rounds`;
  const body = {
    requestId: randomUUID(),
    expectedTotalCents: 8700,
    items: [{ productId: f.product.id, quantity: 1 }],
  };
  const send = (data: object) =>
    request(app.getHttpServer())
      .post(path)
      .set("Authorization", f.auth)
      .send(data);
  const repeats = await Promise.all([send(body), send(body)]);
  assert.deepEqual(
    repeats.map((r) => r.status),
    [201, 201],
  );
  assert.equal(repeats[0].body.totalCents, 11600);
  assert.equal(repeats[1].body.rounds.length, 2);
  await send({
    ...body,
    items: [{ productId: f.product.id, quantity: 2 }],
  }).expect(409);
  await send({ ...body, requestId: randomUUID() }).expect(409);
  const races = await Promise.all([
    send({ ...body, requestId: randomUUID(), expectedTotalCents: 11600 }),
    send({ ...body, requestId: randomUUID(), expectedTotalCents: 11600 }),
  ]);
  assert.deepEqual(races.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    await db.orderRound.count({ where: { orderId: f.order.id } }),
    3,
  );
  await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send({ ...f.body, tableId: f.table2.id, requestId: body.requestId })
    .expect(409);
});

it("rejects foreign, unavailable and unauthorized rounds and preserves terminal accounts", async () => {
  const f = await paymentFixture();
  const path = `${f.base}/${f.order.id}/rounds`;
  const body = {
    requestId: randomUUID(),
    expectedTotalCents: 8700,
    items: [{ productId: f.product.id, quantity: 1 }],
  };
  const send = (data: object, auth = f.auth) =>
    request(app.getHttpServer())
      .post(path)
      .set("Authorization", auth)
      .send(data);
  await send(body, f.staff.KITCHEN).expect(403);
  await send({
    ...body,
    items: [{ productId: f.foreignProduct.id, quantity: 1 }],
  }).expect(400);
  await send({ ...body, items: [body.items[0], body.items[0]] }).expect(400);
  await db.product.update({
    where: { id: f.product.id },
    data: { available: false },
  });
  await send(body).expect(400);
  await db.product.update({
    where: { id: f.product.id },
    data: { available: true },
  });
  await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send(f.payment)
    .expect(201);
  await send(body).expect(409);
  assert.equal(
    await db.orderRound.count({ where: { orderId: f.order.id } }),
    1,
  );
});

it("round transitions enforce roles and isolate rounds belonging to another account", async () => {
  const f = await paymentFixture();
  const second = await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send({ ...f.body, requestId: randomUUID(), tableId: f.table2.id })
    .expect(201);
  const round = second.body.rounds[0];
  const patch = (orderId: string, auth: string, data: object) =>
    request(app.getHttpServer())
      .patch(`${f.base}/${orderId}/rounds/${round.id}/status`)
      .set("Authorization", auth)
      .send(data);
  await patch(f.order.id, f.auth, {
    expectedStatus: "SENT",
    status: "PREPARING",
  }).expect(404);
  await patch(second.body.id, f.staff.WAITER, {
    expectedStatus: "SENT",
    status: "PREPARING",
  }).expect(403);
  await patch(second.body.id, f.staff.KITCHEN, {
    expectedStatus: "SENT",
    status: "DELIVERED",
  }).expect(403);
  await patch(second.body.id, f.staff.KITCHEN, {
    expectedStatus: "SENT",
    status: "PREPARING",
  }).expect(200);
  await patch(second.body.id, f.staff.KITCHEN, {
    expectedStatus: "SENT",
    status: "PREPARING",
  }).expect(409);
});

it("makes concurrent payment and new round mutually exclusive without losing products or money", async () => {
  const f = await paymentFixture();
  const results = await Promise.all([
    request(app.getHttpServer())
      .post(f.path)
      .set("Authorization", f.auth)
      .send(f.payment),
    request(app.getHttpServer())
      .post(`${f.base}/${f.order.id}/rounds`)
      .set("Authorization", f.staff.WAITER)
      .send({
        requestId: randomUUID(),
        expectedTotalCents: 8700,
        items: [{ productId: f.product.id, quantity: 1 }],
      }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const order = await db.order.findUniqueOrThrow({
    where: { id: f.order.id },
    include: { payment: true, rounds: true, items: true },
  });
  if (order.payment) {
    assert.equal(order.status, "CLOSED");
    assert.equal(order.totalCents, 8700);
    assert.equal(order.rounds.length, 1);
  } else {
    assert.equal(order.status, "SENT");
    assert.equal(order.totalCents, 11600);
    assert.equal(order.rounds.length, 2);
    assert.equal(order.items.length, 2);
  }
});

async function cashFixture() {
  const f = await paymentFixture();
  const first = await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send(f.payment)
    .expect(201);
  await db.payment.update({
    where: { id: first.body.payment.id },
    data: { createdAt: new Date("2026-01-16T05:59:59.999Z") },
  });
  const pay = async (method: "CASH" | "CARD", timestamp: string) => {
    const created = await request(app.getHttpServer())
      .post(f.base)
      .set("Authorization", f.auth)
      .send({
        ...f.body,
        requestId: randomUUID(),
        items: [{ productId: f.product.id, quantity: 1 }],
      })
      .expect(201);
    await db.order.update({
      where: { id: created.body.id },
      data: { status: "DELIVERED" },
    });
    await db.orderRound.updateMany({
      where: { orderId: created.body.id },
      data: { status: "DELIVERED" },
    });
    const paid = await request(app.getHttpServer())
      .post(`${f.base}/${created.body.id}/payment`)
      .set("Authorization", f.auth)
      .send({
        requestId: randomUUID(),
        method,
        expectedTotalCents: 2900,
        receivedCents: method === "CASH" ? 5000 : 2900,
        ...(method === "CARD" ? { reference: "terminal-123" } : {}),
      })
      .expect(201);
    await db.payment.update({
      where: { id: paid.body.payment.id },
      data: { createdAt: new Date(timestamp) },
    });
    return paid.body.payment.id as string;
  };
  const cardId = await pay("CARD", "2026-01-15T06:00:00.000Z");
  const outsideId = await pay("CASH", "2026-01-16T06:00:00.000Z");
  const historical = await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send({ ...f.body, requestId: randomUUID() })
    .expect(201);
  await db.order.update({
    where: { id: historical.body.id },
    data: { status: "CLOSED" },
  });
  return {
    ...f,
    cardId,
    outsideId,
    cashBase: `/api/restaurant/branches/${f.branch.id}/cash`,
    cut: {
      day: "2026-01-15",
      requestId: randomUUID(),
      openingCents: 5000,
      countedCents: 13000,
      expectedTotalCents: 11600,
      expectedPaymentCount: 2,
      notes: "Cierre revisado",
    },
  };
}

it("summarizes payment-day boundaries in Mexico and excludes unpaid legacy accounts", async () => {
  const f = await cashFixture();
  const res = await request(app.getHttpServer())
    .get(`${f.cashBase}/summary?day=2026-01-15`)
    .set("Authorization", f.auth)
    .expect(200);
  assert.equal(res.body.totalCents, 11600);
  assert.equal(res.body.paymentCount, 2);
  assert.equal(res.body.cash.totalCents, 8700);
  assert.equal(res.body.cash.receivedCents, 10000);
  assert.equal(res.body.cash.changeCents, 1300);
  assert.equal(res.body.card.totalCents, 2900);
  assert.equal(res.body.periodStart, "2026-01-15T06:00:00.000Z");
  assert.equal(res.body.periodEnd, "2026-01-16T06:00:00.000Z");
  assert.equal(res.body.payments.length, 2);
  assert.ok(!JSON.stringify(res.body).includes("requestHash"));
  const empty = await request(app.getHttpServer())
    .get(`${f.cashBase}/summary?day=2026-01-14`)
    .set("Authorization", f.auth)
    .expect(200);
  assert.equal(empty.body.totalCents, 0);
  assert.equal(empty.body.paymentCount, 0);
});

it("stores cash reconciliation once, preserves snapshots and rejects stale or conflicting cuts", async () => {
  const f = await cashFixture();
  const send = (body: object) =>
    request(app.getHttpServer())
      .post(`${f.cashBase}/cuts`)
      .set("Authorization", f.staff.CASHIER)
      .send(body);
  const results = await Promise.all([send(f.cut), send(f.cut)]);
  assert.deepEqual(
    results.map((r) => r.status),
    [201, 201],
  );
  assert.equal(results[0].body.id, results[1].body.id);
  const saved = results[0].body;
  assert.equal(saved.snapshot.expectedCents, 13700);
  assert.equal(saved.snapshot.differenceCents, -700);
  assert.equal(saved.actorName, "CASHIER");
  assert.ok(!JSON.stringify(saved).includes("requestHash"));
  await send({ ...f.cut, countedCents: 15000 }).expect(409);
  await db.payment.update({
    where: { id: f.outsideId },
    data: { createdAt: new Date("2026-01-15T20:00:00Z") },
  });
  const retry = await send(f.cut).expect(201);
  assert.deepEqual(retry.body.snapshot, saved.snapshot);
  await send({ ...f.cut, requestId: randomUUID() }).expect(409);
  const history = await request(app.getHttpServer())
    .get(`${f.cashBase}/cuts?day=2026-01-15`)
    .set("Authorization", f.auth)
    .expect(200);
  assert.equal(history.body.length, 1);
  assert.deepEqual(history.body[0].snapshot, saved.snapshot);
  const updated = await send({
    ...f.cut,
    requestId: randomUUID(),
    expectedTotalCents: 14500,
    expectedPaymentCount: 3,
    countedCents: 17000,
  }).expect(201);
  assert.equal(updated.body.snapshot.expectedCents, 16600);
  assert.equal(updated.body.snapshot.differenceCents, 400);
  await assert.rejects(
    db.cashCut.update({ where: { id: saved.id }, data: { openingCents: -1 } }),
  );
});

it("protects sales and cuts by live role, restaurant and assigned branch", async () => {
  const f = await cashFixture();
  for (const role of ["WAITER", "KITCHEN"]) {
    await request(app.getHttpServer())
      .get(`${f.cashBase}/summary?day=2026-01-15`)
      .set("Authorization", f.staff[role])
      .expect(403);
    await request(app.getHttpServer())
      .post(`${f.cashBase}/cuts`)
      .set("Authorization", f.staff[role])
      .send(f.cut)
      .expect(403);
  }
  await request(app.getHttpServer())
    .get(`${f.cashBase}/summary?day=2026-01-15`)
    .expect(401);
  const foreign = `/api/restaurant/branches/${f.other.id}/cash`;
  await request(app.getHttpServer())
    .get(`${foreign}/summary?day=2026-01-15`)
    .set("Authorization", f.auth)
    .expect(404);
  await request(app.getHttpServer())
    .post(`${foreign}/cuts`)
    .set("Authorization", f.auth)
    .send(f.cut)
    .expect(404);
  await request(app.getHttpServer())
    .get(`${foreign}/summary?day=2026-01-15`)
    .set("Authorization", f.staff.CASHIER)
    .expect(403);
  const second = await db.branch.create({
    data: { restaurantId: a, name: `Cash second ${randomUUID()}` },
  });
  await request(app.getHttpServer())
    .get(`/api/restaurant/branches/${second.id}/cash/cuts?day=2026-01-15`)
    .set("Authorization", f.staff.CASHIER)
    .expect(403);
  const user = await db.user.findFirstOrThrow({
    where: {
      email: { startsWith: "cashier-" },
      memberships: { some: { branchId: f.branch.id } },
    },
  });
  await db.membership.updateMany({
    where: { userId: user.id, branchId: f.branch.id },
    data: { role: "WAITER" },
  });
  await request(app.getHttpServer())
    .post(`${f.cashBase}/cuts`)
    .set("Authorization", f.staff.CASHIER)
    .send(f.cut)
    .expect(403);
});

it("validates cash dates and money, handles zero-sales cuts and keeps payments untouched", async () => {
  const f = await cashFixture();
  for (const day of [
    "2026-02-30",
    "2026-13-01",
    "2099-01-01",
    "bad",
    "1999-01-01",
  ]) {
    await request(app.getHttpServer())
      .get(`${f.cashBase}/summary?day=${day}`)
      .set("Authorization", f.auth)
      .expect(400);
  }
  for (const override of [
    { openingCents: -1 },
    { countedCents: 1.5 },
    { countedCents: null },
    { openingCents: 2147483648 },
    { expectedCents: 123 },
  ]) {
    await request(app.getHttpServer())
      .post(`${f.cashBase}/cuts`)
      .set("Authorization", f.auth)
      .send({ ...f.cut, ...override })
      .expect(400);
  }
  const before = await db.payment.findMany({
    where: { branchId: f.branch.id },
    orderBy: { id: "asc" },
  });
  const cut = await request(app.getHttpServer())
    .post(`${f.cashBase}/cuts`)
    .set("Authorization", f.auth)
    .send({
      ...f.cut,
      day: "2026-01-14",
      openingCents: 10000,
      countedCents: 10000,
      expectedTotalCents: 0,
      expectedPaymentCount: 0,
    })
    .expect(201);
  assert.equal(cut.body.snapshot.expectedCents, 10000);
  assert.equal(cut.body.snapshot.differenceCents, 0);
  const after = await db.payment.findMany({
    where: { branchId: f.branch.id },
    orderBy: { id: "asc" },
  });
  assert.deepEqual(after, before);
});

it("uses complete sales totals while bounding payment detail to 200 rows", async () => {
  const f = await orderFixture();
  const data = Array.from({ length: 205 }, (_, i) => ({
    id: randomUUID(),
    restaurantId: a,
    branchId: f.branch.id,
    tableId: f.table.id,
    number: i + 1,
    tableName: "Mesa 1",
    createdByName: "Load fixture",
    requestId: randomUUID(),
    requestHash: "fixture",
    status: "CLOSED" as const,
    totalCents: 100,
  }));
  await db.order.createMany({ data });
  await db.payment.createMany({
    data: data.map((o) => ({
      id: randomUUID(),
      orderId: o.id,
      restaurantId: a,
      branchId: f.branch.id,
      requestId: randomUUID(),
      requestHash: "fixture",
      method: "CASH" as const,
      amountCents: 100,
      receivedCents: 100,
      changeCents: 0,
      actorName: "Load fixture",
      createdAt: new Date("2026-01-15T12:00:00Z"),
    })),
  });
  const res = await request(app.getHttpServer())
    .get(`/api/restaurant/branches/${f.branch.id}/cash/summary?day=2026-01-15`)
    .set("Authorization", f.auth)
    .expect(200);
  assert.equal(res.body.paymentCount, 205);
  assert.equal(res.body.totalCents, 20500);
  assert.equal(res.body.payments.length, 200);
});

it("resolves local cash days without depending on machine timezone", () => {
  assert.equal(mexicoDay(new Date("2026-01-16T05:59:59Z")), "2026-01-15");
  const range = cashRange("2026-01-15", new Date("2026-01-15T18:30:00Z"));
  assert.equal(range.start.toISOString(), "2026-01-15T06:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-01-15T18:30:00.000Z");
  assert.throws(() =>
    cashRange("2026-01-16", new Date("2026-01-15T18:30:00Z")),
  );
});

it("cancels partial quantities at original price, audits reason and pays only remaining products", async () => {
  const f = await paymentFixture();
  await db.product.update({
    where: { id: f.product.id },
    data: { priceCents: 9000, name: "Changed" },
  });
  const path = `${f.base}/${f.order.id}/items/${f.order.items[0].id}/cancellations`;
  const body = {
    requestId: randomUUID(),
    quantity: 1,
    expectedCancelledQuantity: 0,
    expectedTotalCents: 8700,
    reason: "Cliente cambió el pedido",
  };
  const result = await request(app.getHttpServer())
    .post(path)
    .set("Authorization", f.staff.MANAGER)
    .send(body)
    .expect(201);
  assert.equal(result.body.totalCents, 5800);
  assert.equal(result.body.items[0].quantity, 3);
  assert.equal(result.body.items[0].cancelledQuantity, 1);
  assert.equal(result.body.items[0].unitPriceCents, 2900);
  assert.equal(result.body.items[0].cancellations[0].reason, body.reason);
  assert.equal(result.body.items[0].cancellations[0].actorName, "MANAGER");
  const ticket = await request(app.getHttpServer())
    .get(`${f.base}/${f.order.id}/ticket`)
    .set("Authorization", f.auth)
    .expect(200);
  assert.equal(ticket.body.order.items[0].quantity, 2);
  assert.equal(ticket.body.order.items[0].lineTotalCents, 5800);
  assert.equal(ticket.body.order.totalCents, 5800);
  await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send(f.payment)
    .expect(409);
  const paid = await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send({ ...f.payment, expectedTotalCents: 5800 })
    .expect(201);
  assert.equal(paid.body.payment.amountCents, 5800);
  const retry = await request(app.getHttpServer())
    .post(path)
    .set("Authorization", f.staff.MANAGER)
    .send(body)
    .expect(201);
  assert.equal(retry.body.items[0].cancelledQuantity, 1);
  await request(app.getHttpServer())
    .post(path)
    .set("Authorization", f.auth)
    .send({
      ...body,
      requestId: randomUUID(),
      expectedTotalCents: 5800,
      expectedCancelledQuantity: 1,
    })
    .expect(409);
});

it("cancels empty rounds, preserves delivered rounds and releases fully cancelled tables", async () => {
  const f = await paymentFixture();
  const added = await request(app.getHttpServer())
    .post(`${f.base}/${f.order.id}/rounds`)
    .set("Authorization", f.auth)
    .send({
      requestId: randomUUID(),
      expectedTotalCents: 8700,
      items: [{ productId: f.product.id, quantity: 1 }],
    })
    .expect(201);
  const item = added.body.rounds[1].items[0];
  const cancel = await request(app.getHttpServer())
    .post(`${f.base}/${f.order.id}/items/${item.id}/cancellations`)
    .set("Authorization", f.auth)
    .send({
      requestId: randomUUID(),
      quantity: 1,
      expectedCancelledQuantity: 0,
      expectedTotalCents: 11600,
      reason: "Ya no lo quiere",
    })
    .expect(201);
  assert.equal(cancel.body.rounds[1].status, "CANCELLED");
  assert.equal(cancel.body.rounds[0].status, "DELIVERED");
  assert.equal(cancel.body.status, "DELIVERED");
  assert.equal(cancel.body.totalCents, 8700);
  await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send(f.payment)
    .expect(201);
  const other = await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send({ ...f.body, requestId: randomUUID() })
    .expect(201);
  const cancelled = await request(app.getHttpServer())
    .post(
      `${f.base}/${other.body.id}/items/${other.body.items[0].id}/cancellations`,
    )
    .set("Authorization", f.auth)
    .send({
      requestId: randomUUID(),
      quantity: 3,
      expectedCancelledQuantity: 0,
      expectedTotalCents: 8700,
      reason: "Cliente se retiró",
    })
    .expect(201);
  assert.equal(cancelled.body.status, "CANCELLED");
  assert.equal(cancelled.body.totalCents, 0);
  assert.equal(cancelled.body.payment, null);
  await request(app.getHttpServer())
    .post(f.base)
    .set("Authorization", f.auth)
    .send({ ...f.body, requestId: randomUUID() })
    .expect(201);
});

it("serializes cancellation retries and rejects excess quantities, stale totals and conflicting IDs", async () => {
  const f = await paymentFixture();
  const path = `${f.base}/${f.order.id}/items/${f.order.items[0].id}/cancellations`;
  const body = {
    requestId: randomUUID(),
    quantity: 1,
    expectedCancelledQuantity: 0,
    expectedTotalCents: 8700,
    reason: "Error al capturar",
  };
  const send = (data: object) =>
    request(app.getHttpServer())
      .post(path)
      .set("Authorization", f.auth)
      .send(data);
  const results = await Promise.all([send(body), send(body)]);
  assert.deepEqual(
    results.map((r) => r.status),
    [201, 201],
  );
  assert.equal(results[1].body.totalCents, 5800);
  assert.equal(results[1].body.items[0].cancellations.length, 1);
  await send({ ...body, reason: "Otra razón" }).expect(409);
  await send({ ...body, requestId: randomUUID() }).expect(409);
  await send({
    ...body,
    requestId: randomUUID(),
    quantity: 3,
    expectedCancelledQuantity: 1,
    expectedTotalCents: 5800,
  }).expect(409);
  const race = await Promise.all([
    send({
      ...body,
      requestId: randomUUID(),
      expectedCancelledQuantity: 1,
      expectedTotalCents: 5800,
    }),
    send({
      ...body,
      requestId: randomUUID(),
      expectedCancelledQuantity: 1,
      expectedTotalCents: 5800,
    }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
});

it("restricts product cancellation to live administrators and validates item/tenant scope", async () => {
  const f = await paymentFixture();
  const path = `${f.base}/${f.order.id}/items/${f.order.items[0].id}/cancellations`;
  const body = {
    requestId: randomUUID(),
    quantity: 1,
    expectedCancelledQuantity: 0,
    expectedTotalCents: 8700,
    reason: "Error",
  };
  for (const role of ["WAITER", "CASHIER", "KITCHEN"])
    await request(app.getHttpServer())
      .post(path)
      .set("Authorization", f.staff[role])
      .send(body)
      .expect(403);
  for (const override of [
    { reason: " " },
    { quantity: 0 },
    { quantity: 1.5 },
    { quantity: null },
    { priceCents: 10 },
  ])
    await request(app.getHttpServer())
      .post(path)
      .set("Authorization", f.auth)
      .send({ ...body, ...override })
      .expect(400);
  await request(app.getHttpServer()).post(path).send(body).expect(401);
  await request(app.getHttpServer())
    .post(`${f.base}/${f.order.id}/items/${randomUUID()}/cancellations`)
    .set("Authorization", f.auth)
    .send(body)
    .expect(404);
  await request(app.getHttpServer())
    .post(
      `/api/restaurant/branches/${f.other.id}/orders/${f.order.id}/items/${f.order.items[0].id}/cancellations`,
    )
    .set("Authorization", f.auth)
    .send(body)
    .expect(404);
});

it("makes payment and cancellation mutually exclusive without a stale charge", async () => {
  const f = await paymentFixture();
  const results = await Promise.all([
    request(app.getHttpServer())
      .post(f.path)
      .set("Authorization", f.auth)
      .send(f.payment),
    request(app.getHttpServer())
      .post(
        `${f.base}/${f.order.id}/items/${f.order.items[0].id}/cancellations`,
      )
      .set("Authorization", f.auth)
      .send({
        requestId: randomUUID(),
        quantity: 1,
        expectedCancelledQuantity: 0,
        expectedTotalCents: 8700,
        reason: "Cambio de pedido",
      }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const order = await db.order.findUniqueOrThrow({
    where: { id: f.order.id },
    include: { payment: true, items: true },
  });
  if (order.payment) {
    assert.equal(order.totalCents, 8700);
    assert.equal(order.items[0].cancelledQuantity, 0);
  } else {
    assert.equal(order.totalCents, 5800);
    assert.equal(order.items[0].cancelledQuantity, 1);
  }
});

it("records mixed payment atomically with separate cash/card amounts, change and one receipt", async () => {
  const f = await paymentFixture();
  const body = {
    ...f.payment,
    method: "MIXED",
    cardAmountCents: 5000,
    receivedCents: 10000,
    reference: "MIXED-123",
  };
  const paid = await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.staff.CASHIER)
    .send(body)
    .expect(201);
  assert.equal(paid.body.status, "CLOSED");
  assert.equal(paid.body.payment.amountCents, 8700);
  assert.equal(paid.body.payment.cashAmountCents, 3700);
  assert.equal(paid.body.payment.cardAmountCents, 5000);
  assert.equal(paid.body.payment.changeCents, 1300);
  const receipt = await request(app.getHttpServer())
    .get(`${f.base}/${f.order.id}/ticket?kind=PAYMENT`)
    .set("Authorization", f.auth)
    .expect(200);
  assert.equal(receipt.body.payment.method, "MIXED");
  assert.equal(receipt.body.payment.cashAmountCents, 3700);
  assert.equal(receipt.body.payment.cardAmountCents, 5000);
  assert.equal(receipt.body.payment.reference, "MIXED-123");
  const repeated = await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.staff.CASHIER)
    .send(body)
    .expect(201);
  assert.equal(repeated.body.payment.id, paid.body.payment.id);
  await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send({ ...body, cardAmountCents: 4900 })
    .expect(409);
  await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send({ ...body, requestId: randomUUID() })
    .expect(409);
  await assert.rejects(
    db.payment.update({
      where: { id: paid.body.payment.id },
      data: { cashAmountCents: 3701 },
    }),
  );
});

it("mixed sales count one account and reconcile only net cash while preserving saved cuts", async () => {
  const f = await paymentFixture();
  const paid = await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send({
      ...f.payment,
      method: "MIXED",
      cardAmountCents: 5000,
      receivedCents: 10000,
      reference: "Terminal mixta",
    })
    .expect(201);
  await db.payment.update({
    where: { id: paid.body.payment.id },
    data: { createdAt: new Date("2026-01-15T12:00:00Z") },
  });
  const base = `/api/restaurant/branches/${f.branch.id}/cash`;
  const summary = await request(app.getHttpServer())
    .get(`${base}/summary?day=2026-01-15`)
    .set("Authorization", f.auth)
    .expect(200);
  assert.equal(summary.body.totalCents, 8700);
  assert.equal(summary.body.paymentCount, 1);
  assert.equal(summary.body.mixedCount, 1);
  assert.equal(summary.body.cash.totalCents, 3700);
  assert.equal(summary.body.card.totalCents, 5000);
  assert.equal(summary.body.cash.receivedCents, 5000);
  assert.equal(summary.body.cash.changeCents, 1300);
  assert.equal(summary.body.cash.count, 1);
  assert.equal(summary.body.card.count, 1);
  const cut = await request(app.getHttpServer())
    .post(`${base}/cuts`)
    .set("Authorization", f.auth)
    .send({
      day: "2026-01-15",
      requestId: randomUUID(),
      openingCents: 1000,
      countedCents: 4700,
      expectedPaymentCount: 1,
      expectedTotalCents: 8700,
    })
    .expect(201);
  assert.equal(cut.body.snapshot.expectedCents, 4700);
  assert.equal(cut.body.snapshot.differenceCents, 0);
  assert.equal(cut.body.snapshot.payments[0].cardAmountCents, 5000);
});

it("rejects invalid mixed splits, insufficient received cash, missing folio and unauthorized roles", async () => {
  const f = await paymentFixture();
  const body = {
    ...f.payment,
    method: "MIXED",
    cardAmountCents: 5000,
    receivedCents: 10000,
    reference: "MIXED-123",
  };
  const send = (data: object, auth = f.auth) =>
    request(app.getHttpServer())
      .post(f.path)
      .set("Authorization", auth)
      .send(data);
  for (const override of [
    { cardAmountCents: 0 },
    { cardAmountCents: 8700 },
    { cardAmountCents: 9000 },
    { cardAmountCents: null },
    { cardAmountCents: 0.5 },
    { receivedCents: 8699 },
    { reference: " " },
    { cashAmountCents: 3700 },
  ])
    await send({ ...body, ...override }).expect(400);
  const { cardAmountCents: _part, ...missing } = body;
  await send(missing).expect(400);
  await send({ ...f.payment, cardAmountCents: 5000 }).expect(400);
  for (const role of ["WAITER", "KITCHEN"])
    await send(body, f.staff[role]).expect(403);
  await request(app.getHttpServer()).post(f.path).send(body).expect(401);
  assert.equal(await db.payment.count({ where: { branchId: f.branch.id } }), 0);
});

it("concurrent mixed submissions register exactly one payment and preserve legacy retry contracts", async () => {
  const f = await paymentFixture();
  const body = {
    ...f.payment,
    method: "MIXED",
    cardAmountCents: 5000,
    receivedCents: 10000,
    reference: "MIXED-123",
  };
  const send = (data: object) =>
    request(app.getHttpServer())
      .post(f.path)
      .set("Authorization", f.auth)
      .send(data);
  const repeats = await Promise.all([send(body), send(body)]);
  assert.deepEqual(
    repeats.map((r) => r.status),
    [201, 201],
  );
  assert.equal(repeats[0].body.payment.id, repeats[1].body.payment.id);
  assert.equal(await db.payment.count({ where: { branchId: f.branch.id } }), 1);
  const legacy = await paymentFixture();
  const original = await request(app.getHttpServer())
    .post(legacy.path)
    .set("Authorization", legacy.auth)
    .send(legacy.payment)
    .expect(201);
  const retry = await request(app.getHttpServer())
    .post(legacy.path)
    .set("Authorization", legacy.auth)
    .send(legacy.payment)
    .expect(201);
  assert.equal(original.body.payment.id, retry.body.payment.id);
});

async function shiftFixture() {
  const f = await paymentFixture();
  const shifts = `/api/restaurant/branches/${f.branch.id}/cash/shifts`;
  const openBody = { requestId: randomUUID(), openingCents: 10000 };
  const opened = await request(app.getHttpServer())
    .post(shifts)
    .set("Authorization", f.staff.CASHIER)
    .send(openBody)
    .expect(201);
  return { ...f, shifts, openBody, shift: opened.body };
}

it("opens one shared branch shift, retries exactly and rejects duplicate concurrent openings", async () => {
  const f = await shiftFixture();
  const retry = await request(app.getHttpServer())
    .post(f.shifts)
    .set("Authorization", f.auth)
    .send(f.openBody)
    .expect(201);
  assert.equal(retry.body.id, f.shift.id);
  await request(app.getHttpServer())
    .post(f.shifts)
    .set("Authorization", f.auth)
    .send({ ...f.openBody, openingCents: 20000 })
    .expect(409);
  const race = await Promise.all([
    request(app.getHttpServer())
      .post(f.shifts)
      .set("Authorization", f.auth)
      .send({ ...f.openBody, requestId: randomUUID() }),
    request(app.getHttpServer())
      .post(f.shifts)
      .set("Authorization", f.auth)
      .send({ ...f.openBody, requestId: randomUUID() }),
  ]);
  assert.deepEqual(
    race.map((r) => r.status),
    [409, 409],
  );
  assert.equal(
    await db.cashShift.count({
      where: { branchId: f.branch.id, closedAt: null },
    }),
    1,
  );
  await assert.rejects(
    db.cashShift.create({
      data: {
        branchId: f.branch.id,
        restaurantId: a,
        openingCents: 0,
        openedByName: "No",
        requestId: randomUUID(),
        requestHash: "fixture",
      },
    }),
  );
});

it("links mixed payments by shift identity across midnight and reconciles withdrawals, expenses and closure", async () => {
  const f = await shiftFixture();
  await db.cashShift.update({
    where: { id: f.shift.id },
    data: { openedAt: new Date("2026-01-14T20:00:00Z") },
  });
  const paid = await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send({
      ...f.payment,
      method: "MIXED",
      cardAmountCents: 5000,
      reference: "turno-mixed",
    })
    .expect(201);
  assert.equal(paid.body.payment.shiftId, f.shift.id);
  await db.payment.update({
    where: { id: paid.body.payment.id },
    data: { createdAt: new Date("2026-01-16T07:00:00Z") },
  });
  let list = await request(app.getHttpServer())
    .get(f.shifts)
    .set("Authorization", f.staff.CASHIER)
    .expect(200);
  assert.equal(list.body.active.revision, 1);
  assert.equal(list.body.active.summary.cashCents, 3700);
  assert.equal(list.body.active.summary.cardCents, 5000);
  assert.equal(list.body.active.summary.paymentCount, 1);
  assert.equal(list.body.active.summary.expectedCents, 13700);
  const withdrawal = {
    requestId: randomUUID(),
    kind: "WITHDRAWAL",
    amountCents: 2000,
    reason: "Retiro a caja fuerte",
    expectedRevision: 1,
  };
  await request(app.getHttpServer())
    .post(`${f.shifts}/${f.shift.id}/movements`)
    .set("Authorization", f.staff.CASHIER)
    .send(withdrawal)
    .expect(201);
  await request(app.getHttpServer())
    .post(`${f.shifts}/${f.shift.id}/movements`)
    .set("Authorization", f.auth)
    .send(withdrawal)
    .expect(201);
  await request(app.getHttpServer())
    .post(`${f.shifts}/${f.shift.id}/movements`)
    .set("Authorization", f.auth)
    .send({
      ...withdrawal,
      requestId: randomUUID(),
      kind: "EXPENSE",
      amountCents: 1000,
      reason: "Compra de hielo",
      expectedRevision: 2,
    })
    .expect(201);
  const closeBody = {
    requestId: randomUUID(),
    countedCents: 10000,
    expectedRevision: 3,
    notes: "Faltante revisado",
  };
  const closed = await request(app.getHttpServer())
    .post(`${f.shifts}/${f.shift.id}/close`)
    .set("Authorization", f.staff.CASHIER)
    .send(closeBody)
    .expect(201);
  assert.equal(closed.body.snapshot.expectedCents, 10700);
  assert.equal(closed.body.snapshot.differenceCents, -700);
  assert.equal(closed.body.snapshot.withdrawalsCents, 2000);
  assert.equal(closed.body.snapshot.expensesCents, 1000);
  assert.equal(closed.body.snapshot.movements.length, 2);
  assert.equal(closed.body.closedByName, "CASHIER");
  const repeated = await request(app.getHttpServer())
    .post(`${f.shifts}/${f.shift.id}/close`)
    .set("Authorization", f.auth)
    .send(closeBody)
    .expect(201);
  assert.deepEqual(repeated.body.snapshot, closed.body.snapshot);
  list = await request(app.getHttpServer())
    .get(f.shifts)
    .set("Authorization", f.auth)
    .expect(200);
  assert.equal(list.body.active, null);
  assert.equal(list.body.history.length, 1);
  assert.ok(!JSON.stringify(list.body).includes("requestHash"));
  await request(app.getHttpServer())
    .post(`${f.shifts}/${f.shift.id}/movements`)
    .set("Authorization", f.auth)
    .send({ ...withdrawal, requestId: randomUUID(), expectedRevision: 4 })
    .expect(409);
  await request(app.getHttpServer())
    .post(`${f.shifts}/${f.shift.id}/close`)
    .set("Authorization", f.auth)
    .send({ ...closeBody, requestId: randomUUID(), expectedRevision: 4 })
    .expect(409);
  await request(app.getHttpServer())
    .post(f.shifts)
    .set("Authorization", f.auth)
    .send({ ...f.openBody, requestId: randomUUID() })
    .expect(201);
  const historical = await db.cashShift.findUniqueOrThrow({
    where: { id: f.shift.id },
  });
  assert.deepEqual(historical.snapshot, closed.body.snapshot);
});

it("rejects overspending, stale movement and close revisions, invalid money and empty reasons", async () => {
  const f = await shiftFixture();
  const body = {
    requestId: randomUUID(),
    kind: "EXPENSE",
    amountCents: 1000,
    reason: "Hielo",
    expectedRevision: 0,
  };
  const path = `${f.shifts}/${f.shift.id}/movements`;
  for (const override of [
    { amountCents: 0 },
    { amountCents: -1 },
    { amountCents: 1.5 },
    { reason: " " },
    { kind: "DEPOSIT" },
    { amountCents: null },
  ])
    await request(app.getHttpServer())
      .post(path)
      .set("Authorization", f.auth)
      .send({ ...body, ...override })
      .expect(400);
  await request(app.getHttpServer())
    .post(path)
    .set("Authorization", f.auth)
    .send({ ...body, amountCents: 10001 })
    .expect(409);
  await request(app.getHttpServer())
    .post(path)
    .set("Authorization", f.auth)
    .send(body)
    .expect(201);
  await request(app.getHttpServer())
    .post(path)
    .set("Authorization", f.auth)
    .send({ ...body, reason: "Otro motivo" })
    .expect(409);
  await request(app.getHttpServer())
    .post(path)
    .set("Authorization", f.auth)
    .send({ ...body, requestId: randomUUID() })
    .expect(409);
  await request(app.getHttpServer())
    .post(`${f.shifts}/${f.shift.id}/close`)
    .set("Authorization", f.auth)
    .send({
      requestId: randomUUID(),
      countedCents: 9000,
      expectedRevision: 0,
      notes: "",
    })
    .expect(409);
  await assert.rejects(
    db.cashMovement.updateMany({
      where: { shiftId: f.shift.id },
      data: { amountCents: 0 },
    }),
  );
});

it("scopes shared cash shifts to cashier branch and tenant and rejects waiter/kitchen access", async () => {
  const f = await shiftFixture();
  for (const role of ["WAITER", "KITCHEN"]) {
    await request(app.getHttpServer())
      .get(f.shifts)
      .set("Authorization", f.staff[role])
      .expect(403);
    await request(app.getHttpServer())
      .post(f.shifts)
      .set("Authorization", f.staff[role])
      .send(f.openBody)
      .expect(403);
  }
  await request(app.getHttpServer()).get(f.shifts).expect(401);
  await request(app.getHttpServer())
    .get(`/api/restaurant/branches/${f.other.id}/cash/shifts`)
    .set("Authorization", f.auth)
    .expect(404);
  await request(app.getHttpServer())
    .get(`/api/restaurant/branches/${f.other.id}/cash/shifts`)
    .set("Authorization", f.staff.CASHIER)
    .expect(403);
  await request(app.getHttpServer())
    .post(`${f.shifts}/${randomUUID()}/close`)
    .set("Authorization", f.auth)
    .send({
      requestId: randomUUID(),
      countedCents: 0,
      expectedRevision: 0,
      notes: "",
    })
    .expect(404);
});

it("serializes close against payment and movement, with each payment assigned at most once", async () => {
  const f = await shiftFixture();
  const results = await Promise.all([
    request(app.getHttpServer())
      .post(f.path)
      .set("Authorization", f.auth)
      .send(f.payment),
    request(app.getHttpServer())
      .post(`${f.shifts}/${f.shift.id}/close`)
      .set("Authorization", f.auth)
      .send({
        requestId: randomUUID(),
        countedCents: 10000,
        expectedRevision: 0,
        notes: "",
      }),
  ]);
  assert.equal(results[0].status, 201);
  const shift = await db.cashShift.findUniqueOrThrow({
    where: { id: f.shift.id },
  });
  const payment = await db.payment.findUniqueOrThrow({
    where: { orderId: f.order.id },
  });
  if (results[1].status === 201) {
    assert.equal(payment.shiftId, null);
    assert.equal((shift.snapshot as { paymentCount: number }).paymentCount, 0);
  } else {
    assert.equal(results[1].status, 409);
    assert.equal(payment.shiftId, f.shift.id);
    assert.equal(shift.closedAt, null);
    assert.equal(shift.revision, 1);
  }
  const second = await shiftFixture();
  const race = await Promise.all([
    request(app.getHttpServer())
      .post(`${second.shifts}/${second.shift.id}/close`)
      .set("Authorization", second.auth)
      .send({
        requestId: randomUUID(),
        countedCents: 10000,
        expectedRevision: 0,
        notes: "",
      }),
    request(app.getHttpServer())
      .post(`${second.shifts}/${second.shift.id}/movements`)
      .set("Authorization", second.auth)
      .send({
        requestId: randomUUID(),
        kind: "WITHDRAWAL",
        amountCents: 1000,
        expectedRevision: 0,
        reason: "Retiro",
      }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
});

it("keeps unassigned historical payments outside new shifts and counts daily sales unchanged", async () => {
  const f = await paymentFixture();
  const paid = await request(app.getHttpServer())
    .post(f.path)
    .set("Authorization", f.auth)
    .send(f.payment)
    .expect(201);
  assert.equal(paid.body.payment.shiftId, null);
  const path = `/api/restaurant/branches/${f.branch.id}/cash/shifts`;
  await request(app.getHttpServer())
    .post(path)
    .set("Authorization", f.auth)
    .send({ requestId: randomUUID(), openingCents: 5000 })
    .expect(201);
  const list = await request(app.getHttpServer())
    .get(path)
    .set("Authorization", f.auth)
    .expect(200);
  assert.equal(list.body.active.summary.paymentCount, 0);
  assert.equal(list.body.active.summary.expectedCents, 5000);
  const stored = await db.payment.findUniqueOrThrow({
    where: { id: paid.body.payment.id },
  });
  assert.equal(stored.shiftId, null);
});
