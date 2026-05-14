import { Test, TestingModule } from "@nestjs/testing";
import { ExtractionResolverService } from "../extraction-resolver.service";

describe("ExtractionResolverService - Integration", () => {
  let service: ExtractionResolverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExtractionResolverService],
    }).compile();

    service = module.get<ExtractionResolverService>(ExtractionResolverService);
  });

  describe("critical paths", () => {
    it("should resolve real-world automotive brands", () => {
      const client = { id: "nandi-toyota", brand_name: "Nandi Toyota", aliases: ["Toyota Dealer"] };
      const competitors = [
        { id: "comp-cardekho", name: "CarDekho", aliases: ["CarDekho.com", "Car Dekho"] },
        { id: "comp-zigwheels", name: "ZigWheels", aliases: ["ZigWheels.com"] },
        { id: "comp-carwale", name: "CarWale", aliases: ["CarWale.com"] },
      ];

      const testCases = [
        { input: "Nandi Toyota", expectedClient: true, expectedCompetitor: null },
        { input: "Toyota Dealer", expectedClient: true, expectedCompetitor: null },
        { input: "CarDekho", expectedClient: false, expectedCompetitor: "comp-cardekho" },
        { input: "Car Dekho", expectedClient: false, expectedCompetitor: "comp-cardekho" },
        { input: "ZigWheels", expectedClient: false, expectedCompetitor: "comp-zigwheels" },
        { input: "CarWale.com", expectedClient: false, expectedCompetitor: "comp-carwale" },
        { input: "Unknown Brand", expectedClient: false, expectedCompetitor: null },
      ];

      for (const tc of testCases) {
        const result = service.resolve(tc.input, client, competitors);
        expect(result.is_client_brand).toBe(tc.expectedClient);
        expect(result.competitor_id).toBe(tc.expectedCompetitor);
      }
    });

    it("should resolve real-world real estate brands", () => {
      const client = { id: "nandi-realty", brand_name: "Nandi Realty", aliases: ["Nandi Properties"] };
      const competitors = [
        { id: "comp-99acres", name: "99acres", aliases: ["99acres.com", "99 Acres"] },
        { id: "comp-housing", name: "Housing.com", aliases: ["Housing", "Housing India"] },
        { id: "comp-magicbricks", name: "MagicBricks", aliases: ["MagicBricks.com"] },
      ];

      const result1 = service.resolve("Nandi Realty", client, competitors);
      expect(result1.is_client_brand).toBe(true);

      const result2 = service.resolve("99acres.com", client, competitors);
      expect(result2.competitor_id).toBe("comp-99acres");

      const result3 = service.resolve("Housing", client, competitors);
      expect(result3.competitor_id).toBe("comp-housing");

      const result4 = service.resolve("MagicBricks.com", client, competitors);
      expect(result4.competitor_id).toBe("comp-magicbricks");
    });

    it("should handle ambiguous mentions with exact matching preference", () => {
      const client = { id: "client-1", brand_name: "Apollo", aliases: [] };
      const competitors = [
        { id: "comp-apollo-h", name: "Apollo Hospitals", aliases: ["Apollo"] },
      ];

      const result = service.resolve("Apollo", client, competitors);

      expect(result.is_client_brand).toBe(true);
    });

    it("should handle partial name matches in extractio context", () => {
      const client = { id: "nandi-auto", brand_name: "Nandi Auto", aliases: [] };
      const competitors = [
        { id: "comp-autocar", name: "AutocarIndia", aliases: ["Autocar India", "Autocar"] },
      ];

      const result = service.resolve("Autocar", client, competitors);

      expect(result.competitor_id).toBe("comp-autocar");
    });

    it("should resolve mention in list correctly", () => {
      const client = { id: "client-1", brand_name: "Client Brand", aliases: [] };
      const competitors = [
        { id: "comp-1", name: "CarDekho", aliases: [] },
        { id: "comp-2", name: "ZigWheels", aliases: [] },
        { id: "comp-3", name: "CarWale", aliases: [] },
      ];

      const mentions = ["CarDekho", "ZigWheels", "Client Brand", "Unknown"];
      const resolved = mentions.map(m => service.resolve(m, client, competitors));

      expect(resolved[0].competitor_id).toBe("comp-1");
      expect(resolved[1].competitor_id).toBe("comp-2");
      expect(resolved[2].is_client_brand).toBe(true);
      expect(resolved[3].competitor_id).toBeNull();
    });

    it("should batch resolve multiple mentions with same competitors", () => {
      const client = { id: "client-1", brand_name: "My Brand", aliases: [] };
      const competitors = [
        { id: "comp-1", name: "Competitor A", aliases: ["Comp A"] },
        { id: "comp-2", name: "Competitor B", aliases: ["Comp B"] },
      ];

      const mentions = ["My Brand", "Competitor A", "Competitor B", "Comp A", "Comp B", "Unknown"];
      const results = mentions.map(m => service.resolve(m, client, competitors));

      expect(results).toHaveLength(6);
      expect(results.filter(r => r.is_client_brand)).toHaveLength(1);
      expect(results.filter(r => r.competitor_id !== null)).toHaveLength(4);
    });
  });
});
