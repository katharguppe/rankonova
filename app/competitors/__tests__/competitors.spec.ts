import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CompetitorsService } from "../competitors.service";
import { getBaselineCompetitorsForVertical } from "../seed/competitors.seed";

jest.mock("../seed/competitors.seed");

describe("CompetitorsService", () => {
  let service: CompetitorsService;
  let prisma: PrismaService;
  const tenantId = "tenant-1";
  const verticalId = "vertical-1";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompetitorsService,
        {
          provide: PrismaService,
          useValue: {
            vertical: {
              findFirst: jest.fn(),
            },
            competitor: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CompetitorsService>(CompetitorsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe("create", () => {
    it("should create a competitor with valid data", async () => {
      (prisma.vertical.findFirst as jest.Mock).mockResolvedValue({ id: verticalId, is_active: true, slug: "automotive" });
      (prisma.competitor.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.competitor.count as jest.Mock).mockResolvedValue(0);
      (prisma.competitor.create as jest.Mock).mockResolvedValue({
        id: "comp-1",
        name: "CarDekho",
        aliases: ["CarDekho.com"],
        website_url: "https://cardekho.com",
        is_active: true,
        tenant_id: tenantId,
        vertical_id: verticalId,
      });

      const result = await service.create(tenantId, verticalId, "CarDekho", ["CarDekho.com"], "https://cardekho.com");
      
      expect(result.id).toBe("comp-1");
      expect(result.name).toBe("CarDekho");
      expect(prisma.competitor.create).toHaveBeenCalled();
    });

    it("should throw BadRequestException if name is empty", async () => {
      await expect(service.create(tenantId, verticalId, "", [])).rejects.toThrow(BadRequestException);
      await expect(service.create(tenantId, verticalId, "  ", [])).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if vertical not found", async () => {
      (prisma.vertical.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.create(tenantId, verticalId, "CarDekho")).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException if competitor already exists", async () => {
      (prisma.vertical.findFirst as jest.Mock).mockResolvedValue({ id: verticalId, is_active: true });
      (prisma.competitor.findFirst as jest.Mock).mockResolvedValue({ id: "comp-1", name: "CarDekho" });
      
      await expect(service.create(tenantId, verticalId, "CarDekho")).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException if max competitors reached", async () => {
      (prisma.vertical.findFirst as jest.Mock).mockResolvedValue({ id: verticalId, is_active: true });
      (prisma.competitor.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.competitor.count as jest.Mock).mockResolvedValue(10);
      
      await expect(service.create(tenantId, verticalId, "CarDekho")).rejects.toThrow(ConflictException);
    });
  });

  describe("list", () => {
    it("should list all active competitors for tenant", async () => {
      const competitors = [
        { id: "comp-1", name: "CarDekho", is_active: true },
        { id: "comp-2", name: "ZigWheels", is_active: true },
      ];
      (prisma.competitor.findMany as jest.Mock).mockResolvedValue(competitors);

      const result = await service.list(tenantId);
      
      expect(result).toEqual(competitors);
      expect(prisma.competitor.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId, is_active: true },
        orderBy: { name: "asc" },
      });
    });

    it("should filter by vertical", async () => {
      const competitors = [{ id: "comp-1", name: "CarDekho", is_active: true }];
      (prisma.competitor.findMany as jest.Mock).mockResolvedValue(competitors);

      await service.list(tenantId, verticalId);

      expect(prisma.competitor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ vertical_id: verticalId }),
        })
      );
    });

    it("should include inactive competitors if requested", async () => {
      (prisma.competitor.findMany as jest.Mock).mockResolvedValue([]);

      await service.list(tenantId, undefined, false);

      expect(prisma.competitor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_active: false }),
        })
      );
    });
  });

  describe("update", () => {
    it("should update a competitor", async () => {
      const competitorId = "comp-1";
      (prisma.competitor.findFirst as jest.Mock).mockResolvedValue({ id: competitorId, tenant_id: tenantId });
      (prisma.competitor.update as jest.Mock).mockResolvedValue({ id: competitorId, name: "Updated Name" });

      await service.update(competitorId, tenantId, { name: "Updated Name" });

      expect(prisma.competitor.update).toHaveBeenCalledWith({
        where: { id: competitorId },
        data: { name: "Updated Name" },
      });
    });

    it("should throw ForbiddenException if competitor not owned by tenant", async () => {
      (prisma.competitor.findFirst as jest.Mock).mockResolvedValue(null);
      
      await expect(service.update("comp-1", tenantId, { name: "Updated" })).rejects.toThrow(ForbiddenException);
    });
  });

  describe("delete", () => {
    it("should soft-delete a competitor", async () => {
      const competitorId = "comp-1";
      (prisma.competitor.findFirst as jest.Mock).mockResolvedValue({ id: competitorId, tenant_id: tenantId });
      (prisma.competitor.update as jest.Mock).mockResolvedValue({ id: competitorId, is_active: false });

      await service.delete(competitorId, tenantId);

      expect(prisma.competitor.update).toHaveBeenCalledWith({
        where: { id: competitorId },
        data: { is_active: false },
      });
    });

    it("should throw ForbiddenException if competitor not owned by tenant", async () => {
      (prisma.competitor.findFirst as jest.Mock).mockResolvedValue(null);
      
      await expect(service.delete("comp-1", tenantId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("seed", () => {
    it("should seed baseline competitors for a vertical", async () => {
      const baselineCompetitors = [
        { name: "CarDekho", aliases: ["CarDekho.com"], websiteUrl: "https://cardekho.com" },
        { name: "ZigWheels", aliases: ["ZigWheels.com"], websiteUrl: "https://zigwheels.com" },
      ];
      
      (prisma.vertical.findFirst as jest.Mock).mockResolvedValue({ id: verticalId, slug: "automotive", is_active: true });
      (prisma.competitor.count as jest.Mock).mockResolvedValue(0);
      (getBaselineCompetitorsForVertical as jest.Mock).mockReturnValue(baselineCompetitors);
      (prisma.competitor.create as jest.Mock)
        .mockResolvedValueOnce({ id: "comp-1", ...baselineCompetitors[0], tenant_id: tenantId })
        .mockResolvedValueOnce({ id: "comp-2", ...baselineCompetitors[1], tenant_id: tenantId });

      const result = await service.seed(tenantId, verticalId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("CarDekho");
      expect(prisma.competitor.create).toHaveBeenCalledTimes(2);
    });

    it("should be idempotent: skip if already has 10+ competitors", async () => {
      (prisma.vertical.findFirst as jest.Mock).mockResolvedValue({ id: verticalId, is_active: true });
      (prisma.competitor.count as jest.Mock).mockResolvedValue(10);

      const result = await service.seed(tenantId, verticalId);

      expect(result).toHaveLength(0);
      expect(prisma.competitor.create).not.toHaveBeenCalled();
    });

    it("should continue on partial failure", async () => {
      const baselineCompetitors = [
        { name: "CarDekho", aliases: ["CarDekho.com"] },
        { name: "ZigWheels", aliases: ["ZigWheels.com"] },
      ];
      
      (prisma.vertical.findFirst as jest.Mock).mockResolvedValue({ id: verticalId, is_active: true });
      (prisma.competitor.count as jest.Mock).mockResolvedValue(0);
      (getBaselineCompetitorsForVertical as jest.Mock).mockReturnValue(baselineCompetitors);
      (prisma.competitor.create as jest.Mock)
        .mockResolvedValueOnce({ id: "comp-1", ...baselineCompetitors[0] })
        .mockRejectedValueOnce(new Error("Duplicate"));

      const result = await service.seed(tenantId, verticalId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("CarDekho");
    });
  });
});
