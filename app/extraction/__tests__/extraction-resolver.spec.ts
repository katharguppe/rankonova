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

    it("should fuzzy match conversational mention (Apollo for Apollo Hospitals)", () => {
      const client = { id: "client-1", brand_name: "Our Hospital", aliases: [] };
      const competitors = [
        { id: "comp-1", name: "Apollo Hospitals", aliases: ["Apollo", "Apollo Hospital"] }
      ];

      const result = service.resolve("Apollo", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should fuzzy match similar brand names (Apolo vs Apollo)", () => {
      const client = { id: "client-1", brand_name: "Our Hospital", aliases: [] };
      const competitors = [
        { id: "comp-1", name: "Apollo Hospitals", aliases: [] }
      ];

      const result = service.resolve("Apolo", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should fuzzy match CarDekho mention via partial name", () => {
      const client = { id: "client-1", brand_name: "Our Car Site", aliases: [] };
      const competitors = [
        { id: "comp-1", name: "CarDekho", aliases: ["CarDekho.com"] }
      ];

      const result = service.resolve("Dekho", client, competitors);

      // This should match via fuzzy because "Dekho" is part of "CarDekho"
      // But also might match via substring if suffix matching is added
      expect(result.competitor_id).toBe("comp-1");
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

  describe("conversational mentions (real-world cases)", () => {
    it("should match Apollo for Apollo Hospitals", () => {
      const client = { id: "client-1", brand_name: "Our Hospital", aliases: [] };
      const competitors = [{ id: "comp-1", name: "Apollo Hospitals", aliases: ["Apollo", "Apollo Hospital"] }];

      const result = service.resolve("Apollo", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should match Honda for Honda Cars", () => {
      const client = { id: "client-1", brand_name: "Nandi Toyota", aliases: [] };
      const competitors = [{ id: "comp-1", name: "Honda Motor", aliases: ["Honda"] }];

      const result = service.resolve("Honda", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should match Max for Max Healthcare", () => {
      const client = { id: "client-1", brand_name: "Our Hospital", aliases: [] };
      const competitors = [{ id: "comp-1", name: "Max Healthcare", aliases: ["Max Health", "Max"] }];

      const result = service.resolve("Max", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should match Infosys for Infosys BPO", () => {
      const client = { id: "client-1", brand_name: "Our Firm", aliases: [] };
      const competitors = [{ id: "comp-1", name: "Infosys BPO", aliases: ["Infosys", "Infosys Services"] }];

      const result = service.resolve("Infosys", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should match EY for Ernst & Young", () => {
      const client = { id: "client-1", brand_name: "Our Firm", aliases: [] };
      const competitors = [{ id: "comp-1", name: "EY", aliases: ["Ernst & Young"] }];

      const result = service.resolve("Ernst Young", client, competitors);

      // Should match via substring (Ernst & Young contains "Ernst Young" partially)
      // or via fuzzy if substring doesn't catch it
      expect(result.competitor_id).toBe("comp-1");
    });

    it("should match housing.com with Housing", () => {
      const client = { id: "client-1", brand_name: "Our Real Estate", aliases: [] };
      const competitors = [{ id: "comp-1", name: "Housing.com", aliases: ["Housing.com", "Housing"] }];

      const result = service.resolve("Housing", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });

    it("should match Naukri with just Naukri (exact)", () => {
      const client = { id: "client-1", brand_name: "Our Job Site", aliases: [] };
      const competitors = [{ id: "comp-1", name: "Naukri", aliases: ["Naukri.com", "Naukri"] }];

      const result = service.resolve("Naukri", client, competitors);

      expect(result.competitor_id).toBe("comp-1");
    });
  });

  describe("Levenshtein distance utility", () => {
    it("should calculate exact match distance as 0", () => {
      const distance = service["levenshteinDistance"]("CardDekho", "CardDekho");
      expect(distance).toBe(0);
    });

    it("should calculate single character difference", () => {
      const distance = service["levenshteinDistance"]("Car", "Bar");
      expect(distance).toBe(1);
    });

    it("should calculate transposition distance", () => {
      const distance = service["levenshteinDistance"]("Apollo", "Apolo");
      expect(distance).toBe(1);
    });

    it("should calculate partial word distance", () => {
      const distance = service["levenshteinDistance"]("Toyota", "Toy");
      expect(distance).toBe(3);
    });

    it("should handle empty strings", () => {
      const distance = service["levenshteinDistance"]("", "Car");
      expect(distance).toBe(3);
    });
  });
});
