// app/competitors/seed/competitors.seed.ts
// Baseline competitor data for all verticals

export const BASELINE_COMPETITORS: Record<
  string,
  Array<{
    name: string;
    aliases: string[];
    websiteUrl?: string;
  }>
> = {
  automotive: [
    {
      name: 'CarDekho',
      aliases: ['Car Dekho', 'cardekho.com'],
      websiteUrl: 'https://www.cardekho.com',
    },
    {
      name: 'ZigWheels',
      aliases: ['Zigwheels', 'zigwheels.com'],
      websiteUrl: 'https://www.zigwheels.com',
    },
    {
      name: 'Team-BHP',
      aliases: ['TeamBHP', 'team bhp', 'teambhp.com'],
      websiteUrl: 'https://www.team-bhp.com',
    },
    {
      name: 'CarWale',
      aliases: ['Car Wale', 'carwale.com'],
      websiteUrl: 'https://www.carwale.com',
    },
    {
      name: 'Cars24',
      aliases: ['CARS24', 'cars24.com'],
      websiteUrl: 'https://www.cars24.com',
    },
    {
      name: 'Spinny',
      aliases: ['Spinny.com', 'spinny car'],
      websiteUrl: 'https://www.spinny.com',
    },
    {
      name: 'OLX',
      aliases: ['OLX India', 'olx.in'],
      websiteUrl: 'https://www.olx.in',
    },
    {
      name: 'AutocarIndia',
      aliases: ['Autocar India', 'autocarindia.com'],
      websiteUrl: 'https://www.autocarindia.com',
    },
    {
      name: 'BikePC',
      aliases: ['Bike PC', 'bikepc.com'],
      websiteUrl: 'https://www.bikepc.com',
    },
    {
      name: 'Vroom',
      aliases: ['Vroom India', 'vroom.com'],
      websiteUrl: 'https://www.vroom.com',
    },
  ],
  'real-estate': [
    {
      name: '99acres',
      aliases: ['99Acres', '99 acres', '99acres.com'],
      websiteUrl: 'https://www.99acres.com',
    },
    {
      name: 'MagicBricks',
      aliases: ['Magic Bricks', 'magicbricks.com'],
      websiteUrl: 'https://www.magicbricks.com',
    },
    {
      name: 'Housing.com',
      aliases: ['Housing', 'housing.com'],
      websiteUrl: 'https://www.housing.com',
    },
    {
      name: 'NoBroker',
      aliases: ['No Broker', 'nobroker.in'],
      websiteUrl: 'https://www.nobroker.in',
    },
    {
      name: 'CommonFloor',
      aliases: ['Common Floor', 'commonfloor.com'],
      websiteUrl: 'https://www.commonfloor.com',
    },
    {
      name: 'Squareyards',
      aliases: ['Square Yards', 'squareyards.com'],
      websiteUrl: 'https://www.squareyards.com',
    },
    {
      name: 'PropTiger',
      aliases: ['Prop Tiger', 'proptiger.com'],
      websiteUrl: 'https://www.proptiger.com',
    },
    {
      name: 'Makaan',
      aliases: ['Makaan.com', 'makaan property'],
      websiteUrl: 'https://www.makaan.com',
    },
    {
      name: 'Sulekha',
      aliases: ['Sulekha.com', 'sulekha property'],
      websiteUrl: 'https://www.sulekha.com',
    },
    {
      name: 'IndiaProperty',
      aliases: ['India Property', 'indiaproperty.com'],
      websiteUrl: 'https://www.indiaproperty.com',
    },
  ],
  'hr-services': [
    {
      name: 'Naukri',
      aliases: ['Naukri.com', 'naukri jobs'],
      websiteUrl: 'https://www.naukri.com',
    },
    {
      name: 'LinkedIn',
      aliases: ['LinkedIn Jobs', 'linkedin.com'],
      websiteUrl: 'https://www.linkedin.com',
    },
    {
      name: 'AmbitionBox',
      aliases: ['Ambition Box', 'ambitionbox.com'],
      websiteUrl: 'https://www.ambitionbox.com',
    },
    {
      name: 'Glassdoor',
      aliases: ['Glassdoor India', 'glassdoor.co.in'],
      websiteUrl: 'https://www.glassdoor.co.in',
    },
    {
      name: 'Indeed',
      aliases: ['Indeed Jobs', 'indeed.co.in'],
      websiteUrl: 'https://www.indeed.co.in',
    },
    {
      name: 'TeamLease',
      aliases: ['Team Lease', 'teamlease.com'],
      websiteUrl: 'https://www.teamlease.com',
    },
    {
      name: 'Randstad',
      aliases: ['Randstad India', 'randstad.co.in'],
      websiteUrl: 'https://www.randstad.co.in',
    },
    {
      name: 'Quess',
      aliases: ['Quess Corp', 'quesstalent.com'],
      websiteUrl: 'https://www.quesstalent.com',
    },
    {
      name: 'Manpower',
      aliases: ['Manpower Group', 'manpower.co.in'],
      websiteUrl: 'https://www.manpower.co.in',
    },
    {
      name: 'ABC Consultants',
      aliases: ['ABC Consultants India', 'abc-consultants.com'],
      websiteUrl: 'https://www.abc-consultants.com',
    },
  ],
  'gcc-advisory': [
    {
      name: 'NASSCOM',
      aliases: ['NASSCOM India', 'nasscom.in'],
      websiteUrl: 'https://www.nasscom.in',
    },
    {
      name: 'Zinnov',
      aliases: ['Zinnov India', 'zinnov.com'],
      websiteUrl: 'https://www.zinnov.com',
    },
    {
      name: 'Everest Group',
      aliases: ['Everest Group Research', 'everestgrp.com'],
      websiteUrl: 'https://www.everestgrp.com',
    },
    {
      name: 'ANSR',
      aliases: ['ANSR Consulting', 'ansr.com'],
      websiteUrl: 'https://www.ansr.com',
    },
    {
      name: 'Deloitte',
      aliases: ['Deloitte India', 'deloitte.com'],
      websiteUrl: 'https://www.deloitte.com',
    },
    {
      name: 'EY',
      aliases: ['Ernst & Young', 'ey.com'],
      websiteUrl: 'https://www.ey.com',
    },
    {
      name: 'KPMG',
      aliases: ['KPMG India', 'kpmg.com'],
      websiteUrl: 'https://www.kpmg.com',
    },
    {
      name: 'PwC',
      aliases: ['PricewaterhouseCoopers', 'pwc.in'],
      websiteUrl: 'https://www.pwc.in',
    },
    {
      name: 'Accenture',
      aliases: ['Accenture India', 'accenture.com'],
      websiteUrl: 'https://www.accenture.com',
    },
    {
      name: 'Infosys BPO',
      aliases: ['Infosys', 'infosys.com'],
      websiteUrl: 'https://www.infosys.com',
    },
  ],
  healthcare: [
    {
      name: 'Apollo Hospitals',
      aliases: ['Apollo', 'apollohospitals.com'],
      websiteUrl: 'https://www.apollohospitals.com',
    },
    {
      name: 'Max Healthcare',
      aliases: ['Max Health', 'maxhealthcare.in'],
      websiteUrl: 'https://www.maxhealthcare.in',
    },
    {
      name: 'Fortis',
      aliases: ['Fortis Hospital', 'fortis.com'],
      websiteUrl: 'https://www.fortis.com',
    },
    {
      name: 'Columbia Asia',
      aliases: ['Columbia', 'columbiaasiahospitals.com'],
      websiteUrl: 'https://www.columbiaasiahospitals.com',
    },
    {
      name: 'Manipal',
      aliases: ['Manipal Hospital', 'manipalhospitals.com'],
      websiteUrl: 'https://www.manipalhospitals.com',
    },
    {
      name: 'Narayana Health',
      aliases: ['Narayana', 'narayanahealth.org'],
      websiteUrl: 'https://www.narayanahealth.org',
    },
    {
      name: 'Medanta',
      aliases: ['Medanta Hospital', 'medanta.org'],
      websiteUrl: 'https://www.medanta.org',
    },
    {
      name: 'Aster',
      aliases: ['Aster Hospitals', 'asterdm.com'],
      websiteUrl: 'https://www.asterdm.com',
    },
    {
      name: 'BLK',
      aliases: ['BLK Hospital', 'blkhospital.com'],
      websiteUrl: 'https://www.blkhospital.com',
    },
    {
      name: 'Lilavati',
      aliases: ['Lilavati Hospital', 'lilavati.co.in'],
      websiteUrl: 'https://www.lilavati.co.in',
    },
  ],
};

/**
 * Look up baseline competitors for a given vertical
 * @param verticalName - vertical slug (e.g., "automotive", "real-estate")
 * @returns array of competitors or empty array if vertical not found
 */
export function getBaselineCompetitorsForVertical(
  verticalName: string,
): Array<{
  name: string;
  aliases: string[];
  websiteUrl?: string;
}> {
  const normalizedName = verticalName.toLowerCase().trim();
  return BASELINE_COMPETITORS[normalizedName] ?? [];
}
