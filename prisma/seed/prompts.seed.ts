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

// ─── Automotive (64 prompts) ──────────────────────────────────────────────────

const AUTOMOTIVE: PromptSeed[] = [
  // purchase_intent
  { text: 'Which {brand} {model} dealer in {city} offers the best on-road price?', category: 'dealer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Best {brand} showroom in {city} for buying a new {model}?', category: 'dealer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Should I buy a {brand} {model} or wait for the next year model in {city}?', category: 'dealer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Is {brand} {model} a good {use_case} car for families in {city}?', category: 'dealer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What are the best {category} cars available in India under {price_range}?', category: 'dealer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Which {brand} models should I consider for {use_case} in India?', category: 'dealer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'When should I upgrade from {brand} {model} to a newer model?', category: 'dealer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is it worth buying a second {brand} {model} after 3 years of ownership?', category: 'dealer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.retention, priority: 4 },

  // comparison
  { text: 'Final comparison: {brand} {model} vs top 3 alternatives before buying in {city}', category: 'variant_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} {model} better than Honda or Hyundai for {use_case}?', category: 'variant_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Compare {brand} {model} vs Maruti in terms of reliability and service cost in {city}', category: 'variant_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: '{brand} {model} vs Hyundai equivalent — which has better resale value in {city}?', category: 'variant_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'How does {brand} {model} compare with {category} competitors in India?', category: 'variant_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Which is better for {use_case} — {brand} {model} or its top rivals in India?', category: 'variant_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Should I sell my {brand} {model} now or after the new variant launches in {city}?', category: 'variant_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'How does the current {brand} {model} compare to models in the {price_range} range?', category: 'variant_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.retention, priority: 4 },

  // feature_query
  { text: 'Does {brand} {model} top variant have wireless CarPlay in India?', category: 'variant_comparison', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What is the boot space and seating capacity of {brand} {model} for {use_case}?', category: 'variant_comparison', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'How good is {brand} {model} sunroof and infotainment in the {price_range} segment?', category: 'variant_comparison', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'What is the fuel efficiency of {brand} {model} in city driving in {city}?', category: 'variant_comparison', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What safety features does {brand} {model} have in the {price_range} segment?', category: 'variant_comparison', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Does {brand} {model} have ADAS features in India?', category: 'variant_comparison', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Does {brand} {model} support OTA software updates?', category: 'service_query', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'How reliable is {brand} {model} transmission after 50000 km?', category: 'service_query', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.retention, priority: 4 },

  // ownership
  { text: 'What are the maintenance costs for {brand} {model} first 3 service cycles in {city}?', category: 'service_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} {model} easy to get serviced in tier-2 cities in India?', category: 'service_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the total cost of ownership of {brand} {model} over 5 years?', category: 'service_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'How good is {brand} service network in {city} for {model}?', category: 'service_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What are common issues with {brand} {model} after 2 years of use?', category: 'service_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How much does it cost to service {brand} {model} annually in {city}?', category: 'service_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How to maintain {brand} {model} for best resale value in {city}?', category: 'service_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'What is the resale value of {brand} {model} after 5 years in {city}?', category: 'service_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.retention, priority: 4 },

  // segment
  { text: 'Which {category} car has best highway mileage in India under {price_range}?', category: 'segment_discovery', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Most popular {category} cars sold in {city} this month?', category: 'segment_discovery', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Top 5 {category} cars for families in {city} under {price_range}?', category: 'segment_discovery', intent_type: IntentType.segment, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Best electric cars under {price_range} in {city} with good service network?', category: 'segment_discovery', intent_type: IntentType.segment, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What are the best {category} cars available in India under {price_range}?', category: 'segment_discovery', intent_type: IntentType.segment, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Which SUVs are best for {use_case} in India under {price_range}?', category: 'segment_discovery', intent_type: IntentType.segment, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What segment should I move to after owning a {brand} {model} for 4 years?', category: 'segment_discovery', intent_type: IntentType.segment, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is upgrading from hatchback to {brand} SUV worth it in {city}?', category: 'segment_discovery', intent_type: IntentType.segment, buyer_stage: BuyerStage.retention, priority: 4 },

  // local_discovery
  { text: 'Top-rated {brand} dealers in {city} for new car purchase?', category: 'dealer_discovery', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: '{brand} showroom in {city} with best exchange offer for old {model}?', category: 'dealer_discovery', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Best {brand} dealers in {city} with good after-sales service reviews?', category: 'dealer_discovery', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: '{brand} service centres in {city} with shortest waiting time?', category: 'dealer_discovery', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Where can I find {brand} dealers near {city}?', category: 'dealer_discovery', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Which {brand} showroom in {city} has the largest inventory?', category: 'dealer_discovery', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Nearest authorized {brand} service centre to {city} for {model} annual service?', category: 'service_query', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Best multi-brand car service in {city} for {brand} {model} out of warranty?', category: 'service_query', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.retention, priority: 4 },

  // trust_signal
  { text: 'Is {brand} {model} safe to buy considering its recall history in India?', category: 'brand_trust', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What is {brand} India rating by NCAP and customer satisfaction surveys?', category: 'brand_trust', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What do owners say about {brand} {model} after 3 years of use?', category: 'brand_trust', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Is {brand} customer service good in {city} for warranty claims?', category: 'brand_trust', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'How trustworthy is {brand} in India for long-term ownership?', category: 'brand_trust', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Is {brand} a reliable car brand for Indian road conditions?', category: 'brand_trust', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How does {brand} handle warranty claims for {model} in India?', category: 'brand_trust', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is extended warranty from {brand} worth buying for {model} in {city}?', category: 'brand_trust', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.retention, priority: 4 },

  // price_query
  { text: 'What is the final on-road price of {brand} {model} after all taxes in {city}?', category: 'price_comparison', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What is the EMI for {brand} {model} with {price_range} down payment in {city}?', category: 'emi_calculator', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the difference in price between base and top variant of {brand} {model}?', category: 'price_comparison', intent_type: IntentType.price_query, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'What discounts are available on {brand} {model} this month in {city}?', category: 'price_comparison', intent_type: IntentType.price_query, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What is the starting price of {brand} {model} in India?', category: 'price_comparison', intent_type: IntentType.price_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What is the on-road price of {brand} {model} in {city}?', category: 'price_comparison', intent_type: IntentType.price_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What is the current market value of 2022 {brand} {model} in {city}?', category: 'price_comparison', intent_type: IntentType.price_query, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'What is the best selling price for my used {brand} {model} in {city}?', category: 'price_comparison', intent_type: IntentType.price_query, buyer_stage: BuyerStage.retention, priority: 4 },
];

// ─── Real Estate (64 prompts) ─────────────────────────────────────────────────

const REAL_ESTATE: PromptSeed[] = [
  // purchase_intent
  { text: 'Which {brand} apartment in {city} has the best ready-to-move options?', category: 'developer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Best 2BHK projects in {city} under {price_range} that are RERA registered?', category: 'property_search', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Should I buy {brand} apartments or wait for RERA-registered projects in {city}?', category: 'developer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Is {brand} {model} residential project worth buying in {city}?', category: 'developer_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What type of property should I buy in {city} for {use_case}?', category: 'property_search', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Is it the right time to buy a {category} property in {city}?', category: 'investment_advice', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'When should I sell my {brand} apartment in {city} for maximum profit?', category: 'investment_advice', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is it worth buying a second property from {brand} in {city}?', category: 'investment_advice', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.retention, priority: 4 },

  // comparison
  { text: 'Final comparison: {brand} vs top 3 builders in {city} for {use_case} property?', category: 'developer_discovery', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} {model} project better than what Sobha or Prestige offers in {city}?', category: 'developer_discovery', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: '{brand} project vs local builders in {city} — who has better construction quality?', category: 'developer_discovery', intent_type: IntentType.comparison, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'How does {brand} {model} project compare to similar projects in {city} under {price_range}?', category: 'developer_discovery', intent_type: IntentType.comparison, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Compare {brand} apartments vs DLF or Godrej for {use_case} in {city}?', category: 'developer_discovery', intent_type: IntentType.comparison, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Which builder is better for {category} housing in {city} — {brand} or competitors?', category: 'developer_discovery', intent_type: IntentType.comparison, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How has {brand} apartment in {city} appreciated vs other projects I considered?', category: 'investment_advice', intent_type: IntentType.comparison, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Should I switch to {brand} from my current property investment in {city}?', category: 'investment_advice', intent_type: IntentType.comparison, buyer_stage: BuyerStage.retention, priority: 4 },

  // feature_query
  { text: 'What is the parking situation in {brand} {model} towers in {city}?', category: 'property_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Does {brand} project in {city} have smart home features and solar backup?', category: 'property_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the carpet area vs super builtup area ratio in {brand} {model} in {city}?', category: 'property_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Does {brand} {model} project in {city} have clubhouse, pool, and gym?', category: 'property_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What amenities does {brand} {model} project offer in {city}?', category: 'property_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Does {brand} housing project in {city} have green building certification?', category: 'property_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How good is the property management at {brand} {model} complex in {city}?', category: 'property_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'What is the maintenance charge at {brand} {model} apartment in {city}?', category: 'property_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.retention, priority: 4 },

  // ownership
  { text: 'What are the legal checks I need before buying {brand} {model} apartment in {city}?', category: 'legal_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} builder construction quality certified for {model} in {city}?', category: 'legal_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the total cost of owning a {price_range} apartment in {city} over 10 years?', category: 'investment_advice', intent_type: IntentType.ownership, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'How good is {brand} after-sales service and handover process in {city}?', category: 'developer_discovery', intent_type: IntentType.ownership, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What are the hidden charges when buying {brand} property in {city}?', category: 'legal_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How much stamp duty and registration cost for {brand} property in {city}?', category: 'legal_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How to get maximum rental yield from {brand} property in {city}?', category: 'investment_advice', intent_type: IntentType.ownership, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'How to deal with {brand} builder for defect liability period issues in {city}?', category: 'legal_query', intent_type: IntentType.ownership, buyer_stage: BuyerStage.retention, priority: 4 },

  // segment
  { text: 'Which premium {category} project in {city} has best location under {price_range}?', category: 'property_search', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Most popular 3BHK projects in {city} under {price_range} ready to move?', category: 'property_search', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Top {category} projects in {city} for investment under {price_range}?', category: 'investment_advice', intent_type: IntentType.segment, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Best plotted development projects in {city} under {price_range}?', category: 'property_search', intent_type: IntentType.segment, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What types of properties are available under {price_range} in {city}?', category: 'property_search', intent_type: IntentType.segment, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Best residential areas in {city} for {use_case} under {price_range}?', category: 'property_search', intent_type: IntentType.segment, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What segment of property is appreciating fastest in {city} now?', category: 'investment_advice', intent_type: IntentType.segment, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Should I diversify from residential to commercial property in {city}?', category: 'investment_advice', intent_type: IntentType.segment, buyer_stage: BuyerStage.retention, priority: 4 },

  // local_discovery
  { text: 'Which new launch projects in {city} are near metro station or highway?', category: 'property_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: '{brand} projects in {city} that are near top schools and hospitals?', category: 'property_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Which micro-market in {city} has best infrastructure for {use_case} residents?', category: 'property_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Best gated communities in {city} with good connectivity to IT corridor?', category: 'property_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Which are the upcoming residential projects near {city} in 2025?', category: 'property_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Best locations to buy property in {city} for {use_case}?', category: 'property_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What new infrastructure development is planned near my {brand} property in {city}?', category: 'investment_advice', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Best property management companies near {brand} complex in {city}?', category: 'property_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.retention, priority: 4 },

  // trust_signal
  { text: 'Is {brand} a safe builder to invest with in {city} based on past project delivery?', category: 'developer_discovery', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What do homebuyers say about {brand} after-possession experience in {city}?', category: 'developer_discovery', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the track record of {brand} builder in {city} — any delays or disputes?', category: 'developer_discovery', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Is {brand} {model} project in {city} approved by leading banks for home loans?', category: 'legal_query', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Is {brand} a RERA-registered and reliable builder in {city}?', category: 'legal_query', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How trustworthy is {brand} for property delivery on time in {city}?', category: 'developer_discovery', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How has {brand} maintained their promise to residents in {model} complex in {city}?', category: 'developer_discovery', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is {brand} reliable for booking under-construction property in {city}?', category: 'developer_discovery', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.retention, priority: 4 },

  // price_query
  { text: 'What is the final all-inclusive price for a 2BHK in {brand} {model} in {city}?', category: 'valuation', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What bank offers the lowest interest rate for {brand} project in {city}?', category: 'valuation', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What payment plan does {brand} offer for {model} project in {city}?', category: 'valuation', intent_type: IntentType.price_query, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'What is the EMI for a {price_range} home loan for {brand} property in {city}?', category: 'valuation', intent_type: IntentType.price_query, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What is the price per sqft for {brand} apartments in {city}?', category: 'valuation', intent_type: IntentType.price_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What is the starting price for {brand} {model} project in {city}?', category: 'valuation', intent_type: IntentType.price_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What is the current resale price of {brand} {model} apartments in {city}?', category: 'valuation', intent_type: IntentType.price_query, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'What rental yield can I expect from {brand} property in {city} per month?', category: 'investment_advice', intent_type: IntentType.price_query, buyer_stage: BuyerStage.retention, priority: 4 },
];

// ─── HR Services (64 prompts) ─────────────────────────────────────────────────

const HR_SERVICES: PromptSeed[] = [
  // purchase_intent
  { text: 'Which HR firm in {city} specializes in bulk {category} hiring for {use_case}?', category: 'staffing_vendor', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Best recruitment agency in {city} to hire {category} professionals under {price_range} budget?', category: 'staffing_vendor', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Should I outsource HR to {brand} or build an in-house team in {city}?', category: 'hr_consulting', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Is {brand} a good HR partner for {use_case} hiring in {city}?', category: 'staffing_vendor', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Which HR staffing companies in {city} should I hire for {use_case}?', category: 'staffing_vendor', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What type of HR service does my {category} company need in {city}?', category: 'hr_consulting', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Should I continue with {brand} HR services or switch to another agency in {city}?', category: 'staffing_vendor', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is it worth renewing the HR outsourcing contract with {brand} for next year?', category: 'staffing_vendor', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.retention, priority: 4 },

  // comparison
  { text: 'Final choice: {brand} vs top 3 staffing companies in {city} for {category} roles?', category: 'staffing_vendor', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} better than ABC Consultants for hiring {category} professionals in {city}?', category: 'staffing_vendor', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: '{brand} vs Manpower vs Quess for {category} staffing in {city} — which is better?', category: 'staffing_vendor', intent_type: IntentType.comparison, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'How does {brand} compare to local HR firms in {city} for {use_case} hiring?', category: 'staffing_vendor', intent_type: IntentType.comparison, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Compare {brand} HR services with other staffing agencies in {city}?', category: 'staffing_vendor', intent_type: IntentType.comparison, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Which HR outsourcing company is better for {use_case} — {brand} or TeamLease?', category: 'staffing_vendor', intent_type: IntentType.comparison, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How does {brand} performance compare to the HR agency I used last year in {city}?', category: 'staffing_vendor', intent_type: IntentType.comparison, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Should I switch from {brand} to a boutique HR firm for niche {category} hiring?', category: 'staffing_vendor', intent_type: IntentType.comparison, buyer_stage: BuyerStage.retention, priority: 4 },

  // feature_query
  { text: 'Does {brand} have dedicated account managers for enterprise clients in {city}?', category: 'hr_consulting', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What SLAs does {brand} offer for filling {category} positions in {city}?', category: 'hr_consulting', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Does {brand} specialize in {category} hiring for IT and GCC companies in {city}?', category: 'staffing_vendor', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'What technology does {brand} use for candidate screening and tracking in {city}?', category: 'hr_consulting', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What services does {brand} HR agency offer for {use_case} in {city}?', category: 'hr_consulting', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Does {brand} provide payroll outsourcing and compliance support in {city}?', category: 'hr_consulting', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Does {brand} provide regular hiring analytics and market insights for {city}?', category: 'hr_consulting', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'What value-added services does {brand} offer to long-term HR clients in {city}?', category: 'hr_consulting', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.retention, priority: 4 },

  // ownership
  { text: 'What is the replacement guarantee policy of {brand} if a hire leaves in 30 days?', category: 'staffing_vendor', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What is the contract term with {brand} for permanent staffing in {city}?', category: 'staffing_vendor', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the total cost of outsourcing HR to {brand} for a {price_range} budget?', category: 'hr_consulting', intent_type: IntentType.ownership, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'What are the hidden costs when working with {brand} HR agency in {city}?', category: 'hr_consulting', intent_type: IntentType.ownership, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What is the typical fee structure for HR agencies in {city} for {use_case}?', category: 'hr_consulting', intent_type: IntentType.ownership, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How do HR staffing firms charge for {category} hiring in India?', category: 'hr_consulting', intent_type: IntentType.ownership, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How can I negotiate better rates with {brand} after 1 year of partnership in {city}?', category: 'hr_consulting', intent_type: IntentType.ownership, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'What ROI can I expect from HR outsourcing with {brand} for {use_case} in {city}?', category: 'hr_consulting', intent_type: IntentType.ownership, buyer_stage: BuyerStage.retention, priority: 4 },

  // segment
  { text: 'Which recruitment firm in {city} has the best database for {category} professionals?', category: 'staffing_vendor', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Most reliable bulk hiring agency in {city} for seasonal {category} workforce?', category: 'staffing_vendor', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Top staffing companies in {city} for contract-to-hire {category} roles?', category: 'staffing_vendor', intent_type: IntentType.segment, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Best HR outsourcing companies for manufacturing sector in {city} under {price_range}?', category: 'staffing_vendor', intent_type: IntentType.segment, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Which HR agencies in {city} specialize in {category} sector hiring?', category: 'staffing_vendor', intent_type: IntentType.segment, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Best executive search firms in {city} for C-suite {use_case} roles?', category: 'staffing_vendor', intent_type: IntentType.segment, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What segment of HR services is growing fastest for companies in {city}?', category: 'hr_consulting', intent_type: IntentType.segment, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Should my {category} company switch to RPO model from traditional staffing in {city}?', category: 'hr_consulting', intent_type: IntentType.segment, buyer_stage: BuyerStage.retention, priority: 4 },

  // local_discovery
  { text: 'Which HR firm in {city} has placed candidates with top {category} companies recently?', category: 'staffing_vendor', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: '{brand} office location and contact for {city} hiring requirements?', category: 'staffing_vendor', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'HR agencies near {city} that specialize in {category} talent acquisition?', category: 'staffing_vendor', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Best placement consultancies in {city} for mid-senior {category} professionals?', category: 'staffing_vendor', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'List of HR staffing agencies in {city} for {use_case} hiring?', category: 'staffing_vendor', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Which HR companies have offices near {city}?', category: 'staffing_vendor', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Are there any new HR firms in {city} that could supplement {brand} services?', category: 'staffing_vendor', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'What is the HR talent market outlook in {city} for {category} roles this quarter?', category: 'salary_benchmark', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.retention, priority: 4 },

  // trust_signal
  { text: 'Is {brand} compliant with labour laws and PF/ESI regulations in {city}?', category: 'staffing_vendor', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What percentage of {brand} placements in {city} last beyond 6 months?', category: 'staffing_vendor', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is {brand} track record for placing {category} candidates in {city}?', category: 'staffing_vendor', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'What do client companies say about {brand} HR services in {city}?', category: 'staffing_vendor', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'How trustworthy is {brand} HR agency for {use_case} in {city}?', category: 'staffing_vendor', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Is {brand} a certified and compliant staffing company in India?', category: 'employer_branding', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How does {brand} handle dispute resolution between placed candidates and clients?', category: 'hr_consulting', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is {brand} recommended by other {category} companies in {city} for HR outsourcing?', category: 'staffing_vendor', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.retention, priority: 4 },

  // price_query
  { text: 'What will {brand} charge for hiring 50 {category} staff in {city} under {price_range}?', category: 'hr_consulting', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What is the best payment model — fixed retainer vs success fee with {brand} in {city}?', category: 'hr_consulting', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the fee structure of {brand} for placing {category} professionals in {city}?', category: 'hr_consulting', intent_type: IntentType.price_query, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'What is the cost difference between contract and permanent staffing with {brand}?', category: 'hr_consulting', intent_type: IntentType.price_query, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What is the typical recruitment fee charged by HR agencies in {city}?', category: 'hr_consulting', intent_type: IntentType.price_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How much does HR outsourcing cost for a {price_range} company in {city}?', category: 'hr_consulting', intent_type: IntentType.price_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Is {brand} pricing competitive for {category} hiring compared to market rates in {city}?', category: 'hr_consulting', intent_type: IntentType.price_query, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'How can I optimize HR outsourcing costs with {brand} for {use_case} in {city}?', category: 'hr_consulting', intent_type: IntentType.price_query, buyer_stage: BuyerStage.retention, priority: 4 },
];

// ─── GCC Advisory (64 prompts) ────────────────────────────────────────────────

const GCC_ADVISORY: PromptSeed[] = [
  // purchase_intent
  { text: 'Which GCC consulting firm in {city} has best track record for {category} sector?', category: 'gcc_setup', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Best advisory firm to set up GCC in {city} for {price_range} investment budget?', category: 'gcc_setup', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Should I hire {brand} to set up a GCC or do it independently in {city}?', category: 'gcc_setup', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Is {brand} a reliable GCC advisory partner for {use_case} setup in {city}?', category: 'gcc_setup', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Should my company set up a GCC in {city} for {use_case} operations?', category: 'gcc_setup', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What type of GCC advisory services does my {category} company need in {city}?', category: 'gcc_setup', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Should I expand my GCC in {city} with {brand} advisory support or go solo?', category: 'expansion_strategy', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is it worth renewing the GCC advisory contract with {brand} for year 2?', category: 'gcc_setup', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.retention, priority: 4 },

  // comparison
  { text: 'Final comparison: {brand} vs top 3 GCC advisors in {city} for {category} operations?', category: 'gcc_setup', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} better than Zinnov or Everest Group for GCC talent advisory in {city}?', category: 'talent_advisory', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: '{brand} vs Deloitte vs Nasscom advisory for {category} GCC setup in {city}?', category: 'gcc_setup', intent_type: IntentType.comparison, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'How does {brand} compare to boutique GCC advisory firms in {city}?', category: 'gcc_setup', intent_type: IntentType.comparison, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Compare {brand} GCC advisory with other consultants in {city}?', category: 'gcc_setup', intent_type: IntentType.comparison, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Which GCC advisory firm is better — {brand} or KPMG or EY in {city}?', category: 'gcc_setup', intent_type: IntentType.comparison, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How does {brand} GCC advisory performance compare to benchmarks in {city}?', category: 'cost_benchmarking', intent_type: IntentType.comparison, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Should I bring in a second GCC advisory firm alongside {brand} in {city}?', category: 'gcc_setup', intent_type: IntentType.comparison, buyer_stage: BuyerStage.retention, priority: 4 },

  // feature_query
  { text: 'Does {brand} offer real estate and infrastructure advisory for GCC in {city}?', category: 'infrastructure_advisory', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What governance and compliance support does {brand} provide for GCC in India?', category: 'compliance_query', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Does {brand} have expertise in {category} GCC operations for Indian market?', category: 'gcc_setup', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'What talent acquisition support does {brand} provide for GCC ramp-up in {city}?', category: 'talent_advisory', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What does a GCC advisory firm like {brand} offer for {use_case} in {city}?', category: 'gcc_setup', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Does {brand} provide end-to-end GCC setup including legal and HR in {city}?', category: 'gcc_setup', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Does {brand} provide ongoing GCC performance benchmarking in {city}?', category: 'cost_benchmarking', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'What value-added services does {brand} offer to mature GCC clients in {city}?', category: 'gcc_setup', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.retention, priority: 4 },

  // ownership
  { text: 'What is {brand} advisory fee structure for GCC setup in {city}?', category: 'gcc_setup', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What ROI should I expect from {brand} GCC advisory for {use_case} in {city}?', category: 'cost_benchmarking', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the total advisory cost for setting up a GCC in {city} under {price_range}?', category: 'gcc_setup', intent_type: IntentType.ownership, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'What are the ongoing management costs for a {category} GCC in {city}?', category: 'cost_benchmarking', intent_type: IntentType.ownership, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What does it cost to set up a GCC in {city} with advisory support?', category: 'gcc_setup', intent_type: IntentType.ownership, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What are the hidden costs of GCC setup that advisory firms warn about in {city}?', category: 'gcc_setup', intent_type: IntentType.ownership, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How can I optimize GCC operating costs in {city} with {brand} advisory support?', category: 'cost_benchmarking', intent_type: IntentType.ownership, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'What is the benchmark cost per FTE for a {category} GCC in {city}?', category: 'cost_benchmarking', intent_type: IntentType.ownership, buyer_stage: BuyerStage.retention, priority: 4 },

  // segment
  { text: 'Which {category} GCC advisory firm in {city} has the best talent ecosystem?', category: 'talent_advisory', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Most experienced GCC advisor in {city} for technology and engineering operations?', category: 'gcc_setup', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Top GCC advisory firms for BFSI sector operations in {city}?', category: 'gcc_setup', intent_type: IntentType.segment, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Best cities in India for setting up {category} GCC — why choose {city}?', category: 'infrastructure_advisory', intent_type: IntentType.segment, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Which {category} sector companies are setting up GCCs in {city} in 2025?', category: 'expansion_strategy', intent_type: IntentType.segment, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What type of GCC is best suited for my {category} company in {city}?', category: 'gcc_setup', intent_type: IntentType.segment, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What segment of GCC services is growing fastest in {city} in 2025?', category: 'expansion_strategy', intent_type: IntentType.segment, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Should my {category} GCC in {city} pivot to AI and automation capabilities?', category: 'expansion_strategy', intent_type: IntentType.segment, buyer_stage: BuyerStage.retention, priority: 4 },

  // local_discovery
  { text: 'Which GCC advisory firm in {city} has worked with Fortune 500 companies recently?', category: 'gcc_setup', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: '{brand} office and contact details for GCC advisory in {city}?', category: 'gcc_setup', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'GCC advisory firms near {city} with NASSCOM membership and credentials?', category: 'gcc_setup', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Best local GCC consultants in {city} for {category} sector?', category: 'gcc_setup', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'List of GCC advisory firms operating in {city}?', category: 'gcc_setup', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Which GCC advisory firms have dedicated offices in {city}?', category: 'gcc_setup', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Are there any emerging GCC advisory firms in {city} that can supplement {brand}?', category: 'gcc_setup', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'What is the GCC talent pipeline outlook in {city} for {category} roles in 2025?', category: 'talent_advisory', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.retention, priority: 4 },

  // trust_signal
  { text: 'Is {brand} compliant with data protection and IP laws for GCC advisory in India?', category: 'compliance_query', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What do GCC heads say about {brand} advisory experience in {city}?', category: 'gcc_setup', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What successful GCC setups has {brand} led in {city} for {category} sector?', category: 'gcc_setup', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Is {brand} advisory firm recognized by NASSCOM or CII for GCC expertise?', category: 'gcc_setup', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Is {brand} a credible and experienced GCC advisory firm in India?', category: 'gcc_setup', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What is {brand} reputation in the GCC advisory space in {city}?', category: 'gcc_setup', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How has {brand} helped GCCs scale from startup to 500 employees in {city}?', category: 'expansion_strategy', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is {brand} recommended by peer companies for GCC advisory in {city}?', category: 'gcc_setup', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.retention, priority: 4 },

  // price_query
  { text: 'What will {brand} GCC advisory cost for a {price_range} setup budget in {city}?', category: 'cost_benchmarking', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is there a phased payment model with {brand} for GCC advisory in {city}?', category: 'gcc_setup', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the fee structure for {brand} end-to-end GCC setup in {city}?', category: 'gcc_setup', intent_type: IntentType.price_query, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'What is the cost comparison of different GCC advisory firms in {city}?', category: 'cost_benchmarking', intent_type: IntentType.price_query, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What does GCC advisory typically cost for a {category} company entering {city}?', category: 'gcc_setup', intent_type: IntentType.price_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How much does {brand} charge for an initial GCC feasibility study in {city}?', category: 'gcc_setup', intent_type: IntentType.price_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Is {brand} pricing competitive for ongoing GCC governance advisory in {city}?', category: 'cost_benchmarking', intent_type: IntentType.price_query, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'How can I negotiate better GCC advisory rates with {brand} for phase 2 in {city}?', category: 'gcc_setup', intent_type: IntentType.price_query, buyer_stage: BuyerStage.retention, priority: 4 },
];

// ─── Healthcare (64 prompts) ──────────────────────────────────────────────────

const HEALTHCARE: PromptSeed[] = [
  // purchase_intent
  { text: 'Which {brand} hospital in {city} is best for {use_case} surgery with good success rate?', category: 'hospital_search', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Best {category} specialist doctors at {brand} hospital in {city}?', category: 'doctor_discovery', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Should I choose {brand} hospital or a government hospital in {city} for {use_case}?', category: 'hospital_search', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Is {brand} a good choice for {use_case} treatment in {city}?', category: 'hospital_search', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Which {category} hospital or clinic should I choose in {city} for {use_case}?', category: 'hospital_search', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What type of healthcare provider does my family need in {city}?', category: 'health_query', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Should I continue with {brand} hospital for follow-up care in {city}?', category: 'appointment_booking', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is it worth getting a second opinion from {brand} for my existing treatment in {city}?', category: 'health_query', intent_type: IntentType.purchase_intent, buyer_stage: BuyerStage.retention, priority: 4 },

  // comparison
  { text: 'Final choice: {brand} vs top 3 hospitals in {city} for {use_case} procedure?', category: 'treatment_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Is {brand} better than Columbia Asia or NH for {category} surgery in {city}?', category: 'treatment_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: '{brand} vs private clinic vs government hospital for {use_case} in {city}?', category: 'treatment_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'How does {brand} compare to other {category} specialists in {city}?', category: 'treatment_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Compare {brand} hospital vs Apollo or Fortis for {use_case} in {city}?', category: 'treatment_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Which hospital is better for {category} treatment — {brand} or Manipal in {city}?', category: 'treatment_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How does my experience at {brand} compare to other healthcare providers I have used?', category: 'treatment_comparison', intent_type: IntentType.comparison, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Should I switch from {brand} to another healthcare provider in {city}?', category: 'hospital_search', intent_type: IntentType.comparison, buyer_stage: BuyerStage.retention, priority: 4 },

  // feature_query
  { text: 'What is the doctor-to-patient ratio at {brand} hospital for {use_case} in {city}?', category: 'hospital_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Does {brand} hospital in {city} have 24x7 emergency and ICU for {use_case}?', category: 'hospital_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What diagnostic facilities does {brand} have for {category} conditions in {city}?', category: 'hospital_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Does {brand} hospital in {city} have advanced robotic surgery capabilities?', category: 'hospital_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What specialties does {brand} hospital offer in {city} for {use_case}?', category: 'doctor_discovery', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Does {brand} have accredited NABH or JCI certification in {city}?', category: 'hospital_search', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What post-treatment support does {brand} provide for {use_case} patients in {city}?', category: 'appointment_booking', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Does {brand} have a telemedicine option for follow-up after {use_case} treatment?', category: 'appointment_booking', intent_type: IntentType.feature_query, buyer_stage: BuyerStage.retention, priority: 4 },

  // ownership
  { text: 'What is the package price for {use_case} surgery at {brand} in {city}?', category: 'cost_inquiry', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What are the pre- and post-treatment costs for {use_case} at {brand} in {city}?', category: 'cost_inquiry', intent_type: IntentType.ownership, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the total cost of {use_case} treatment at {brand} in {city}?', category: 'cost_inquiry', intent_type: IntentType.ownership, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Does insurance cover {use_case} treatment at {brand} hospital in {city}?', category: 'cost_inquiry', intent_type: IntentType.ownership, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What does treatment for {use_case} typically cost at hospitals in {city}?', category: 'cost_inquiry', intent_type: IntentType.ownership, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Are there hidden charges for {category} treatment at {brand} in {city}?', category: 'cost_inquiry', intent_type: IntentType.ownership, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How much should I budget for {use_case} follow-up care at {brand} in {city}?', category: 'cost_inquiry', intent_type: IntentType.ownership, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'What is the cost of rehabilitation after {use_case} treatment at {brand} in {city}?', category: 'cost_inquiry', intent_type: IntentType.ownership, buyer_stage: BuyerStage.retention, priority: 4 },

  // segment
  { text: 'Which {category} hospital in {city} has the highest success rate for {use_case}?', category: 'hospital_search', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Most trusted {category} specialists in {city} based on patient reviews?', category: 'doctor_discovery', intent_type: IntentType.segment, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Top-rated hospitals in {city} for {use_case} with best patient outcomes?', category: 'hospital_search', intent_type: IntentType.segment, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Best oncology centres in {city} for {use_case} treatment under {price_range}?', category: 'hospital_search', intent_type: IntentType.segment, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Which hospitals in {city} specialize in {category} treatment?', category: 'hospital_search', intent_type: IntentType.segment, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Best {category} specialist clinics in {city} under {price_range} consultation fee?', category: 'doctor_discovery', intent_type: IntentType.segment, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'What type of preventive healthcare should I follow after {use_case} treatment in {city}?', category: 'health_query', intent_type: IntentType.segment, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Should I consider wellness programmes at {brand} hospital for long-term health in {city}?', category: 'appointment_booking', intent_type: IntentType.segment, buyer_stage: BuyerStage.retention, priority: 4 },

  // local_discovery
  { text: 'Which {brand} branch in {city} is nearest to me and treats {use_case}?', category: 'hospital_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: '{brand} hospital locations in {city} that accept my health insurance?', category: 'appointment_booking', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'Best {category} hospitals near {city} with short appointment wait times?', category: 'appointment_booking', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Top physiotherapy and rehabilitation centres near {city} for {use_case}?', category: 'hospital_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Which hospitals near me in {city} treat {use_case} effectively?', category: 'hospital_search', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Where can I find a good {category} specialist in {city}?', category: 'doctor_discovery', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Nearest diagnostic lab to {brand} hospital for follow-up tests in {city}?', category: 'appointment_booking', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Best home healthcare service near {brand} hospital in {city} for post-surgery care?', category: 'appointment_booking', intent_type: IntentType.local_discovery, buyer_stage: BuyerStage.retention, priority: 4 },

  // trust_signal
  { text: 'Is {brand} hospital safe for {use_case} surgery based on infection control standards?', category: 'hospital_search', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'What credentials do {use_case} surgeons at {brand} have in {city}?', category: 'doctor_discovery', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What do patients say about their experience at {brand} for {use_case} in {city}?', category: 'hospital_search', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'What is the patient survival and recovery rate at {brand} for {use_case}?', category: 'hospital_search', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'Is {brand} hospital a trustworthy and safe choice for {use_case} in {city}?', category: 'hospital_search', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'Is {brand} accredited for {category} treatment by national medical bodies in India?', category: 'hospital_search', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How has {brand} handled post-treatment complications for {use_case} patients?', category: 'hospital_search', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is {brand} hospital recommended by doctors in {city} for {use_case} referrals?', category: 'doctor_discovery', intent_type: IntentType.trust_signal, buyer_stage: BuyerStage.retention, priority: 4 },

  // price_query
  { text: 'What is the all-inclusive cost for {use_case} procedure at {brand} in {city}?', category: 'cost_inquiry', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 10 },
  { text: 'Which health insurance covers {use_case} treatment at {brand} hospital in {city}?', category: 'cost_inquiry', intent_type: IntentType.price_query, buyer_stage: BuyerStage.decision, priority: 9 },
  { text: 'What is the estimated cost for {use_case} surgery at {brand} hospital in {city}?', category: 'cost_inquiry', intent_type: IntentType.price_query, buyer_stage: BuyerStage.consideration, priority: 8 },
  { text: 'Does {brand} offer EMI or payment plans for expensive {use_case} treatments in {city}?', category: 'cost_inquiry', intent_type: IntentType.price_query, buyer_stage: BuyerStage.consideration, priority: 7 },
  { text: 'What is the consultation fee at {brand} hospital in {city} for {use_case}?', category: 'cost_inquiry', intent_type: IntentType.price_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How much does a {category} health checkup cost at {brand} in {city}?', category: 'cost_inquiry', intent_type: IntentType.price_query, buyer_stage: BuyerStage.awareness, priority: 6 },
  { text: 'How much will annual follow-up care for {use_case} cost at {brand} in {city}?', category: 'cost_inquiry', intent_type: IntentType.price_query, buyer_stage: BuyerStage.retention, priority: 5 },
  { text: 'Is {brand} health checkup package worth {price_range} for preventive care in {city}?', category: 'cost_inquiry', intent_type: IntentType.price_query, buyer_stage: BuyerStage.retention, priority: 4 },
];

export async function seedPrompts(prisma: PrismaClient) {
  const existing = await prisma.prompt.count({ where: { tenant_id: null } });
  if (existing >= 300) {
    console.log('  Platform prompts already seeded, skipping');
    return;
  }

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
