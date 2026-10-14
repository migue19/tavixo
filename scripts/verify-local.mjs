import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import {
  mkdir,
  rm,
  mkdtemp,
  writeFile,
  open,
  cp,
  readFile,
} from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { request } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
await mkdir("work", { recursive: true });
async function portFree(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const assigned = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return assigned;
}
await portFree(6000);
await portFree(6001);
const port = await portFree(0);
const directory = await mkdtemp(`${process.cwd()}/work/postgres-`);
const password = randomBytes(24).toString("hex");
const url = `postgresql://tavixo:${password}@127.0.0.1:${port}/tavixo_test?schema=public`;
const env = {
  ...process.env,
  DATABASE_URL: url,
  TEST_DATABASE_URL: url,
  JWT_SECRET: randomBytes(48).toString("hex"),
  NODE_ENV: "test",
  COOKIE_SECURE: "false",
  WEB_ORIGIN: "http://localhost:6001",
  API_INTERNAL_URL: "http://127.0.0.1:6000",
  API_PORT: "6000",
  API_HOST: "127.0.0.1",
  SEED_ADMIN_EMAIL: "admin@birriaelcachanilla.com.mx",
  SEED_ADMIN_PASSWORD: randomBytes(24).toString("hex"),
  NEXT_TELEMETRY_DISABLED: "1",
};
const pgLog = await open("work/postgres.log", "w");
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  port,
  user: "tavixo",
  password,
  persistent: false,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: (message) => pgLog.write(String(message)),
  onError: (message) => pgLog.write(String(message)),
});
const children = [];
const results = [];
async function run(args) {
  console.log(`\nChecking: npm ${args.join(" ")}`);
  const child = spawn("npm", args, { env, stdio: "inherit" });
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`npm ${args.join(" ")} failed (${code})`);
  results.push(`PASS: npm ${args.join(" ")}`);
}
function http(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request(path, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, text: data }),
      );
    });
    req.on("error", reject);
    req.setTimeout(4000, () => req.destroy(new Error("timeout")));
    req.end(options.body);
  });
}
async function waitReady(url) {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await http(url);
      if (res.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become ready: ${url}`);
}
async function server(command, args, filename) {
  const log = await open(filename, "w");
  const child = spawn(command, args, {
    env,
    stdio: ["ignore", log.fd, log.fd],
  });
  children.push({ child, log });
  return child;
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
  results.push(`PASS: ${message}`);
}
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("tavixo_test");
  await run(["run", "db:generate"]);
  await rm("work/upgrade", { recursive: true, force: true });
  await mkdir("work/upgrade/migrations/20261013000000_init", {
    recursive: true,
  });
  await cp(
    "apps/api/test/fixtures/schema-sprint1.prisma",
    "work/upgrade/schema.prisma",
  );
  await cp(
    "apps/api/prisma/migrations/20261013000000_init/migration.sql",
    "work/upgrade/migrations/20261013000000_init/migration.sql",
  );
  await cp(
    "apps/api/prisma/migrations/migration_lock.toml",
    "work/upgrade/migrations/migration_lock.toml",
  );
  await run([
    "exec",
    "--",
    "prisma",
    "migrate",
    "deploy",
    "--schema",
    "work/upgrade/schema.prisma",
  ]);
  const legacy = {
    user: randomUUID(),
    restaurant: randomUUID(),
    member: randomUUID(),
    session: randomUUID(),
  };
  const client = pg.getPgClient("tavixo_test", "127.0.0.1");
  await client.connect();
  try {
    await client.query(
      'INSERT INTO "Restaurant" (id, slug, name) VALUES ($1, $2, $3)',
      [legacy.restaurant, "upgrade-fixture", "Legacy restaurant"],
    );
    await client.query(
      'INSERT INTO "User" (id, email, name, "passwordHash") VALUES ($1, $2, $3, $4)',
      [legacy.user, "upgrade@example.com", "Legacy owner", "legacy-hash"],
    );
    await client.query(
      'INSERT INTO "Membership" (id, "userId", "restaurantId", role) VALUES ($1, $2, $3, $4)',
      [legacy.member, legacy.user, legacy.restaurant, "OWNER"],
    );
    await client.query(
      'INSERT INTO "RefreshSession" (id, "membershipId", "tokenHash", "familyId", "expiresAt") VALUES ($1, $2, $3, $4, $5)',
      [
        legacy.session,
        legacy.member,
        "a".repeat(64),
        randomUUID(),
        new Date(Date.now() + 86400000),
      ],
    );
    await cp(
      "apps/api/test/fixtures/schema-sprint3.prisma",
      "work/upgrade/schema.prisma",
    );
    for (const migration of [
      "20261013010000_management",
      "20261013020000_catalog",
    ]) {
      await cp(
        `apps/api/prisma/migrations/${migration}`,
        `work/upgrade/migrations/${migration}`,
        { recursive: true },
      );
    }
    await run([
      "exec",
      "--",
      "prisma",
      "migrate",
      "deploy",
      "--schema",
      "work/upgrade/schema.prisma",
    ]);
    const legacyBranch = (
      await client.query('SELECT id FROM "Branch" WHERE "restaurantId"=$1', [
        legacy.restaurant,
      ])
    ).rows[0].id;
    const legacyCategory = randomUUID(),
      legacyProduct = randomUUID(),
      legacyTable = randomUUID();
    await client.query(
      'INSERT INTO "MenuCategory" (id, "restaurantId", "branchId", name) VALUES ($1,$2,$3,$4)',
      [legacyCategory, legacy.restaurant, legacyBranch, "Tacos"],
    );
    await client.query(
      'INSERT INTO "Product" (id,"restaurantId","branchId","categoryId",name,"priceCents",available) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [
        legacyProduct,
        legacy.restaurant,
        legacyBranch,
        legacyCategory,
        "Taco chico",
        2900,
        false,
      ],
    );
    await client.query(
      'INSERT INTO "DiningTable" (id,"restaurantId","branchId",name,capacity) VALUES ($1,$2,$3,$4,$5)',
      [legacyTable, legacy.restaurant, legacyBranch, "Mesa existente", 6],
    );
    await cp(
      "apps/api/test/fixtures/schema-sprint4.prisma",
      "work/upgrade/schema.prisma",
    );
    await cp(
      "apps/api/prisma/migrations/20261014020000_orders",
      "work/upgrade/migrations/20261014020000_orders",
      { recursive: true },
    );
    await run([
      "exec",
      "--",
      "prisma",
      "migrate",
      "deploy",
      "--schema",
      "work/upgrade/schema.prisma",
    ]);
    const legacyOrders = [randomUUID(), randomUUID()];
    for (const [i, id] of legacyOrders.entries()) {
      const status = i === 0 ? "DELIVERED" : "CLOSED";
      await client.query(
        'INSERT INTO "Order" (id,"restaurantId","branchId","tableId",number,"tableName","createdByName","requestId","requestHash",status,"totalCents","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())',
        [
          id,
          legacy.restaurant,
          legacyBranch,
          legacyTable,
          i + 1,
          "Mesa existente",
          "Legacy owner",
          randomUUID(),
          "a".repeat(64),
          status,
          5800,
        ],
      );
      await client.query(
        'INSERT INTO "OrderItem" (id,"orderId","restaurantId","branchId","productId",name,quantity,"unitPriceCents") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          randomUUID(),
          id,
          legacy.restaurant,
          legacyBranch,
          legacyProduct,
          "Taco chico",
          2,
          2900,
        ],
      );
      await client.query(
        'INSERT INTO "OrderEvent" (id,"orderId","branchId","restaurantId",status,"actorName") VALUES ($1,$2,$3,$4,$5,$6)',
        [
          randomUUID(),
          id,
          legacyBranch,
          legacy.restaurant,
          status,
          "Legacy owner",
        ],
      );
    }
    await run(["run", "db:migrate"]);
    const preservedOrders = await client.query(
      'SELECT o.status,o."totalCents",i.quantity,i."unitPriceCents",p.id AS payment FROM "Order" o JOIN "OrderItem" i ON i."orderId"=o.id LEFT JOIN "Payment" p ON p."orderId"=o.id WHERE o."restaurantId"=$1 ORDER BY o.number',
      [legacy.restaurant],
    );
    assert(
      preservedOrders.rows.length === 2 &&
        preservedOrders.rows[0].status === "DELIVERED" &&
        preservedOrders.rows[1].status === "CLOSED" &&
        preservedOrders.rows.every(
          (o) =>
            o.totalCents === 5800 &&
            o.quantity === 2 &&
            o.unitPriceCents === 2900 &&
            o.payment === null,
        ),
      "Sprint 4 upgrade preserves delivered/closed orders and prices without inventing payments",
    );
    const catalogPreserved = await client.query(
      'SELECT p.name,p."priceCents",p.available,t.capacity FROM "Product" p JOIN "DiningTable" t ON t."branchId"=p."branchId" WHERE p.id=$1 AND t.id=$2',
      [legacyProduct, legacyTable],
    );
    assert(
      catalogPreserved.rows.length === 1 &&
        catalogPreserved.rows[0].name === "Taco chico" &&
        catalogPreserved.rows[0].priceCents === 2900 &&
        catalogPreserved.rows[0].available === false &&
        catalogPreserved.rows[0].capacity === 6,
      "Sprint 3 upgrade preserves menu prices, availability and tables",
    );
    const upgraded = await client.query(
      'SELECT u."passwordHash", m.role, b.name, s.id AS session FROM "User" u JOIN "Membership" m ON m."userId"=u.id JOIN "Branch" b ON b.id=m."branchId" AND b."restaurantId"=m."restaurantId" JOIN "RefreshSession" s ON s."membershipId"=m.id WHERE u.id=$1',
      [legacy.user],
    );
    assert(
      upgraded.rows.length === 1 &&
        upgraded.rows[0].passwordHash === "legacy-hash" &&
        upgraded.rows[0].role === "OWNER" &&
        upgraded.rows[0].name === "Sucursal Principal" &&
        upgraded.rows[0].session === legacy.session,
      "Sprint 1 upgrade preserves credentials, roles and sessions and backfills the main branch",
    );
    await client.query('DELETE FROM "Order" WHERE "restaurantId"=$1', [
      legacy.restaurant,
    ]);
    await client.query('DELETE FROM "Restaurant" WHERE id=$1', [
      legacy.restaurant,
    ]);
    await client.query('DELETE FROM "User" WHERE id=$1', [legacy.user]);
  } finally {
    await client.end();
  }

  await run(["run", "db:migrate"]);
  await run(["run", "db:seed"]);
  await run(["run", "db:seed"]);
  await run(["run", "typecheck"]);
  await run(["test"]);
  await run(["run", "test:integration"]);
  await run(["run", "build"]);
  await server("node", ["apps/api/dist/main.js"], "work/api.log");
  await waitReady("http://127.0.0.1:6000/api/health");
  // Run the standalone artifact that Docker uses (static assets copied below).
  await cp("apps/web/public", "apps/web/.next/standalone/apps/web/public", {
    recursive: true,
  });
  await cp(
    "apps/web/.next/static",
    "apps/web/.next/standalone/apps/web/.next/static",
    { recursive: true },
  );
  env.HOSTNAME = "127.0.0.1";
  env.PORT = "6001";
  await server(
    "node",
    ["apps/web/.next/standalone/apps/web/server.js"],
    "work/web.log",
  );
  await waitReady("http://127.0.0.1:6001/");
  const page = await http("http://127.0.0.1:6001/");
  assert(page.text.includes("tavixo"), "web HTML served on 6001");
  const health = await http("http://127.0.0.1:6001/api/health");
  assert(health.status === 200, "web proxy reaches API and PostgreSQL");
  for (const path of [
    "/manifest.webmanifest",
    "/sw.js",
    "/offline.html",
    "/icon-192.png",
    "/icon-512.png",
  ]) {
    const response = await http(`http://127.0.0.1:6001${path}`);
    assert(response.status === 200, `PWA asset ${path}`);
  }
  const body = JSON.stringify({
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    restaurantSlug: "birria-el-cachanilla",
  });
  const login = await http("http://127.0.0.1:6001/api/auth/login", {
    method: "POST",
    headers: { Origin: env.WEB_ORIGIN, "Content-Type": "application/json" },
    body,
  });
  assert(login.status === 201, "pilot login through web proxy");
  const auth = JSON.parse(login.text);
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  assert(
    auth.user.role === "OWNER" &&
      auth.restaurant.name === "Birria El Cachanilla",
    "pilot OWNER membership seeded",
  );
  const restaurant = await http("http://127.0.0.1:6001/api/restaurant", {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  assert(
    restaurant.status === 200,
    "authenticated tenant access through web proxy",
  );
  const branches = await http("http://127.0.0.1:6001/api/restaurant/branches", {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  const branchValues = JSON.parse(branches.text);
  assert(
    branches.status === 200 &&
      branchValues.length === 1 &&
      branchValues[0].name === "Sucursal Principal",
    "pilot main branch seeded without duplicates",
  );
  const refreshed = await http("http://127.0.0.1:6001/api/auth/refresh", {
    method: "POST",
    headers: { Origin: env.WEB_ORIGIN, Cookie: cookie },
  });
  assert(refreshed.status === 201, "cookie refresh through web proxy");
} catch (error) {
  results.push(`FAIL: ${error.message}`);
  process.exitCode = 1;
  console.error(error);
} finally {
  for (const { child, log } of children.reverse()) {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        once(child, "exit"),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    await log.close();
  }
  await pg
    .stop()
    .catch((error) => console.error("PostgreSQL cleanup:", error.message));
  await pgLog.close();
  await writeFile(
    "work/verification.txt",
    `${new Date().toISOString()}\n${results.join("\n")}\nDocker/Nginx runtime checks not performed by this script.\n`,
  );
  console.log(results.join("\n"));
}
