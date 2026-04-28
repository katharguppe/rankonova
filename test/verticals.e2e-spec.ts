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
  email: 'super@e2e-verticals.test',
  password: 'SuperPass1!',
  tenantName: 'Super Admin Tenant',
  tenantSlug: 'super-admin-e2e-vert',
  billingEmail: 'billing@e2e-verticals.test',
};

const TENANT_USER = {
  email: 'tenant@e2e-verticals.test',
  password: 'TenantPass1!',
  tenantName: 'Regular Tenant',
  tenantSlug: 'regular-tenant-e2e-vert',
  billingEmail: 'billing-tenant@e2e-verticals.test',
};

const BASE_VERTICAL = {
  name: 'E2E Test Vertical',
  slug: 'e2e-test-vert',
  description: 'Created in E2E tests',
  promptTemplates: ['Best {brand} in {city}?'],
  intentCategories: ['dealer_discovery'],
  trustedDomains: ['example.com'],
  aggregatorPlatforms: [{ name: 'TestAgg', url_pattern: 'https://example.com/{city}', css_selectors: {}, crawl_frequency: 'weekly' }],
  schemaTypes: ['LocalBusiness'],
  communityPlatforms: [{ platform: 'reddit', identifiers: ['r/test'], keywords: ['test'] }],
  wikidataEntityType: 'Q123',
  reviewPlatforms: [{ name: 'Google', type: 'api', config: {} }],
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

describe('Verticals E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superToken: string;
  let tenantToken: string;
  let superUserId: string;
  let superTenantId: string;
  let tenantId: string;
  let verticalId: string;
  let clonedVerticalId: string;

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get(PrismaService);

    const sa = await registerAndLogin(app, SUPER_ADMIN, prisma);
    superToken = sa.token;
    superUserId = sa.userId;
    const saUser = await prisma.user.findUnique({ where: { id: superUserId } });
    superTenantId = saUser!.tenant_id;

    // Elevate to super_admin
    await prisma.user.update({ where: { id: superUserId }, data: { role: 'super_admin' } });

    // Re-login to get token with super_admin role
    const relogin = await request(app.getHttpServer())
      .post('/auth/login')
      .type('application/json')
      .send({ email: SUPER_ADMIN.email, password: SUPER_ADMIN.password });
    superToken = (relogin.body as { accessToken: string }).accessToken;

    const tu = await registerAndLogin(app, TENANT_USER, prisma);
    tenantToken = tu.token;
    const tuUser = await prisma.user.findUnique({ where: { email: TENANT_USER.email } });
    tenantId = tuUser!.tenant_id;
  });

  afterAll(async () => {
    const ids = [verticalId, clonedVerticalId].filter((id): id is string => !!id);
    if (ids.length) {
      await prisma.verticalConfigAudit.deleteMany({ where: { vertical_id: { in: ids } } });
      await prisma.vertical.deleteMany({ where: { id: { in: ids } } });
    }
    const emails = [SUPER_ADMIN.email, TENANT_USER.email];
    await prisma.authEvent.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    const tids = [superTenantId, tenantId].filter((id): id is string => !!id);
    if (tids.length) await prisma.tenant.deleteMany({ where: { id: { in: tids } } });
    await app.close();
  });

  // ── Create ─────────────────────────────────────────────────────────────────

  it('POST /verticals -> 403 for tenant_admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/verticals')
      .set('Authorization', `Bearer ${tenantToken}`)
      .type('application/json')
      .send(BASE_VERTICAL);
    expect(res.status).toBe(403);
  });

  it('POST /verticals -> 201 for super_admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/verticals')
      .set('Authorization', `Bearer ${superToken}`)
      .type('application/json')
      .send(BASE_VERTICAL);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: BASE_VERTICAL.name, slug: BASE_VERTICAL.slug });
    verticalId = (res.body as { id: string }).id;
  });

  it('POST /verticals -> 409 duplicate slug', async () => {
    const res = await request(app.getHttpServer())
      .post('/verticals')
      .set('Authorization', `Bearer ${superToken}`)
      .type('application/json')
      .send(BASE_VERTICAL);
    expect(res.status).toBe(409);
  });

  // ── Read ───────────────────────────────────────────────────────────────────

  it('GET /verticals -> 200 list (tenant_admin can read)', async () => {
    const res = await request(app.getHttpServer())
      .get('/verticals')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /verticals/:id -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/verticals/${verticalId}`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect((res.body as { id: string }).id).toBe(verticalId);
  });

  it('GET /verticals/:id -> 404 unknown id', async () => {
    const res = await request(app.getHttpServer())
      .get('/verticals/nonexistent-id-xyz')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(404);
  });

  it('GET /verticals -> 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/verticals');
    expect(res.status).toBe(401);
  });

  // ── Update + audit log ─────────────────────────────────────────────────────

  it('PATCH /verticals/:id -> 200 updates name and logs audit', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/verticals/${verticalId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .type('application/json')
      .send({ name: 'E2E Test Vertical Updated' });
    expect(res.status).toBe(200);
    expect((res.body as { name: string }).name).toBe('E2E Test Vertical Updated');
  });

  it('GET /verticals/:id/audit -> 200 with one entry after update', async () => {
    const res = await request(app.getHttpServer())
      .get(`/verticals/${verticalId}/audit`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as unknown[]).length).toBeGreaterThanOrEqual(1);
    const entry = (res.body as { changed_by_user_id: string }[])[0];
    expect(entry.changed_by_user_id).toBe(superUserId);
  });

  it('GET /verticals/:id/audit -> 403 for tenant_admin', async () => {
    const res = await request(app.getHttpServer())
      .get(`/verticals/${verticalId}/audit`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  // ── Clone ──────────────────────────────────────────────────────────────────

  it('POST /verticals/:id/clone -> 201 produces independent record', async () => {
    const res = await request(app.getHttpServer())
      .post(`/verticals/${verticalId}/clone`)
      .set('Authorization', `Bearer ${superToken}`)
      .type('application/json')
      .send({ name: 'E2E Clone Vertical', slug: 'e2e-clone-vert' });
    expect(res.status).toBe(201);
    clonedVerticalId = (res.body as { id: string }).id;
    expect(clonedVerticalId).not.toBe(verticalId);
    expect((res.body as { slug: string }).slug).toBe('e2e-clone-vert');
  });

  it('Cloned vertical is independent (patching source does not affect clone)', async () => {
    await request(app.getHttpServer())
      .patch(`/verticals/${verticalId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .type('application/json')
      .send({ name: 'Source Renamed Again' });

    const cloneRes = await request(app.getHttpServer())
      .get(`/verticals/${clonedVerticalId}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect((cloneRes.body as { name: string }).name).toBe('E2E Clone Vertical');
  });

  it('POST /verticals/:id/clone -> 409 duplicate slug', async () => {
    const res = await request(app.getHttpServer())
      .post(`/verticals/${verticalId}/clone`)
      .set('Authorization', `Bearer ${superToken}`)
      .type('application/json')
      .send({ name: 'Dup Clone', slug: 'e2e-clone-vert' });
    expect(res.status).toBe(409);
  });

  // ── Deactivate ─────────────────────────────────────────────────────────────

  it('DELETE /verticals/:id -> 204 soft deactivates', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/verticals/${clonedVerticalId}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(204);
  });

  it('GET /verticals/:id after deactivate -> 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/verticals/${clonedVerticalId}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(404);
  });

  it('Row persists with is_active=false after deactivate', async () => {
    const row = await prisma.vertical.findUnique({ where: { id: clonedVerticalId } });
    expect(row).not.toBeNull();
    expect(row!.is_active).toBe(false);
  });
});
