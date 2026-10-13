import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma.service';
import { hashPassword } from '../src/password';

const origin = 'http://localhost:6001';
let app: INestApplication, db: PrismaService;
let a: string, b: string, membership: string;
const password = 'test-password-very-long';
const suffix = randomUUID().slice(0, 8);
const email = `owner-${suffix}@example.com`;
const waiterEmail = `waiter-${suffix}@example.com`;
let users: string[] = [];
const slug = `restaurant-a-${suffix}`;
const cookie = (res: request.Response): string => (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
let loginCounter = 1;
const login = (who = email) => request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For', `192.0.2.${loginCounter++}`).set('Origin', origin).send({ email: who, password, restaurantSlug: slug });

before(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Use a dedicated TEST_DATABASE_URL whose database name ends in _test');
  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET = 'a-test-only-secret-with-at-least-32-characters';
  process.env.WEB_ORIGIN = origin;
  process.env.COOKIE_SECURE = 'false';
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication(); configureApp(app); await app.init(); db = app.get(PrismaService);
  const ra = await db.restaurant.create({ data: { slug, name: 'A' } }); a = ra.id;
  const rb = await db.restaurant.create({ data: { slug: `restaurant-b-${suffix}`, name: 'B' } }); b = rb.id;
  const hashed = await hashPassword(password);
  const owner = await db.user.create({ data: { email, name: 'Owner', passwordHash: hashed } });
  const waiter = await db.user.create({ data: { email: waiterEmail, name: 'Waiter', passwordHash: hashed } }); users = [owner.id, waiter.id];
  const member = await db.membership.create({ data: { userId: owner.id, restaurantId: a, role: Role.OWNER } }); membership = member.id;
  await db.membership.create({ data: { userId: waiter.id, restaurantId: a, role: Role.WAITER } });
  await db.membership.create({ data: { userId: owner.id, restaurantId: b, role: Role.MANAGER } });
}, { timeout: 30000 });
after(async () => {
  if (db) { await db.restaurant.deleteMany({ where: { id: { in: [a, b].filter(Boolean) } } }); await db.user.deleteMany({ where: { id: { in: users } } }); }
  if (app) await app.close();
});

it('health checks PostgreSQL; unauthenticated requests fail', async () => {
  await request(app.getHttpServer()).get('/api/health').expect(200);
  await request(app.getHttpServer()).get('/api/restaurant').expect(401);
});
it('validates credentials, DTOs and request origin', async () => {
  await request(app.getHttpServer()).post('/api/auth/login').set('Origin', origin).send({ email, password: 'wrong', restaurantSlug: slug }).expect(401);
  await request(app.getHttpServer()).post('/api/auth/login').set('Origin', origin).send({ email, password, restaurantSlug: slug, role: 'OWNER' }).expect(400);
  await request(app.getHttpServer()).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email, password, restaurantSlug: slug }).expect(403);
  const res = await login(); assert.equal(res.status, 201); assert.equal(res.body.refreshToken, undefined);
  assert.match(res.headers['set-cookie'][0], /HttpOnly/); assert.match(res.headers['set-cookie'][0], /SameSite=Strict/);
});
it('scopes reads and updates to JWT tenant despite forged header, body or path', async () => {
  const res = await login(); const auth = `Bearer ${res.body.accessToken}`;
  const restaurant = await request(app.getHttpServer()).get('/api/restaurant').set('Authorization', auth).set('X-Tenant-Id', b).expect(200);
  assert.equal(restaurant.body.id, a);
  const members = await request(app.getHttpServer()).get('/api/restaurant/members').set('Authorization', auth).expect(200);
  assert.equal(members.body.length, 2); assert.ok(!JSON.stringify(members.body).includes('passwordHash'));
  await request(app.getHttpServer()).patch('/api/restaurant').set('Authorization', auth).send({ name: 'A updated', restaurantId: b }).expect(400);
  await request(app.getHttpServer()).patch('/api/restaurant').set('Authorization', auth).send({ name: 'A updated' }).expect(200);
  assert.equal((await db.restaurant.findUniqueOrThrow({ where: { id: b } })).name, 'B');
  await request(app.getHttpServer()).get(`/api/restaurants/${b}`).set('Authorization', auth).expect(404);
  const second = await request(app.getHttpServer()).post('/api/auth/login').set('Origin', origin).send({ email, password, restaurantSlug: `restaurant-b-${suffix}` }).expect(201);
  const other = await request(app.getHttpServer()).get('/api/restaurant').set('Authorization', `Bearer ${second.body.accessToken}`).expect(200);
  assert.equal(other.body.id, b);
});
it('enforces roles and live membership revocation', async () => {
  const waiter = await login(waiterEmail);
  await request(app.getHttpServer()).get('/api/restaurant').set('Authorization', `Bearer ${waiter.body.accessToken}`).expect(200);
  await request(app.getHttpServer()).patch('/api/restaurant').set('Authorization', `Bearer ${waiter.body.accessToken}`).send({ name: 'Invalid' }).expect(403);
  await request(app.getHttpServer()).get('/api/restaurant/members').set('Authorization', `Bearer ${waiter.body.accessToken}`).expect(403);
  const owner = await login(); await db.membership.update({ where: { id: membership }, data: { active: false } });
  await request(app.getHttpServer()).get('/api/me').set('Authorization', `Bearer ${owner.body.accessToken}`).expect(401);
  await request(app.getHttpServer()).post('/api/auth/refresh').set('Origin', origin).set('Cookie', cookie(owner)).expect(401);
  await db.membership.update({ where: { id: membership }, data: { active: true } });
});
it('rejects tampered and expired JWTs', async () => {
  const res = await login(); const jwt = app.get(JwtService); const payload = jwt.decode(res.body.accessToken);
  const { exp, iat, iss, aud, ...claims } = payload;
  const expired = await jwt.signAsync(claims, { expiresIn: -1 });
  await request(app.getHttpServer()).get('/api/me').set('Authorization', `Bearer ${expired}`).expect(401);
  await request(app.getHttpServer()).get('/api/me').set('Authorization', `Bearer ${res.body.accessToken.slice(0, -8)}tampered`).expect(401);
});
it('rotates refresh token and revokes family on reuse', async () => {
  const first = await login(); const oldCookie = cookie(first);
  const refreshed = await request(app.getHttpServer()).post('/api/auth/refresh').set('Origin', origin).set('Cookie', oldCookie).expect(201);
  assert.notEqual(cookie(refreshed), oldCookie);
  await request(app.getHttpServer()).get('/api/me').set('Authorization', `Bearer ${first.body.accessToken}`).expect(401);
  await request(app.getHttpServer()).post('/api/auth/refresh').set('Origin', origin).set('Cookie', oldCookie).expect(401);
  await request(app.getHttpServer()).post('/api/auth/refresh').set('Origin', origin).set('Cookie', cookie(refreshed)).expect(401);
  await request(app.getHttpServer()).get('/api/me').set('Authorization', `Bearer ${refreshed.body.accessToken}`).expect(401);
});
it('blocks cross-origin refresh and revokes access and refresh on logout', async () => {
  const res = await login();
  await request(app.getHttpServer()).post('/api/auth/refresh').set('Origin', 'https://evil.example').set('Cookie', cookie(res)).expect(403);
  await request(app.getHttpServer()).post('/api/auth/logout').set('Origin', origin).set('Cookie', cookie(res)).expect(201);
  await request(app.getHttpServer()).get('/api/me').set('Authorization', `Bearer ${res.body.accessToken}`).expect(401);
  await request(app.getHttpServer()).post('/api/auth/refresh').set('Origin', origin).set('Cookie', cookie(res)).expect(401);
});

it('limits brute-force login attempts by client IP', async () => {
  for (let i = 0; i < 10; i++) {
    await request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For', '192.0.2.250').set('Origin', origin).send({ email, password: 'wrong', restaurantSlug: slug }).expect(401);
  }
  await request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For', '192.0.2.250').set('Origin', origin).send({ email, password, restaurantSlug: slug }).expect(429);
});
