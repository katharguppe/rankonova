import { generateKeyPairSync } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';
import { PrismaService } from '../app/prisma/prisma.service';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env['JWT_PRIVATE_KEY'] = Buffer.from(
  privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
).toString('base64');
process.env['JWT_PUBLIC_KEY'] = Buffer.from(
  publicKey.export({ type: 'spki', format: 'pem' }).toString(),
).toString('base64');
process.env['JWT_EXPIRES_IN'] = '86400';
process.env['REFRESH_TOKEN_EXPIRES_IN'] = '2592000';
process.env['ENCRYPTION_KEY'] = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

const A = {
  email: 'user-a@e2e-users.test',
  password: 'PasswordA1!',
  tenantName: 'Users E2E Tenant A',
  tenantSlug: 'users-e2e-tenant-a',
  billingEmail: 'billing-a@e2e-users.test',
};
const B = {
  email: 'user-b@e2e-users.test',
  password: 'PasswordB1!',
  tenantName: 'Users E2E Tenant B',
  tenantSlug: 'users-e2e-tenant-b',
  billingEmail: 'billing-b@e2e-users.test',
};
const INVITED_EMAIL = 'invited@e2e-users.test';
const INVITED_PASSWORD = 'InvitedPass1!';

async function buildApp(): Promise<INestApplication> {
  const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = fixture.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return app;
}

async function registerAndLogin(
  app: INestApplication,
  dto: typeof A,
  prisma: PrismaService,
): Promise<{ token: string; tenantId: string; userId: string }> {
  const reg = await request(app.getHttpServer())
    .post('/auth/register')
    .type('application/json')
    .send(dto);
  expect(reg.status).toBe(201);
  const { verificationToken } = reg.body as { verificationToken: string };
  await request(app.getHttpServer()).get('/auth/verify-email').query({ token: verificationToken });
  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .type('application/json')
    .send({ email: dto.email, password: dto.password });
  expect(login.status).toBe(200);
  const { accessToken } = login.body as { accessToken: string };
  const user = await prisma.user.findUnique({ where: { email: dto.email } });
  return { token: accessToken, tenantId: user!.tenant_id, userId: user!.id };
}

jest.setTimeout(60000);

describe('Users E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let invitedUserId: string;
  let inviteToken: string;

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get(PrismaService);

    // Pre-cleanup: anchor on tenant slug so orphaned tenants are caught
    const _pcTenants = await prisma.tenant.findMany({
      where: { slug: { in: [A.tenantSlug, B.tenantSlug] } },
      select: { id: true },
    });
    const _pcTids = _pcTenants.map(t => t.id);
    if (_pcTids.length) {
      const _pcUsers = await prisma.user.findMany({ where: { tenant_id: { in: _pcTids } }, select: { id: true } });
      const _pcUids = _pcUsers.map(u => u.id);
      if (_pcUids.length) {
        await prisma.authEvent.deleteMany({ where: { user_id: { in: _pcUids } } });
        await prisma.refreshToken.deleteMany({ where: { user_id: { in: _pcUids } } });
      }
      await prisma.user.deleteMany({ where: { tenant_id: { in: _pcTids } } });
      await prisma.tenant.deleteMany({ where: { id: { in: _pcTids } } });
    }

    const a = await registerAndLogin(app, A, prisma);
    tokenA = a.token;
    tenantAId = a.tenantId;
    userAId = a.userId;

    const b = await registerAndLogin(app, B, prisma);
    tenantBId = b.tenantId;
    userBId = b.userId;
  }, 60000);

  afterAll(async () => {
    const tenantIds = [tenantAId, tenantBId].filter((id): id is string => !!id);
    await prisma.authEvent.deleteMany({
      where: { user: { email: { in: [A.email, B.email, INVITED_EMAIL] } } },
    });
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { in: [A.email, B.email, INVITED_EMAIL] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [A.email, B.email, INVITED_EMAIL] } },
    });
    if (tenantIds.length) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await app.close();
  });

  // ── Own profile ────────────────────────────────────────────────────────────

  it('GET /users/me -> 200 own profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: userAId, email: A.email, role: 'tenant_admin' });
  });

  // ── User list ──────────────────────────────────────────────────────────────

  it('GET /users -> 200 lists only own-tenant users', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = (res.body as { id: string }[]).map((u) => u.id);
    expect(ids).toContain(userAId);
    expect(ids).not.toContain(userBId);
  });

  // ── Invite flow ────────────────────────────────────────────────────────────

  it('POST /users/invite -> 201 invite created', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${tokenA}`)
      .type('application/json')
      .send({ email: INVITED_EMAIL, role: 'client_manager' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('inviteToken');
    inviteToken = (res.body as { inviteToken: string }).inviteToken;
    const user = await prisma.user.findUnique({ where: { email: INVITED_EMAIL } });
    expect(user).not.toBeNull();
    expect(user!.is_active).toBe(false);
    invitedUserId = user!.id;
  });

  it('POST /users/accept-invite -> 200 account activated', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/accept-invite')
      .type('application/json')
      .send({ token: inviteToken, password: INVITED_PASSWORD });
    expect(res.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { email: INVITED_EMAIL } });
    expect(user!.is_active).toBe(true);
  });

  it('invited user can log in after accepting', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .type('application/json')
      .send({ email: INVITED_EMAIL, password: INVITED_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  // ── Role management ────────────────────────────────────────────────────────

  it('PATCH /users/:id/role -> 200 role updated', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${invitedUserId}/role`)
      .set('Authorization', `Bearer ${tokenA}`)
      .type('application/json')
      .send({ role: 'client_viewer' });
    expect(res.status).toBe(200);
    expect((res.body as { role: string }).role).toBe('client_viewer');
  });

  // ── Tenant isolation ───────────────────────────────────────────────────────

  it('[ISOLATION] Tenant A cannot GET Tenant B user -> 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });

  it('[ISOLATION] Tenant A cannot PATCH role of Tenant B user -> 404', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${userBId}/role`)
      .set('Authorization', `Bearer ${tokenA}`)
      .type('application/json')
      .send({ role: 'client_viewer' });
    expect(res.status).toBe(404);
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('[EDGE] Cannot deactivate own account -> 400', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/users/${userAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(400);
  });

  it('[EDGE] Cannot invite to super_admin role -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${tokenA}`)
      .type('application/json')
      .send({ email: 'super@e2e-users.test', role: 'super_admin' });
    expect(res.status).toBe(400);
  });

  it('[EDGE] Cannot promote to super_admin role -> 400', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${invitedUserId}/role`)
      .set('Authorization', `Bearer ${tokenA}`)
      .type('application/json')
      .send({ role: 'super_admin' });
    expect(res.status).toBe(400);
  });

  // ── Deactivate ─────────────────────────────────────────────────────────────

  it('DELETE /users/:id -> 204 deactivated', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/users/${invitedUserId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(204);
    const user = await prisma.user.findUnique({ where: { id: invitedUserId } });
    expect(user!.is_active).toBe(false);
  });
});
