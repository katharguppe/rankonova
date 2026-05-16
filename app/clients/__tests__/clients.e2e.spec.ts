/**
 * Clients E2E Integration Tests
 *
 * Tests the HTTP layer for ClientsController using NestJS TestingModule
 * with mocked PrismaService, JwtAuthGuard, and RolesGuard.
 * No real DB or JWT calls are made.
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as express from 'express';

import { ClientsController } from '../clients.controller';
import { ClientsService } from '../clients.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

const TENANT_A = 'tenant-e2e-clients-001';
const TENANT_B = 'tenant-e2e-clients-002';
const CLIENT_ID = 'client-e2e-001';

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makePrismaMock() {
  return {
    client: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

// JwtAuthGuard stub — injects tenantId from test header X-Test-Tenant
const jwtGuardStub = {
  canActivate: jest.fn((context) => {
    const req = context.switchToHttp().getRequest();
    const tenantId = req.headers['x-test-tenant'] ?? TENANT_A;
    req.user = {
      userId: 'user-e2e-001',
      tenantId,
      role: 'tenant_admin',
    };
    return true;
  }),
};

// RolesGuard stub — always allows
const rolesGuardStub = {
  canActivate: jest.fn(() => true),
};

// ---------------------------------------------------------------------------
// Module builder
// ---------------------------------------------------------------------------

interface TestContext {
  app: INestApplication;
  prismaMock: ReturnType<typeof makePrismaMock>;
}

async function buildApp(overrides: {
  prismaMock?: ReturnType<typeof makePrismaMock>;
} = {}): Promise<TestContext> {
  const prismaMock = overrides.prismaMock ?? makePrismaMock();

  const moduleRef = await Test.createTestingModule({
    controllers: [ClientsController],
    providers: [
      ClientsService,
      { provide: PrismaService, useValue: prismaMock },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(jwtGuardStub)
    .overrideGuard(RolesGuard)
    .useValue(rolesGuardStub)
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(express.json());
  await app.init();

  return { app, prismaMock };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Clients E2E', () => {
  describe('PATCH /clients/:id/profile (updateProfile)', () => {
    it('should update client profile with valid data and correct tenant', async () => {
      const profileData = {
        digital_handles: {
          linkedin: 'test-profile',
          twitter: '@testuser',
        },
        brand_description: 'Test brand description',
        brand_keywords: ['keyword1', 'keyword2'],
        competitors_known: ['Competitor A'],
      };

      const prismaMock = makePrismaMock();
      prismaMock.client.findFirst.mockResolvedValue({
        id: CLIENT_ID,
        tenant_id: TENANT_A,
        deleted_at: null,
      });
      prismaMock.client.update.mockResolvedValue({
        id: CLIENT_ID,
        tenant_id: TENANT_A,
        vertical_id: 'vert-1',
        name: 'E2E Client',
        brand_name: 'E2E Brand',
        aliases: [],
        city: 'Bangalore',
        state: 'Karnataka',
        website_url: 'https://example.com',
        description: 'Test',
        models: {},
        is_active: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        digital_handles: profileData.digital_handles,
        brand_description: profileData.brand_description,
        brand_keywords: profileData.brand_keywords,
        competitors_known: profileData.competitors_known,
      });

      const { app } = await buildApp({ prismaMock });

      const response = await request(app.getHttpServer())
        .patch(`/clients/${CLIENT_ID}/profile`)
        .set('x-test-tenant', TENANT_A)
        .send(profileData);

      expect(response.status).toBe(200);
      expect(response.body.digital_handles).toEqual(profileData.digital_handles);
      expect(response.body.brand_description).toEqual(profileData.brand_description);
      expect(response.body.brand_keywords).toEqual(profileData.brand_keywords);
      expect(response.body.competitors_known).toEqual(profileData.competitors_known);

      await app.close();
    });

    it('should return 404 when updating profile for client in different tenant', async () => {
      // Client belongs to TENANT_A; request comes in as TENANT_B
      const prismaMock = makePrismaMock();
      // findFirst returns null because tenant_id does not match
      prismaMock.client.findFirst.mockResolvedValue(null);

      const { app } = await buildApp({ prismaMock });

      const response = await request(app.getHttpServer())
        .patch(`/clients/${CLIENT_ID}/profile`)
        .set('x-test-tenant', TENANT_B)
        .send({ brand_description: 'Hacker attempt' });

      // Service throws NotFoundException (404) when client not found for tenant
      expect(response.status).toBe(404);

      await app.close();
    });
  });
});
