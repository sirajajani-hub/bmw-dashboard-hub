import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCampaignAppendixRows,
  buildInsights,
  buildQaChecks,
  chooseObjectiveMetric,
  entityLabelForInsight,
  primaryMetricForChannel,
  type ChartPoint,
  type ChannelSummaryRow,
  type DetailRow,
  type MetricCard,
  type QuarterOption,
} from './dashboardService';
import {
  buildInsightRewriteSpec,
  buildVarianceRewriteSpec,
  rewriteInsightChannels,
  validateInsightRewrite,
} from './insightRewriteAgent';

function makeRow(overrides: Partial<DetailRow>): DetailRow {
  return {
    Region: 'T2EAST',
    MACO: 'BMW',
    Channel: 'Connected TV / OTT',
    Platform: 'DV360',
    'Site Name': 'DV360',
    'Campaign / Placement Type': 'Hulu',
    'Funnel Stage': 'Awareness',
    OptimizeTo: 'Video Completions',
    VCR: 0.8,
    'Video Completes': 800,
    'Video Plays': 1000,
    Clicks: 0,
    Campaign: 'Campaign A',
    Month: '2026-01-01',
    Spend: 1000,
    'All KBAs': 10,
    'Inventory Searches': 0,
    'Page Visits': 0,
    Leads: 0,
    Impressions: 10000,
    ...overrides,
  };
}

const CURRENT_QUARTER: QuarterOption = {
  quarter: 1,
  year: 2026,
  label: 'Q1 2026',
};

const COMPARISON_QUARTER: QuarterOption = {
  quarter: 4,
  year: 2025,
  label: 'Q4 2025',
};

const PRIOR_YEAR_SAME_QUARTER: QuarterOption = {
  quarter: 1,
  year: 2025,
  label: 'Q1 2025',
};

function sectionBulletsById(result: ReturnType<typeof buildInsights>, channelName: string) {
  const channel = result.channels.find((item) => item.channel === channelName);
  assert.ok(channel);

  return Object.fromEntries(channel.sections.map((section) => [section.id, section.bullets])) as Record<string, string[]>;
}

test('entityLabelForInsight uses site name for CTV/OLV and placement type when site name contains DV360', () => {
  assert.equal(
    entityLabelForInsight(
      makeRow({
        Channel: 'Connected TV / OTT',
        Platform: 'DV360',
        'Site Name': 'DV360',
        'Campaign / Placement Type': 'Hulu',
      }),
    ),
    'Hulu',
  );

  assert.equal(
    entityLabelForInsight(
      makeRow({
        Channel: 'Online Video',
        Platform: 'CM360',
        'Site Name': 'YouTube',
        'Campaign / Placement Type': 'Skippable',
      }),
    ),
    'YouTube',
  );

  assert.equal(
    entityLabelForInsight(
      makeRow({
        Channel: 'Display',
        Platform: 'Google Display Network',
        'Site Name': 'Some Site',
      }),
    ),
    'Google Display Network',
  );
});

test('primaryMetricForChannel uses VCR for CTV/OLV and CPKBA for non-video fallback channels', () => {
  const ctvMetric = primaryMetricForChannel('ctv', {
    spend: 1000,
    kbas: 10,
    impressions: 10000,
    videoCompletes: 800,
    videoPlays: 1000,
  });
  assert.equal(ctvMetric?.label, 'VCR');
  assert.equal(ctvMetric?.value, 0.8);

  const displayMetric = primaryMetricForChannel('digital-display', {
    spend: 1000,
    kbas: 20,
    impressions: 50000,
  });
  assert.equal(displayMetric?.label, 'CPKBA');
  assert.equal(displayMetric?.value, 50);
});

test('buildInsights keeps CTV insight copy VCR-only across delivery, variance, campaign, learnings, optimization, and recommendations', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2026-01-01',
      Spend: 4000,
      'All KBAs': 40,
      VCR: 0.82,
      'Video Completes': 820,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2026-02-01',
      Spend: 5000,
      'All KBAs': 45,
      VCR: 0.86,
      'Video Completes': 860,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign B',
      Month: '2026-01-01',
      Spend: 2500,
      'All KBAs': 35,
      VCR: 0.7,
      'Video Completes': 700,
      'Video Plays': 1000,
      'Site Name': 'New York Interconnect',
      'Campaign / Placement Type': 'CTV Standard',
      Platform: 'CM360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign B',
      Month: '2026-02-01',
      Spend: 2000,
      'All KBAs': 30,
      VCR: 0.68,
      'Video Completes': 680,
      'Video Plays': 1000,
      'Site Name': 'New York Interconnect',
      'Campaign / Placement Type': 'CTV Standard',
      Platform: 'CM360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2025-10-01',
      Spend: 3000,
      'All KBAs': 20,
      VCR: 0.75,
      'Video Completes': 750,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2025-11-01',
      Spend: 3200,
      'All KBAs': 25,
      VCR: 0.76,
      'Video Completes': 760,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign B',
      Month: '2025-10-01',
      Spend: 2800,
      'All KBAs': 30,
      VCR: 0.72,
      'Video Completes': 720,
      'Video Plays': 1000,
      'Site Name': 'New York Interconnect',
      'Campaign / Placement Type': 'CTV Standard',
      Platform: 'CM360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign B',
      Month: '2025-11-01',
      Spend: 2600,
      'All KBAs': 28,
      VCR: 0.71,
      'Video Completes': 710,
      'Video Plays': 1000,
      'Site Name': 'New York Interconnect',
      'Campaign / Placement Type': 'CTV Standard',
      Platform: 'CM360',
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const ctvChannel = result.channels.find((channel) => channel.channel === 'Connected TV / OTT');

  assert.ok(ctvChannel);

  const allBullets = ctvChannel.sections.flatMap((section) => section.bullets);
  assert.ok(allBullets.length > 0);
  assert.ok(allBullets.some((bullet) => bullet.includes('VCR')));
  assert.ok(allBullets.some((bullet) => bullet.includes('Hulu')));
  assert.ok(allBullets.some((bullet) => bullet.includes('New York Interconnect')));
  assert.ok(allBullets.every((bullet) => !/\bDV360\b|\bCM360\b/.test(bullet)));
  assert.ok(allBullets.every((bullet) => !/\bCPKBA\b|\bCP KBA\b/.test(bullet)));
  assert.ok(allBullets.every((bullet) => !/\bKBA\b|\bKBAs\b/.test(bullet)));

  const deliverySection = ctvChannel.sections.find((section) => section.id === 'delivery');
  assert.ok(deliverySection);
  assert.ok(deliverySection.bullets.every((bullet) => /spend with a VCR/i.test(bullet)));

  const varianceSection = ctvChannel.sections.find((section) => section.id === 'variance');
  assert.ok(varianceSection);
  assert.ok(varianceSection.bullets.every((bullet) => !/\bKBA\b|\bKBAs\b/.test(bullet)));
});

test('buildInsights keeps non-video campaign delivery on KBA and CPKBA language', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Search',
      Platform: 'Google',
      'Site Name': 'Ignored Site',
      Campaign: 'Search A',
      Month: '2026-01-01',
      Spend: 5000,
      'All KBAs': 100,
      Impressions: 10000,
      Clicks: 300,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Google',
      Campaign: 'Search A',
      Month: '2026-02-01',
      Spend: 5500,
      'All KBAs': 120,
      Impressions: 11000,
      Clicks: 320,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Bing',
      Campaign: 'Search B',
      Month: '2026-01-01',
      Spend: 3000,
      'All KBAs': 40,
      Impressions: 8000,
      Clicks: 200,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Bing',
      Campaign: 'Search B',
      Month: '2026-02-01',
      Spend: 3200,
      'All KBAs': 30,
      Impressions: 7500,
      Clicks: 150,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Google',
      Campaign: 'Search A',
      Month: '2025-10-01',
      Spend: 4500,
      'All KBAs': 90,
      Impressions: 9000,
      Clicks: 280,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Bing',
      Campaign: 'Search B',
      Month: '2025-10-01',
      Spend: 2800,
      'All KBAs': 35,
      Impressions: 7000,
      Clicks: 170,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const searchChannel = result.channels.find((channel) => channel.channel === 'Search');

  assert.ok(searchChannel);

  const campaignDeliverySection = searchChannel.sections.find((section) => section.id === 'campaignDelivery');
  assert.ok(campaignDeliverySection);
  assert.ok(campaignDeliverySection.bullets.some((bullet) => /\bKBAs\b/.test(bullet)));
  assert.ok(campaignDeliverySection.bullets.some((bullet) => /\bCPKBA\b/.test(bullet)));
});

test('buildInsights keeps OLV insight copy VCR-only and uses site naming rules', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Online Video',
      Campaign: 'OLV A',
      Month: '2026-01-01',
      Spend: 3000,
      'All KBAs': 25,
      VCR: 0.78,
      'Video Completes': 780,
      'Video Plays': 1000,
      'Site Name': 'YouTube',
      'Campaign / Placement Type': 'Skippable',
      Platform: 'CM360',
    }),
    makeRow({
      Channel: 'Online Video',
      Campaign: 'OLV A',
      Month: '2026-02-01',
      Spend: 3500,
      'All KBAs': 30,
      VCR: 0.8,
      'Video Completes': 800,
      'Video Plays': 1000,
      'Site Name': 'YouTube',
      'Campaign / Placement Type': 'Skippable',
      Platform: 'CM360',
    }),
    makeRow({
      Channel: 'Online Video',
      Campaign: 'OLV B',
      Month: '2026-01-01',
      Spend: 2000,
      'All KBAs': 18,
      VCR: 0.66,
      'Video Completes': 660,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Pre-Roll',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Online Video',
      Campaign: 'OLV B',
      Month: '2026-02-01',
      Spend: 1800,
      'All KBAs': 15,
      VCR: 0.64,
      'Video Completes': 640,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Pre-Roll',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Online Video',
      Campaign: 'OLV A',
      Month: '2025-10-01',
      Spend: 2500,
      'All KBAs': 20,
      VCR: 0.74,
      'Video Completes': 740,
      'Video Plays': 1000,
      'Site Name': 'YouTube',
      'Campaign / Placement Type': 'Skippable',
      Platform: 'CM360',
    }),
    makeRow({
      Channel: 'Online Video',
      Campaign: 'OLV B',
      Month: '2025-10-01',
      Spend: 2200,
      'All KBAs': 16,
      VCR: 0.67,
      'Video Completes': 670,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Pre-Roll',
      Platform: 'DV360',
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const olvChannel = result.channels.find((channel) => channel.channel === 'Online Video');

  assert.ok(olvChannel);

  const allBullets = olvChannel.sections.flatMap((section) => section.bullets);
  assert.ok(allBullets.some((bullet) => bullet.includes('YouTube')));
  assert.ok(allBullets.some((bullet) => bullet.includes('Pre-Roll')));
  assert.ok(allBullets.every((bullet) => !/\bDV360\b|\bCM360\b/.test(bullet)));
  assert.ok(allBullets.every((bullet) => !/\bKBA\b|\bKBAs\b|\bCPKBA\b|\bCP KBA\b/.test(bullet)));
});

test('buildInsights excludes Display from the rendered insight channels', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Display',
      Platform: 'Google Display Network',
      Campaign: 'Display A',
      Month: '2026-01-01',
      Spend: 4000,
      'All KBAs': 100,
      Impressions: 100000,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Display',
      Platform: 'Google Display Network',
      Campaign: 'Display A',
      Month: '2026-02-01',
      Spend: 4200,
      'All KBAs': 105,
      Impressions: 105000,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Display',
      Platform: 'Trade Desk',
      Campaign: 'Display B',
      Month: '2026-01-01',
      Spend: 3500,
      'All KBAs': 50,
      Impressions: 90000,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Display',
      Platform: 'Trade Desk',
      Campaign: 'Display B',
      Month: '2026-02-01',
      Spend: 3600,
      'All KBAs': 45,
      Impressions: 85000,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Display',
      Platform: 'Google Display Network',
      Campaign: 'Display A',
      Month: '2025-10-01',
      Spend: 3900,
      'All KBAs': 90,
      Impressions: 95000,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Display',
      Platform: 'Trade Desk',
      Campaign: 'Display B',
      Month: '2025-10-01',
      Spend: 3300,
      'All KBAs': 48,
      Impressions: 88000,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const displayChannel = result.channels.find((channel) => channel.channel === 'Display');

  assert.equal(displayChannel, undefined);
});

test('chooseObjectiveMetric uses CTR for traffic objectives and CPKBA otherwise', () => {
  const trafficMetric = chooseObjectiveMetric('search', 'Traffic / Landing Page Visits', {
    spend: 1000,
    kbas: 20,
    impressions: 10000,
    clicks: 500,
    vcr: null,
    videoCompletes: 0,
    videoPlays: 0,
  });
  assert.equal(trafficMetric?.label, 'CTR');
  assert.equal(trafficMetric?.value, 0.05);

  const efficiencyMetric = chooseObjectiveMetric('social', 'Conversions / Leads', {
    spend: 1000,
    kbas: 20,
    impressions: 10000,
    clicks: 500,
    vcr: null,
    videoCompletes: 0,
    videoPlays: 0,
  });
  assert.equal(efficiencyMetric?.label, 'CPKBA');
  assert.equal(efficiencyMetric?.value, 50);
});

test('buildQaChecks reports passing insight audit coverage and reconciliation when audit counters align', () => {
  const currentRows = [
    makeRow({
      Channel: 'Search',
      Platform: 'Google',
      Campaign: 'Search A',
      Month: '2026-01-01',
      Spend: 1000,
      'All KBAs': 20,
      Impressions: 10000,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
  ];
  const priorRows = [
    makeRow({
      Channel: 'Search',
      Platform: 'Google',
      Campaign: 'Search A',
      Month: '2025-10-01',
      Spend: 900,
      'All KBAs': 18,
      Impressions: 9000,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
  ];

  const kpis: MetricCard[] = [
    {
      id: 'cp-kba',
      label: 'COST PER KBA',
      value: 50,
      displayValue: '$50.00',
      delta: 0,
      deltaLabel: '0%',
      tone: 'neutral',
      note: 'Search and Social spend divided by Search and Social All KBAs.',
    },
  ];

  const points: ChartPoint[] = [
    {
      label: 'Jan 25',
      spend: 500,
      kbas: 10,
      cpKba: 50,
      spendDisplay: '$500',
      kbasDisplay: '10',
      cpKbaDisplay: '$50',
      spendMoMLabel: '0%',
      kbasMoMLabel: '0%',
      cpKbaMoMLabel: '0%',
    },
  ];

  const channelSummary: ChannelSummaryRow[] = [
    {
      channel: 'Search',
      spendDisplay: '$1,000',
      kbasDisplay: '20',
      cpkbaDisplay: '$50',
      yoyLabel: '+11%',
      status: 'Ahead',
      currentSpend: 1000,
      priorSpend: 900,
      currentSpendShare: 1,
      priorSpendShare: 1,
    },
  ];

  const checks = buildQaChecks({
    currentDetailRows: currentRows,
    priorDetailRows: priorRows,
    currentQuarter: CURRENT_QUARTER,
    comparisonQuarter: COMPARISON_QUARTER,
    channelSummary,
    totals: { spend: 1000, kbas: 20 },
    priorTotals: { spend: 900, kbas: 18 },
    channelTotals: { spend: 1000, kbas: 20 },
    cpKbaTotals: { spend: 1000, kbas: 20 },
    priorCpKbaTotals: { spend: 900, kbas: 18 },
    cpKbaBenchmarkTotals: { spend: 500, kbas: 10 },
    selectedRegion: 'T2EAST',
    selectedMaco: 'BMW',
    kpis,
    points,
    cpKbaBenchmark: 50,
    insightsAudit: {
      renderedChannelCount: 1,
      renderedSectionCount: 2,
      renderedBulletCount: 3,
      metricClaimCount: 3,
      reconciledMetricClaimCount: 3,
      groundedBulletCount: 3,
      blockedBulletCount: 1,
      blockedSectionCount: 1,
    },
  });

  assert.equal(checks.find((check) => check.id === 'insight-evidence')?.status, 'PASS');
  assert.equal(checks.find((check) => check.id === 'claim-reconciliation')?.status, 'PASS');
  assert.equal(checks.find((check) => check.id === 'empty-evidence-blocking')?.status, 'PASS');
});

test('buildQaChecks warns when insight audit counters do not reconcile', () => {
  const rows = [
    makeRow({
      Channel: 'Search',
      Platform: 'Google',
      Campaign: 'Search A',
      Month: '2026-01-01',
      Spend: 1000,
      'All KBAs': 20,
      Impressions: 10000,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
  ];

  const checks = buildQaChecks({
    currentDetailRows: rows,
    priorDetailRows: rows.map((row) => ({ ...row, Month: '2025-10-01' })),
    currentQuarter: CURRENT_QUARTER,
    comparisonQuarter: COMPARISON_QUARTER,
    channelSummary: [
      {
        channel: 'Search',
        spendDisplay: '$1,000',
        kbasDisplay: '20',
        cpkbaDisplay: '$50',
        yoyLabel: '+0%',
        status: 'Stable',
        currentSpend: 1000,
        priorSpend: 1000,
        currentSpendShare: 1,
        priorSpendShare: 1,
      },
    ],
    totals: { spend: 1000, kbas: 20 },
    priorTotals: { spend: 1000, kbas: 20 },
    channelTotals: { spend: 1000, kbas: 20 },
    selectedRegion: 'T2EAST',
    selectedMaco: 'BMW',
    kpis: [
      {
        id: 'cp-kba',
        label: 'COST PER KBA',
        value: 50,
        displayValue: '$50.00',
        delta: 0,
        deltaLabel: '0%',
        tone: 'neutral',
        note: 'Search and Social spend divided by Search and Social All KBAs.',
      },
    ],
    points: [
      {
        label: 'Jan 25',
        spend: 500,
        kbas: 10,
        cpKba: 50,
        spendDisplay: '$500',
        kbasDisplay: '10',
        cpKbaDisplay: '$50',
        spendMoMLabel: '0%',
        kbasMoMLabel: '0%',
        cpKbaMoMLabel: '0%',
      },
    ],
    cpKbaTotals: { spend: 1000, kbas: 20 },
    priorCpKbaTotals: { spend: 1000, kbas: 20 },
    cpKbaBenchmarkTotals: { spend: 500, kbas: 10 },
    cpKbaBenchmark: 50,
    insightsAudit: {
      renderedChannelCount: 1,
      renderedSectionCount: 1,
      renderedBulletCount: 3,
      metricClaimCount: 2,
      reconciledMetricClaimCount: 1,
      groundedBulletCount: 2,
      blockedBulletCount: 0,
      blockedSectionCount: 0,
    },
  });

  assert.equal(checks.find((check) => check.id === 'insight-evidence')?.status, 'WARN');
  assert.equal(checks.find((check) => check.id === 'claim-reconciliation')?.status, 'WARN');
});

test('buildInsights returns the canonical CTV section copy for the current fixture', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2026-01-01',
      Spend: 4000,
      'All KBAs': 40,
      VCR: 0.82,
      'Video Completes': 820,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2026-02-01',
      Spend: 5000,
      'All KBAs': 45,
      VCR: 0.86,
      'Video Completes': 860,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign B',
      Month: '2026-01-01',
      Spend: 2500,
      'All KBAs': 35,
      VCR: 0.7,
      'Video Completes': 700,
      'Video Plays': 1000,
      'Site Name': 'New York Interconnect',
      'Campaign / Placement Type': 'CTV Standard',
      Platform: 'CM360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign B',
      Month: '2026-02-01',
      Spend: 2000,
      'All KBAs': 30,
      VCR: 0.68,
      'Video Completes': 680,
      'Video Plays': 1000,
      'Site Name': 'New York Interconnect',
      'Campaign / Placement Type': 'CTV Standard',
      Platform: 'CM360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2025-10-01',
      Spend: 3000,
      'All KBAs': 20,
      VCR: 0.75,
      'Video Completes': 750,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2025-11-01',
      Spend: 3200,
      'All KBAs': 25,
      VCR: 0.76,
      'Video Completes': 760,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign B',
      Month: '2025-10-01',
      Spend: 2800,
      'All KBAs': 30,
      VCR: 0.72,
      'Video Completes': 720,
      'Video Plays': 1000,
      'Site Name': 'New York Interconnect',
      'Campaign / Placement Type': 'CTV Standard',
      Platform: 'CM360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign B',
      Month: '2025-11-01',
      Spend: 2600,
      'All KBAs': 28,
      VCR: 0.71,
      'Video Completes': 710,
      'Video Plays': 1000,
      'Site Name': 'New York Interconnect',
      'Campaign / Placement Type': 'CTV Standard',
      Platform: 'CM360',
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Connected TV / OTT');

  assert.deepEqual(sections.delivery, [
    'Hulu delivered 66.7% of spend with a VCR of 84.0%. VCR for the platform improved by 11.3% quarter over quarter to 84.0% from 75.5% in Q4 2025.',
    'New York Interconnect delivered 33.3% of spend with a VCR of 69.0%. VCR for the platform remained stable quarter over quarter at 69.0% vs 71.5% in Q4 2025.',
  ]);
  assert.deepEqual(sections.variance, [
    'VCR remained stable YoY at 76.5% vs 73.5%.',
  ]);
  assert.deepEqual(sections.campaignDelivery, [
    'Campaign A / Hulu accounted for 66.7% of spend and delivered a VCR of 84.0%. VCR for the campaign improved by 11.3% quarter over quarter to 84.0% from 75.5% in Q4 2025.',
    'Campaign A / Hulu delivered the strongest VCR at 84.0%.',
    'Campaign B / CTV Standard delivered a low VCR of 69.0%.',
  ]);
  assert.deepEqual(sections.quarterLearnings, [
    'Connected TV / OTT VCR remained stable quarter over quarter at 76.5% in Q1 2026 vs 73.5% in Q4 2025.',
  ]);
  assert.deepEqual(sections.optimizations, [
    'Optimize Campaign B / CTV Standard, which delivered 69.0% on VCR while representing 33.3% of spend.',
  ]);
  assert.deepEqual(sections.recommendations, [
    'Optimize Hulu / Campaign A / Hulu based on VCR of 84.0% at 66.7% of spend.',
  ]);
});

test('buildInsights returns the canonical Search section copy for the current fixture', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Search',
      Platform: 'Google',
      'Site Name': 'Ignored Site',
      Campaign: 'Search A',
      Month: '2026-01-01',
      Spend: 5000,
      'All KBAs': 100,
      Impressions: 10000,
      Clicks: 300,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Google',
      Campaign: 'Search A',
      Month: '2026-02-01',
      Spend: 5500,
      'All KBAs': 120,
      Impressions: 11000,
      Clicks: 320,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Bing',
      Campaign: 'Search B',
      Month: '2026-01-01',
      Spend: 3000,
      'All KBAs': 40,
      Impressions: 8000,
      Clicks: 200,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Bing',
      Campaign: 'Search B',
      Month: '2026-02-01',
      Spend: 3200,
      'All KBAs': 30,
      Impressions: 7500,
      Clicks: 150,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Google',
      Campaign: 'Search A',
      Month: '2025-10-01',
      Spend: 4500,
      'All KBAs': 90,
      Impressions: 9000,
      Clicks: 280,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Bing',
      Campaign: 'Search B',
      Month: '2025-10-01',
      Spend: 2800,
      'All KBAs': 35,
      Impressions: 7000,
      Clicks: 170,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Search');

  assert.deepEqual(sections.delivery, [
    'Google delivered 75.9% of KBAs with a CPKBA of $47.73. Media efficiency for the platform remained stable quarter over quarter at $47.73 vs $50.00 in Q4 2025.',
    'Bing delivered 24.1% of KBAs with a CPKBA of $88.57. Media efficiency for the platform decreased by 10.7% quarter over quarter to $88.57 from $80.00 in Q4 2025.',
  ]);
  assert.deepEqual(sections.variance, [
    'Overall Search KBAs increased 132.0% YoY to 290 from 125.',
    'CPKBA remained stable YoY at $57.59 vs $58.40.',
  ]);
  assert.deepEqual(sections.campaignDelivery, [
    'Search A accounted for 62.9% of spend and 75.9% of total KBAs, outperforming its share of investment, with a CPKBA of $47.73 and CTR of 3.0%. Media efficiency for the campaign remained stable quarter over quarter at $47.73 vs $50.00 in Q4 2025.',
    'Search A delivered the strongest efficiency at $47.73, alongside CTR of 3.0%.',
    'Search B delivered a higher cost per action at $88.57, with CTR at 2.3%.',
  ]);
  assert.deepEqual(sections.quarterLearnings, [
    'Search KBAs increased 132.0% quarter over quarter, reaching 290 in Q1 2026 vs 125 in Q4 2025. CPKBA remained stable quarter over quarter at $57.59 in Q1 2026 vs $58.40 in Q4 2025.',
  ]);
  assert.deepEqual(sections.optimizations, [
    'Optimize Search B, which delivered $88.57 on CPKBA while representing 37.1% of spend.',
  ]);
  assert.deepEqual(sections.recommendations, [
    'Scale Google / Search A based on CPKBA of $47.73 and 75.9% of channel KBAs.',
  ]);
});

test('buildInsights uses year-over-year wording in quarter learnings when the comparison quarter matches last year', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2026-01-01',
      Spend: 4000,
      'All KBAs': 40,
      VCR: 0.82,
      'Video Completes': 820,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign B',
      Month: '2026-02-01',
      Spend: 2000,
      'All KBAs': 30,
      VCR: 0.72,
      'Video Completes': 720,
      'Video Plays': 1000,
      'Site Name': 'New York Interconnect',
      'Campaign / Placement Type': 'CTV Standard',
      Platform: 'CM360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2025-01-01',
      Spend: 3500,
      'All KBAs': 35,
      VCR: 0.79,
      'Video Completes': 790,
      'Video Plays': 1000,
      'Site Name': 'DV360',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign B',
      Month: '2025-02-01',
      Spend: 1500,
      'All KBAs': 28,
      VCR: 0.69,
      'Video Completes': 690,
      'Video Plays': 1000,
      'Site Name': 'New York Interconnect',
      'Campaign / Placement Type': 'CTV Standard',
      Platform: 'CM360',
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, PRIOR_YEAR_SAME_QUARTER);
  const sections = sectionBulletsById(result, 'Connected TV / OTT');

  assert.deepEqual(sections.quarterLearnings, [
    'Connected TV / OTT VCR remained stable year over year at 77.0% in Q1 2026 vs 74.0% in Q1 2025.',
  ]);
});

test('buildInsights suppresses CTV delivery bullets that do not have a valid VCR instead of falling back to KBAs', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2026-01-01',
      Spend: 4000,
      'All KBAs': 40,
      VCR: 0.82,
      'Video Completes': 820,
      'Video Plays': 1000,
      'Site Name': 'Programmatic Video - Connected TV/OTT',
      'Campaign / Placement Type': 'Programmatic Video - Connected TV/OTT',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign B',
      Month: '2026-01-01',
      Spend: 2000,
      'All KBAs': 38,
      VCR: undefined,
      'Video Completes': 0,
      'Video Plays': 0,
      'Site Name': 'Online Video - Connected TV/OTT',
      'Campaign / Placement Type': 'Online Video - Connected TV/OTT',
      Platform: 'CM360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2025-10-01',
      Spend: 3500,
      'All KBAs': 35,
      VCR: 0.8,
      'Video Completes': 800,
      'Video Plays': 1000,
      'Site Name': 'Programmatic Video - Connected TV/OTT',
      'Campaign / Placement Type': 'Programmatic Video - Connected TV/OTT',
      Platform: 'DV360',
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Connected TV / OTT');

  assert.deepEqual(sections.delivery, [
    'Programmatic Video - Connected TV/OTT delivered 66.7% of spend with a VCR of 82.0%. VCR for the platform remained stable quarter over quarter at 82.0% vs 80.0% in Q4 2025.',
  ]);
  assert.ok(sections.delivery.every((bullet) => !/\bKBA\b|\bKBAs\b/.test(bullet)));
});

test('buildInsights uses "decreased by" for material negative rate variance changes', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2026-01-01',
      Spend: 3000,
      'All KBAs': 30,
      VCR: 0.6,
      'Video Completes': 600,
      'Video Plays': 1000,
      'Site Name': 'Hulu',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2025-10-01',
      Spend: 3000,
      'All KBAs': 25,
      VCR: 0.8,
      'Video Completes': 800,
      'Video Plays': 1000,
      'Site Name': 'Hulu',
      'Campaign / Placement Type': 'Hulu',
      Platform: 'DV360',
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Connected TV / OTT');

  assert.deepEqual(sections.variance, [
    'VCR decreased by 25.0% YoY to 60.0% from 80.0%.',
  ]);
});

test('buildInsights renders a current-year VCR fallback when CTV has no comparison-period run', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Connected TV / OTT',
      Campaign: 'Campaign A',
      Month: '2026-01-01',
      Spend: 4000,
      'All KBAs': 40,
      VCR: 0.999,
      'Video Completes': 999,
      'Video Plays': 1000,
      'Site Name': 'Programmatic Video - Connected TV/OTT',
      'Campaign / Placement Type': 'Programmatic Video - Connected TV/OTT',
      Platform: 'DV360',
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Connected TV / OTT');

  assert.deepEqual(sections.variance, [
    'Connected TV / OTT delivered a current-year VCR of 99.9%; Connected TV / OTT did not run in the comparison period.',
  ]);
});

test('buildInsights keeps quarter learnings at the channel level without campaign or platform detail', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Search',
      Platform: 'Google',
      Campaign: 'Search A',
      Month: '2026-01-01',
      Spend: 5000,
      'All KBAs': 100,
      Impressions: 10000,
      Clicks: 300,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Bing',
      Campaign: 'Search B',
      Month: '2026-02-01',
      Spend: 3200,
      'All KBAs': 30,
      Impressions: 7500,
      Clicks: 150,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Google',
      Campaign: 'Search A',
      Month: '2025-10-01',
      Spend: 4500,
      'All KBAs': 90,
      Impressions: 9000,
      Clicks: 280,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Bing',
      Campaign: 'Search B',
      Month: '2025-10-01',
      Spend: 2800,
      'All KBAs': 35,
      Impressions: 7000,
      Clicks: 170,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Search');

  assert.ok(sections.quarterLearnings.every((bullet) => bullet.startsWith('Search ')));
  assert.ok(sections.quarterLearnings.every((bullet) => bullet.includes('Q1 2026')));
  assert.ok(sections.quarterLearnings.every((bullet) => bullet.includes(COMPARISON_QUARTER.label)));
  assert.ok(sections.quarterLearnings.some((bullet) => bullet.includes('CPKBA')));
  assert.ok(sections.quarterLearnings.every((bullet) => !/\bGoogle\b|\bBing\b|\bSearch A\b|\bSearch B\b/.test(bullet)));
});

test('buildInsights uses efficiency direction wording when CPKBA rises in quarter learnings', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Social',
      Platform: 'Meta',
      Campaign: 'Social A',
      Month: '2026-01-01',
      Spend: 1369746.46,
      'All KBAs': 378383,
      Impressions: 1000000,
      Clicks: 10000,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta',
      Campaign: 'Social A',
      Month: '2025-10-01',
      Spend: 809532.99,
      'All KBAs': 312561,
      Impressions: 950000,
      Clicks: 9000,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Social');

  assert.deepEqual(sections.quarterLearnings, [
    'Social KBAs increased 21.1% quarter over quarter, reaching 378,383 in Q1 2026 vs 312,561 in Q4 2025. CPKBA efficiency decreased 39.8% quarter over quarter to $3.62 in Q1 2026 from $2.59 in Q4 2025.',
  ]);
});

test('buildInsights includes every active social platform in delivery bullets', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Facebook',
      Campaign: 'Military',
      Month: '2026-01-01',
      Spend: 300,
      'All KBAs': 120,
      Impressions: 10000,
      Clicks: 400,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Instagram',
      Campaign: 'Consideration',
      Month: '2026-01-01',
      Spend: 280,
      'All KBAs': 115,
      Impressions: 11000,
      Clicks: 420,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'TikTok',
      Campaign: 'Always On',
      Month: '2026-02-01',
      Spend: 260,
      'All KBAs': 90,
      Impressions: 9000,
      Clicks: 350,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Facebook',
      Campaign: 'Military',
      Month: '2025-10-01',
      Spend: 200,
      'All KBAs': 100,
      Impressions: 9000,
      Clicks: 300,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Instagram',
      Campaign: 'Consideration',
      Month: '2025-10-01',
      Spend: 190,
      'All KBAs': 90,
      Impressions: 8500,
      Clicks: 280,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'TikTok',
      Campaign: 'Always On',
      Month: '2025-10-01',
      Spend: 180,
      'All KBAs': 70,
      Impressions: 8000,
      Clicks: 250,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Social');

  assert.equal(sections.delivery.length, 3);
  assert.ok(sections.delivery.some((bullet) => bullet.startsWith('Meta - Facebook delivered')));
  assert.ok(sections.delivery.some((bullet) => bullet.startsWith('Meta - Instagram delivered')));
  assert.ok(sections.delivery.some((bullet) => bullet.startsWith('TikTok delivered')));
  assert.ok(sections.delivery.every((bullet) => /quarter over quarter/.test(bullet)));
});

test('buildInsights excludes zero-spend social platforms and campaigns from delivery sections', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Facebook',
      Campaign: 'SAV High',
      Month: '2026-01-01',
      Spend: 300,
      'All KBAs': 120,
      Impressions: 10000,
      Clicks: 400,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Instagram',
      Campaign: 'Zero Spend Campaign',
      Month: '2026-01-01',
      Spend: 0,
      'All KBAs': 115,
      Impressions: 11000,
      Clicks: 420,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Facebook',
      Campaign: 'SAV High',
      Month: '2025-10-01',
      Spend: 200,
      'All KBAs': 100,
      Impressions: 9000,
      Clicks: 300,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Instagram',
      Campaign: 'Zero Spend Campaign',
      Month: '2025-10-01',
      Spend: 0,
      'All KBAs': 90,
      Impressions: 8500,
      Clicks: 280,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Social');

  assert.ok(sections.delivery.every((bullet) => !bullet.includes('Meta - Instagram')));
  assert.ok(sections.campaignDelivery.every((bullet) => !bullet.includes('Zero Spend Campaign')));
});

test('buildInsights filters social campaign delivery to the approved campaign labels', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Facebook',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'Sedan Low',
      Month: '2026-01-01',
      Spend: 280,
      'All KBAs': 115,
      Impressions: 11000,
      Clicks: 420,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'TikTok',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'SAV High',
      Month: '2026-02-01',
      Spend: 150,
      'All KBAs': 30,
      Impressions: 7000,
      Clicks: 220,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'TikTok',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'Consideration',
      Month: '2026-02-01',
      Spend: 260,
      'All KBAs': 90,
      Impressions: 9000,
      Clicks: 350,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Instagram',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'Sedan High',
      Month: '2025-10-01',
      Spend: 200,
      'All KBAs': 100,
      Impressions: 9000,
      Clicks: 300,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Instagram',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'Sedan Low',
      Month: '2025-10-01',
      Spend: 190,
      'All KBAs': 90,
      Impressions: 8500,
      Clicks: 280,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'TikTok',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'SAV High',
      Month: '2025-10-01',
      Spend: 140,
      'All KBAs': 40,
      Impressions: 6500,
      Clicks: 200,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const socialChannel = result.channels.find((channel) => channel.channel === 'Social');

  assert.ok(socialChannel);
  const allSocialBullets = socialChannel.sections.flatMap((section) => section.bullets);
  const sections = sectionBulletsById(result, 'Social');
  assert.ok(allSocialBullets.every((bullet) => !bullet.includes('Consideration')));
  assert.ok((sections.campaignDelivery ?? []).some((bullet) => /quarter over quarter/.test(bullet)));
});

test('buildInsights renders a social campaign takeaway for each allowed campaign in scope', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Facebook',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'SAV High',
      Month: '2026-01-01',
      Spend: 500,
      'All KBAs': 120,
      Impressions: 10000,
      Clicks: 400,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Instagram',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'SAV Low',
      Month: '2026-01-01',
      Spend: 420,
      'All KBAs': 125,
      Impressions: 11000,
      Clicks: 430,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'TikTok',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'Sedan Low',
      Month: '2026-02-01',
      Spend: 310,
      'All KBAs': 70,
      Impressions: 9000,
      Clicks: 300,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'TikTok',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'EV',
      Month: '2026-02-01',
      Spend: 220,
      'All KBAs': 65,
      Impressions: 8500,
      Clicks: 280,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Facebook',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'Sedan High',
      Month: '2026-03-01',
      Spend: 140,
      'All KBAs': 35,
      Impressions: 6000,
      Clicks: 180,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Social');

  assert.equal(sections.campaignDelivery.length, 5);
  assert.ok(sections.campaignDelivery[0]?.startsWith('SAV High accounted for'));
  assert.ok(sections.campaignDelivery.some((bullet) => bullet.startsWith('SAV Low accounted for')));
  assert.ok(sections.campaignDelivery.some((bullet) => bullet.startsWith('Sedan Low accounted for')));
  assert.ok(sections.campaignDelivery.some((bullet) => bullet.startsWith('EV accounted for')));
  assert.ok(sections.campaignDelivery.some((bullet) => bullet.startsWith('Sedan High accounted for')));
});

test('buildInsights aggregates social campaign takeaways across platforms for the same campaign label', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Facebook',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'SAV High',
      Month: '2026-01-01',
      Spend: 500,
      'All KBAs': 120,
      Impressions: 10000,
      Clicks: 400,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'TikTok',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'SAV High',
      Month: '2026-02-01',
      Spend: 300,
      'All KBAs': 80,
      Impressions: 9000,
      Clicks: 280,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Instagram',
      Campaign: 'Fallback Campaign Name',
      'Campaign Sub-Category (T2 Reporting Only)': 'SAV Low',
      Month: '2026-01-01',
      Spend: 420,
      'All KBAs': 125,
      Impressions: 11000,
      Clicks: 430,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Social');
  const savHighBullets = sections.campaignDelivery.filter((bullet) => bullet.startsWith('SAV High accounted for'));

  assert.equal(savHighBullets.length, 1);
  assert.equal(sections.campaignDelivery.length, 2);
  assert.ok(sections.campaignDelivery.every((bullet) => !bullet.includes('share of investment')));
});

test('buildInsights keeps social optimization and recommendation bullets grounded when sub-category labels differ from raw campaign names', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Social',
      Platform: 'Meta - Facebook',
      Campaign: 'Raw Campaign Alpha',
      'Campaign Sub-Category (T2 Reporting Only)': 'SAV High',
      Month: '2026-01-01',
      Spend: 500,
      'All KBAs': 200,
      Impressions: 10000,
      Clicks: 400,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'TikTok',
      Campaign: 'Raw Campaign Beta',
      'Campaign Sub-Category (T2 Reporting Only)': 'Military',
      Month: '2026-02-01',
      Spend: 300,
      'All KBAs': 30,
      Impressions: 8000,
      Clicks: 120,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Social');

  assert.deepEqual(result.audit, {
    renderedChannelCount: 1,
    renderedSectionCount: 5,
    renderedBulletCount: 7,
    metricClaimCount: 7,
    reconciledMetricClaimCount: 7,
    groundedBulletCount: 7,
    blockedBulletCount: 0,
    blockedSectionCount: 1,
  });
  assert.ok((sections.optimizations ?? []).some((bullet) => bullet.startsWith('Optimize Military')));
  assert.ok((sections.recommendations ?? []).some((bullet) => bullet.includes('/ SAV High based on CPKBA')));
});

test('buildInsights uses efficiency direction wording when CPKBA changes in YoY variance', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Social',
      Platform: 'Meta',
      Campaign: 'Social A',
      Month: '2026-01-01',
      Spend: 407,
      'All KBAs': 100,
      Impressions: 10000,
      Clicks: 500,
    }),
    makeRow({
      Channel: 'Social',
      Platform: 'Meta',
      Campaign: 'Social A',
      Month: '2025-10-01',
      Spend: 306,
      'All KBAs': 100,
      Impressions: 9500,
      Clicks: 450,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, COMPARISON_QUARTER);
  const sections = sectionBulletsById(result, 'Social');

  assert.ok(sections.variance.includes('CPKBA efficiency decreased by 33.0% YoY to $4.07 from $3.06.'));
});

test('buildVarianceRewriteSpec adds VCR-only guardrails for video variance bullets', () => {
  const spec = buildVarianceRewriteSpec('Connected TV / OTT', 'VCR remained stable YoY at 84.0% vs 83.4%.');

  assert.equal(spec.section, 'variance');
  assert.ok(spec.requiredTerms.includes('VCR'));
  assert.ok(spec.requiredTerms.includes('stable'));
  assert.ok(spec.forbiddenTerms.includes('KBA'));
  assert.ok(spec.forbiddenTerms.includes('worsened'));
  assert.deepEqual(spec.approvedNumbers, ['84.0%', '83.4%']);
});

test('validateInsightRewrite rejects forbidden terms and unapproved numbers', () => {
  const spec = buildVarianceRewriteSpec('Connected TV / OTT', 'VCR remained stable YoY at 84.0% vs 83.4%.');

  assert.deepEqual(validateInsightRewrite(spec, 'VCR remained stable YoY at 84.0% vs 83.4%.'), { valid: true });
  assert.deepEqual(validateInsightRewrite(spec, 'VCR worsened 84.0% vs 83.4%.'), {
    valid: false,
    reason: 'forbidden term: worsened',
  });
  assert.deepEqual(validateInsightRewrite(spec, 'VCR remained stable YoY at 84.0% vs 12.0%.'), {
    valid: false,
    reason: 'introduced unapproved number',
  });
  assert.deepEqual(validateInsightRewrite(spec, 'VCR remained stable YoY at 84.0% vs 83.4% (Awareness / Video Views).'), {
    valid: false,
    reason: 'introduced unapproved parenthetical context',
  });
});

test('buildVarianceRewriteSpec preserves CPKBA efficiency wording and rejects legacy direction words', () => {
  const spec = buildVarianceRewriteSpec('Social', 'CPKBA efficiency decreased by 33.0% YoY to $4.07 from $3.06.');

  assert.ok(spec.requiredTerms.includes('CPKBA'));
  assert.ok(spec.requiredTerms.includes('efficiency decreased'));
  assert.ok(spec.forbiddenTerms.includes('improved'));
  assert.ok(spec.forbiddenTerms.includes('declined'));
  assert.deepEqual(validateInsightRewrite(spec, 'CPKBA improved by 33.0% YoY to $4.07 from $3.06.'), {
    valid: false,
    reason: 'forbidden term: improved',
  });
  assert.deepEqual(validateInsightRewrite(spec, 'CPKBA declined 33.0% YoY to $4.07 from $3.06.'), {
    valid: false,
    reason: 'forbidden term: declined',
  });
});

test('buildInsightRewriteSpec preserves both KBA volume and CPKBA terms in quarter learnings', () => {
  const bullet =
    'Social KBAs increased 21.1% quarter over quarter, reaching 378,383 in Q1 2026 vs 312,561 in Q4 2025. CPKBA efficiency decreased 39.8% quarter over quarter to $3.62 in Q1 2026 from $2.59 in Q4 2025.';
  const spec = buildInsightRewriteSpec('Social', 'quarterLearnings', bullet);

  assert.ok(spec.requiredTerms.includes('KBAs'));
  assert.ok(spec.requiredTerms.includes('KBAs increased'));
  assert.ok(spec.requiredTerms.includes('CPKBA'));
  assert.ok(spec.requiredTerms.includes('efficiency decreased'));
  assert.deepEqual(
    validateInsightRewrite(spec, 'Social CPKBA efficiency decreased 39.8% quarter over quarter to $3.62 in Q1 2026 from $2.59 in Q4 2025.'),
    {
      valid: false,
      reason: 'missing required term: KBAs',
    },
  );
  assert.deepEqual(
    validateInsightRewrite(
      spec,
      'Social KBAs reached 378,383 in Q1 2026 vs 312,561 in Q4 2025, while CPKBA efficiency decreased 39.8% quarter over quarter to $3.62 in Q1 2026 from $2.59 in Q4 2025.',
    ),
    {
      valid: false,
      reason: 'missing required term: KBAs increased',
    },
  );
});

test('buildInsightRewriteSpec does not infer a KBA decrease requirement from a later CPKBA clause', () => {
  const bullet =
    'Social KBAs increased 17.6% year over year, reaching 694,938 in Q1 2026 vs 591,111 in Q1 2025. CPKBA efficiency decreased 32.9% year over year to $4.07 in Q1 2026 from $3.06 in Q1 2025.';
  const spec = buildInsightRewriteSpec('Social', 'quarterLearnings', bullet);

  assert.ok(spec.requiredTerms.includes('KBAs'));
  assert.ok(spec.requiredTerms.includes('KBAs increased'));
  assert.ok(!spec.requiredTerms.includes('KBAs decreased'));
  assert.deepEqual(
    validateInsightRewrite(
      spec,
      'Social KBAs increased 17.6% year over year to 694,938 in Q1 2026 from 591,111 in Q1 2025, while CPKBA efficiency decreased 32.9% year over year to $4.07 in Q1 2026 from $3.06 in Q1 2025.',
    ),
    { valid: true },
  );
});

test('buildCampaignAppendixRows includes both quarter columns and preserves comparison-only rows', () => {
  const currentChannelMap = new Map([
    ['Search', { channel: 'Search', platform: 'Search - Google Ads', spend: 100, kbas: 20, byoStarts: 10, byoCompletes: 5, inventorySearches: 8, leads: 2, impressions: 1000 }],
  ]);
  const comparisonChannelMap = new Map([
    ['Search', { channel: 'Search', platform: 'Search - Google Ads', spend: 80, kbas: 16, byoStarts: 8, byoCompletes: 4, inventorySearches: 6, leads: 1, impressions: 900 }],
    ['Social', { channel: 'Social', platform: 'Meta - Facebook', spend: 60, kbas: 12, byoStarts: 7, byoCompletes: 3, inventorySearches: 4, leads: 1, impressions: 700 }],
  ]);
  const currentManagedByMap = new Map([
    ['Search::Search - Google Ads', { channel: 'Search', platform: 'Search - Google Ads', spend: 100, kbas: 20, byoStarts: 10, byoCompletes: 5, inventorySearches: 8, leads: 2, impressions: 1000 }],
  ]);
  const comparisonManagedByMap = new Map([
    ['Search::Search - Google Ads', { channel: 'Search', platform: 'Search - Google Ads', spend: 80, kbas: 16, byoStarts: 8, byoCompletes: 4, inventorySearches: 6, leads: 1, impressions: 900 }],
    ['Social::Meta - Facebook', { channel: 'Social', platform: 'Meta - Facebook', spend: 60, kbas: 12, byoStarts: 7, byoCompletes: 3, inventorySearches: 4, leads: 1, impressions: 700 }],
  ]);

  const rows = buildCampaignAppendixRows(
    currentChannelMap,
    comparisonChannelMap,
    currentManagedByMap,
    comparisonManagedByMap,
  );

  const searchPlatform = rows.find((row) => row.rowType === 'platform' && row.channel === 'Search');
  const socialPlatform = rows.find((row) => row.rowType === 'platform' && row.channel === 'Social');

  assert.ok(searchPlatform);
  assert.equal(searchPlatform.current.spendDisplay, '$100.00');
  assert.equal(searchPlatform.comparison.spendDisplay, '$80.00');
  assert.equal(searchPlatform.current.spendDeltaLabel, '+25%');

  assert.ok(socialPlatform);
  assert.equal(socialPlatform.current.spendDisplay, '$0.00');
  assert.equal(socialPlatform.comparison.spendDisplay, '$60.00');
  assert.equal(socialPlatform.current.spendDeltaLabel, '-100%');
});

test('buildInsights retains all Search platform delivery bullets', () => {
  const rows: DetailRow[] = [
    makeRow({
      Channel: 'Search',
      Platform: 'Search - Google Ads',
      Campaign: 'Search - Google Ads',
      Month: '2026-01-01',
      Spend: 1700000,
      'All KBAs': 450000,
      Clicks: 1200000,
      Impressions: 18000000,
      VCR: null,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Search - Google Performance Max',
      Campaign: 'Search - Google Performance Max',
      Month: '2026-01-01',
      Spend: 520000,
      'All KBAs': 205000,
      Clicks: 500000,
      Impressions: 10000000,
      VCR: null,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Search - Bing Ads',
      Campaign: 'Search - Bing Ads',
      Month: '2026-01-01',
      Spend: 392000,
      'All KBAs': 60500,
      Clicks: 190000,
      Impressions: 6000000,
      VCR: null,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Search - Google Ads',
      Campaign: 'Search - Google Ads',
      Month: '2025-01-01',
      Spend: 2100000,
      'All KBAs': 390000,
      Clicks: 1500000,
      Impressions: 19000000,
      VCR: null,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Search - Google Performance Max',
      Campaign: 'Search - Google Performance Max',
      Month: '2025-01-01',
      Spend: 610000,
      'All KBAs': 165000,
      Clicks: 650000,
      Impressions: 11000000,
      VCR: null,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
    makeRow({
      Channel: 'Search',
      Platform: 'Search - Bing Ads',
      Campaign: 'Search - Bing Ads',
      Month: '2025-01-01',
      Spend: 420000,
      'All KBAs': 51000,
      Clicks: 300000,
      Impressions: 7000000,
      VCR: null,
      'Video Completes': 0,
      'Video Plays': 0,
    }),
  ];

  const result = buildInsights(rows, CURRENT_QUARTER, PRIOR_YEAR_SAME_QUARTER);
  const searchBullets = sectionBulletsById(result, 'Search').delivery;

  assert.equal(searchBullets.length, 3);
  assert.ok(searchBullets.some((bullet) => bullet.includes('Search - Google Ads')));
  assert.ok(searchBullets.some((bullet) => bullet.includes('Search - Google Performance Max')));
  assert.ok(searchBullets.some((bullet) => bullet.includes('Search - Bing Ads')));
  assert.ok(searchBullets.every((bullet) => bullet.includes('CPKBA')));
});

test('rewriteInsightChannels applies validated rewrites across insight sections when rewrite is mandatory', async () => {
  const channels = [
    {
      channel: 'Connected TV / OTT',
      sections: [
        { id: 'variance' as const, title: 'YoY Variances', bullets: ['VCR remained stable YoY at 84.0% vs 83.4%.'] },
        { id: 'delivery' as const, title: 'Delivery by Platform/Channel/Campaign', bullets: ['Hulu delivered 66.7% of spend with a VCR of 84.0%.'] },
      ],
    },
  ];

  const rewritten = await rewriteInsightChannels(
    channels,
    async (spec) => {
      if (spec.section === 'variance') {
        return 'VCR remained stable YoY at 84.0% vs 83.4%.';
      }
      if (spec.section === 'delivery') {
        return 'Hulu delivered 66.7% of spend with a VCR of 84.0%.';
      }
      return 'VCR worsened 10.0% vs last month.';
    },
    { model: 'test-model', loggingEnabled: false },
  );

  assert.deepEqual(rewritten[0].sections[0].bullets, ['VCR remained stable YoY at 84.0% vs 83.4%.']);
  assert.deepEqual(rewritten[0].sections[1].bullets, ['Hulu delivered 66.7% of spend with a VCR of 84.0%.']);
});

test('rewriteInsightChannels throws when a mandatory rewrite fails', async () => {
  const channels = [
    {
      channel: 'Connected TV / OTT',
      sections: [
        { id: 'variance' as const, title: 'YoY Variances', bullets: ['VCR remained stable YoY at 84.0% vs 83.4%.'] },
      ],
    },
  ];

  await assert.rejects(
    rewriteInsightChannels(
      channels,
      async () => {
        throw new Error('Mandatory insight rewrite failed validation for Connected TV / OTT/variance: introduced unapproved number');
      },
      { model: 'test-model', loggingEnabled: false },
    ),
    /Mandatory insight rewrite failed validation/,
  );
});
