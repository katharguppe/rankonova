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
  email: 'tenant-a@e2e-tenants.test',
  password: 'PasswordA1!',
  tenantName: 'Tenant A Corp',
  tenantSlug: 'tenant-a-e2e',
  billingEmail: 'billing-a@e2e-tenants.test',
};
const B = {
  email: 'tenant-b@e2e-tenants.test',
  password: 'PasswordB1!',
  tenantName: 'Tenant B Corp',
  tenantSlug: 'tenant-b-e2e',
  billingEmail: 'billing-b@e2e-tenants.test',
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
  dto: typeof A,
  prisma: PrismaService,
): Promise<{ token: string; tenantId: string; userId: string }> {
  const reg = await request(app.getHttpServer()).post('/auth/register').send(dto);
  expect(reg.status).toBe(201);
  const { verificationToken } = reg.body as { verificationToken: string };
  await request(app.getHttpServer())
    .get('/auth/verify-email')
    .query({ token: verificationToken });
  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: dto.email, password: dto.password });
  expect(login.status).toBe(200);
  const { accessToken } = login.body as { accessToken: string };
  const user = await prisma.user.findUnique({ where: { email: dto.email } });
  return { token: accessToken, tenantId: user!.tenant_id, userId: user!.id };
}

describe('Tenants E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let tenantAId: string;
  let tenantBId: string;
  let verticalId: string;
  let clientAId: string;
  let clientBId: string;

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get(PrismaService);

    // Seed a test vertical
    const vertical = await prisma.vertical.create({
      data: {
        name: 'E2E Test Vertical',
        slug: 'e2e-test-vertical',
        prompt_templates: [],
        trusted_domains: [],
        aggregator_platforms: [],
        schema_types: [],
        community_platforms: [],
        review_platforms: [],
      },
    });
    verticalId = vertical.id;

    const a = await registerAndLogin(app, A, prisma);
    tokenA = a.token;
    tenantAId = a.tenantId;

    const b = await registerAndLogin(app, B, prisma);
    tokenB = b.token;
    tenantBId = b.tenantId;

    // Create Tenant B's client (for isolation tests)
    const res = await request(app.getHttpServer())
      .post('/tenants/me/clients')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        verticalId,
        name: 'B Client',
        brandName: 'BrandB',
        aliases: ['BrandB'],
        city: 'Bengaluru',
        state: 'Karnataka',
        websiteUrl: 'https://brandb.example.com',
      });
    expect(res.status).toBe(201);
    clientBId = (res.body as { id: string }).id;
  });

  afterAll(async () => {
    // Clean up in FK order
    await prisma.client.deleteMany({
      where: { tenant_id: { in: [tenantAId, tenantBId] } },
    });
    await prisma.authEvent.deleteMany({
      where: { user: { email: { in: [A.email, B.email] } } },
    });
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { in: [A.email, B.email] } } },
    });
    await prisma.user.deleteMany({ where: { email: { in: [A.email, B.email] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    await prisma.vertical.delete({ where: { id: verticalId } });
    await app.close();
  });

  // ── Tenant profile ─────────────────────────────────────────────────────────

  it('GET /tenants/me -> 200 own tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/tenants/me')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: tenantAId, slug: A.tenantSlug });
  });

  it('PATCH /tenants/me -> 200 updated name', async () => {
    const res = await request(app.getHttpServer())
      .patch('/tenants/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Tenant A Updated' });
    expect(res.status).toBe(200);
    expect((res.body as { name: string }).name).toBe('Tenant A Updated');
  });

  it('GET /tenants/me without token -> 401', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/me');
    expect(res.status).toBe(401);
  });

  // ── Client CRUD ────────────────────────────────────────────────────────────

  it('POST /tenants/me/clients -> 201 client created', async () => {
    const res = await request(app.getHttpServer())
      .post('/tenants/me/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        verticalId,
        name: 'A Client',
        brandName: 'BrandA',
        aliases: ['BrandA', 'BA'],
        city: 'Bengaluru',
        state: 'Karnataka',
        websiteUrl: 'https://branda.example.com',
        description: 'Test client for Tenant A',
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'A Client', tenant_id: tenantAId });
    clientAId = (res.body as { id: string }).id;
  });

  it('POST /tenants/me/clients second time on starter -> 403 plan limit', async () => {
    const res = await request(app.getHttpServer())
      .post('/tenants/me/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        verticalId,
        name: 'A Client 2',
        brandName: 'BrandA2',
        aliases: ['BrandA2'],
        city: 'Mumbai',
        state: 'Maharashtra',
        websiteUrl: 'https://branda2.example.com',
      });
    expect(res.status).toBe(403);
  });

  it('GET /tenants/me/clients -> 200 list own clients', async () => {
    const res = await request(app.getHttpServer())
      .get('/tenants/me/clients')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = (res.body as { id: string }[]).map((c) => c.id);
    expect(ids).toContain(clientAId);
    expect(ids).not.toContain(clientBId);
  });

  it('GET /tenants/me/clients/:id -> 200 own client', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tenants/me/clients/${clientAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect((res.body as { id: string }).id).toBe(clientAId);
  });

  it('PATCH /tenants/me/clients/:id -> 200 updated', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tenants/me/clients/${clientAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'A Client Updated', city: 'Hyderabad' });
    expect(res.status).toBe(200);
    expect((res.body as { name: string }).name).toBe('A Client Updated');
  });

  // ── Tenant isolation penetration tests ────────────────────────────────────

  it('[ISOLATION] Tenant A cannot GET Tenant B client -> 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tenants/me/clients/${clientBId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });

  it('[ISOLATION] Tenant A cannot PATCH Tenant B client -> 404', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tenants/me/clients/${clientBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('[ISOLATION] Tenant A cannot DELETE Tenant B client -> 404', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/tenants/me/clients/${clientBId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });

  // ── Soft delete ────────────────────────────────────────────────────────────

  it('DELETE /tenants/me/clients/:id -> 204 soft deleted', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/tenants/me/clients/${clientAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(204);
  });

  it('GET /tenants/me/clients/:id after soft delete -> 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tenants/me/clients/${clientAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });

  it('Row persisted with deleted_at set after soft delete', async () => {
    const row = await prisma.client.findUnique({ where: { id: clientAId } });
    expect(row).not.toBeNull();
    expect(row!.is_active).toBe(false);
    expect(row!.deleted_at).not.toBeNull();
  });
});
