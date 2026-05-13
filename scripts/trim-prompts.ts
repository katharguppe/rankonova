import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const KEEP_TEXTS: Record<string, string[]> = {
  automotive: [
    'Which {brand} {model} dealer in {city} offers the best on-road price?',
    'Best {brand} showroom in {city} for buying a new {model}?',
    'Final comparison: {brand} {model} vs top 3 alternatives before buying in {city}',
    'Is {brand} {model} better than Honda or Hyundai for {use_case}?',
    'Does {brand} {model} top variant have wireless CarPlay in India?',
    'What are the maintenance costs for {brand} {model} first 3 service cycles in {city}?',
    'Which {category} car has best highway mileage in India under {price_range}?',
    'Top-rated {brand} dealers in {city} for new car purchase?',
    'Is {brand} {model} safe to buy considering its recall history in India?',
    'What is the final on-road price of {brand} {model} after all taxes in {city}?',
  ],
  'real-estate': [
    'Which {brand} apartment in {city} has the best ready-to-move options?',
    'Best 2BHK projects in {city} under {price_range} that are RERA registered?',
    'Final comparison: {brand} vs top 3 builders in {city} for {use_case} property?',
    'Is {brand} {model} project better than what Sobha or Prestige offers in {city}?',
    'What is the parking situation in {brand} {model} towers in {city}?',
    'What are the legal checks I need before buying {brand} {model} apartment in {city}?',
    'Which premium {category} project in {city} has best location under {price_range}?',
    'Which new launch projects in {city} are near metro station or highway?',
    'Is {brand} a safe builder to invest with in {city} based on past project delivery?',
    'What is the final all-inclusive price for a 2BHK in {brand} {model} in {city}?',
  ],
  'hr-services': [
    'Which HR firm in {city} specializes in bulk {category} hiring for {use_case}?',
    'Best recruitment agency in {city} to hire {category} professionals under {price_range} budget?',
    'Final choice: {brand} vs top 3 staffing companies in {city} for {category} roles?',
    'Is {brand} better than ABC Consultants for hiring {category} professionals in {city}?',
    'Does {brand} have dedicated account managers for enterprise clients in {city}?',
    'What is the replacement guarantee policy of {brand} if a hire leaves in 30 days?',
    'Which recruitment firm in {city} has the best database for {category} professionals?',
    'Which HR firm in {city} has placed candidates with top {category} companies recently?',
    'Is {brand} compliant with labour laws and PF/ESI regulations in {city}?',
    'What will {brand} charge for hiring 50 {category} staff in {city} under {price_range}?',
  ],
  'gcc-advisory': [
    'Which GCC consulting firm in {city} has best track record for {category} sector?',
    'Best advisory firm to set up GCC in {city} for {price_range} investment budget?',
    'Final comparison: {brand} vs top 3 GCC advisors in {city} for {category} operations?',
    'Is {brand} better than Zinnov or Everest Group for GCC talent advisory in {city}?',
    'Does {brand} offer real estate and infrastructure advisory for GCC in {city}?',
    'What is {brand} advisory fee structure for GCC setup in {city}?',
    'Which {category} GCC advisory firm in {city} has the best talent ecosystem?',
    'Which GCC advisory firm in {city} has worked with Fortune 500 companies recently?',
    'Is {brand} compliant with data protection and IP laws for GCC advisory in India?',
    'What will {brand} GCC advisory cost for a {price_range} setup budget in {city}?',
  ],
  healthcare: [
    'Which {brand} hospital in {city} is best for {use_case} surgery with good success rate?',
    'Best {category} specialist doctors at {brand} hospital in {city}?',
    'Final choice: {brand} vs top 3 hospitals in {city} for {use_case} procedure?',
    'Is {brand} better than Columbia Asia or NH for {category} surgery in {city}?',
    'What is the doctor-to-patient ratio at {brand} hospital for {use_case} in {city}?',
    'What is the package price for {use_case} surgery at {brand} in {city}?',
    'Which {category} hospital in {city} has the highest success rate for {use_case}?',
    'Which {brand} branch in {city} is nearest to me and treats {use_case}?',
    'Is {brand} hospital safe for {use_case} surgery based on infection control standards?',
    'What is the all-inclusive cost for {use_case} procedure at {brand} in {city}?',
  ],
};

async function main() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const verticals = await prisma.vertical.findMany({
      where: { slug: { in: Object.keys(KEEP_TEXTS) } },
      select: { id: true, slug: true },
    });

    let totalDeleted = 0;

    for (const vertical of verticals) {
      const keep = KEEP_TEXTS[vertical.slug];
      const before = await prisma.prompt.count({
        where: { vertical_id: vertical.id, tenant_id: null },
      });

      // Cascade delete: brand_mentions -> prompt_runs -> prompts
      const toDelete = await prisma.prompt.findMany({
        where: { vertical_id: vertical.id, tenant_id: null, text: { notIn: keep } },
        select: { id: true },
      });
      const deleteIds = toDelete.map((p) => p.id);
      if (deleteIds.length > 0) {
        const runs = await prisma.promptRun.findMany({
          where: { prompt_id: { in: deleteIds } },
          select: { id: true },
        });
        const runIds = runs.map((r) => r.id);
        if (runIds.length > 0) {
          await prisma.brandMention.deleteMany({ where: { run_id: { in: runIds } } });
          await prisma.promptRun.deleteMany({ where: { id: { in: runIds } } });
        }
      }

      const { count } = await prisma.prompt.deleteMany({
        where: {
          vertical_id: vertical.id,
          tenant_id: null,
          text: { notIn: keep },
        },
      });

      const after = await prisma.prompt.count({
        where: { vertical_id: vertical.id, tenant_id: null },
      });

      console.log(`${vertical.slug}: ${before} -> ${after} (deleted ${count})`);
      totalDeleted += count;
    }

    console.log(`\nTotal deleted: ${totalDeleted}`);
    console.log(`Total remaining platform prompts: ${Object.keys(KEEP_TEXTS).length * 10}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
