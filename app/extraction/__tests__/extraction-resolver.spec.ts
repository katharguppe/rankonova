import { Test, TestingModule } from "@nestjs/testing";
import { ExtractionResolverService } from "../extraction-resolver.service";

describe("ExtractionResolverService", () => {
  let service: ExtractionResolverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExtractionResolverService],
    }).compile();

    service = module.get<ExtractionResolverService>(ExtractionResolverService);
  });

  describe("resolve", () => {
    it("should return client brand on exact match", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho", aliases: [] }];

      const result = service.resolve("Nandi Toyota", client, competitors);

      expect(result.is_client_brand).toBe(true);
      expect(result.competitor_id).toBeNull();
    });

    it("should return competitor on exact match", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho", aliases: [] }];

      const result = service.resolve("CarDekho", client, competitors);

      expect(result.is_client_brand).toBe(false);
      expect(result.competitor_id).toBe("comp-1");
    });

    it("should match case-insensitively", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho", aliases: [] }];

      const result = service.resolve("cardekho", client, competitors);

      expect(result.is_client_brand).toBe(false);
      expect(result.competitor_id).toBe("comp-1");
    });

    it("should match against aliases", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho", aliases: ["CarDekho.com", "CarDekho India"] }];

      const result = service.resolve("CarDekho.com", client, competitors);

      expect(result.is_client_brand).toBe(false);
      expect(result.competitor_id).toBe("comp-1");
    });

    it("should use substring match when exact match fails", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho", aliases: [] }];

      const result = service.resolve("Car", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should use substring match for term containing search string", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho Auto", aliases: [] }];

      const result = service.resolve("CarDekho", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should use partial match as fallback", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho", aliases: [] }];

      const result = service.resolve("Car", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should prefer client brand on match", () => {
      const client = { id: "client-1", brand_name: "CarDekho", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho Auto", aliases: [] }];

      const result = service.resolve("CarDekho", client, competitors);

      expect(result.is_client_brand).toBe(true);
      expect(result.competitor_id).toBeNull();
    });

    it("should return null competitor on no match", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho", aliases: [] }];

      const result = service.resolve("ZigWheels", client, competitors);

      expect(result.is_client_brand).toBe(false);
      expect(result.competitor_id).toBeNull();
    });

    it("should handle whitespace in brand names", () => {
      const client = { id: "client-1", brand_name: "  Nandi Toyota  ", aliases: [] };
      const competitors: { id: string; name: string; aliases: unknown }[] = [];

      const result = service.resolve("  nandi toyota  ", client, competitors);

      expect(result.is_client_brand).toBe(true);
    });

    it("should prioritize exact match over substring", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [
        { id: "comp-1", name: "CarDekho", aliases: [] },
        { id: "comp-2", name: "Car", aliases: [] },
      ];

      const result = service.resolve("Car", client, competitors);

      expect(result.competitor_id).toBe("comp-2");
    });

    it("should handle invalid aliases gracefully", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: null };
      const competitors = [{ id: "comp-1", name: "CarDekho", aliases: "not-an-array" }];

      const result = service.resolve("CarDekho", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should prioritize exact match over substring", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [
        { id: "comp-1", name: "CarDekho", aliases: [] },
        { id: "comp-2", name: "Car", aliases: [] },
      ];

      const result = service.resolve("Car", client, competitors);

      expect(result.competitor_id).toBe("comp-2");
    });
  });

  describe("hierarchical matching", () => {
    it("should do exact match first", () => {
      const client = { id: "client-1", brand_name: "Honda", aliases: ["Honda India"] };
      const competitors = [{ id: "comp-1", name: "Car", aliases: ["Honda Dealership"] }];

      const result = service.resolve("Honda", client, competitors);

      expect(result.is_client_brand).toBe(true);
    });

    it("should do substring match second", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho India", aliases: [] }];

      const result = service.resolve("CarDekho", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should do partial match third", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho", aliases: [] }];

      const result = service.resolve("Car", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should match via substring even with short strings", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "CarDekho", aliases: [] }];

      const result = service.resolve("Ca", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });
  });
});
