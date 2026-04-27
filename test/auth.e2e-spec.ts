import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { generateKeyPairSync } from 'crypto';
import { authenticator } from 'otplib';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';

import { AppModule } from '../app/app.module';
import { PrismaService } from '../app/prisma/prisma.service';

// ── Test RS256 key pair (generated once, set before any module loads) ─────────
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env['JWT_PRIVATE_KEY'] = Buffer.from(
  privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
).toString('base64');
process.env['JWT_PUBLIC_KEY'] = Buffer.from(
  publicKey.export({ type: 'spki', format: 'pem' }).toString(),
).toString('base64');
process.env['JWT_EXPIRES_IN'] = '86400';
process.env['REFRESH_TOKEN_EXPIRES_IN'] = '2592000';
// 32-byte AES-256 key (64 hex chars)
process.env['ENCRYPTION_KEY'] = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

// ── Helpers ───────────────────────────────────────────────────────────────────

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as string | string[] | undefined;
  if (!raw) return undefined;
  const cookies = Array.isArray(raw) ? raw : [raw];
  return cookies.find((c) => c.startsWith(`${name}=`));
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const cleanupUserIds: string[] = [];
  const cleanupTenantIds: string[] = [];

  async function buildApp(): Promise<INestApplication> {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const a = fixture.createNestApplication();
    a.use(cookieParser());
    a.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await a.init();
    return a;
  }

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (cleanupUserIds.length) {
      await prisma.authEvent.deleteMany({ where: { user_id: { in: cleanupUserIds } } });
      await prisma.refreshToken.deleteMany({ where: { user_id: { in: cleanupUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    }
    if (cleanupTenantIds.length) {
      await prisma.tenant.deleteMany({ where: { id: { in: cleanupTenantIds } } });
    }
    await app.close();
  });

  // ── Test helpers ─────────────────────────────────────────────────────────────

  async function registerAndVerify(suffix = uid()) {
    const dto = {
      email: `test-${suffix}@aeo.test`,
      password: 'Password123!',
      tenantName: `Tenant ${suffix}`,
      tenantSlug: `tenant-${suffix}`,
      billingEmail: `billing-${suffix}@aeo.test`,
    };

    const regRes = await request(app.getHttpServer()).post('/auth/register').send(dto).expect(201);
    await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${regRes.body.verificationToken as string}`)
      .expect(200);

    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    const tenant = await prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
    if (user) cleanupUserIds.push(user.id);
    if (tenant) cleanupTenantIds.push(tenant.id);

    return { dto, user: user!, tenant: tenant! };
  }

  async function login(email: string, password: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/auth/login').send({ email, password }).expect(200);
    return { agent, accessToken: res.body.accessToken as string, loginRes: res };
  }

  // ── Registration ─────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('creates tenant + user, returns 64-char verificationToken', async () => {
      const suffix = uid();
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `reg-${suffix}@aeo.test`,
          password: 'Password123!',
          tenantName: `Reg ${suffix}`,
          tenantSlug: `reg-${suffix}`,
          billingEmail: `b@aeo.test`,
        })
        .expect(201);

      expect(res.body.verificationToken).toHaveLength(64);

      const user = await prisma.user.findUnique({ where: { email: `reg-${suffix}@aeo.test` } });
      expect(user?.role).toBe('tenant_admin');
      if (user) cleanupUserIds.push(user.id);
      const tenant = await prisma.tenant.findUnique({ where: { slug: `reg-${suffix}` } });
      expect(tenant).toBeTruthy();
      if (tenant) cleanupTenantIds.push(tenant.id);
    });

    it('rejects duplicate email → 409', async () => {
      const { dto } = await registerAndVerify();
      await request(app.getHttpServer()).post('/auth/register').send(dto).expect(409);
    });

    it('rejects duplicate tenant slug → 409', async () => {
      const { dto } = await registerAndVerify();
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...dto, email: `other-${uid()}@aeo.test` })
        .expect(409);
    });

    it('rejects password < 8 chars → 400', async () => {
      const s = uid();
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `e@aeo.test`, password: 'abc', tenantName: 'T', tenantSlug: s, billingEmail: 'b@aeo.test' })
        .expect(400);
    });

    it('rejects invalid slug chars → 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `e@aeo.test`, password: 'Password123!', tenantName: 'T', tenantSlug: 'Invalid Slug!', billingEmail: 'b@aeo.test' })
        .expect(400);
    });
  });

  // ── Email verification ────────────────────────────────────────────────────────

  describe('GET /auth/verify-email', () => {
    it('verifies with valid token → 200', async () => {
      const suffix = uid();
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `v-${suffix}@aeo.test`, password: 'Password123!', tenantName: `V ${suffix}`, tenantSlug: `v-${suffix}`, billingEmail: 'b@aeo.test' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/auth/verify-email?token=${res.body.verificationToken as string}`)
        .expect(200)
        .expect((r) => expect(r.body.message).toMatch(/verified/i));

      const user = await prisma.user.findUnique({ where: { email: `v-${suffix}@aeo.test` } });
      if (user) cleanupUserIds.push(user.id);
      const tenant = await prisma.tenant.findUnique({ where: { slug: `v-${suffix}` } });
      if (tenant) cleanupTenantIds.push(tenant.id);
    });

    it('rejects invalid token → 400', async () => {
      await request(app.getHttpServer())
        .get('/auth/verify-email?token=' + 'x'.repeat(64))
        .expect(400);
    });
  });

  // ── Login ─────────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns accessToken + httpOnly refresh_token cookie', async () => {
      const { dto } = await registerAndVerify();
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: dto.email, password: dto.password })
        .expect(200);

      expect(typeof res.body.accessToken).toBe('string');
      const rc = cookieValue(res, 'refresh_token');
      expect(rc).toBeTruthy();
      expect(rc).toMatch(/HttpOnly/i);
    });

    it('blocks unverified email → 403', async () => {
      const suffix = uid();
      const dto = { email: `uv-${suffix}@aeo.test`, password: 'Password123!', tenantName: `UV ${suffix}`, tenantSlug: `uv-${suffix}`, billingEmail: 'b@aeo.test' };
      await request(app.getHttpServer()).post('/auth/register').send(dto).expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/login').send({ email: dto.email, password: dto.password }).expect(403);
      expect(res.body.message).toMatch(/not verified/i);

      const user = await prisma.user.findUnique({ where: { email: dto.email } });
      if (user) cleanupUserIds.push(user.id);
      const tenant = await prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
      if (tenant) cleanupTenantIds.push(tenant.id);
    });

    it('rejects wrong password → 401', async () => {
      const { dto } = await registerAndVerify();
      await request(app.getHttpServer())
        .post('/auth/login').send({ email: dto.email, password: 'WrongPassword!' }).expect(401);
    });

    it('rejects unknown email → 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login').send({ email: 'nobody@nowhere.com', password: 'Password123!' }).expect(401);
    });
  });

  // ── Account lockout ───────────────────────────────────────────────────────────

  describe('Account lockout', () => {
    it('5 wrong passwords lock the account; correct password then returns 403', async () => {
      const { dto } = await registerAndVerify();
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login').send({ email: dto.email, password: 'WrongPassword!' }).expect(401);
      }
      const res = await request(app.getHttpServer())
        .post('/auth/login').send({ email: dto.email, password: dto.password }).expect(403);
      expect(res.body.message).toMatch(/locked/i);
    });

    it('account_locked auth event written on lockout', async () => {
      const { dto, user } = await registerAndVerify();
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login').send({ email: dto.email, password: 'WrongPassword!' });
      }
      const event = await prisma.authEvent.findFirst({
        where: { user_id: user.id, event_type: 'account_locked' },
      });
      expect(event).toBeTruthy();
    });
  });

  // ── Token refresh (rotation) ──────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns new accessToken and rotates refresh cookie', async () => {
      const { dto } = await registerAndVerify();
      const agent = request.agent(app.getHttpServer());
      await agent.post('/auth/login').send({ email: dto.email, password: dto.password });

      const res = await agent.post('/auth/refresh').expect(200);
      expect(typeof res.body.accessToken).toBe('string');
      expect(cookieValue(res, 'refresh_token')).toBeTruthy();
    });

    it('original refresh token rejected after rotation (replay blocked)', async () => {
      const { dto } = await registerAndVerify();

      // Capture original refresh cookie from login
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login').send({ email: dto.email, password: dto.password }).expect(200);
      const originalCookie = cookieValue(loginRes, 'refresh_token')!;

      // First use — succeeds, issues new token
      await request(app.getHttpServer())
        .post('/auth/refresh').set('Cookie', originalCookie).expect(200);

      // Replay original token — must be rejected
      await request(app.getHttpServer())
        .post('/auth/refresh').set('Cookie', originalCookie).expect(401);
    });

    it('returns 401 with no cookie', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });
  });

  // ── Logout ────────────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('clears cookie and invalidates refresh token', async () => {
      const { dto } = await registerAndVerify();
      const { agent, accessToken } = await login(dto.email, dto.password);

      await agent.post('/auth/logout').set('Authorization', `Bearer ${accessToken}`).expect(204);
      await agent.post('/auth/refresh').expect(401);
    });

    it('requires bearer token → 401 without auth', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });

  // ── Password reset ────────────────────────────────────────────────────────────

  describe('Password reset', () => {
    it('issues resetToken, confirm updates password, old password rejected', async () => {
      const { dto } = await registerAndVerify();

      const reqRes = await request(app.getHttpServer())
        .post('/auth/password-reset/request').send({ email: dto.email }).expect(200);
      const { resetToken } = reqRes.body as { resetToken: string };
      expect(resetToken).toHaveLength(64);

      await request(app.getHttpServer())
        .post('/auth/password-reset/confirm')
        .send({ resetToken, newPassword: 'NewPassword456!' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login').send({ email: dto.email, password: dto.password }).expect(401);
      await request(app.getHttpServer())
        .post('/auth/login').send({ email: dto.email, password: 'NewPassword456!' }).expect(200);
    });

    it('unknown email returns 200 with empty resetToken (no leak)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/password-reset/request').send({ email: 'ghost@nowhere.com' }).expect(200);
      expect(res.body.resetToken).toBe('');
    });

    it('invalid resetToken → 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/password-reset/confirm')
        .send({ resetToken: 'badtoken', newPassword: 'NewPassword456!' })
        .expect(400);
    });
  });

  // ── MFA ───────────────────────────────────────────────────────────────────────

  describe('MFA: enroll → enable → login challenge → verify', () => {
    it('full flow: enroll returns secret+QR, enable with valid TOTP, login triggers challenge, challenge succeeds', async () => {
      const { dto } = await registerAndVerify();
      const { agent, accessToken } = await login(dto.email, dto.password);

      // Enroll
      const enrollRes = await agent
        .post('/auth/mfa/enroll').set('Authorization', `Bearer ${accessToken}`).expect(201);
      const { secret, qrDataUrl } = enrollRes.body as { secret: string; qrDataUrl: string };
      expect(typeof secret).toBe('string');
      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);

      // Enable
      await agent
        .post('/auth/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: authenticator.generate(secret) })
        .expect(200);

      // Login now returns MFA challenge
      const challengeRes = await request(app.getHttpServer())
        .post('/auth/login').send({ email: dto.email, password: dto.password }).expect(200);
      expect(challengeRes.body.mfaRequired).toBe(true);
      expect(typeof challengeRes.body.mfaSession).toBe('string');

      // Verify challenge → issues tokens
      const verifyRes = await request(app.getHttpServer())
        .post('/auth/mfa/verify')
        .send({ token: authenticator.generate(secret), mfaSession: challengeRes.body.mfaSession })
        .expect(200);
      expect(typeof verifyRes.body.accessToken).toBe('string');
    });

    it('wrong TOTP code during challenge → 401', async () => {
      const { dto } = await registerAndVerify();
      const { agent, accessToken } = await login(dto.email, dto.password);

      const enrollRes = await agent
        .post('/auth/mfa/enroll').set('Authorization', `Bearer ${accessToken}`).expect(201);
      const { secret } = enrollRes.body as { secret: string };

      await agent
        .post('/auth/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: authenticator.generate(secret) })
        .expect(200);

      const challengeRes = await request(app.getHttpServer())
        .post('/auth/login').send({ email: dto.email, password: dto.password }).expect(200);

      await request(app.getHttpServer())
        .post('/auth/mfa/verify')
        .send({ token: '000000', mfaSession: challengeRes.body.mfaSession })
        .expect(401);
    });

    it('expired / unknown MFA session → 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/mfa/verify')
        .send({ token: '123456', mfaSession: 'nonexistentsession' })
        .expect(401);
    });

    it('enroll without auth → 401', async () => {
      await request(app.getHttpServer()).post('/auth/mfa/enroll').expect(401);
    });
  });

  // ── Auth events ───────────────────────────────────────────────────────────────

  describe('Auth events written to DB', () => {
    it('login_success written on successful login', async () => {
      const { dto, user } = await registerAndVerify();
      await request(app.getHttpServer())
        .post('/auth/login').send({ email: dto.email, password: dto.password });
      const ev = await prisma.authEvent.findFirst({ where: { user_id: user.id, event_type: 'login_success' } });
      expect(ev).toBeTruthy();
    });

    it('login_failure written on wrong password', async () => {
      const { dto, user } = await registerAndVerify();
      await request(app.getHttpServer())
        .post('/auth/login').send({ email: dto.email, password: 'WrongPassword!' });
      const ev = await prisma.authEvent.findFirst({ where: { user_id: user.id, event_type: 'login_failure' } });
      expect(ev).toBeTruthy();
    });

    it('logout event written on logout', async () => {
      const { dto, user } = await registerAndVerify();
      const { agent, accessToken } = await login(dto.email, dto.password);
      await agent.post('/auth/logout').set('Authorization', `Bearer ${accessToken}`);
      const ev = await prisma.authEvent.findFirst({ where: { user_id: user.id, event_type: 'logout' } });
      expect(ev).toBeTruthy();
    });

    it('token_refreshed written on refresh', async () => {
      const { dto, user } = await registerAndVerify();
      const { agent } = await login(dto.email, dto.password);
      await agent.post('/auth/refresh');
      const ev = await prisma.authEvent.findFirst({ where: { user_id: user.id, event_type: 'token_refreshed' } });
      expect(ev).toBeTruthy();
    });

    it('password_reset_requested written on reset request', async () => {
      const { dto, user } = await registerAndVerify();
      await request(app.getHttpServer())
        .post('/auth/password-reset/request').send({ email: dto.email });
      const ev = await prisma.authEvent.findFirst({ where: { user_id: user.id, event_type: 'password_reset_requested' } });
      expect(ev).toBeTruthy();
    });
  });

  // ── Rate limiting ─────────────────────────────────────────────────────────────

  describe('Rate limiting', () => {
    it('11th request within 60s window returns 429', async () => {
      // Use a fresh isolated app instance so prior tests do not exhaust the quota
      const isolatedApp = await buildApp();
      const http = isolatedApp.getHttpServer();

      try {
        for (let i = 0; i < 10; i++) {
          await request(http).post('/auth/login').send({ email: 'x@x.com', password: 'pass' });
        }
        const res = await request(http).post('/auth/login').send({ email: 'x@x.com', password: 'pass' });
        expect(res.status).toBe(429);
      } finally {
        await isolatedApp.close();
      }
    });
  });
});
