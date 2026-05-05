import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

export async function seedVerticals(prisma: PrismaClient) {
  const verticals = [
    {
      name: 'Automotive',
      slug: 'automotive',
      description: 'Car dealers, OEMs, and automotive service providers',
      prompt_templates: [
        'Which is the best {category} car under {price_range} in {city}?',
        'Compare {brand} {model} with its top competitors in India',
        'What is the on-road price of {brand} {model} in {city}?',
        'Is {brand} {model} good for {use_case} in {city}?',
        'What are common complaints about {brand} {model}?',
        'Best EMI options for {brand} {model} in {city}',
      ],
      intent_categories: [
        'dealer_discovery',
        'price_comparison',
        'test_drive',
        'emi_calculator',
        'variant_comparison',
        'service_query',
      ],
      trusted_domains: [
        'cardekho.com',
        'zigwheels.com',
        'carwale.com',
        'team-bhp.com',
        'autocarindia.com',
        'motorbeam.com',
      ],
      aggregator_platforms: [
        {
          name: 'CarDekho',
          url_pattern: 'https://www.cardekho.com/dealers/{city}/{brand}',
          css_selectors: {
            name: 'h1.gsc_col-sm-12, h1.dealerName, h1',
            address: '.address, .dealerAddress, [class*="address"]',
            phone: 'a[href^="tel:"]',
            rating: '.ratingCount, .dealerRating, [class*="rating"]',
            review_count: '.totalReview, .reviewsCount, [class*="review"]',
            description: '.descriptionText, .dealerDesc, [class*="description"]',
            photos: '.dealerImages img, [class*="gallery"] img',
            hours: '.timings, .dealerTiming, [class*="timing"]',
            website: 'a.websiteLink, a[class*="website"]',
            category: '.category, [class*="category"]',
            certifications: '.certBadge, [class*="certif"]',
            response_rate: '.responseRate, [class*="response"]',
          },
          crawl_frequency: 'weekly',
        },
        {
          name: 'ZigWheels',
          url_pattern: 'https://www.zigwheels.com/dealers/{city}/{brand}',
          css_selectors: {
            name: 'h1.dName, h1',
            address: '.dAddress, .address, [class*="address"]',
            phone: 'a[href^="tel:"]',
            rating: '.rating .count, .ratingValue, [class*="rating"]',
            review_count: '.totalReviews, [class*="review"]',
            description: '.description, .about, [class*="description"]',
            photos: '.dealer-gallery img, [class*="gallery"] img',
            hours: '.dealerTiming, .timings, [class*="timing"]',
            website: 'a.website, a[class*="website"]',
            category: '[class*="category"]',
            certifications: '[class*="certif"], [class*="award"]',
            response_rate: '[class*="response"]',
          },
          crawl_frequency: 'weekly',
        },
      ],
      schema_types: ['Car', 'AutoDealer', 'Review', 'Product', 'Service'],
      community_platforms: [
        {
          platform: 'reddit',
          identifiers: ['r/IndiaCars', 'r/CarsIndia', 'r/indiancars'],
          keywords: ['buy car India', 'car review India', 'best car under', 'car comparison'],
        },
      ],
      wikidata_entity_type: 'Q1420',
      news_rss_feeds: [
        { url: 'https://www.autocarindia.com/rss', name: 'Autocar India' },
        { url: 'https://www.motorbeam.com/feed/', name: 'MotorBeam' },
        { url: 'https://auto.ndtv.com/rss/news', name: 'NDTV Auto' },
      ],
      review_platforms: [
        { name: 'Google My Business', type: 'api', config: {} },
        { name: 'CarDekho Reviews', type: 'scrape', config: { base_url: 'https://www.cardekho.com' } },
        { name: 'ZigWheels Reviews', type: 'scrape', config: { base_url: 'https://www.zigwheels.com' } },
      ],
    },
    {
      name: 'Real Estate',
      slug: 'real-estate',
      description: 'Property developers, brokers, and real estate advisory firms',
      prompt_templates: [
        'Best apartments under {price_range} in {city} for {use_case}',
        'Top {category} projects by {brand} in {city}',
        'What is the average property price in {city} area?',
        'Compare {brand} {model} project vs alternatives in {city}',
        'Is {city} a good place for real estate investment in {use_case}?',
        'Best localities for {use_case} in {city}',
      ],
      intent_categories: [
        'property_search',
        'rental_query',
        'investment_advice',
        'valuation',
        'legal_query',
        'developer_discovery',
      ],
      trusted_domains: [
        '99acres.com',
        'magicbricks.com',
        'housing.com',
        'nobroker.in',
        'squareyards.com',
        'commonfloor.com',
      ],
      aggregator_platforms: [
        {
          name: '99acres',
          url_pattern: 'https://www.99acres.com/{category}-in-{city}-ffid',
          // TODO: confirm css_selectors with engineering
          css_selectors: {},
          crawl_frequency: 'weekly',
        },
        {
          name: 'MagicBricks',
          url_pattern: 'https://www.magicbricks.com/{category}-in-{city}',
          // TODO: confirm css_selectors with engineering
          css_selectors: {},
          crawl_frequency: 'weekly',
        },
      ],
      schema_types: ['RealEstateListing', 'Place', 'Organization', 'Review', 'LocalBusiness'],
      community_platforms: [
        {
          platform: 'reddit',
          identifiers: ['r/india', 'r/bangalore', 'r/mumbai', 'r/hyderabad'],
          keywords: ['real estate India', 'buy flat', 'property investment', 'builder review'],
        },
      ],
      wikidata_entity_type: 'Q124757',
      review_platforms: [
        { name: 'Google My Business', type: 'api', config: {} },
        { name: '99acres Reviews', type: 'scrape', config: { base_url: 'https://www.99acres.com' } },
        { name: 'MagicBricks Reviews', type: 'scrape', config: { base_url: 'https://www.magicbricks.com' } },
      ],
    },
    {
      name: 'HR Services',
      slug: 'hr-services',
      description: 'Staffing agencies, HR consulting, and talent advisory firms',
      prompt_templates: [
        'Best staffing agencies for {category} roles in {city}',
        'Top HR consulting firms for {use_case} in India',
        'Average salary for {model} in {city}?',
        'Compare {brand} vs other staffing agencies for {category}',
        'Which recruitment agency is best for {category} hiring in {city}?',
        'Employee reviews of {brand} as an employer in {city}',
      ],
      intent_categories: [
        'job_search',
        'company_review',
        'salary_benchmark',
        'hr_consulting',
        'staffing_vendor',
        'employer_branding',
      ],
      trusted_domains: [
        'naukri.com',
        'ambitionbox.com',
        'linkedin.com',
        'indeed.co.in',
        'glassdoor.co.in',
        'timesjobs.com',
      ],
      aggregator_platforms: [
        {
          name: 'Naukri',
          url_pattern: 'https://www.naukri.com/companies/{brand}',
          // TODO: confirm css_selectors with engineering
          css_selectors: {},
          crawl_frequency: 'weekly',
        },
        {
          name: 'AmbitionBox',
          url_pattern: 'https://www.ambitionbox.com/overview/{brand}-overview',
          // TODO: confirm css_selectors with engineering
          css_selectors: {},
          crawl_frequency: 'weekly',
        },
      ],
      schema_types: ['Organization', 'JobPosting', 'Review', 'LocalBusiness', 'EmployerAggregateRating'],
      community_platforms: [
        {
          platform: 'reddit',
          identifiers: ['r/india', 'r/IndiaFinance', 'r/developersIndia'],
          keywords: ['best staffing agency India', 'HR consulting firm', 'recruitment agency review'],
        },
      ],
      wikidata_entity_type: 'Q4830453',
      review_platforms: [
        { name: 'Google My Business', type: 'api', config: {} },
        { name: 'AmbitionBox', type: 'scrape', config: { base_url: 'https://www.ambitionbox.com' } },
        { name: 'Glassdoor India', type: 'scrape', config: { base_url: 'https://www.glassdoor.co.in' } },
      ],
    },
    {
      name: 'GCC Advisory',
      slug: 'gcc-advisory',
      description: 'Global Capability Centre setup, consulting, and talent advisory',
      prompt_templates: [
        'How to set up a GCC in {city} India for {use_case}?',
        'Best cities in India for {category} GCC setup',
        'Cost comparison for GCC setup in {city} vs {model}',
        'Which consulting firm is best for GCC advisory in India?',
        '{brand} GCC setup services in {city} review',
        'Talent availability for {category} GCC in {city}',
      ],
      intent_categories: [
        'gcc_setup',
        'talent_advisory',
        'compliance_query',
        'infrastructure_advisory',
        'expansion_strategy',
        'cost_benchmarking',
      ],
      trusted_domains: [
        'nasscom.in',
        'deloitte.com',
        'kpmg.com',
        'ey.com',
        'pwc.in',
        'business-standard.com',
      ],
      aggregator_platforms: [
        {
          name: 'NASSCOM',
          url_pattern: 'https://nasscom.in/knowledge-center/publications',
          // TODO: confirm css_selectors with engineering
          css_selectors: {},
          crawl_frequency: 'monthly',
        },
        {
          name: 'LinkedIn',
          url_pattern: 'https://www.linkedin.com/company/{brand}',
          // TODO: confirm css_selectors with engineering
          css_selectors: {},
          crawl_frequency: 'weekly',
        },
      ],
      schema_types: ['Organization', 'Article', 'Review', 'LocalBusiness', 'Service'],
      community_platforms: [
        {
          platform: 'reddit',
          identifiers: ['r/india', 'r/IndiaInvestments', 'r/developersIndia'],
          keywords: ['GCC India', 'global capability centre', 'captive centre India', 'GCC advisory'],
        },
      ],
      wikidata_entity_type: 'Q891723',
      review_platforms: [
        { name: 'Google My Business', type: 'api', config: {} },
        { name: 'LinkedIn Company Reviews', type: 'scrape', config: { base_url: 'https://www.linkedin.com' } },
      ],
    },
    {
      name: 'Healthcare',
      slug: 'healthcare',
      description: 'Hospitals, clinics, diagnostic centres, and healthcare service providers',
      prompt_templates: [
        'Best {category} doctors in {city} for {use_case}',
        'Top hospitals for {use_case} treatment in {city}',
        'Cost of {model} surgery in {city}?',
        '{brand} hospital reviews in {city}',
        'Compare {brand} diagnostic centre vs alternatives in {city}',
        'Which is the best {category} clinic near {city}?',
      ],
      intent_categories: [
        'doctor_discovery',
        'hospital_search',
        'treatment_comparison',
        'health_query',
        'appointment_booking',
        'cost_inquiry',
      ],
      trusted_domains: [
        'practo.com',
        'justdial.com',
        '1mg.com',
        'lybrate.com',
        'healthifyme.com',
        'indiamart.com',
      ],
      aggregator_platforms: [
        {
          name: 'Practo',
          url_pattern: 'https://www.practo.com/{city}/doctors',
          // TODO: confirm css_selectors with engineering
          css_selectors: {},
          crawl_frequency: 'weekly',
        },
        {
          name: 'JustDial',
          url_pattern: 'https://www.justdial.com/{city}/{brand}',
          css_selectors: {
            name: 'h1.jdnm, h1, [class*="businessname"]',
            address: '.locateme, [class*="address"], [itemprop="address"]',
            phone: 'a.callnow, a[href^="tel:"]',
            rating: '.green_rating, .star-rating, [class*="rating"]',
            review_count: '.totrate, [class*="ratingcount"]',
            description: '.businessInfo, [class*="description"]',
            photos: '.slick-track img, [class*="gallery"] img',
            hours: '.timing, [class*="timing"], [class*="hours"]',
            website: 'a.cursor-point, a[class*="website"]',
            category: '.catname, [class*="category"]',
            certifications: '[class*="certif"], [class*="award"]',
            response_rate: '[class*="response"]',
          },
          crawl_frequency: 'weekly',
        },
      ],
      schema_types: ['MedicalOrganization', 'Physician', 'Review', 'LocalBusiness', 'MedicalClinic'],
      community_platforms: [
        {
          platform: 'reddit',
          identifiers: ['r/india', 'r/bangalore', 'r/AskIndia'],
          keywords: ['best hospital India', 'doctor recommendation India', 'hospital review', 'healthcare India'],
        },
      ],
      wikidata_entity_type: 'Q35638',
      news_rss_feeds: [
        { url: 'https://health.ndtv.com/feeds', name: 'NDTV Health' },
        { url: 'https://economictimes.indiatimes.com/industry/healthcare/biotech/rssfeeds/13352286.cms', name: 'ET Healthcare' },
      ],
      review_platforms: [
        { name: 'Google My Business', type: 'api', config: {} },
        { name: 'Practo Reviews', type: 'scrape', config: { base_url: 'https://www.practo.com' } },
        { name: 'JustDial Reviews', type: 'scrape', config: { base_url: 'https://www.justdial.com' } },
      ],
    },
  ];

  for (const v of verticals) {
    await prisma.vertical.upsert({
      where: { slug: v.slug },
      update: {
        name: v.name,
        description: v.description,
        prompt_templates: v.prompt_templates,
        intent_categories: v.intent_categories,
        trusted_domains: v.trusted_domains,
        aggregator_platforms: v.aggregator_platforms,
        schema_types: v.schema_types,
        community_platforms: v.community_platforms,
        wikidata_entity_type: v.wikidata_entity_type,
        news_rss_feeds: (v.news_rss_feeds ?? undefined) as import('@prisma/client').Prisma.InputJsonValue | undefined,
        review_platforms: v.review_platforms,
        is_active: true,
      },
      create: v,
    });
    console.log(`Seeded vertical: ${v.name}`);
  }
}

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
seedVerticals(prisma)
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
