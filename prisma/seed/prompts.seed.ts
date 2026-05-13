import { BuyerStage, IntentType, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

type PromptSeed = {
  text: string;
  category: string;
  intent_type: IntentType;
  buyer_stage: BuyerStage;
  priority: number;
};

// ─── Automotive (10 prompts) ──────────────────────────────────────────────────

const AUTOMOTIVE: PromptSeed[] = [
  { text: 'Which {brand} {model} dealer in {city} offers the best on-road price?', category: 'dealer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Best {brand} showroom in {city} for buying a new {model}?', category: 'dealer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Final comparison: {brand} {model} vs top 3 alternatives before buying in {city}', category: 'variant_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} {model} better than Honda or Hyundai for {use_case}?', category: 'variant_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Does {brand} {model} top variant have wireless CarPlay in India?', category: 'variant_comparison', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What are the maintenance costs for {brand} {model} first 3 service cycles in {city}?', category: 'service_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Which {category} car has best highway mileage in India under {price_range}?', category: 'segment_discovery', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Top-rated {brand} dealers in {city} for new car purchase?', category: 'dealer_discovery', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} {model} safe to buy considering its recall history in India?', category: 'brand_trust', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What is the final on-road price of {brand} {model} after all taxes in {city}?', category: 'price_comparison', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 10 },
];

// ─── Real Estate (10 prompts) ─────────────────────────────────────────────────

const REAL_ESTATE: PromptSeed[] = [
  { text: 'Which {brand} apartment in {city} has the best ready-to-move options?', category: 'developer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Best 2BHK projects in {city} under {price_range} that are RERA registered?', category: 'property_search', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Final comparison: {brand} vs top 3 builders in {city} for {use_case} property?', category: 'developer_discovery', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} {model} project better than what Sobha or Prestige offers in {city}?', category: 'developer_discovery', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the parking situation in {brand} {model} towers in {city}?', category: 'property_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What are the legal checks I need before buying {brand} {model} apartment in {city}?', category: 'legal_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Which premium {category} project in {city} has best location under {price_range}?', category: 'property_search', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Which new launch projects in {city} are near metro station or highway?', category: 'property_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} a safe builder to invest with in {city} based on past project delivery?', category: 'developer_discovery', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What is the final all-inclusive price for a 2BHK in {brand} {model} in {city}?', category: 'valuation', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 10 },
];

// ─── HR Services (10 prompts) ─────────────────────────────────────────────────

const HR_SERVICES: PromptSeed[] = [
  { text: 'Which HR firm in {city} specializes in bulk {category} hiring for {use_case}?', category: 'staffing_vendor', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Best recruitment agency in {city} to hire {category} professionals under {price_range} budget?', category: 'staffing_vendor', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Final choice: {brand} vs top 3 staffing companies in {city} for {category} roles?', category: 'staffing_vendor', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} better than ABC Consultants for hiring {category} professionals in {city}?', category: 'staffing_vendor', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Does {brand} have dedicated account managers for enterprise clients in {city}?', category: 'hr_consulting', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What is the replacement guarantee policy of {brand} if a hire leaves in 30 days?', category: 'staffing_vendor', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Which recruitment firm in {city} has the best database for {category} professionals?', category: 'staffing_vendor', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Which HR firm in {city} has placed candidates with top {category} companies recently?', category: 'staffing_vendor', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} compliant with labour laws and PF/ESI regulations in {city}?', category: 'staffing_vendor', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What will {brand} charge for hiring 50 {category} staff in {city} under {price_range}?', category: 'hr_consulting', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 10 },
];

// ─── GCC Advisory (10 prompts) ────────────────────────────────────────────────

const GCC_ADVISORY: PromptSeed[] = [
  { text: 'Which GCC consulting firm in {city} has best track record for {category} sector?', category: 'gcc_setup', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Best advisory firm to set up GCC in {city} for {price_range} investment budget?', category: 'gcc_setup', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Final comparison: {brand} vs top 3 GCC advisors in {city} for {category} operations?', category: 'gcc_setup', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} better than Zinnov or Everest Group for GCC talent advisory in {city}?', category: 'talent_advisory', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Does {brand} offer real estate and infrastructure advisory for GCC in {city}?', category: 'infrastructure_advisory', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What is {brand} advisory fee structure for GCC setup in {city}?', category: 'gcc_setup', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Which {category} GCC advisory firm in {city} has the best talent ecosystem?', category: 'talent_advisory', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Which GCC advisory firm in {city} has worked with Fortune 500 companies recently?', category: 'gcc_setup', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} compliant with data protection and IP laws for GCC advisory in India?', category: 'compliance_query', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What will {brand} GCC advisory cost for a {price_range} setup budget in {city}?', category: 'cost_benchmarking', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 10 },
];

// ─── Healthcare (10 prompts) ──────────────────────────────────────────────────

const HEALTHCARE: PromptSeed[] = [
  { text: 'Which {brand} hospital in {city} is best for {use_case} surgery with good success rate?', category: 'hospital_search', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Best {category} specialist doctors at {brand} hospital in {city}?', category: 'doctor_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Final choice: {brand} vs top 3 hospitals in {city} for {use_case} procedure?', category: 'treatment_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} better than Columbia Asia or NH for {category} surgery in {city}?', category: 'treatment_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the doctor-to-patient ratio at {brand} hospital for {use_case} in {city}?', category: 'hospital_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What is the package price for {use_case} surgery at {brand} in {city}?', category: 'cost_inquiry', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Which {category} hospital in {city} has the highest success rate for {use_case}?', category: 'hospital_search', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Which {brand} branch in {city} is nearest to me and treats {use_case}?', category: 'hospital_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} hospital safe for {use_case} surgery based on infection control standards?', category: 'hospital_search', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What is the all-inclusive cost for {use_case} procedure at {brand} in {city}?', category: 'cost_inquiry', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 10 },
];

export async function seedPrompts(prisma: PrismaClient) {
  const verticals = await prisma.vertical.findMany({
    where: { slug: { in: ['automotive', 'real-estate', 'hr-services', 'gcc-advisory', 'healthcare'] } },
    select: { id: true, slug: true },
  });

  const verticalIdBySlug = Object.fromEntries(verticals.map((v) => [v.slug, v.id]));

  const SEED_MAP: [string, PromptSeed[]][] = [
    ['automotive', AUTOMOTIVE],
    ['real-estate', REAL_ESTATE],
    ['hr-services', HR_SERVICES],
    ['gcc-advisory', GCC_ADVISORY],
    ['healthcare', HEALTHCARE],
  ];

  // Backfill: prompts seeded before vertical_id was added land with vertical_id=null.
  // Detect and repair by matching exact text — safe regardless of insertion order.
  const nullVerticalCount = await prisma.prompt.count({
    where: { tenant_id: null, vertical_id: null },
  });

  if (nullVerticalCount > 0) {
    console.log(`  Backfilling vertical_id on ${nullVerticalCount} platform prompts with null vertical...`);
    let fixed = 0;
    for (const [slug, seeds] of SEED_MAP) {
      const verticalId = verticalIdBySlug[slug];
      if (!verticalId) {
        console.warn(`  Vertical '${slug}' not found — skipping backfill`);
        continue;
      }
      for (const s of seeds) {
        const { count } = await prisma.prompt.updateMany({
          where: { text: s.text, tenant_id: null, vertical_id: null },
          data: { vertical_id: verticalId },
        });
        fixed += count;
      }
    }
    console.log(`  Backfilled ${fixed} prompts`);
    return;
  }

  const existing = await prisma.prompt.count({ where: { tenant_id: null } });
  if (existing >= 50) {
    console.log('  Platform prompts already seeded, skipping');
    return;
  }

  let total = 0;
  for (const [slug, seeds] of SEED_MAP) {
    const verticalId = verticalIdBySlug[slug];
    if (!verticalId) {
      console.warn(`  Vertical '${slug}' not found — skipping its prompts`);
      continue;
    }

    const { count } = await prisma.prompt.createMany({
      data: seeds.map((s) => ({
        text: s.text,
        category: s.category,
        intent_type: s.intent_type,
        buyer_stage: s.buyer_stage,
        priority: s.priority,
        vertical_id: verticalId,
        tenant_id: null,
        is_custom: false,
        is_active: true,
      })),
      skipDuplicates: false,
    });

    total += count;
    console.log(`  Seeded ${count} prompts for ${slug}`);
  }

  console.log(`  Total platform prompts created: ${total}`);
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  seedPrompts(prisma)
    .then(() => prisma.$disconnect())
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect().finally(() => process.exit(1));
    });
}
