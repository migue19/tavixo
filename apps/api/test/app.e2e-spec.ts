import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import request from "supertest";
import { randomUUID } from "node:crypto";
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
    await db.payment.deleteMany({
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
