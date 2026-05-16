import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from '../clients.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ClientsService', () => {
  let service: ClientsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    client: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateClientProfile', () => {
    it('should update all profile fields successfully', async () => {
      const clientId = 'test-client-id';
      const tenantId = 'test-tenant-id';
      const profileData = {
        digital_handles: {
          linkedin: 'john-doe',
          twitter: '@johndoe',
        },
        brand_description: 'A leading automotive dealer',
        brand_keywords: ['cars', 'dealers', 'bangalore'],
        competitors_known: ['Competitor A', 'Competitor B'],
      };

      jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue({
        id: clientId,
        tenant_id: tenantId,
        vertical_id: 'vert-1',
        name: 'Test Client',
        brand_name: 'Test Brand',
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
        digital_handles: null,
        brand_description: null,
        brand_keywords: null,
        competitors_known: null,
      });

      jest.spyOn(prismaService.client, 'update').mockResolvedValue({
        id: clientId,
        tenant_id: tenantId,
        vertical_id: 'vert-1',
        name: 'Test Client',
        brand_name: 'Test Brand',
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

      const result = await service.updateClientProfile(
        clientId,
        tenantId,
        profileData,
      );

      expect(result.digital_handles).toEqual(profileData.digital_handles);
      expect(result.brand_description).toEqual(profileData.brand_description);
      expect(result.brand_keywords).toEqual(profileData.brand_keywords);
      expect(result.competitors_known).toEqual(profileData.competitors_known);
    });

    it('should update only provided fields (partial update)', async () => {
      const clientId = 'test-client-id';
      const tenantId = 'test-tenant-id';
      const profileData = {
        brand_description: 'Updated description',
      };

      jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue({
        id: clientId,
        tenant_id: tenantId,
        vertical_id: 'vert-1',
        name: 'Test Client',
        brand_name: 'Test Brand',
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
        digital_handles: null,
        brand_description: null,
        brand_keywords: null,
        competitors_known: null,
      });

      jest.spyOn(prismaService.client, 'update').mockResolvedValue({
        id: clientId,
        tenant_id: tenantId,
        vertical_id: 'vert-1',
        name: 'Test Client',
        brand_name: 'Test Brand',
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
        digital_handles: null,
        brand_description: 'Updated description',
        brand_keywords: null,
        competitors_known: null,
      });

      const result = await service.updateClientProfile(
        clientId,
        tenantId,
        profileData,
      );

      expect(result.brand_description).toEqual('Updated description');
      expect(result.digital_handles).toBeNull();
    });

    it('should throw NotFoundException when client not found', async () => {
      const clientId = 'nonexistent-id';
      const tenantId = 'test-tenant-id';

      jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue(null);

      await expect(
        service.updateClientProfile(clientId, tenantId, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when client belongs to different tenant', async () => {
      const clientId = 'test-client-id';
      const tenantId = 'wrong-tenant-id';

      jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue(null);

      await expect(
        service.updateClientProfile(clientId, tenantId, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should accept empty profile data (no updates)', async () => {
      const clientId = 'test-client-id';
      const tenantId = 'test-tenant-id';

      jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue({
        id: clientId,
        tenant_id: tenantId,
        vertical_id: 'vert-1',
        name: 'Test Client',
        brand_name: 'Test Brand',
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
        digital_handles: null,
        brand_description: null,
        brand_keywords: null,
        competitors_known: null,
      });

      jest.spyOn(prismaService.client, 'update').mockResolvedValue({
        id: clientId,
        tenant_id: tenantId,
        vertical_id: 'vert-1',
        name: 'Test Client',
        brand_name: 'Test Brand',
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
        digital_handles: null,
        brand_description: null,
        brand_keywords: null,
        competitors_known: null,
      });

      const result = await service.updateClientProfile(clientId, tenantId, {});

      expect(result.id).toEqual(clientId);
      expect(prismaService.client.update).toHaveBeenCalled();
    });

    it('should call prisma.client.update with correct data structure', async () => {
      const clientId = 'test-client-id';
      const tenantId = 'test-tenant-id';
      const profileData = {
        brand_keywords: ['keyword1', 'keyword2'],
      };

      jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue({
        id: clientId,
        tenant_id: tenantId,
        vertical_id: 'vert-1',
        name: 'Test Client',
        brand_name: 'Test Brand',
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
        digital_handles: null,
        brand_description: null,
        brand_keywords: null,
        competitors_known: null,
      });

      const updateSpy = jest
        .spyOn(prismaService.client, 'update')
        .mockResolvedValue({
          id: clientId,
          tenant_id: tenantId,
          vertical_id: 'vert-1',
          name: 'Test Client',
          brand_name: 'Test Brand',
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
          digital_handles: null,
          brand_description: null,
          brand_keywords: profileData.brand_keywords,
          competitors_known: null,
        });

      await service.updateClientProfile(clientId, tenantId, profileData);

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: clientId },
        data: expect.objectContaining({
          brand_keywords: profileData.brand_keywords,
        }),
        select: expect.objectContaining({
          id: true,
          brand_keywords: true,
        }),
      });
    });
  });
});
