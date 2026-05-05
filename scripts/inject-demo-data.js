/**
 * inject-demo-data.js
 * Injects realistic presentation data for Sir's demo:
 *   1. Updates the latest GapReport for the stress client (snake_case JSONB keys)
 *   2. Inserts 3 PR signals (draft / approved / distributed)
 *
 * Run: node scripts/inject-demo-data.js
 */

const { Pool } = require('pg');
require('dotenv').config({ override: true });

const CLIENT_ID = 'cmonwtk9r00002ku9q59ge1h4';

// ── CUID-lite: deterministic demo IDs ────────────────────────────────────────
const PR_IDS = [
  'cmsdemo0ev0001000000000000',
  'cmsdemo0sf0002000000000000',
  'cmsdemo0fs0003000000000000',
];

// ── Gap report payload ────────────────────────────────────────────────────────

const PLAIN_ENGLISH_SUMMARY = `
StressClient's AEO audit reveals three critical gaps that are suppressing AI citation rates across
Perplexity, ChatGPT, and Google AI Overviews in the Automotive vertical.

The most urgent gap is the complete absence of FAQPage schema markup. Competitor profiles on CarDekho
and ZigWheels serve structured FAQ pairs that AI engines extract and cite verbatim. StressClient has
no FAQ schema on any crawled page, meaning every comparison and advisory query that surfaces a
competitor answer fails to surface StressClient's content. This single fix is projected to deliver a
25–35% citation rate lift within four to six weeks.

The second gap is a weak aggregator presence. CarDekho completeness is scored at 33%, with missing
fields in service categories, certified technician count, EMI calculator link, and customer video
testimonials. ZigWheels shows a similar pattern. AI models that power automotive queries frequently
pull dealer facts from these aggregator profiles; incomplete profiles mean the brand is ranked lower
in AI-generated shortlists.

Third, StressClient has no Wikidata entity. Google Knowledge Graph, Wikipedia notability checks,
and Wikidata SPARQL queries all return null for the brand. Without an entity, AI engines cannot
attribute factual brand claims (founding year, location, certifications) directly, suppressing
citation confidence. Establishing a Wikidata Q-item with correct P-claims takes under one hour and
unlocks entity recognition across all major AI engines.

Off-site signals compound the problem: community presence is 20%, PR coverage is 5%, and review
volume gap stands at 70. Addressing the schema and aggregator gaps first will yield the fastest
measurable improvement before the next quarterly AEO review.
`.trim();

const ON_SITE_GAPS = {
  missing_schema_types: ['FAQPage', 'Review', 'LocalBusiness'],
  faq_coverage_score: 0.35,   // displayed as pct → 35%
  freshness_gap: 45,           // displayed as score → 45.0 days
  entity_density_gap: 60,      // displayed as score → 60.0
  internal_link_gap: 40,       // displayed as score → 40.0
};

const OFF_SITE_GAPS = {
  aggregator_presence: 0.33,   // pct → 33%
  review_volume_gap: 70,       // score → 70.0
  community_presence: 0.20,    // pct → 20%
  entity_recognition: 0.10,    // pct → 10%
  pr_coverage: 0.05,           // pct → 5%
};

const RECOMMENDED_ACTIONS = [
  {
    action: 'Add FAQPage schema markup to your top 10 product and service pages. AI engines extract FAQ pairs directly and cite structured answers at 3× the rate of unstructured content.',
    estimated_impact: 'Estimated 25–35% increase in AI citation rate within 4–6 weeks of deployment',
    priority: 'high',
  },
  {
    action: 'Complete your CarDekho and ZigWheels dealer profiles. Fill all missing fields: dealership hours, certified service categories, EMI calculator link, and customer video testimonials.',
    estimated_impact: 'Aggregator presence score projected to improve from 33% to 65%+ with fully completed profiles',
    priority: 'high',
  },
  {
    action: 'Create a Wikidata entity (Q-item) for StressClient with P31 (automotive dealer), P17 (India), P131 (city), and P856 (website). Add at least 3 Wikipedia-linkable references.',
    estimated_impact: 'Entity recognition rises from 10% to 60%+, enabling AI engines to attribute brand facts directly in citation answers',
    priority: 'high',
  },
  {
    action: 'Add Review schema markup to 5 key pages and respond within 7 days to the 12 unaddressed negative reviews on ZigWheels and CarDekho.',
    estimated_impact: 'Review trust signals improve ranking in Perplexity and ChatGPT comparison queries by an estimated 15–20%',
    priority: 'medium',
  },
  {
    action: 'Publish 3 FAQ-led blog posts targeting: EV charging in your city, festive season financing options, and Maruti vs Hyundai comparison — the top 3 unanswered intents in the Automotive vertical.',
    estimated_impact: 'Content freshness gap narrows from 45 days to under 10 days; projected 15% citation lift in Q3',
    priority: 'low',
  },
];

// ── PR signal payloads ────────────────────────────────────────────────────────

const DISTRIBUTION_AUTOMOTIVE = [
  { outlet: 'Autocar India',    journalist: 'Editorial Desk', contact: 'editorial@autocarindia.com', wire_service: false },
  { outlet: 'NDTV Auto',        journalist: 'Auto Desk',      contact: 'auto@ndtv.com',              wire_service: false },
  { outlet: 'MotorBeam',        journalist: 'News Desk',      contact: 'news@motorbeam.com',         wire_service: false },
  { outlet: 'CarWale',          journalist: 'Content Team',   contact: 'content@carwale.com',        wire_service: false },
  { outlet: 'PRNewswire India', journalist: null,             contact: 'indiasales@prnewswire.com',  wire_service: true  },
  { outlet: 'BusinessWire India',journalist: null,            contact: 'info@businesswireindia.com', wire_service: true  },
  { outlet: 'PRLog India',      journalist: null,             contact: 'support@prlog.org',          wire_service: true  },
];

const PR_SIGNALS = [
  {
    id: PR_IDS[0],
    news_title: 'India Plans 10,000 Public EV Charging Stations in Tier-2 and Tier-3 Cities by 2026',
    news_url:   'https://auto.ndtv.com/news/india-plans-10000-ev-charging-stations-tier2-cities-2026-7234156',
    news_source: 'auto.ndtv.com',
    published_at: new Date('2026-05-04T08:30:00Z'),
    relevance_score: 0.82,
    status: 'draft',
    approved_at: null,
    pr_angle:
      'The government\'s EV charging expansion into Tier-2 cities creates an immediate credibility opportunity for StressClient. ' +
      'As one of the region\'s largest multi-brand dealers, StressClient can position itself as the first certified EV-ready service centre, ' +
      'announcing parallel investments in on-site AC chargers and trained EV technicians. This positions the brand ahead of the infrastructure wave, ' +
      'not behind it, and generates earned media in a news cycle that will run for six to twelve months.',
    press_release_draft:
      `FOR IMMEDIATE RELEASE

StressClient Announces EV-Ready Service Bay Ahead of Government's Tier-2 Charging Rollout

[CITY], [DATE] — As the Ministry of Heavy Industries accelerates its plan to deploy 10,000 public EV charging stations across Tier-2 and Tier-3 cities by end-2026, StressClient today announced the commissioning of three 22 kW AC charging bays at its flagship showroom, becoming the first multi-brand dealership in [CITY] to offer in-house EV charging for customers.

"EV adoption is no longer a metro story," said [Spokesperson Name], General Manager, StressClient. "Our customers have been asking about charging infrastructure for over a year. We are not waiting for public stations — we are making it available at our doorstep today."

The newly installed Tata Power EZ Charge bays are compatible with all BEV and PHEV models currently on sale in India. Customers bringing their vehicles in for service can charge at zero cost during the service window.

StressClient also confirmed the enrolment of six senior technicians in Maruti Suzuki's certified EV service programme, with completion expected by Q3 2026.

About StressClient: [Company description]

Media Contact: [Name] | [Email] | [Phone]`,
    distribution_checklist: DISTRIBUTION_AUTOMOTIVE,
  },
  {
    id: PR_IDS[1],
    news_title: 'New BIS Safety Standards Mandate ABS and Dual Airbags for All Sub-4M Passenger Vehicles',
    news_url:   'https://www.autocarindia.com/car-news/bis-safety-standards-abs-dual-airbags-sub-4m-segment-april-2026-419872',
    news_source: 'autocarindia.com',
    published_at: new Date('2026-05-02T10:00:00Z'),
    relevance_score: 0.74,
    status: 'approved',
    approved_at: new Date('2026-05-03T09:15:00Z'),
    pr_angle:
      'New BIS safety mandates give StressClient a compliance-first narrative to push with first-time buyers comparing entry-level hatchbacks. ' +
      'A press release highlighting that all StressClient inventory already meets the new standards — and that the dealership offers free safety audits for pre-standard vehicles — ' +
      'positions the brand as a trusted advisor rather than a pure sales outlet. This plays well with the intent category "is [brand] [model] safe for family" which is the second-highest volume query in our vertical.',
    press_release_draft:
      `FOR IMMEDIATE RELEASE

StressClient Confirms 100% of In-Stock Inventory Meets New BIS ABS + Airbag Mandate

[CITY], [DATE] — With the Bureau of Indian Standards' updated safety norms for passenger vehicles now in effect, StressClient today confirmed that every vehicle in its current showroom inventory — across Maruti Suzuki, Hyundai, and Tata Motors lineups — is fully compliant with the new ABS and dual front airbag requirements for the sub-4-metre segment.

"Safety is not a regulatory checkbox for us," said [Spokesperson], Sales Head, StressClient. "We have proactively ensured our entire stock meets the new norms, and our service team is now certified to inspect and advise existing owners on retrofit options where available."

The dealership is additionally offering free vehicle safety assessments for owners of models manufactured before April 2026, covering ABS functionality, airbag sensor diagnostics, and tyre pressure monitoring.

Customers can book a complimentary safety check at [website] or call [phone number].

About StressClient: [Company description]

Media Contact: [Name] | [Email] | [Phone]`,
    distribution_checklist: DISTRIBUTION_AUTOMOTIVE,
  },
  {
    id: PR_IDS[2],
    news_title: 'Festive Season 2025: Passenger Vehicle Retail Touches Record 4.2 Lakh Units in October',
    news_url:   'https://www.motorbeam.com/festive-season-2025-passenger-vehicle-retail-record-4-2-lakh-units-october/',
    news_source: 'motorbeam.com',
    published_at: new Date('2026-04-28T07:00:00Z'),
    relevance_score: 0.63,
    status: 'distributed',
    approved_at: new Date('2026-04-29T08:00:00Z'),
    pr_angle:
      'Record retail numbers in the festive season give StressClient the opportunity to anchor a local market story: ' +
      'how the brand contributed to and capitalised on the regional sales surge, what specific models drove footfall, ' +
      'and what the order book looks like going into Q1 2026. Local business desks and automotive trade publications ' +
      'actively seek dealership-level ground truth during macro sales reporting cycles.',
    press_release_draft:
      `FOR IMMEDIATE RELEASE

StressClient Records Best-Ever Festive Season with 340 Units Delivered in October 2025

[CITY], [DATE] — Riding the wave of the strongest festive retail season in Indian automotive history, StressClient delivered 340 passenger vehicles during October 2025 — a 38% jump year-on-year and the dealership's best single-month performance since inception.

The Maruti Suzuki Fronx and Tata Nexon EV led volumes, together accounting for 55% of total deliveries. Hyundai Creta S+ and the newly launched Maruti Dzire contributed the remaining mix, with a notable uptick in CNG variant demand.

"The demand this festive season was unlike anything we have seen," said [Spokesperson], MD, StressClient. "Our pre-booking pipeline for November is already at 180 units, suggesting the momentum will carry into Q1 2026."

StressClient also recorded a 22% increase in used-car exchange bookings and saw its finance penetration rate cross 72% for the first time, driven by sub-9% EMI schemes in partnership with HDFC Bank and Maruti Finance.

About StressClient: [Company description]

Media Contact: [Name] | [Email] | [Phone]`,
    distribution_checklist: DISTRIBUTION_AUTOMOTIVE,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

  try {
    // 1. Find the latest gap report for the stress client
    const { rows: reports } = await pool.query(
      `SELECT id, version FROM gap_reports WHERE client_id = $1 ORDER BY version DESC LIMIT 1`,
      [CLIENT_ID],
    );

    if (!reports.length) {
      console.error('No gap report found for client', CLIENT_ID);
      process.exit(1);
    }

    const report = reports[0];
    console.log(`Updating gap report id=${report.id} (v${report.version}) ...`);

    await pool.query(
      `UPDATE gap_reports
       SET plain_english_summary = $1,
           on_site_gaps          = $2,
           off_site_gaps         = $3,
           recommended_actions   = $4,
           top_cited_domain      = $5,
           updated_at            = NOW()
       WHERE id = $6`,
      [
        PLAIN_ENGLISH_SUMMARY,
        JSON.stringify(ON_SITE_GAPS),
        JSON.stringify(OFF_SITE_GAPS),
        JSON.stringify(RECOMMENDED_ACTIONS),
        'cardekho.com',
        report.id,
      ],
    );
    console.log('Gap report updated.');

    // 2. Delete any existing demo PR signals (idempotent re-run)
    await pool.query(
      `DELETE FROM pr_signals WHERE id = ANY($1)`,
      [PR_IDS],
    );

    // 3. Insert 3 PR signals
    for (const sig of PR_SIGNALS) {
      await pool.query(
        `INSERT INTO pr_signals
           (id, client_id, news_title, news_url, news_source, published_at,
            relevance_score, pr_angle, press_release_draft, distribution_checklist,
            status, approved_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::\"PrSignalStatus\",$12,NOW(),NOW())`,
        [
          sig.id,
          CLIENT_ID,
          sig.news_title,
          sig.news_url,
          sig.news_source,
          sig.published_at,
          sig.relevance_score,
          sig.pr_angle,
          sig.press_release_draft,
          JSON.stringify(sig.distribution_checklist),
          sig.status,
          sig.approved_at,
        ],
      );
      console.log(`PR signal inserted: [${sig.status}] ${sig.news_title.slice(0, 60)}...`);
    }

    console.log('\nDone. Refresh /dashboard and check Diagnostics + Off-Site Builder > PR tabs.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('inject-demo-data failed:', err);
  process.exit(1);
});
