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

const SUPER_ADMIN = {
  email: 'super@e2e-prompts.test',
  password: 'SuperPass1!',
  tenantName: 'Super Admin Prompts Tenant',
  tenantSlug: 'super-admin-e2e-prompts',
  billingEmail: 'billing@e2e-prompts.test',
};

const TENANT_USER = {
  email: 'tenant@e2e-prompts.test',
  password: 'TenantPass1!',
  tenantName: 'Regular Prompts Tenant',
  tenantSlug: 'regular-tenant-e2e-prompts',
  billingEmail: 'billing-tenant@e2e-prompts.test',
};

const OTHER_TENANT_USER = {
  email: 'other@e2e-prompts.test',
  password: 'OtherPass1!',
  tenantName: 'Other Prompts Tenant',
  tenantSlug: 'other-tenant-e2e-prompts',
  billingEmail: 'billing-other@e2e-prompts.test',
};

const BASE_PROMPT = {
  text: 'Which {brand} {model} dealer in {city} offers the best on-road price?',
  category: 'dealer_discovery',
  intentType: 'purchase_intent',
  buyerStage: 'decision',
};

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
  dto: typeof SUPER_ADMIN,
  prisma: PrismaService,
): Promise<{ token: string; userId: string }> {
  const reg = await request(app.getHttpServer()).post('/auth/register').type('application/json').send(dto);
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
  return { token: accessToken, userId: user!.id };
}

describe('Prompts E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let superToken: string;
  let superUserId: string;
  let superTenantId: string;

  let tenantToken: string;
  let tenantUserId: string;
  let tenantId: string;

  let otherTenantToken: string;
  let otherTenantUserId: string;
  let otherTenantId: string;

  let testVerticalId: string;
  let platformPromptId: string;
  let customPromptId: string;
  let deactivatePromptId: string;

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get(PrismaService);

    // Pre-cleanup: anchor on tenant slug so orphaned tenants are caught
    const _pcTenants = await prisma.tenant.findMany({
      where: { slug: { in: [SUPER_ADMIN.tenantSlug, TENANT_USER.tenantSlug, OTHER_TENANT_USER.tenantSlug] } },
      select: { id: true },
    });
    const _pcTids = _pcTenants.map(t => t.id);
    if (_pcTids.length) {
      await prisma.prompt.deleteMany({ where: { tenant_id: { in: _pcTids } } });
      const _pcUsers = await prisma.user.findMany({ where: { tenant_id: { in: _pcTids } }, select: { id: true } });
      const _pcUids = _pcUsers.map(u => u.id);
      if (_pcUids.length) {
        await prisma.authEvent.deleteMany({ where: { user_id: { in: _pcUids } } });
        await prisma.refreshToken.deleteMany({ where: { user_id: { in: _pcUids } } });
      }
      await prisma.user.deleteMany({ where: { tenant_id: { in: _pcTids } } });
      await prisma.tenant.deleteMany({ where: { id: { in: _pcTids } } });
    }
    const _leftoverVert = await prisma.vertical.findFirst({ where: { slug: 'e2e-prompts-vertical' } });
    if (_leftoverVert) {
      await prisma.prompt.deleteMany({ where: { vertical_id: _leftoverVert.id } });
      await prisma.vertical.deleteMany({ where: { id: _leftoverVert.id } });
    }

    // --- super_admin ---
    const sa = await registerAndLogin(app, SUPER_ADMIN, prisma);
    superToken = sa.token;
    superUserId = sa.userId;
    const saUser = await prisma.user.findUnique({ where: { id: superUserId } });
    superTenantId = saUser!.tenant_id;
    await prisma.user.update({ where: { id: superUserId }, data: { role: 'super_admin' } });
    const saRelogin = await request(app.getHttpServer())
      .post('/auth/login')
      .type('application/json')
      .send({ email: SUPER_ADMIN.email, password: SUPER_ADMIN.password });
    superToken = (saRelogin.body as { accessToken: string }).accessToken;

    // --- tenant_admin ---
    const tu = await registerAndLogin(app, TENANT_USER, prisma);
    tenantToken = tu.token;
    tenantUserId = tu.userId;
    const tuUser = await prisma.user.findUnique({ where: { email: TENANT_USER.email } });
    tenantId = tuUser!.tenant_id;
    await prisma.user.update({ where: { id: tenantUserId }, data: { role: 'tenant_admin' } });
    const tuRelogin = await request(app.getHttpServer())
      .post('/auth/login')
      .type('application/json')
      .send({ email: TENANT_USER.email, password: TENANT_USER.password });
    tenantToken = (tuRelogin.body as { accessToken: string }).accessToken;

    // --- other tenant (tenant_admin, for isolation test) ---
    const ot = await registerAndLogin(app, OTHER_TENANT_USER, prisma);
    otherTenantToken = ot.token;
    otherTenantUserId = ot.userId;
    const otUser = await prisma.user.findUnique({ where: { email: OTHER_TENANT_USER.email } });
    otherTenantId = otUser!.tenant_id;
    await prisma.user.update({ where: { id: otherTenantUserId }, data: { role: 'tenant_admin' } });
    const otRelogin = await request(app.getHttpServer())
      .post('/auth/login')
      .type('application/json')
      .send({ email: OTHER_TENANT_USER.email, password: OTHER_TENANT_USER.password });
    otherTenantToken = (otRelogin.body as { accessToken: string }).accessToken;

    // --- test vertical (created directly in DB, no dependency on /verticals) ---
    const vertical = await prisma.vertical.create({
      data: {
        name: 'E2E Prompts Vertical',
        slug: 'e2e-prompts-vertical',
        prompt_templates: ['Best {brand} in {city}?'],
        intent_categories: ['dealer_discovery'],
        trusted_domains: ['example.com'],
        aggregator_platforms: [],
        schema_types: ['LocalBusiness'],
        community_platforms: [],
        review_platforms: [],
      },
    });
    testVerticalId = vertical.id;
  }, 30000);

  afterAll(async () => {
    // Delete prompts under the test vertical and both test tenants
    await prisma.prompt.deleteMany({
      where: {
        OR: [
          { vertical_id: testVerticalId },
          { tenant_id: { in: [tenantId, otherTenantId].filter(Boolean) } },
        ],
      },
    });
    await prisma.vertical.deleteMany({ where: { id: testVerticalId } });

    const emails = [SUPER_ADMIN.email, TENANT_USER.email, OTHER_TENANT_USER.email];
    await prisma.authEvent.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    const tids = [superTenantId, tenantId, otherTenantId].filter((id): id is string => !!id);
    if (tids.length) await prisma.tenant.deleteMany({ where: { id: { in: tids } } });

    await app.close();
  });

  // ── Auth guard ────────────────────────────────────────────────────────────

  it('GET /prompts -> 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/prompts');
    expect(res.status).toBe(401);
  });

  // ── Create ────────────────────────────────────────────────────────────────

  it('POST /prompts -> 201 super_admin creates platform prompt', async () => {
    const res = await request(app.getHttpServer())
      .post('/prompts')
      .set('Authorization', `Bearer ${superToken}`)
      .type('application/json')
      .send({ ...BASE_PROMPT, verticalId: testVerticalId });
    expect(res.status).toBe(201);
    const body = res.body as { id: string; tenant_id: string | null; is_custom: boolean };
    expect(body.tenant_id).toBeNull();
    expect(body.is_custom).toBe(false);
    platformPromptId = body.id;
  });

  it('POST /prompts -> 201 tenant_admin creates custom prompt', async () => {
    const res = await request(app.getHttpServer())
      .post('/prompts')
      .set('Authorization', `Bearer ${tenantToken}`)
      .type('application/json')
      .send({ ...BASE_PROMPT, verticalId: testVerticalId });
    expect(res.status).toBe(201);
    const body = res.body as { id: string; tenant_id: string; is_custom: boolean };
    expect(body.tenant_id).toBe(tenantId);
    expect(body.is_custom).toBe(true);
    customPromptId = body.id;
  });

  // ── Read ──────────────────────────────────────────────────────────────────

  it('GET /prompts/platform -> 200 returns platform prompts only', async () => {
    const res = await request(app.getHttpServer())
      .get('/prompts/platform')
      .set('Authorization', `Bearer ${tenantToken}`)
      .query({ verticalId: testVerticalId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const rows = res.body as { tenant_id: string | null }[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    rows.forEach((r) => expect(r.tenant_id).toBeNull());
  });

  it('GET /prompts -> 200 includes own custom prompt and platform prompts', async () => {
    const res = await request(app.getHttpServer())
      .get('/prompts')
      .set('Authorization', `Bearer ${tenantToken}`)
      .query({ verticalId: testVerticalId });
    expect(res.status).toBe(200);
    const ids = (res.body as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(customPromptId);
    expect(ids).toContain(platformPromptId);
  });

  it('GET /prompts/:id -> 200 returns single prompt', async () => {
    const res = await request(app.getHttpServer())
      .get(`/prompts/${customPromptId}`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect((res.body as { id: string }).id).toBe(customPromptId);
  });

  it('GET /prompts/:id -> 404 for unknown id', async () => {
    const res = await request(app.getHttpServer())
      .get('/prompts/nonexistent-id-xyz')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(404);
  });

  it('GET /prompts/:id -> 404 when other tenant requests custom prompt (isolation)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/prompts/${customPromptId}`)
      .set('Authorization', `Bearer ${otherTenantToken}`);
    expect(res.status).toBe(404);
  });

  // ── Update ────────────────────────────────────────────────────────────────

  it('PATCH /prompts/:id -> 200 tenant_admin updates own custom prompt', async () => {
    const updated = 'Updated: Best {brand} dealer in {city} for new {model}?';
    const res = await request(app.getHttpServer())
      .patch(`/prompts/${customPromptId}`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .type('application/json')
      .send({ text: updated });
    expect(res.status).toBe(200);
    expect((res.body as { text: string }).text).toBe(updated);
  });

  it('PATCH /prompts/:id -> 403 tenant_admin cannot modify platform prompt', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/prompts/${platformPromptId}`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .type('application/json')
      .send({ text: 'Trying to change a platform prompt' });
    expect(res.status).toBe(403);
  });

  // ── Deactivate ────────────────────────────────────────────────────────────

  it('DELETE /prompts/:id -> 204 soft deactivates prompt', async () => {
    // Create a dedicated prompt for the deactivate test
    const create = await request(app.getHttpServer())
      .post('/prompts')
      .set('Authorization', `Bearer ${tenantToken}`)
      .type('application/json')
      .send({ ...BASE_PROMPT, verticalId: testVerticalId, text: 'Prompt to be deactivated in {city}' });
    expect(create.status).toBe(201);
    deactivatePromptId = (create.body as { id: string }).id;

    const res = await request(app.getHttpServer())
      .delete(`/prompts/${deactivatePromptId}`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(204);
  });

  it('GET /prompts/:id -> 404 after deactivation', async () => {
    const res = await request(app.getHttpServer())
      .get(`/prompts/${deactivatePromptId}`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(404);
  });

  it('Row persists with is_active=false after deactivation', async () => {
    const row = await prisma.prompt.findUnique({ where: { id: deactivatePromptId } });
    expect(row).not.toBeNull();
    expect(row!.is_active).toBe(false);
  });

  // ── Quota ─────────────────────────────────────────────────────────────────

  it('GET /prompts/quota -> 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/prompts/quota');
    expect(res.status).toBe(401);
  });

  it('GET /prompts/quota -> 200 returns quota status for tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/prompts/quota')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    const body = res.body as { allowed: boolean; count: number; limit: number; resetAt: string };
    expect(typeof body.allowed).toBe('boolean');
    expect(typeof body.count).toBe('number');
    expect(body.limit).toBe(500); // starter plan default
    expect(typeof body.resetAt).toBe('string');
    expect(body.allowed).toBe(true);
  });
});
