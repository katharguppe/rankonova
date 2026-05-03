import { generateKeyPairSync } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';
import { PrismaService } from '../app/prisma/prisma.service';
import { FaqPageGeneratorService } from '../app/content-agent/generators/faq-page.generator';
import { ComparisonPageGeneratorService } from '../app/content-agent/generators/comparison-page.generator';
import { EntityAuthorityPageGeneratorService } from '../app/content-agent/generators/entity-authority-page.generator';
import { SegmentArticleGeneratorService } from '../app/content-agent/generators/segment-article.generator';
import type { GeneratedContent } from '../app/content-agent/content-agent.types';

// ── JWT keys (generated once before any module loads) ─────────────────────────
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

jest.setTimeout(120_000);

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Generates a deterministic answer string: ~60 words, always includes numbers.
function faqAnswer(n: number): string {
  return (
    `This is answer ${n} for Test Brand dealership in Bangalore. ` +
    `The starting price is Rs ${n * 2} lakh for this category of vehicle in 2026. ` +
    `Our dealership has been serving customers for over ${n + 10} years across Karnataka. ` +
    `We offer ${n * 5} certified pre-owned vehicles each month at competitive prices. ` +
    `Contact us at our ${n + 3} Bangalore showrooms for a free consultation session today.`
  );
}

// 6 Q&A pairs — each answer ~60 words with numbers; safely within 50-90 word limit.
const FAQ_ENTITIES = Array.from({ length: 6 }, (_, i) => ({
  '@type': 'Question',
  name: `What is the key benefit of Test Brand option ${i + 1} in Bangalore?`,
  acceptedAnswer: { '@type': 'Answer', text: faqAnswer(i + 1) },
}));

function makeFaqHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Brand FAQ – Automotive Dealer Bangalore</title>
  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ_ENTITIES })}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'AutoDealer', name: 'Test Brand', url: 'https://testbrand.example.com' })}
  </script>
</head>
<body>
  <h1>Test Brand FAQ – Automotive Dealer Bangalore</h1>
  <div class="faq">
    ${FAQ_ENTITIES.map((e) => `<div class="faq-item"><h2>${e.name}</h2><p>${e.acceptedAnswer.text}</p></div>`).join('\n    ')}
  </div>
</body>
</html>`;
}

function makeComparisonHtml(): string {
  const faqEntities = Array.from({ length: 4 }, (_, i) => ({
    '@type': 'Question',
    name: `How does Test Brand compare on dimension ${i + 1}?`,
    acceptedAnswer: { '@type': 'Answer', text: faqAnswer(i + 1) },
  }));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Brand vs Rival: Automotive Bangalore</title>
  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqEntities })}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Test Brand' })}
  </script>
</head>
<body>
  <h1>Test Brand vs Rival: Automotive Bangalore</h1>
  <table>
    <thead>
      <tr><th scope="col">Feature</th><th scope="col">Test Brand</th><th scope="col">Rival</th></tr>
    </thead>
    <tbody>
      <tr><td>Starting price</td><td><strong>Rs 8 lakh</strong></td><td>Rs 9.5 lakh</td></tr>
      <tr><td>Warranty</td><td><strong>3 years / 100,000 km</strong></td><td>2 years / 60,000 km</td></tr>
      <tr><td>Service centres</td><td><strong>12</strong></td><td>8</td></tr>
      <tr><td>Rating</td><td><strong>4.7/5</strong></td><td>4.2/5</td></tr>
      <tr><td>Resale value (3yr)</td><td><strong>63%</strong></td><td>55%</td></tr>
    </tbody>
  </table>
</body>
</html>`;
}

function makeEntityHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Brand – AutoDealer Bangalore | About</title>
  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'AutoDealer', name: 'Test Brand', url: 'https://testbrand.example.com', foundingDate: '2005', areaServed: 'Bangalore' })}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Who is Test Brand?', acceptedAnswer: { '@type': 'Answer', text: faqAnswer(1) } }] })}
  </script>
</head>
<body>
  <h1>Test Brand – AutoDealer Bangalore</h1>
  <p>Test Brand is an authorised automobile dealer operating in Bangalore since 2005 with over 18 years of service.</p>
  <dl>
    <!-- P571: inception --><dt>Founded</dt><dd>2005</dd>
    <!-- P159: headquarters location --><dt>Headquarters</dt><dd>Bangalore, Karnataka, India</dd>
    <!-- P856: official website --><dt>Website</dt><dd>https://testbrand.example.com</dd>
    <!-- P17: country --><dt>Country</dt><dd>India</dd>
  </dl>
</body>
</html>`;
}

// Segment article needs ≥1200 body words (excluding scripts).
function makeArticleHtml(): string {
  const sentence =
    'Test Brand offers reliable automotive services across Bangalore starting from Rs 8 lakh with a comprehensive 3-year warranty covering 100000 km. ';
  let bodyText = '';
  while (bodyText.split(/\s+/).filter(Boolean).length < 1250) {
    bodyText += sentence;
  }
  const faqEntities = Array.from({ length: 3 }, (_, i) => ({
    '@type': 'Question',
    name: `Question ${i + 1} for automotive buyers in Bangalore?`,
    acceptedAnswer: { '@type': 'Answer', text: faqAnswer(i + 1) },
  }));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Buying a Car in Bangalore: 2026 Buyers Guide</title>
  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', name: 'Buying a Car in Bangalore: 2026 Buyers Guide', author: { '@type': 'Organization', name: 'Test Brand' } })}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqEntities })}
  </script>
</head>
<body>
  <h1>Buying a Car in Bangalore: 2026 Buyers Guide</h1>
  <h2>Understanding Prices and On-Road Costs in 2026</h2>
  <p>${bodyText.slice(0, Math.floor(bodyText.length / 2))}</p>
  <h2>Warranty, Service, and After-Sales Support</h2>
  <p>${bodyText.slice(Math.floor(bodyText.length / 2))}</p>
</body>
</html>`;
}

function makeOutput(
  title: string,
  htmlContent: string,
  schemaJson: object = {},
): GeneratedContent {
  return { title, htmlContent, schemaJson, generationPrompt: 'mock-prompt' };
}

// ── Users ─────────────────────────────────────────────────────────────────────

const ADMIN = {
  email: 'admin@e2e-content-agent.test',
  password: 'AdminPass1!',
  tenantName: 'Content Agent E2E Tenant',
  tenantSlug: 'content-agent-e2e',
  billingEmail: 'billing@e2e-content-agent.test',
};

const VIEWER = {
  email: 'viewer@e2e-content-agent.test',
  password: 'ViewerPass1!',
  tenantName: 'Content Agent E2E Tenant',
  tenantSlug: 'content-agent-e2e',
  billingEmail: 'billing@e2e-content-agent.test',
};

const OTHER = {
  email: 'other@e2e-content-agent.test',
  password: 'OtherPass1!',
  tenantName: 'Content Agent Other Tenant',
  tenantSlug: 'content-agent-other-e2e',
  billingEmail: 'other-billing@e2e-content-agent.test',
};

// ── App builder ───────────────────────────────────────────────────────────────

const mockFaq = { generate: jest.fn() };
const mockComparison = { generate: jest.fn() };
const mockEntity = { generate: jest.fn() };
const mockArticle = { generate: jest.fn() };

async function buildApp(): Promise<INestApplication> {
  const fixture = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FaqPageGeneratorService).useValue(mockFaq)
    .overrideProvider(ComparisonPageGeneratorService).useValue(mockComparison)
    .overrideProvider(EntityAuthorityPageGeneratorService).useValue(mockEntity)
    .overrideProvider(SegmentArticleGeneratorService).useValue(mockArticle)
    .compile();

  const app = fixture.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
}

async function registerAndLogin(
  app: INestApplication,
  dto: typeof ADMIN,
): Promise<string> {
  const reg = await request(app.getHttpServer())
    .post('/auth/register')
    .type('application/json')
    .send(dto);
  if (reg.status !== 201) throw new Error(`register failed: ${JSON.stringify(reg.body)}`);
  const { verificationToken } = reg.body as { verificationToken: string };
  await request(app.getHttpServer())
    .get('/auth/verify-email')
    .query({ token: verificationToken });
  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .type('application/json')
    .send({ email: dto.email, password: dto.password });
  return (login.body as { accessToken: string }).accessToken;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ContentAgent (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let viewerToken: string;
  let otherToken: string;
  let tenantId: string;
  let otherTenantId: string;
  let clientId: string;
  let verticalId: string;

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get(PrismaService);

    // ── Pre-cleanup (anchor on slugs) ─────────────────────────────────────────
    const oldTenants = await prisma.tenant.findMany({
      where: { slug: { in: [ADMIN.tenantSlug, OTHER.tenantSlug, 'ignored-viewer-e2e'] } },
      select: { id: true },
    });
    const oldTids = oldTenants.map((t) => t.id);
    if (oldTids.length) {
      const oldClients = await prisma.client.findMany({
        where: { tenant_id: { in: oldTids } }, select: { id: true },
      });
      const oldCids = oldClients.map((c) => c.id);
      if (oldCids.length) {
        await prisma.contentOutput.deleteMany({ where: { client_id: { in: oldCids } } });
        await prisma.notification.deleteMany({ where: { client_id: { in: oldCids } } });
        await prisma.competitor.deleteMany({ where: { tenant_id: { in: oldTids } } });
        await prisma.client.deleteMany({ where: { id: { in: oldCids } } });
      }
      const oldUsers = await prisma.user.findMany({
        where: { tenant_id: { in: oldTids } }, select: { id: true },
      });
      const oldUids = oldUsers.map((u) => u.id);
      if (oldUids.length) {
        await prisma.authEvent.deleteMany({ where: { user_id: { in: oldUids } } });
        await prisma.refreshToken.deleteMany({ where: { user_id: { in: oldUids } } });
        await prisma.user.deleteMany({ where: { id: { in: oldUids } } });
      }
      await prisma.tenant.deleteMany({ where: { id: { in: oldTids } } });
    }

    // ── Set up mock return values ─────────────────────────────────────────────
    mockFaq.generate.mockResolvedValue(
      makeOutput('Test Brand FAQ – Automotive Dealer Bangalore', makeFaqHtml()),
    );
    mockComparison.generate.mockResolvedValue(
      makeOutput('Test Brand vs Rival: Automotive Bangalore', makeComparisonHtml()),
    );
    mockEntity.generate.mockResolvedValue(
      makeOutput('Test Brand – AutoDealer Bangalore | About', makeEntityHtml()),
    );
    mockArticle.generate.mockResolvedValue(
      makeOutput('Buying a Car in Bangalore: 2026 Buyers Guide', makeArticleHtml()),
    );

    // ── Register users ────────────────────────────────────────────────────────
    adminToken = await registerAndLogin(app, ADMIN);
    otherToken = await registerAndLogin(app, OTHER);

    // Promote admin user to tenant_admin
    const adminUser = await prisma.user.findUnique({ where: { email: ADMIN.email } });
    tenantId = adminUser!.tenant_id;
    await prisma.user.update({ where: { id: adminUser!.id }, data: { role: 'tenant_admin' } });

    const otherUser = await prisma.user.findUnique({ where: { email: OTHER.email } });
    otherTenantId = otherUser!.tenant_id;

    // Register viewer in same tenant as admin
    const viewerReg = await request(app.getHttpServer())
      .post('/auth/register')
      .type('application/json')
      .send({ ...VIEWER, tenantName: 'ignored', tenantSlug: 'ignored-viewer-e2e' });
    if (viewerReg.status === 201) {
      const { verificationToken } = viewerReg.body as { verificationToken: string };
      await request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ token: verificationToken });
    }
    // Viewer ends up in its own tenant; move it into admin's tenant manually
    const viewerUser = await prisma.user.findUnique({ where: { email: VIEWER.email } });
    if (viewerUser) {
      await prisma.user.update({
        where: { id: viewerUser.id },
        data: { tenant_id: tenantId, role: 'client_viewer' },
      });
    }
    const viewerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .type('application/json')
      .send({ email: VIEWER.email, password: VIEWER.password });
    viewerToken = (viewerLogin.body as { accessToken: string }).accessToken;

    // ── Seed vertical + client + competitor ───────────────────────────────────
    const vertical = await prisma.vertical.upsert({
      where: { slug: 'content-agent-e2e-auto' },
      update: {},
      create: {
        name: 'Automotive',
        slug: 'content-agent-e2e-auto',
        prompt_templates: [],
        intent_categories: [],
        trusted_domains: [],
        aggregator_platforms: [],
        schema_types: ['AutoDealer'],
        community_platforms: [],
        review_platforms: [],
      },
    });
    verticalId = vertical.id;

    const clientRes = await request(app.getHttpServer())
      .post('/tenants/me/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({
        verticalId,
        name: 'Test Brand Dealership',
        brandName: 'Test Brand',
        aliases: ['TestBrand'],
        city: 'Bangalore',
        state: 'Karnataka',
        websiteUrl: 'https://testbrand.example.com',
      });
    expect(clientRes.status).toBe(201);
    clientId = (clientRes.body as { id: string }).id;

    await prisma.competitor.create({
      data: {
        tenant_id: tenantId,
        vertical_id: verticalId,
        name: 'Rival Motors',
        aliases: [],
        website_url: 'https://rival.example.com',
      },
    });
  }, 60000);

  afterAll(async () => {
    const tids = [tenantId, otherTenantId].filter((id): id is string => !!id);
    if (tids.length) {
      const cids = (await prisma.client.findMany({
        where: { tenant_id: { in: tids } }, select: { id: true },
      })).map((c) => c.id);
      if (cids.length) {
        await prisma.contentOutput.deleteMany({ where: { client_id: { in: cids } } });
        await prisma.notification.deleteMany({ where: { client_id: { in: cids } } });
        await prisma.competitor.deleteMany({ where: { tenant_id: { in: tids } } });
        await prisma.client.deleteMany({ where: { id: { in: cids } } });
      }
      const uids = (await prisma.user.findMany({
        where: { tenant_id: { in: tids } }, select: { id: true },
      })).map((u) => u.id);
      if (uids.length) {
        await prisma.authEvent.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.refreshToken.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.user.deleteMany({ where: { id: { in: uids } } });
      }
      await prisma.tenant.deleteMany({ where: { id: { in: tids } } });
    }
    await prisma.vertical.deleteMany({ where: { slug: 'content-agent-e2e-auto' } });
    await prisma.tenant.deleteMany({ where: { slug: 'ignored-viewer-e2e' } });
    await app.close();
  });

  // ── Generation ────────────────────────────────────────────────────────────────

  it('POST /content/generate faq_page -> 201 draft saved', async () => {
    const res = await request(app.getHttpServer())
      .post('/content/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({ clientId, contentType: 'faq_page' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      client_id: clientId,
      type: 'faq_page',
      status: 'draft',
    });
    expect(typeof res.body.id).toBe('string');
    expect(mockFaq.generate).toHaveBeenCalledWith(
      expect.objectContaining({ brandName: 'Test Brand', city: 'Bangalore' }),
    );
  });

  it('POST /content/generate comparison_page -> 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/content/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({ clientId, contentType: 'comparison_page' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: 'comparison_page', status: 'draft' });
    expect(mockComparison.generate).toHaveBeenCalledWith(
      expect.objectContaining({ competitorNames: expect.arrayContaining(['Rival Motors']) }),
    );
  });

  it('POST /content/generate entity_authority_page -> 201 with correct schema type', async () => {
    const res = await request(app.getHttpServer())
      .post('/content/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({ clientId, contentType: 'entity_authority_page' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: 'entity_authority_page', status: 'draft' });
    expect(mockEntity.generate).toHaveBeenCalledWith(
      expect.objectContaining({ schemaOrgType: 'LocalBusiness' }),
    );
  });

  it('POST /content/generate segment_article -> 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/content/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({ clientId, contentType: 'segment_article' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: 'segment_article', status: 'draft' });
    expect(mockArticle.generate).toHaveBeenCalled();
  });

  // ── List / get ─────────────────────────────────────────────────────────────────

  it('GET /content/:clientId -> lists all 4 outputs', async () => {
    const res = await request(app.getHttpServer())
      .get(`/content/${clientId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const types = (res.body as { type: string }[]).map((o) => o.type);
    expect(types).toContain('faq_page');
    expect(types).toContain('comparison_page');
    expect(types).toContain('entity_authority_page');
    expect(types).toContain('segment_article');
  });

  it('GET /content/:clientId?status=draft -> filters by status', async () => {
    const res = await request(app.getHttpServer())
      .get(`/content/${clientId}?status=draft`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const statuses = (res.body as { status: string }[]).map((o) => o.status);
    expect(statuses.every((s) => s === 'draft')).toBe(true);
  });

  it('GET /content/output/:id -> returns full HTML content', async () => {
    // Get an output id from the list
    const list = await request(app.getHttpServer())
      .get(`/content/${clientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const outputId = (list.body as { id: string }[])[0].id;

    const res = await request(app.getHttpServer())
      .get(`/content/output/${outputId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: outputId, html_content: expect.any(String) });
    expect((res.body as { html_content: string }).html_content).toContain('<html');
  });

  it('GET /content/output/:unknown -> 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/content/output/nonexistent-id-000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  // ── Approval workflow ─────────────────────────────────────────────────────────

  it('full approval path: draft -> approve -> publish', async () => {
    // Generate fresh FAQ output
    const genRes = await request(app.getHttpServer())
      .post('/content/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({ clientId, contentType: 'faq_page' });
    expect(genRes.status).toBe(201);
    const outputId = (genRes.body as { id: string }).id;

    // Approve
    const approveRes = await request(app.getHttpServer())
      .patch(`/content/output/${outputId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body).toMatchObject({
      status: 'approved',
      approved_at: expect.any(String),
      approved_by: expect.any(String),
    });

    // Publish
    const publishRes = await request(app.getHttpServer())
      .patch(`/content/output/${outputId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(publishRes.status).toBe(200);
    expect(publishRes.body).toMatchObject({
      status: 'published',
      published_at: expect.any(String),
      follow_up_scheduled_at: expect.any(String),
    });

    // follow_up_scheduled_at should be ~60 days in the future
    const followUpDate = new Date((publishRes.body as { follow_up_scheduled_at: string }).follow_up_scheduled_at);
    const daysAhead = (followUpDate.getTime() - Date.now()) / (24 * 3600 * 1000);
    expect(daysAhead).toBeGreaterThan(58);
    expect(daysAhead).toBeLessThan(62);
  });

  it('revision path: draft -> request-revision -> regenerate -> new draft with previous_version_id', async () => {
    const genRes = await request(app.getHttpServer())
      .post('/content/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({ clientId, contentType: 'faq_page' });
    expect(genRes.status).toBe(201);
    const originalId = (genRes.body as { id: string }).id;

    // Request revision
    const revRes = await request(app.getHttpServer())
      .patch(`/content/output/${originalId}/request-revision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({ reviewNotes: 'Please add more specific pricing data for the SUV category.' });
    expect(revRes.status).toBe(200);
    expect(revRes.body).toMatchObject({
      status: 'revision_requested',
      review_notes: 'Please add more specific pricing data for the SUV category.',
    });

    // Regenerate
    const regenRes = await request(app.getHttpServer())
      .post(`/content/output/${originalId}/regenerate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(regenRes.status).toBe(201);

    const newOutput = regenRes.body as { id: string; previous_version_id: string; status: string };
    expect(newOutput.status).toBe('draft');
    expect(newOutput.previous_version_id).toBe(originalId);
    expect(newOutput.id).not.toBe(originalId);

    // Generator was called with revision notes
    const lastCall = mockFaq.generate.mock.calls[mockFaq.generate.mock.calls.length - 1] as [{ revisionNotes?: string }];
    expect(lastCall[0].revisionNotes).toContain('Please add more specific pricing data');
  });

  // ── State machine guards ───────────────────────────────────────────────────────

  it('cannot publish a draft directly -> 400', async () => {
    const genRes = await request(app.getHttpServer())
      .post('/content/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({ clientId, contentType: 'faq_page' });
    const outputId = (genRes.body as { id: string }).id;

    const res = await request(app.getHttpServer())
      .patch(`/content/output/${outputId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('cannot approve a published output -> 400', async () => {
    // Generate -> approve -> publish
    const genRes = await request(app.getHttpServer())
      .post('/content/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({ clientId, contentType: 'faq_page' });
    const id = (genRes.body as { id: string }).id;
    await request(app.getHttpServer())
      .patch(`/content/output/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app.getHttpServer())
      .patch(`/content/output/${id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app.getHttpServer())
      .patch(`/content/output/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('cannot regenerate a draft (must be revision_requested) -> 400', async () => {
    const genRes = await request(app.getHttpServer())
      .post('/content/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({ clientId, contentType: 'faq_page' });
    const id = (genRes.body as { id: string }).id;

    const res = await request(app.getHttpServer())
      .post(`/content/output/${id}/regenerate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  // ── Role guards ───────────────────────────────────────────────────────────────

  it('client_viewer can list outputs but cannot generate -> 403', async () => {
    const listRes = await request(app.getHttpServer())
      .get(`/content/${clientId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(listRes.status).toBe(200);

    const genRes = await request(app.getHttpServer())
      .post('/content/generate')
      .set('Authorization', `Bearer ${viewerToken}`)
      .type('application/json')
      .send({ clientId, contentType: 'faq_page' });
    expect(genRes.status).toBe(403);
  });

  // ── Tenant isolation ──────────────────────────────────────────────────────────

  it('other tenant cannot read outputs from this tenant -> 404', async () => {
    const list = await request(app.getHttpServer())
      .get(`/content/${clientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const outputId = (list.body as { id: string }[])[0].id;

    const res = await request(app.getHttpServer())
      .get(`/content/output/${outputId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  // ── Notification created on generate ─────────────────────────────────────────

  it('draft generation creates a notification record', async () => {
    const genRes = await request(app.getHttpServer())
      .post('/content/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('application/json')
      .send({ clientId, contentType: 'faq_page' });
    expect(genRes.status).toBe(201);
    const outputId = (genRes.body as { id: string }).id;

    const notif = await prisma.notification.findFirst({
      where: { tenant_id: tenantId, deep_link: `/content/output/${outputId}` },
    });
    expect(notif).not.toBeNull();
    expect(notif?.type).toBe('content_draft_ready');
    expect(notif?.severity).toBe('high');
  });
});
