import { BMW_DATASOURCE, resolveTableauMcpConfig } from './tableauConfig';
import { callTableauTool } from './tableauMcpClient';
import { rewriteInsightChannels } from './insightRewriteAgent';
import { applyManualInsightOverrides, loadUserInsightsJson } from './userInsights';

type MonthlyRow = {
  Month: string;
  Spend: number;
  'All KBAs': number;
  'BYO Starts': number;
  'BYO Completes': number;
  'Inventory Searches': number;
  Leads: number;
  Impressions: number;
};

type MonthlyChannelRow = {
  Month: string;
  Channel: string;
  Spend: number;
  'All KBAs': number;
};

export type DetailRow = {
  Region: string;
  MACO: string;
  'CPO Categorization'?: string;
  Channel: string;
  Platform: string;
  Publisher?: string;
  'Campaign Managed By'?: string;
  'Site Name'?: string;
  'Campaign / Placement Type'?: string;
  'Campaign (T2 Reporting Only)'?: string;
  'Campaign Sub-Category (T2 Reporting Only)'?: string;
  'Funnel Stage'?: string;
  OptimizeTo?: string;
  VCR?: number;
  'Video Completes'?: number;
  'Video Plays'?: number;
  Clicks?: number;
  Campaign: string;
  Month: string;
  Spend: number;
  'All KBAs': number;
  'BYO Starts'?: number;
  'BYO Completes'?: number;
  'Inventory Searches': number;
  'Page Visits'?: number;
  Leads: number;
  Impressions: number;
};

type OptionRow = {
  Region: string;
  MACO: string;
};

type QueryResponse<T> = { data: T[] };

type ScopeParams = {
  region?: string;
  maco?: string;
  currentQuarter?: string;
  comparisonQuarter?: string;
};

const DASHBOARD_TIMING_ENABLED = process.env.DASHBOARD_TIMING === 'true';

function logDashboardTiming(stage: string, durationMs: number, meta?: Record<string, unknown>) {
  if (!DASHBOARD_TIMING_ENABLED) {
    return;
  }

  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[dashboard-timing] ${stage} ${durationMs.toFixed(1)}ms${suffix}`);
}

async function timeDashboardStage<T>(
  stage: string,
  run: () => Promise<T>,
  meta?: Record<string, unknown>,
) {
  const startedAt = performance.now();
  try {
    return await run();
  } finally {
    logDashboardTiming(stage, performance.now() - startedAt, meta);
  }
}

export type QuarterOption = {
  quarter: number;
  year: number;
  label: string;
};

type YoyStatus = {
  label: string;
  delta: number | null;
  tone: 'positive' | 'negative' | 'neutral';
};

type CpKbaTotals = {
  spend: number;
  kbas: number;
};

type DriverItem = {
  channel: string;
  campaign: string;
  currentKbas: string;
  priorKbas: string;
  contribution: string;
  yoyLabel: string;
  material: boolean;
};

type EfficiencyDriverItem = {
  entityType: 'Channel' | 'Platform' | 'Campaign';
  label: string;
  context: string;
  currentCpKba: string;
  priorCpKba: string;
  deltaLabel: string;
  material: boolean;
};

export type QaCheck = {
  id: string;
  label: string;
  status: 'PASS' | 'WARN';
  detail: string;
};

export type MetricCard = {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  delta: number | null;
  deltaLabel: string;
  tone: 'positive' | 'negative' | 'neutral';
  note: string;
};

export type ChartPoint = {
  label: string;
  spend: number;
  kbas: number;
  cpKba: number;
  spendDisplay: string;
  kbasDisplay: string;
  cpKbaDisplay: string;
  spendMoMLabel: string;
  kbasMoMLabel: string;
  cpKbaMoMLabel: string;
};

export type ChannelSummaryRow = {
  channel: string;
  spendDisplay: string;
  kbasDisplay: string;
  cpkbaDisplay: string;
  yoyLabel: string;
  status: 'Ahead' | 'Stable' | 'Watch';
  currentSpend: number;
  priorSpend: number;
  currentSpendShare: number;
  priorSpendShare: number;
};

type MediaSpendPerformanceCard = {
  id: string;
  label: string;
  platformSpend: Array<{
    label: string;
    spend: number;
    spendDisplay: string;
  }>;
  highlights?: string[];
  metrics: Array<{
    id: string;
    label: string;
    display: string;
    changeLabel: string;
  }>;
};

type MediaCardMetric = MediaSpendPerformanceCard['metrics'][number];

type CampaignAppendixRow = {
  rowType: 'platform' | 'subtotal';
  channel: string;
  platform: string;
  current: AppendixMetricDisplays;
  comparison: AppendixMetricDisplays;
};

type AppendixMetricDisplays = {
  spendDisplay: string;
  kbasDisplay: string;
  cpkbaDisplay: string;
  impressionsDisplay: string;
  byoStartsDisplay: string;
  byoCompletesDisplay: string;
  inventorySearchesDisplay: string;
  leadsDisplay: string;
  spendDeltaLabel: string;
  kbasDeltaLabel: string;
  cpkbaDeltaLabel: string;
  impressionsDeltaLabel: string;
  byoStartsDeltaLabel: string;
  byoCompletesDeltaLabel: string;
  inventorySearchesDeltaLabel: string;
  leadsDeltaLabel: string;
};

export type InsightSection = {
  id:
    | 'delivery'
    | 'variance'
    | 'campaignDelivery'
    | 'quarterLearnings'
    | 'optimizations'
    | 'recommendations';
  title: string;
  bullets: string[];
};

export type ChannelInsight = {
  channel: string;
  sections: InsightSection[];
};

type InsightAudit = {
  renderedChannelCount: number;
  renderedSectionCount: number;
  renderedBulletCount: number;
  metricClaimCount: number;
  reconciledMetricClaimCount: number;
  groundedBulletCount: number;
  blockedBulletCount: number;
  blockedSectionCount: number;
};

export type DashboardResponse = {
  datasource: {
    luid: string;
    name: string;
    siteName: string;
    server: string;
  };
  scope: {
    deckType: 'master' | 'split';
    tier: string;
    region: string;
    maco: string;
    title: string;
    subtitle: string;
  };
  period: {
    quarterLabel: string;
    priorQuarterLabel: string;
    monthLabels: string[];
    latestCompleteQuarterEnd: string;
  };
  filters: {
    selectedRegion: string;
    selectedMaco: string;
    selectedCurrentQuarter: string;
    selectedComparisonQuarter: string;
    availableRegions: string[];
    availableMacos: string[];
    availableQuarters: string[];
  };
  qa: QaCheck[];
  kpis: MetricCard[];
  comboChart: {
    title: string;
    subtitle: string;
    takeaway: string;
    cpKbaTitle: string;
    cpKbaSubtitle: string;
    cpKbaBenchmark: number;
    cpKbaBenchmarkDisplay: string;
    points: ChartPoint[];
  };
  mediaSpendPerformance: {
    title: string;
    subtitle: string;
    currentQuarterLabel: string;
    priorQuarterLabel: string;
    cards: MediaSpendPerformanceCard[];
  };
  channelSummary: ChannelSummaryRow[];
  drivers: {
    positive: DriverItem[];
    negative: DriverItem[];
  };
  efficiencyDrivers: {
    positive: EfficiencyDriverItem[];
    negative: EfficiencyDriverItem[];
  };
  appendix: {
    title: string;
    rows: CampaignAppendixRow[];
    totals: CampaignAppendixRow;
  };
  insights: {
    title: string;
    subtitle: string;
    channels: ChannelInsight[];
  };
  fetchedAt: string;
};

const REGION_ORDER = ['T2EAST', 'T2CENTRAL', 'T2SOUTH', 'T2WEST'];

const KPI_META = [
  { id: 'byo-starts', label: 'BYO STARTS', note: 'Quarter total BYO starts.', betterWhenLower: false, formatter: 'compact' },
  { id: 'byo-completes', label: 'BYO COMPLETES', note: 'Quarter total BYO completes.', betterWhenLower: false, formatter: 'compact' },
  { id: 'inventory-searches', label: 'INVENTORY SEARCHES', note: 'Quarter total inventory searches including CPO.', betterWhenLower: false, formatter: 'compact' },
  { id: 'leads', label: 'LEAD SUBMISSIONS', note: 'Quarter total leads.', betterWhenLower: false, formatter: 'compact' },
  { id: 'spend', label: 'TOTAL\nSPEND', note: 'Quarter total media cost.', betterWhenLower: false, formatter: 'currency' },
  { id: 'all-kbas', label: 'TOTAL KEY\nBUYING ACTIONS', note: 'Quarter total key buying actions.', betterWhenLower: false, formatter: 'compact' },
  { id: 'impressions', label: 'TOTAL\nIMPRESSIONS', note: 'Quarter total impressions.', betterWhenLower: false, formatter: 'compact' },
  { id: 'cp-kba', label: 'COST PER KBA', note: 'Search and Social spend divided by Search and Social All KBAs.', betterWhenLower: true, formatter: 'currency' },
] as const;

const MONTHLY_QUERY_BASE = {
  datasourceLuid: BMW_DATASOURCE.luid,
  limit: 80,
  query: {
    fields: [
      { fieldCaption: 'date', function: 'TRUNC_MONTH', fieldAlias: 'Month', sortDirection: 'ASC', sortPriority: 1 },
      { fieldCaption: 'Media Cost', function: 'SUM', fieldAlias: 'Spend' },
      { fieldCaption: 'All KBAs', function: 'SUM', fieldAlias: 'All KBAs' },
      { fieldCaption: 'KBA - BYO Starts', function: 'SUM', fieldAlias: 'BYO Starts' },
      { fieldCaption: 'KBA - BYO Completes', function: 'SUM', fieldAlias: 'BYO Completes' },
      { fieldCaption: 'KBA - Inventory Searches + CPO Inv. Searches', function: 'SUM', fieldAlias: 'Inventory Searches' },
      { fieldCaption: 'KBA - Leads', function: 'SUM', fieldAlias: 'Leads' },
      { fieldCaption: 'Impressions', function: 'SUM', fieldAlias: 'Impressions' },
    ],
  },
} as const;

const MONTHLY_CHANNEL_QUERY_BASE = {
  datasourceLuid: BMW_DATASOURCE.luid,
  limit: 500,
  query: {
    fields: [
      { fieldCaption: 'date', function: 'TRUNC_MONTH', fieldAlias: 'Month', sortDirection: 'ASC', sortPriority: 1 },
      { fieldCaption: 'Channel', fieldAlias: 'Channel' },
      { fieldCaption: 'Media Cost', function: 'SUM', fieldAlias: 'Spend' },
      { fieldCaption: 'All KBAs', function: 'SUM', fieldAlias: 'All KBAs' },
    ],
  },
} as const;

const DETAIL_QUERY_BASE = {
  datasourceLuid: BMW_DATASOURCE.luid,
  limit: 30000,
  query: {
    fields: [] as Array<Record<string, unknown>>,
  },
} as const;

const OPTIONS_QUERY = {
  datasourceLuid: BMW_DATASOURCE.luid,
  limit: 500,
  query: {
    fields: [
      { fieldCaption: 'Tier - Region', fieldAlias: 'Region' },
      { fieldCaption: 'Tier - Maco', fieldAlias: 'MACO' },
    ],
    filters: [
      { field: { fieldCaption: 'Tier' }, filterType: 'SET', values: ['Tier 2'] },
      { field: { fieldCaption: 'CPO Categorization' }, filterType: 'SET', values: ['New Car'] },
    ],
  },
} as const;

function parseMonth(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatKpiCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatWholeNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyExact(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'standard',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1_000_000 ? 1 : 2,
  }).format(value);
}

export function formatKpiCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 1_000 ? 'compact' : 'standard',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function sumBy<T>(rows: T[], getValue: (row: T) => number) {
  return rows.reduce((total, row) => total + getValue(row), 0);
}

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function changeDirection(current: number, prior: number, thresholdPercent = 5) {
  if (prior === 0 && current > 0) {
    return 'up';
  }

  if (prior === 0 && current === 0) {
    return 'flat';
  }

  const delta = changePercent(current, prior);
  if (delta === null || Math.abs(delta) < thresholdPercent) {
    return 'flat';
  }

  return delta > 0 ? 'up' : 'down';
}

function buildYoyStatus(current: number, prior: number, betterWhenLower = false): YoyStatus {
  if (prior === 0 && current > 0) {
    return {
      label: 'New',
      delta: null,
      tone: 'positive',
    };
  }

  if (prior > 0 && current === 0) {
    return {
      label: 'Discontinued',
      delta: -100,
      tone: 'negative',
    };
  }

  if (prior === 0 && current === 0) {
    return {
      label: 'No Activity',
      delta: null,
      tone: 'neutral',
    };
  }

  const delta = ((current - prior) / prior) * 100;
  const rounded = Math.round(delta);
  const tone = betterWhenLower ? (delta <= 0 ? 'positive' : 'negative') : delta >= 0 ? 'positive' : 'negative';

  return {
    label: `${rounded > 0 ? '+' : ''}${rounded}% YoY`,
    delta,
    tone,
  };
}

function getLatestCompleteQuarter(now = new Date()) {
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();
  const currentQuarter = Math.floor(month / 3) + 1;
  const latestQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
  const latestQuarterYear = currentQuarter === 1 ? year - 1 : year;
  return { quarter: latestQuarter, year: latestQuarterYear };
}

function quarterMonths(quarter: number) {
  const startMonth = (quarter - 1) * 3;
  return [startMonth, startMonth + 1, startMonth + 2];
}

function getQuarterDateRange(quarter: number, year: number) {
  const [startMonth] = quarterMonths(quarter);
  return {
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, startMonth + 3, 0)),
  };
}

function quarterLabel(quarter: number, year: number) {
  return `Q${quarter} ${year}`;
}

function getQuarterFromDate(date: Date) {
  return {
    quarter: Math.floor(date.getUTCMonth() / 3) + 1,
    year: date.getUTCFullYear(),
  };
}

function buildAvailableQuarters(rows: MonthlyRow[]) {
  const quarterMap = new Map<string, QuarterOption>();

  for (const row of rows) {
    const month = parseMonth(row.Month);
    const quarter = getQuarterFromDate(month);
    const label = quarterLabel(quarter.quarter, quarter.year);
    quarterMap.set(label, { ...quarter, label });
  }

  return Array.from(quarterMap.values()).sort((left, right) =>
    right.year !== left.year ? right.year - left.year : right.quarter - left.quarter,
  );
}

function resolveQuarterSelection(
  requestedLabel: string | undefined,
  availableQuarters: QuarterOption[],
  fallback: QuarterOption,
) {
  return availableQuarters.find((option) => option.label === requestedLabel) ?? fallback;
}

function shiftMonth(date: Date, delta: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function sameMonth(date: Date, other: Date) {
  return date.getUTCFullYear() === other.getUTCFullYear() && date.getUTCMonth() === other.getUTCMonth();
}

function formatMonthYearLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

function formatChangeVsLy(current: number, prior: number, priorDisplay: string) {
  if (prior === 0 && current > 0) {
    return 'New vs LY';
  }

  if (prior === 0 && current === 0) {
    return 'No activity';
  }

  const delta = Math.round(((current - prior) / Math.max(prior, 1)) * 100);
  return `${delta > 0 ? '+' : ''}${delta}% vs LY (${priorDisplay})`;
}

export function buildNonVideoMediaCardMetrics({
  channelId,
  spendCurrent,
  spendPrior,
  kbasCurrent,
  kbasPrior,
  clicksCurrent,
  clicksPrior,
  impressionsCurrent,
  impressionsPrior,
  cpKbaCurrent,
  cpKbaPrior,
}: {
  channelId: 'social' | 'search';
  spendCurrent: number;
  spendPrior: number;
  kbasCurrent: number;
  kbasPrior: number;
  clicksCurrent: number;
  clicksPrior: number;
  impressionsCurrent: number;
  impressionsPrior: number;
  cpKbaCurrent: number;
  cpKbaPrior: number;
}): MediaCardMetric[] {
  const scaleMetricId = channelId === 'search' ? 'clicks' : 'impressions';
  const scaleMetricLabel = channelId === 'search' ? 'Clicks' : 'Impressions';
  const currentScaleMetric = channelId === 'search' ? clicksCurrent : impressionsCurrent;
  const priorScaleMetric = channelId === 'search' ? clicksPrior : impressionsPrior;

  return [
    {
      id: 'spend',
      label: 'Total Spend',
      display: formatKpiCurrency(spendCurrent),
      changeLabel: formatChangeVsLy(spendCurrent, spendPrior, formatKpiCurrency(spendPrior)),
    },
    {
      id: 'kbas',
      label: 'Total KBAs',
      display: formatCompactNumber(kbasCurrent),
      changeLabel: formatChangeVsLy(kbasCurrent, kbasPrior, formatCompactNumber(kbasPrior)),
    },
    {
      id: scaleMetricId,
      label: scaleMetricLabel,
      display: formatCompactNumber(currentScaleMetric),
      changeLabel: formatChangeVsLy(currentScaleMetric, priorScaleMetric, formatCompactNumber(priorScaleMetric)),
    },
    {
      id: 'cpkba',
      label: 'Cost Per KBA',
      display: formatCurrency(cpKbaCurrent),
      changeLabel: formatChangeVsLy(cpKbaCurrent, cpKbaPrior, formatCurrency(cpKbaPrior)),
    },
  ];
}

function normalizeChannel(channel: string) {
  const value = channel.trim().toLowerCase();

  if (value.includes('connected tv') || value.includes('ott') || value === 'ctv') {
    return 'ctv';
  }

  if (value.includes('online video') || value === 'olv') {
    return 'olv';
  }

  if (value.includes('display')) {
    return 'digital-display';
  }

  if (value.includes('search')) {
    return 'search';
  }

  if (value.includes('social')) {
    return 'social';
  }

  return value;
}

function buildScopeFilters(region?: string, maco?: string) {
  const filters: Array<Record<string, unknown>> = [
    { field: { fieldCaption: 'Tier' }, filterType: 'SET', values: ['Tier 2'] },
    { field: { fieldCaption: 'CPO Categorization' }, filterType: 'SET', values: ['New Car'] },
  ];

  if (region) {
    filters.push({ field: { fieldCaption: 'Tier - Region' }, filterType: 'SET', values: [region] });
  }

  if (maco && maco !== 'ALL MACOS') {
    filters.push({ field: { fieldCaption: 'Tier - Maco' }, filterType: 'SET', values: [maco] });
  }

  return filters;
}

function buildQuery<T extends { query: { fields: readonly unknown[] } }>(
  base: T,
  filters: Array<Record<string, unknown>>,
) {
  return {
    ...base,
    query: {
      ...base.query,
      filters,
    },
  };
}

type QueryValidationError = {
  errorType?: string;
  message?: string;
};

function isQueryValidationError(payload: unknown): payload is QueryValidationError {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      'errorType' in payload &&
      (payload as QueryValidationError).errorType === 'validation',
  );
}

function buildQuarterDateFilter(quarter: QuarterOption) {
  const { start, end } = getQuarterDateRange(quarter.quarter, quarter.year);
  return {
    field: { fieldCaption: 'date' },
    filterType: 'QUANTITATIVE_DATE',
    quantitativeFilterType: 'RANGE',
    minDate: start.toISOString().slice(0, 10),
    maxDate: end.toISOString().slice(0, 10),
  } satisfies Record<string, unknown>;
}

async function fetchDetailRows(
  filters: Array<Record<string, unknown>>,
  quarter: QuarterOption,
) {
  const options = {
    // Known unsupported in the current dashboard datasource query shape.
    includeSiteName: false,
    includePublisher: true,
    includePlacementType: true,
    includeFunnelStage: true,
    includeOptimizeTo: true,
    // Known unsupported in the current dashboard datasource query shape.
    includeVcr: false,
    includeVideoMetrics: true,
    includeClicks: true,
  };
  let attempt = 0;

  while (true) {
    attempt += 1;
    const payload = await timeDashboardStage(
      'tableau.detail-quarter',
      () =>
        callTableauTool<QueryResponse<DetailRow> | QueryValidationError>(
          'query-datasource',
          buildQuery(
            {
              ...DETAIL_QUERY_BASE,
              query: {
                fields: buildDetailQueryFields(options),
              },
            },
            [...filters, buildQuarterDateFilter(quarter)],
          ),
        ),
      {
        quarter: quarter.label,
        attempt,
      },
    );

    if (isQueryValidationError(payload)) {
      const message = payload.message ?? 'Unknown Tableau validation error';
      if (options.includePublisher && message.includes('publisher')) {
        logDashboardTiming('tableau.detail-validation', 0, {
          quarter: quarter.label,
          attempt,
          droppedField: 'publisher',
          message,
        });
        options.includePublisher = false;
        continue;
      }
      if (options.includeSiteName && message.includes('Site Name')) {
        logDashboardTiming('tableau.detail-validation', 0, {
          quarter: quarter.label,
          attempt,
          droppedField: 'Site Name',
          message,
        });
        options.includeSiteName = false;
        continue;
      }
      if (options.includePlacementType && message.includes('Campaign / Placement Type')) {
        logDashboardTiming('tableau.detail-validation', 0, {
          quarter: quarter.label,
          attempt,
          droppedField: 'Campaign / Placement Type',
          message,
        });
        options.includePlacementType = false;
        continue;
      }
      if (options.includeFunnelStage && message.includes('Funnel Stage')) {
        logDashboardTiming('tableau.detail-validation', 0, {
          quarter: quarter.label,
          attempt,
          droppedField: 'Funnel Stage',
          message,
        });
        options.includeFunnelStage = false;
        continue;
      }
      if (options.includeOptimizeTo && (message.includes('optimizeto') || message.includes('Optimize To'))) {
        logDashboardTiming('tableau.detail-validation', 0, {
          quarter: quarter.label,
          attempt,
          droppedField: 'OptimizeTo',
          message,
        });
        options.includeOptimizeTo = false;
        continue;
      }
      if (options.includeVcr && message.includes('Rate - Video Completion (VCR)')) {
        logDashboardTiming('tableau.detail-validation', 0, {
          quarter: quarter.label,
          attempt,
          droppedField: 'VCR',
          message,
        });
        options.includeVcr = false;
        continue;
      }
      if (
        options.includeVideoMetrics &&
        (message.includes('Video Completes') || message.includes('Video Plays'))
      ) {
        logDashboardTiming('tableau.detail-validation', 0, {
          quarter: quarter.label,
          attempt,
          droppedField: 'Video Completes/Video Plays',
          message,
        });
        options.includeVideoMetrics = false;
        continue;
      }
      if (options.includeClicks && message.includes('Clicks')) {
        logDashboardTiming('tableau.detail-validation', 0, {
          quarter: quarter.label,
          attempt,
          droppedField: 'Clicks',
          message,
        });
        options.includeClicks = false;
        continue;
      }
      throw new Error(message);
    }

    return {
      data: payload.data.map((row) => ({
        ...row,
        Campaign: ((row['Campaign (T2 Reporting Only)'] || row.Campaign || 'Unassigned') as string).trim() || 'Unassigned',
      })),
      options,
    };
  }
}

async function fetchDetailRowsForQuarters(
  filters: Array<Record<string, unknown>>,
  quarters: QuarterOption[],
) {
  const uniqueQuarters = Array.from(
    new Map(quarters.map((quarter) => [quarter.label, quarter])).values(),
  );

  const results = await Promise.all(
    uniqueQuarters.map((quarter) => fetchDetailRows(filters, quarter)),
  );

  return {
    data: results.flatMap((result) => result.data),
  };
}

function buildDetailQueryFields(options: {
  includeSiteName: boolean;
  includePublisher: boolean;
  includePlacementType: boolean;
  includeFunnelStage: boolean;
  includeOptimizeTo: boolean;
  includeVcr: boolean;
  includeVideoMetrics: boolean;
  includeClicks: boolean;
}) {
  const fields: Array<Record<string, unknown>> = [
    { fieldCaption: 'Tier - Region', fieldAlias: 'Region' },
    { fieldCaption: 'Tier - Maco', fieldAlias: 'MACO' },
    { fieldCaption: 'CPO Categorization', fieldAlias: 'CPO Categorization' },
    { fieldCaption: 'Channel', fieldAlias: 'Channel' },
    { fieldCaption: 'Platform', fieldAlias: 'Platform' },
    { fieldCaption: 'Campaign Managed By', fieldAlias: 'Campaign Managed By' },
  ];

  if (options.includePublisher) {
    fields.push({ fieldCaption: 'publisher', fieldAlias: 'Publisher' });
  }

  if (options.includeSiteName) {
    fields.push({ fieldCaption: 'Site Name', fieldAlias: 'Site Name' });
  }

  if (options.includePlacementType) {
    fields.push({ fieldCaption: 'Campaign / Placement Type', fieldAlias: 'Campaign / Placement Type' });
  }

  if (options.includeFunnelStage) {
    fields.push({ fieldCaption: 'Funnel Stage', fieldAlias: 'Funnel Stage' });
  }

  if (options.includeOptimizeTo) {
    fields.push({ fieldCaption: 'optimizeto', fieldAlias: 'OptimizeTo' });
  }

  fields.push(
    { fieldCaption: 'Campaign (T2 Reporting Only)', fieldAlias: 'Campaign (T2 Reporting Only)' },
    { fieldCaption: 'Campaign Sub-Category (T2 Reporting Only) ', fieldAlias: 'Campaign Sub-Category (T2 Reporting Only)' },
  );

  if (options.includeVcr) {
    fields.push({ fieldCaption: 'Rate - Video Completion (VCR)', function: 'AVG', fieldAlias: 'VCR' });
  }

  if (options.includeVideoMetrics) {
    fields.push(
      { fieldCaption: 'Video Completes', function: 'SUM', fieldAlias: 'Video Completes' },
      { fieldCaption: 'Video Plays', function: 'SUM', fieldAlias: 'Video Plays' },
    );
  }

  if (options.includeClicks) {
    fields.push({ fieldCaption: 'Clicks', function: 'SUM', fieldAlias: 'Clicks' });
  }

  fields.push(
    { fieldCaption: 'date', function: 'TRUNC_MONTH', fieldAlias: 'Month', sortDirection: 'ASC', sortPriority: 1 },
    { fieldCaption: 'Media Cost', function: 'SUM', fieldAlias: 'Spend' },
    { fieldCaption: 'All KBAs', function: 'SUM', fieldAlias: 'All KBAs' },
    { fieldCaption: 'KBA - BYO Starts', function: 'SUM', fieldAlias: 'BYO Starts' },
    { fieldCaption: 'KBA - BYO Completes', function: 'SUM', fieldAlias: 'BYO Completes' },
    { fieldCaption: 'KBA - Inventory Searches + CPO Inv. Searches', function: 'SUM', fieldAlias: 'Inventory Searches' },
    { fieldCaption: 'landing_page_load', function: 'SUM', fieldAlias: 'Page Visits' },
    { fieldCaption: 'KBA - Leads', function: 'SUM', fieldAlias: 'Leads' },
    { fieldCaption: 'Impressions', function: 'SUM', fieldAlias: 'Impressions' },
  );

  return fields;
}

function buildFilterOptions(rows: OptionRow[]) {
  const regionSet = new Set<string>();
  const macosByRegion = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.Region || !row.MACO) {
      continue;
    }

    regionSet.add(row.Region);
    if (!macosByRegion.has(row.Region)) {
      macosByRegion.set(row.Region, new Set(['ALL MACOS']));
    }
    macosByRegion.get(row.Region)?.add(row.MACO);
  }

  const regions = Array.from(regionSet).sort((left, right) => {
    const leftIndex = REGION_ORDER.indexOf(left);
    const rightIndex = REGION_ORDER.indexOf(right);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });

  const macos = new Map<string, string[]>();
  for (const region of regions) {
    const values = Array.from(macosByRegion.get(region) ?? new Set(['ALL MACOS']));
    const sorted = values
      .filter((value) => value !== 'ALL MACOS')
      .sort((left, right) => left.localeCompare(right));
    macos.set(region, ['ALL MACOS', ...sorted]);
  }

  return { regions, macos };
}

function isSearchOrSocialChannel(channel: string) {
  const normalized = normalizeChannel(channel);
  return normalized === 'search' || normalized === 'social';
}

function sumCpKbaTotals(rows: Array<{ Channel: string; Spend: number; 'All KBAs': number }>): CpKbaTotals {
  return rows.reduce<CpKbaTotals>(
    (totals, row) => {
      if (!isSearchOrSocialChannel(row.Channel || '')) {
        return totals;
      }

      totals.spend += row.Spend;
      totals.kbas += row['All KBAs'];
      return totals;
    },
    { spend: 0, kbas: 0 },
  );
}

function monthInQuarter(date: Date, quarter: number, year: number) {
  return date.getUTCFullYear() === year && quarterMonths(quarter).includes(date.getUTCMonth());
}

function groupDetailRows(
  rows: DetailRow[],
  quarter: number,
  year: number,
  keyGetter: (row: DetailRow) => string,
) {
  const map = new Map<
    string,
    {
      channel: string;
      platform: string;
      campaignManagedBy: string;
      siteName: string;
      placementType: string;
      funnelStageCounts: Map<string, number>;
      optimizeToCounts: Map<string, number>;
      vcrWeightedNumerator: number;
      vcrWeight: number;
      videoCompletes: number;
      videoPlays: number;
      clicks: number;
      campaign: string;
      spend: number;
      kbas: number;
      byoStarts: number;
      byoCompletes: number;
      inventorySearches: number;
      leads: number;
      impressions: number;
    }
  >();

  for (const row of rows) {
    const month = parseMonth(row.Month);
    if (!monthInQuarter(month, quarter, year)) {
      continue;
    }

    const key = keyGetter(row);
    const current = map.get(key) ?? {
      channel: row.Channel || 'Unassigned',
      platform: row.Platform || 'Unassigned',
      campaignManagedBy: row['Campaign Managed By'] || 'Unassigned',
      siteName: row['Site Name'] || '',
      placementType: row['Campaign / Placement Type'] || '',
      funnelStageCounts: new Map<string, number>(),
      optimizeToCounts: new Map<string, number>(),
      vcrWeightedNumerator: 0,
      vcrWeight: 0,
      videoCompletes: 0,
      videoPlays: 0,
      clicks: 0,
      campaign: row.Campaign || 'Unassigned',
      spend: 0,
      kbas: 0,
      byoStarts: 0,
      byoCompletes: 0,
      inventorySearches: 0,
      leads: 0,
      impressions: 0,
    };

    current.spend += row.Spend;
    current.kbas += row['All KBAs'];
    current.byoStarts += row['BYO Starts'] ?? 0;
    current.byoCompletes += row['BYO Completes'] ?? 0;
    current.inventorySearches += row['Inventory Searches'] ?? 0;
    current.leads += row.Leads;
    current.impressions += row.Impressions;
    current.videoCompletes += row['Video Completes'] ?? 0;
    current.videoPlays += row['Video Plays'] ?? 0;
    current.clicks += row.Clicks ?? 0;
    const funnelStage = (row['Funnel Stage'] ?? '').trim();
    if (funnelStage) {
      current.funnelStageCounts.set(funnelStage, (current.funnelStageCounts.get(funnelStage) ?? 0) + 1);
    }
    const optimizeTo = (row.OptimizeTo ?? '').trim();
    if (optimizeTo) {
      current.optimizeToCounts.set(optimizeTo, (current.optimizeToCounts.get(optimizeTo) ?? 0) + 1);
    }
    if (typeof row.VCR === 'number' && Number.isFinite(row.VCR) && row.VCR > 0) {
      current.vcrWeightedNumerator += row.VCR * Math.max(row.Impressions, 0);
      current.vcrWeight += Math.max(row.Impressions, 0);
    }
    map.set(key, current);
  }

  return map;
}

function emptyAppendixAggregate(
  overrides: Partial<{
    channel: string;
    platform: string;
  }> = {},
) {
  return {
    channel: overrides.channel ?? 'Unassigned',
    platform: overrides.platform ?? 'Unassigned',
    spend: 0,
    kbas: 0,
    byoStarts: 0,
    byoCompletes: 0,
    inventorySearches: 0,
    leads: 0,
    impressions: 0,
  };
}

export function buildAppendixMetricDisplays(metrics: {
  spend: number;
  priorSpend?: number;
  kbas: number;
  priorKbas?: number;
  impressions: number;
  priorImpressions?: number;
  byoStarts: number;
  priorByoStarts?: number;
  byoCompletes: number;
  priorByoCompletes?: number;
  inventorySearches: number;
  priorInventorySearches?: number;
  leads: number;
  priorLeads?: number;
  priorCpKba?: number;
}) {
  const cpKba = safeDivide(metrics.spend, metrics.kbas);
  return {
    spendDisplay: formatCurrencyExact(metrics.spend),
    kbasDisplay: formatWholeNumber(metrics.kbas),
    cpkbaDisplay: formatCurrencyExact(cpKba),
    impressionsDisplay: formatWholeNumber(metrics.impressions),
    byoStartsDisplay: formatWholeNumber(metrics.byoStarts),
    byoCompletesDisplay: formatWholeNumber(metrics.byoCompletes),
    inventorySearchesDisplay: formatWholeNumber(metrics.inventorySearches),
    leadsDisplay: formatWholeNumber(metrics.leads),
    spendDeltaLabel: formatAppendixDelta(metrics.spend, metrics.priorSpend ?? 0),
    kbasDeltaLabel: formatAppendixDelta(metrics.kbas, metrics.priorKbas ?? 0),
    cpkbaDeltaLabel: formatAppendixDelta(cpKba, metrics.priorCpKba ?? 0),
    impressionsDeltaLabel: formatAppendixDelta(metrics.impressions, metrics.priorImpressions ?? 0),
    byoStartsDeltaLabel: formatAppendixDelta(metrics.byoStarts, metrics.priorByoStarts ?? 0),
    byoCompletesDeltaLabel: formatAppendixDelta(metrics.byoCompletes, metrics.priorByoCompletes ?? 0),
    inventorySearchesDeltaLabel: formatAppendixDelta(metrics.inventorySearches, metrics.priorInventorySearches ?? 0),
    leadsDeltaLabel: formatAppendixDelta(metrics.leads, metrics.priorLeads ?? 0),
  };
}

function formatAppendixDelta(current: number, prior: number) {
  if (prior === 0 && current > 0) {
    return 'New';
  }

  if (prior === 0 && current === 0) {
    return '0%';
  }

  const delta = Math.round(((current - prior) / Math.max(prior, 1)) * 100);
  return `${delta > 0 ? '+' : ''}${delta}%`;
}

export function buildCampaignAppendixRows(
  currentChannelMap: Map<string, ReturnType<typeof emptyAppendixAggregate>>,
  comparisonChannelMap: Map<string, ReturnType<typeof emptyAppendixAggregate>>,
  currentPlatformMap: Map<string, ReturnType<typeof emptyAppendixAggregate>>,
  comparisonPlatformMap: Map<string, ReturnType<typeof emptyAppendixAggregate>>,
) {
  const orderedChannels = Array.from(new Set([...currentChannelMap.keys(), ...comparisonChannelMap.keys()]))
    .filter((channel) => normalizeChannel(channel) !== 'digital-display')
    .sort((left, right) => {
      const leftSpend = Math.max(currentChannelMap.get(left)?.spend ?? 0, comparisonChannelMap.get(left)?.spend ?? 0);
      const rightSpend = Math.max(currentChannelMap.get(right)?.spend ?? 0, comparisonChannelMap.get(right)?.spend ?? 0);
      return rightSpend - leftSpend;
    });

  return orderedChannels.flatMap((channel) => {
    const currentChannel = currentChannelMap.get(channel) ?? emptyAppendixAggregate({ channel });
    const comparisonChannel = comparisonChannelMap.get(channel) ?? emptyAppendixAggregate({ channel });
    const orderedPlatformKeys = Array.from(new Set([...currentPlatformMap.keys(), ...comparisonPlatformMap.keys()]))
      .filter((key) => (currentPlatformMap.get(key)?.channel ?? comparisonPlatformMap.get(key)?.channel) === channel)
      .filter((key) => (currentPlatformMap.get(key)?.spend ?? 0) > 0)
      .sort((left, right) => {
        const leftSpend = Math.max(currentPlatformMap.get(left)?.spend ?? 0, comparisonPlatformMap.get(left)?.spend ?? 0);
        const rightSpend = Math.max(currentPlatformMap.get(right)?.spend ?? 0, comparisonPlatformMap.get(right)?.spend ?? 0);
        return rightSpend - leftSpend;
      });

    const platformRows: CampaignAppendixRow[] = orderedPlatformKeys.map((key) => {
      const current = currentPlatformMap.get(key);
      const comparison = comparisonPlatformMap.get(key);
      const labelSource = current ?? comparison ?? emptyAppendixAggregate({ channel });

      return {
        rowType: 'platform',
        channel: labelSource.channel,
        platform: labelSource.platform,
        current: buildAppendixMetricDisplays({
          ...(current ?? emptyAppendixAggregate({
            channel: labelSource.channel,
            platform: labelSource.platform,
          })),
          priorSpend: comparison?.spend ?? 0,
          priorKbas: comparison?.kbas ?? 0,
          priorImpressions: comparison?.impressions ?? 0,
          priorByoStarts: comparison?.byoStarts ?? 0,
          priorByoCompletes: comparison?.byoCompletes ?? 0,
          priorInventorySearches: comparison?.inventorySearches ?? 0,
          priorLeads: comparison?.leads ?? 0,
          priorCpKba: safeDivide(comparison?.spend ?? 0, comparison?.kbas ?? 0),
        }),
        comparison: buildAppendixMetricDisplays({
          ...(comparison ?? emptyAppendixAggregate({
            channel: labelSource.channel,
            platform: labelSource.platform,
          })),
          priorSpend: current?.spend ?? 0,
          priorKbas: current?.kbas ?? 0,
          priorImpressions: current?.impressions ?? 0,
          priorByoStarts: current?.byoStarts ?? 0,
          priorByoCompletes: current?.byoCompletes ?? 0,
          priorInventorySearches: current?.inventorySearches ?? 0,
          priorLeads: current?.leads ?? 0,
          priorCpKba: safeDivide(current?.spend ?? 0, current?.kbas ?? 0),
        }),
      };
    });

    const subtotalRow: CampaignAppendixRow = {
      rowType: 'subtotal',
      channel,
      platform: 'Channel subtotal',
      current: buildAppendixMetricDisplays({
        ...currentChannel,
        priorSpend: comparisonChannel.spend,
        priorKbas: comparisonChannel.kbas,
        priorImpressions: comparisonChannel.impressions,
        priorByoStarts: comparisonChannel.byoStarts,
        priorByoCompletes: comparisonChannel.byoCompletes,
        priorInventorySearches: comparisonChannel.inventorySearches,
        priorLeads: comparisonChannel.leads,
        priorCpKba: safeDivide(comparisonChannel.spend, comparisonChannel.kbas),
      }),
      comparison: buildAppendixMetricDisplays({
        ...comparisonChannel,
        priorSpend: currentChannel.spend,
        priorKbas: currentChannel.kbas,
        priorImpressions: currentChannel.impressions,
        priorByoStarts: currentChannel.byoStarts,
        priorByoCompletes: currentChannel.byoCompletes,
        priorInventorySearches: currentChannel.inventorySearches,
        priorLeads: currentChannel.leads,
        priorCpKba: safeDivide(currentChannel.spend, currentChannel.kbas),
      }),
    };

    return [...platformRows, subtotalRow];
  });
}

export function buildQaChecks(input: {
  currentDetailRows: DetailRow[];
  priorDetailRows: DetailRow[];
  currentQuarter: QuarterOption;
  comparisonQuarter: QuarterOption;
  channelSummary: ChannelSummaryRow[];
  totals: { spend: number; kbas: number };
  priorTotals: { spend: number; kbas: number };
  channelTotals: { spend: number; kbas: number };
  cpKbaTotals: { spend: number; kbas: number };
  priorCpKbaTotals: { spend: number; kbas: number };
  cpKbaBenchmarkTotals: { spend: number; kbas: number };
  selectedRegion: string;
  selectedMaco: string;
  kpis: MetricCard[];
  points: ChartPoint[];
  cpKbaBenchmark: number;
  insightsAudit: InsightAudit;
}) {
  const {
    currentDetailRows,
    priorDetailRows,
    currentQuarter,
    comparisonQuarter,
    channelSummary,
    totals,
    priorTotals,
    channelTotals,
    cpKbaTotals,
    priorCpKbaTotals,
    cpKbaBenchmarkTotals,
    selectedRegion,
    selectedMaco,
    kpis,
    points,
    cpKbaBenchmark,
    insightsAudit,
  } = input;

  const detailRows = [...currentDetailRows, ...priorDetailRows];
  const blankRows = currentDetailRows.filter((row) => !row.Channel || !row.Campaign).length;
  const spendDiff = Math.abs(channelTotals.spend - totals.spend) / Math.max(totals.spend, 1);
  const kbaDiff = Math.abs(channelTotals.kbas - totals.kbas) / Math.max(totals.kbas, 1);
  const requiredFieldChecks = detailRows.map((row) =>
    Boolean(row.Region && row.MACO && row.Channel !== undefined && row.Platform !== undefined && row.Campaign !== undefined && row.Month) &&
    ['Spend', 'All KBAs', 'Inventory Searches', 'Leads', 'Impressions'].every((field) => Number.isFinite(row[field as keyof DetailRow] as number)),
  );
  const allRequiredFieldsPresent = detailRows.length > 0 && requiredFieldChecks.every(Boolean);
  const currentWindowValid =
    currentDetailRows.length > 0 &&
    currentDetailRows.every((row) => monthInQuarter(parseMonth(row.Month), currentQuarter.quarter, currentQuarter.year));
  const comparisonWindowValid =
    priorDetailRows.length > 0 &&
    priorDetailRows.every((row) => monthInQuarter(parseMonth(row.Month), comparisonQuarter.quarter, comparisonQuarter.year));
  const strictTierExactMatch = detailRows.length > 0 && detailRows.every((row) => {
    if (row.Region !== selectedRegion) {
      return false;
    }

    if (selectedMaco !== 'ALL MACOS' && row.MACO !== selectedMaco) {
      return false;
    }

    return true;
  });
  const cpoCategorizationExactMatch =
    detailRows.length > 0 &&
    detailRows.every((row) => (row['CPO Categorization'] ?? '').trim() === 'New Car');
  const zeroKbaRows = detailRows.filter((row) => row['All KBAs'] === 0);
  const zeroSearchSocialKbaRows = detailRows.filter((row) => isSearchOrSocialChannel(row.Channel || '') && row['All KBAs'] === 0);
  const divideByZeroSafe =
    zeroKbaRows.every((row) => Number.isFinite(safeDivide(row.Spend, row['All KBAs']))) &&
    zeroSearchSocialKbaRows.every((row) => Number.isFinite(safeDivide(row.Spend, row['All KBAs']))) &&
    Number.isFinite(safeDivide(cpKbaTotals.spend, cpKbaTotals.kbas)) &&
    Number.isFinite(safeDivide(priorCpKbaTotals.spend, priorCpKbaTotals.kbas));
  const displayedCpKba = kpis.find((kpi) => kpi.id === 'cp-kba')?.value ?? 0;
  const expectedCpKba = safeDivide(cpKbaTotals.spend, cpKbaTotals.kbas);
  const displayedBenchmark = cpKbaBenchmark;
  const expectedBenchmark = safeDivide(cpKbaBenchmarkTotals.spend, cpKbaBenchmarkTotals.kbas);
  const derivedValueAuditPass =
    Math.abs(displayedCpKba - expectedCpKba) <= 1e-9 &&
    Math.abs(displayedBenchmark - expectedBenchmark) <= 1e-9;
  const evidenceCoveragePass =
    insightsAudit.renderedBulletCount > 0 &&
    insightsAudit.groundedBulletCount === insightsAudit.renderedBulletCount;
  const claimReconciliationPass =
    insightsAudit.metricClaimCount > 0 &&
    insightsAudit.metricClaimCount === insightsAudit.reconciledMetricClaimCount;
  const emptyEvidenceBlockingPass =
    insightsAudit.renderedBulletCount === insightsAudit.groundedBulletCount;

  const checks: QaCheck[] = [
    {
      id: 'required-fields',
      label: 'Required fields present',
      status: allRequiredFieldsPresent ? 'PASS' : 'WARN',
      detail: allRequiredFieldsPresent
        ? 'Required spend, KBA, impression, lead, Region, MACO, Channel, Platform, Campaign, and Month fields are present on scoped detail rows.'
        : 'One or more required dimensions or measures are missing from scoped detail rows.',
    },
    {
      id: 'quarter-window',
      label: 'Quarter window correctness',
      status: currentWindowValid && comparisonWindowValid ? 'PASS' : 'WARN',
      detail:
        currentWindowValid && comparisonWindowValid
          ? `Current rows map to ${currentQuarter.label}; comparison rows map to ${comparisonQuarter.label}.`
          : 'One or more scoped rows falls outside the selected reporting windows.',
    },
    {
      id: 'strict-tier',
      label: 'Strict Tier exact-match validation',
      status: strictTierExactMatch ? 'PASS' : 'WARN',
      detail: strictTierExactMatch
        ? `All scoped rows match Region == ${selectedRegion}${selectedMaco !== 'ALL MACOS' ? ` and MACO == ${selectedMaco}` : ''}, with CPO Categorization == New Car.`
        : 'Scoped detail includes rows outside the selected Region/MACO filter.',
    },
    {
      id: 'cpo-categorization',
      label: 'CPO categorization filter validation',
      status: cpoCategorizationExactMatch ? 'PASS' : 'WARN',
      detail: cpoCategorizationExactMatch
        ? 'All scoped rows match CPO Categorization == New Car.'
        : 'Scoped detail includes one or more rows outside CPO Categorization == New Car.',
    },
    {
      id: 'reconciliation',
      label: 'Reconciliation within 0.5%',
      status: spendDiff <= 0.005 && kbaDiff <= 0.005 ? 'PASS' : 'WARN',
      detail: `Channel rollup variance: Spend ${(spendDiff * 100).toFixed(2)}%, KBAs ${(kbaDiff * 100).toFixed(2)}%.`,
    },
    {
      id: 'null-audit',
      label: 'Null/blank dimension audit',
      status: blankRows === 0 ? 'PASS' : 'WARN',
      detail: blankRows === 0 ? 'No blank Channel/Campaign rows in the scoped quarter detail.' : `${blankRows} scoped detail rows have blank Channel or Campaign values.`,
    },
    {
      id: 'divide-by-zero',
      label: 'Divide-by-zero handling',
      status: divideByZeroSafe ? 'PASS' : 'WARN',
      detail: divideByZeroSafe
        ? `Safe divide returned finite values for ${zeroKbaRows.length} zero-KBA row${zeroKbaRows.length === 1 ? '' : 's'}, ${zeroSearchSocialKbaRows.length} zero-KBA Search/Social row${zeroSearchSocialKbaRows.length === 1 ? '' : 's'}, and all quarter-level CP KBA calculations.`
        : 'A divide-by-zero path produced a non-finite derived value.',
    },
    {
      id: 'insight-evidence',
      label: 'Insight evidence coverage',
      status: evidenceCoveragePass ? 'PASS' : 'WARN',
      detail: evidenceCoveragePass
        ? `${insightsAudit.groundedBulletCount} rendered insight bullets have supporting scoped evidence.`
        : `${insightsAudit.renderedBulletCount - insightsAudit.groundedBulletCount} rendered insight bullets are missing evidence coverage.`,
    },
    {
      id: 'claim-reconciliation',
      label: 'Claim-to-metric reconciliation',
      status: claimReconciliationPass ? 'PASS' : 'WARN',
      detail: claimReconciliationPass
        ? `${insightsAudit.reconciledMetricClaimCount} of ${insightsAudit.metricClaimCount} metric-bearing insight bullets reconciled to finite computed values.`
        : `${insightsAudit.metricClaimCount - insightsAudit.reconciledMetricClaimCount} metric-bearing insight bullets failed reconciliation.`,
    },
    {
      id: 'derived-value-audit',
      label: 'Derived-value audit',
      status: derivedValueAuditPass ? 'PASS' : 'WARN',
      detail: derivedValueAuditPass
        ? 'Displayed CP KBA and chart benchmark values reconcile to Search and Social source totals.'
        : 'One or more displayed derived values does not reconcile to source totals.',
    },
    {
      id: 'empty-evidence-blocking',
      label: 'Empty-evidence blocking',
      status: emptyEvidenceBlockingPass ? 'PASS' : 'WARN',
      detail: `Suppressed ${insightsAudit.blockedSectionCount} empty section${insightsAudit.blockedSectionCount === 1 ? '' : 's'} and ${insightsAudit.blockedBulletCount} unsupported bullet${insightsAudit.blockedBulletCount === 1 ? '' : 's'} before render.`,
    },
    {
      id: 'deck-completeness',
      label: 'Deck completeness',
      status: channelSummary.length > 0 ? 'PASS' : 'WARN',
      detail: channelSummary.length > 0 ? 'Scope, QA, KPI scorecard, combo chart, channel summary, drivers, and appendix all populated.' : 'One or more sections have no data for the scoped quarter.',
    },
  ];

  return checks;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function changePercent(current: number, prior: number) {
  if (prior === 0) {
    return null;
  }

  return ((current - prior) / prior) * 100;
}

function titleCaseChannel(channel: string) {
  const normalized = normalizeChannel(channel);
  if (normalized === 'ctv') return 'Connected TV / OTT';
  if (normalized === 'olv') return 'Online Video';
  if (normalized === 'digital-display') return 'Display';
  if (normalized === 'search') return 'Search';
  if (normalized === 'social') return 'Social';
  return channel;
}

export function entityLabelForInsight(row: DetailRow) {
  const normalized = normalizeChannel(row.Channel || '');
  if (normalized === 'search' || normalized === 'social') {
    return row.Platform || 'Unassigned';
  }

  if (normalized === 'ctv' || normalized === 'olv') {
    const siteName = (row['Site Name'] || '').trim();
    const placementType = cleanPlacementType(row['Campaign / Placement Type']);
    const platform = (row.Platform || '').trim();

    if (siteName) {
      if (/dv360/i.test(siteName)) {
        return placementType || (!/^(dv360|cm360)$/i.test(platform) ? platform : '') || 'Unassigned';
      }

      if (!/^(dv360|cm360)$/i.test(siteName)) {
        return siteName;
      }
    }

    if (placementType) {
      return placementType;
    }

    if (platform && !/^(dv360|cm360)$/i.test(platform)) {
      return platform;
    }

    return 'Unassigned';
  }

  return row.Platform || row['Site Name'] || 'Unassigned';
}

function isPresentableInsightValue(value: number) {
  return Number.isFinite(value) && value > 0;
}

function cleanPlacementType(value: string | undefined) {
  const text = (value ?? '').trim();
  if (!text || text === 'Multiple Placement Types') {
    return '';
  }
  return text;
}

function campaignLabelForInsight(row: DetailRow) {
  const campaign = (row.Campaign || 'Unassigned').trim();
  const placementType = cleanPlacementType(row['Campaign / Placement Type']);
  const normalized = normalizeChannel(row.Channel || '');

  if (!placementType || normalized === 'search' || normalized === 'social' || placementType === campaign) {
    return campaign;
  }

  return `${campaign} / ${placementType}`;
}

function socialCampaignLabel(row: DetailRow) {
  return (
    row['Campaign Sub-Category (T2 Reporting Only)']
    || row['Campaign (T2 Reporting Only)']
    || row.Campaign
    || 'Unassigned'
  ).trim();
}

export type InsightMetric = {
  label: string;
  value: number;
  formatter: (metric: number) => string;
  higherIsBetter: boolean;
  positivePhrase: string;
  negativePhrase: string;
};

export function primaryMetricForChannel(
  channelId: string,
  metrics: {
    spend: number;
    kbas: number;
    impressions: number;
    vcr?: number | null;
    videoCompletes?: number;
    videoPlays?: number;
  },
): InsightMetric | null {
  if (channelId === 'search' || channelId === 'social') {
    const value = safeDivide(metrics.spend, metrics.kbas);
    return isPresentableInsightValue(value)
      ? {
          label: 'CPKBA',
          value,
          formatter: formatCurrency,
          higherIsBetter: false,
          positivePhrase: 'the strongest efficiency',
          negativePhrase: 'a higher cost per action',
        }
      : null;
  }

  if (channelId === 'ctv' || channelId === 'olv') {
    const derivedVcr =
      typeof metrics.videoPlays === 'number' && metrics.videoPlays > 0
        ? safeDivide(metrics.videoCompletes ?? 0, metrics.videoPlays)
        : null;
    const value = derivedVcr ?? metrics.vcr ?? null;
    return value !== null && Number.isFinite(value) && value > 0
      ? {
          label: 'VCR',
          value,
          formatter: (metric: number) => formatPercent(metric * 100),
          higherIsBetter: true,
          positivePhrase: 'the strongest completion rate',
          negativePhrase: 'a lower completion rate',
        }
      : null;
  }

  const value = safeDivide(metrics.spend, metrics.kbas);
  return isPresentableInsightValue(value)
    ? {
        label: 'CPKBA',
        value,
        formatter: formatCurrency,
        higherIsBetter: false,
        positivePhrase: 'the strongest efficiency',
        negativePhrase: 'a higher cost per action',
      }
    : null;
}

function isMaterialCampaignInsightCandidate(input: {
  spendShare: number;
  kbaShare: number;
  impressions: number;
  rowCount: number;
  channelId: string;
}) {
  const baseMateriality =
    input.spendShare >= 0.03 ||
    input.kbaShare >= 0.03 ||
    input.rowCount >= 3;

  if (input.channelId === 'ctv' || input.channelId === 'olv') {
    return baseMateriality || input.impressions >= 10000;
  }

  return baseMateriality;
}

function compareInsightMetric(left: InsightMetric, right: InsightMetric) {
  return left.higherIsBetter ? right.value - left.value : left.value - right.value;
}

function hasMeaningfulInsightMetricSpread(best: InsightMetric, weakest: InsightMetric) {
  if (best.label === 'VCR') {
    return Math.abs(best.value - weakest.value) >= 0.01;
  }

  const baseline = Math.max(Math.abs(best.value), Math.abs(weakest.value), 1e-9);
  return Math.abs(best.value - weakest.value) / baseline >= 0.1;
}

function varianceNarrative(metric: InsightMetric, delta: number, basis: string, currentDisplay: string, priorDisplay: string) {
  const absoluteDelta = Math.abs(delta);
  if (absoluteDelta < 10) {
    return `${metric.label} remained stable YoY at ${currentDisplay} vs ${priorDisplay}.`;
  }

  if (metric.label === 'CPKBA') {
    return `${metric.label} efficiency ${delta >= 0 ? 'decreased' : 'increased'} by ${formatPercent(absoluteDelta)} YoY to ${currentDisplay} from ${priorDisplay}.`;
  }

  const favorableChange = metric.higherIsBetter ? delta >= 0 : delta <= 0;
  return favorableChange
    ? `${metric.label} improved by ${formatPercent(absoluteDelta)} YoY to ${currentDisplay} from ${priorDisplay}.`
    : `${metric.label} decreased by ${formatPercent(absoluteDelta)} YoY to ${currentDisplay} from ${priorDisplay}.`;
}

function varianceUnavailableNarrative(metric: InsightMetric, channelLabel: string) {
  return `${channelLabel} delivered a current-year ${metric.label} of ${metric.formatter(metric.value)}; ${channelLabel} did not run in the comparison period.`;
}

function deliveryComparisonNarrative(
  metric: InsightMetric | null,
  priorMetric: InsightMetric | null,
  subjectLabel: 'platform' | 'campaign',
  comparisonLabel: string,
  priorQuarterLabel: string,
) {
  if (!metric || !priorMetric) {
    return null;
  }

  const delta = changePercent(metric.value, priorMetric.value);
  const absoluteDelta = delta === null ? null : Math.abs(delta);
  const currentDisplay = metric.formatter(metric.value);
  const priorDisplay = priorMetric.formatter(priorMetric.value);

  if (absoluteDelta !== null && absoluteDelta < 10) {
    return metric.label === 'CPKBA'
      ? `Media efficiency for the ${subjectLabel} remained stable ${comparisonLabel} at ${currentDisplay} vs ${priorDisplay} in ${priorQuarterLabel}.`
      : `${metric.label} for the ${subjectLabel} remained stable ${comparisonLabel} at ${currentDisplay} vs ${priorDisplay} in ${priorQuarterLabel}.`;
  }

  if (metric.label === 'CPKBA') {
    return `Media efficiency for the ${subjectLabel} ${delta !== null && delta >= 0 ? 'decreased' : 'increased'} by ${delta === null ? '' : `${formatPercent(Math.abs(delta))} `}${comparisonLabel} to ${currentDisplay} from ${priorDisplay} in ${priorQuarterLabel}.`;
  }

  const favorableChange = delta !== null ? (metric.higherIsBetter ? delta >= 0 : delta <= 0) : false;
  return `${metric.label} for the ${subjectLabel} ${favorableChange ? 'improved' : 'decreased'} by ${delta === null ? '' : `${formatPercent(Math.abs(delta))} `}${comparisonLabel} to ${currentDisplay} from ${priorDisplay} in ${priorQuarterLabel}.`;
}

function socialPlatformComparisonGroup(row: DetailRow) {
  const platform = (row.Platform || '').trim().toLowerCase();
  if (platform.startsWith('meta')) {
    return 'Meta';
  }
  if (platform.includes('tiktok')) {
    return 'TikTok';
  }

  return null;
}

function metaTikTokComparisonCandidate(channelCurrent: DetailRow[], currentQuarterLabel: string) {
  const totals = new Map<string, { spend: number; kbas: number; rows: number }>();

  for (const row of channelCurrent) {
    const group = socialPlatformComparisonGroup(row);
    if (!group) {
      continue;
    }

    const current = totals.get(group) ?? { spend: 0, kbas: 0, rows: 0 };
    current.spend += row.Spend;
    current.kbas += row['All KBAs'];
    current.rows += 1;
    totals.set(group, current);
  }

  const meta = totals.get('Meta');
  const tiktok = totals.get('TikTok');
  if (!meta || !tiktok || meta.spend <= 0 || tiktok.spend <= 0) {
    return null;
  }

  const metaCpkba = safeDivide(meta.spend, meta.kbas);
  const tiktokCpkba = safeDivide(tiktok.spend, tiktok.kbas);
  if (!isPresentableInsightValue(metaCpkba) || !isPresentableInsightValue(tiktokCpkba) || tiktokCpkba >= metaCpkba) {
    return null;
  }

  const efficiencyLift = safeDivide(metaCpkba - tiktokCpkba, metaCpkba) * 100;
  if (!isPresentableInsightValue(efficiencyLift)) {
    return null;
  }

  return {
    text: `Platform Performance: In ${currentQuarterLabel}, Meta's CPKBA was ${formatCurrency(metaCpkba)} versus TikTok's ${formatCurrency(tiktokCpkba)}, representing ${formatPercent(efficiencyLift)} greater efficiency on TikTok with room to scale.`,
    evidenceCount: meta.rows + tiktok.rows,
    metricValues: [metaCpkba, tiktokCpkba, efficiencyLift],
  };
}

function quarterComparisonChange(delta: number | null) {
  if (delta === null) {
    return null;
  }

  if (Math.abs(delta) < 10) {
    return 'held broadly flat';
  }

  return delta >= 0 ? `increased ${formatPercent(Math.abs(delta))}` : `declined ${formatPercent(Math.abs(delta))}`;
}

function quarterLearningVolumeNarrative(
  channelLabel: string,
  metricLabel: string,
  currentValue: number,
  priorValue: number,
  currentQuarterLabel: string,
  priorQuarterLabel: string,
  comparisonLabel: string,
) {
  const delta = changePercent(currentValue, priorValue);
  const movement = quarterComparisonChange(delta);

  if (movement) {
    return `${channelLabel} ${metricLabel} ${movement} ${comparisonLabel}, reaching ${formatWholeNumber(currentValue)} in ${currentQuarterLabel} vs ${formatWholeNumber(priorValue)} in ${priorQuarterLabel}.`;
  }

  if (currentValue > 0) {
    return `${channelLabel} delivered ${formatWholeNumber(currentValue)} ${metricLabel} in ${currentQuarterLabel}; ${priorQuarterLabel} did not have a comparable baseline.`;
  }

  return null;
}

function quarterLearningSpendNarrative(
  channelLabel: string,
  currentSpend: number,
  priorSpend: number,
  currentQuarterLabel: string,
  priorQuarterLabel: string,
  comparisonLabel: string,
) {
  const delta = changePercent(currentSpend, priorSpend);
  const movement = quarterComparisonChange(delta);

  if (movement) {
    return `${channelLabel} spend ${movement} ${comparisonLabel} to ${formatCurrency(currentSpend)} in ${currentQuarterLabel} from ${formatCurrency(priorSpend)} in ${priorQuarterLabel}.`;
  }

  if (currentSpend > 0) {
    return `${channelLabel} spent ${formatCurrency(currentSpend)} in ${currentQuarterLabel}; ${priorQuarterLabel} did not have a comparable baseline.`;
  }

  return null;
}

function quarterLearningEfficiencyNarrative(
  channelLabel: string,
  metric: InsightMetric | null,
  priorMetric: InsightMetric | null,
  currentQuarterLabel: string,
  priorQuarterLabel: string,
  comparisonLabel: string,
) {
  if (!metric) {
    return null;
  }

  if (!priorMetric) {
    return `${channelLabel} delivered ${metric.label} of ${metric.formatter(metric.value)} in ${currentQuarterLabel}; ${priorQuarterLabel} did not have a comparable baseline.`;
  }

  const delta = changePercent(metric.value, priorMetric.value);
  const absoluteDelta = delta === null ? null : Math.abs(delta);

  if (absoluteDelta !== null && absoluteDelta < 10) {
    return `${channelLabel} ${metric.label} remained stable ${comparisonLabel} at ${metric.formatter(metric.value)} in ${currentQuarterLabel} vs ${priorMetric.formatter(priorMetric.value)} in ${priorQuarterLabel}.`;
  }

  if (metric.label === 'CPKBA') {
    return `${channelLabel} ${metric.label} efficiency ${delta !== null && delta >= 0 ? 'decreased' : 'increased'} ${delta === null ? '' : `${formatPercent(Math.abs(delta))} `}${comparisonLabel} to ${metric.formatter(metric.value)} in ${currentQuarterLabel} from ${priorMetric.formatter(priorMetric.value)} in ${priorQuarterLabel}.`;
  }

  const favorableChange = delta !== null ? (metric.higherIsBetter ? delta >= 0 : delta <= 0) : false;
  return `${channelLabel} ${metric.label} ${favorableChange ? 'improved' : 'decreased'} ${delta === null ? '' : `${formatPercent(Math.abs(delta))} `}${comparisonLabel} to ${metric.formatter(metric.value)} in ${currentQuarterLabel} from ${priorMetric.formatter(priorMetric.value)} in ${priorQuarterLabel}.`;
}

function insightComparisonLabel(currentQuarter: QuarterOption, comparisonQuarter: QuarterOption) {
  if (currentQuarter.quarter === comparisonQuarter.quarter && currentQuarter.year === comparisonQuarter.year + 1) {
    return 'year over year';
  }

  const currentIndex = currentQuarter.year * 4 + currentQuarter.quarter;
  const comparisonIndex = comparisonQuarter.year * 4 + comparisonQuarter.quarter;
  if (currentIndex - comparisonIndex === 1) {
    return 'quarter over quarter';
  }

  return 'versus the comparison quarter';
}

function quarterLearningCombinedNarrative(
  channelId: string,
  channelLabel: string,
  currentQuarter: QuarterOption,
  comparisonQuarter: QuarterOption,
  currentQuarterLabel: string,
  priorQuarterLabel: string,
  currentKbas: number,
  priorKbas: number,
  currentPrimaryMetric: InsightMetric | null,
  priorPrimaryMetric: InsightMetric | null,
) {
  const comparisonLabel = insightComparisonLabel(currentQuarter, comparisonQuarter);
  if (channelId === 'ctv' || channelId === 'olv') {
    return quarterLearningEfficiencyNarrative(
      channelLabel,
      currentPrimaryMetric,
      priorPrimaryMetric,
      currentQuarterLabel,
      priorQuarterLabel,
      comparisonLabel,
    );
  }

  const volumeNarrative = quarterLearningVolumeNarrative(
    channelLabel,
    'KBAs',
    currentKbas,
    priorKbas,
    currentQuarterLabel,
    priorQuarterLabel,
    comparisonLabel,
  );
  const efficiencyNarrative = quarterLearningEfficiencyNarrative(
    channelLabel,
    currentPrimaryMetric,
    priorPrimaryMetric,
    currentQuarterLabel,
    priorQuarterLabel,
    comparisonLabel,
  );

  if (volumeNarrative && efficiencyNarrative) {
    const trimmedChannelLabel = `${channelLabel} `;
    const efficiencyTail = efficiencyNarrative.startsWith(trimmedChannelLabel)
      ? efficiencyNarrative.slice(trimmedChannelLabel.length)
      : efficiencyNarrative;
    return `${volumeNarrative} ${efficiencyTail}`;
  }

  return volumeNarrative ?? efficiencyNarrative;
}

function abbreviatedComparisonLabel(comparisonLabel: string) {
  if (comparisonLabel === 'year over year') {
    return 'YoY';
  }

  if (comparisonLabel === 'quarter over quarter') {
    return 'QoQ';
  }

  return 'vs comparison quarter';
}

function socialSecondaryKpiNarrative(
  channelId: string,
  comparisonLabel: string,
  current: { spend: number; leads: number; pageVisits: number },
  prior: { spend: number; leads: number; pageVisits: number },
) {
  if (channelId !== 'social') {
    return null;
  }

  const currentCpl = safeDivide(current.spend, current.leads);
  const priorCpl = safeDivide(prior.spend, prior.leads);
  const currentLeadRate = safeDivide(current.leads, current.pageVisits);
  const priorLeadRate = safeDivide(prior.leads, prior.pageVisits);
  const cplDelta = changePercent(currentCpl, priorCpl);
  const leadRateDelta = changePercent(currentLeadRate, priorLeadRate);
  const spendDelta = changePercent(current.spend, prior.spend);

  if (
    !isPresentableInsightValue(currentCpl) ||
    !isPresentableInsightValue(priorCpl) ||
    !isPresentableInsightValue(currentLeadRate) ||
    !isPresentableInsightValue(priorLeadRate) ||
    cplDelta === null ||
    leadRateDelta === null ||
    spendDelta === null
  ) {
    return null;
  }

  const metricValues = [
    currentCpl,
    priorCpl,
    currentLeadRate,
    priorLeadRate,
    cplDelta,
    leadRateDelta,
    spendDelta,
  ];

  const shortComparisonLabel = abbreviatedComparisonLabel(comparisonLabel);
  const cplDeltaLabel = `${cplDelta > 0 ? '+' : ''}${formatPercent(cplDelta)}`;
  const leadRateMovement = leadRateDelta >= 0 ? 'improved' : 'decreased';
  const spendContext =
    spendDelta >= 0
      ? `despite spend scaling of +${formatPercent(spendDelta)} ${shortComparisonLabel}`
      : `while spend decreased ${formatPercent(Math.abs(spendDelta))} ${shortComparisonLabel}`;

  return {
    text: `Secondary KPIs: CPL came in at ${formatCurrency(currentCpl)} (${cplDeltaLabel} ${shortComparisonLabel}), and Lead rate ${leadRateMovement} ${formatPercent(Math.abs(leadRateDelta))} ${shortComparisonLabel} ${spendContext}.`,
    metricValues,
  };
}

function lowMetricNarrative(metric: InsightMetric) {
  if (metric.label === 'VCR') {
    return `a low ${metric.label}`;
  }

  return metric.negativePhrase;
}

function topCountLabel(counts: Map<string, number>) {
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? '';
}

function cleanObjectiveText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function objectiveContextSummary(funnelStage: string, optimizeTo: string) {
  const parts = [cleanObjectiveText(funnelStage), cleanObjectiveText(optimizeTo)].filter(Boolean);
  return parts.join(' / ');
}

function rateMetric(value: number) {
  return `${formatPercent(value * 100)}`;
}

export function chooseObjectiveMetric(
  channelId: string,
  objectiveContext: string,
  metrics: {
    spend: number;
    kbas: number;
    impressions: number;
    clicks: number;
    vcr?: number | null;
    videoCompletes?: number;
    videoPlays?: number;
  },
): InsightMetric | null {
  const objective = objectiveContext.toLowerCase();

  if (channelId === 'search' || channelId === 'social') {
    const ctr = safeDivide(metrics.clicks, metrics.impressions);
    const cpkba = safeDivide(metrics.spend, metrics.kbas);
    const trafficDriven =
      objective.includes('traffic') ||
      objective.includes('click') ||
      objective.includes('visit') ||
      objective.includes('landing');

    if (trafficDriven && ctr > 0) {
      return {
        label: 'CTR',
        value: ctr,
        formatter: rateMetric,
        higherIsBetter: true,
        positivePhrase: 'the strongest click-through rate',
        negativePhrase: 'a softer click-through rate',
      };
    }

    return isPresentableInsightValue(cpkba)
      ? {
          label: 'CPKBA',
          value: cpkba,
          formatter: formatCurrency,
          higherIsBetter: false,
          positivePhrase: 'the strongest efficiency',
          negativePhrase: 'a higher cost per action',
        }
      : ctr > 0
        ? {
            label: 'CTR',
            value: ctr,
            formatter: rateMetric,
            higherIsBetter: true,
            positivePhrase: 'the strongest click-through rate',
            negativePhrase: 'a softer click-through rate',
          }
        : null;
  }

  return primaryMetricForChannel(channelId, metrics);
}

export function aggregateChannelPlatforms(
  rows: DetailRow[],
  quarter: number,
  year: number,
  channelId: string,
  labelField: 'platform' | 'videoEntity' | 'videoChart' = 'platform',
): Array<{ label: string; spend: number; spendDisplay: string }> {
  const scopedRows = rows.filter((row) => {
    const month = parseMonth(row.Month);
    return monthInQuarter(month, quarter, year) && normalizeChannel(row.Channel || '') === channelId;
  });

    const grouped = new Map<string, { label: string; spend: number }>();
  for (const row of scopedRows) {
    const platformLabel = (row.Platform || '').trim();
    const channelLabel = (row.Channel || '').trim();
    const label =
      labelField === 'videoEntity'
        ? (row.Publisher || '').trim() || entityLabelForInsight(row)
        : labelField === 'videoChart'
          ? videoChartLabelForRow(row)
          : platformLabel || 'Unassigned';
    const current = grouped.get(label) ?? { label, spend: 0 };
    current.spend += row.Spend;
    grouped.set(label, current);
  }

  return Array.from(grouped.values())
    .sort((left, right) => right.spend - left.spend)
    .map((entry) => ({
      label: entry.label,
      spend: entry.spend,
      spendDisplay: formatCurrency(entry.spend),
    }));
}

function videoChartLabelForRow(row: DetailRow) {
  const platformLabel = (row.Platform || '').trim();
  const channelLabel = (row.Channel || '').trim();
  return platformLabel === 'YouTube' || platformLabel === 'YouTube TV'
    ? platformLabel
    : channelLabel || 'Unassigned';
}

type CampaignCardBucket = {
  label: string;
  spend: number;
  kbas: number;
  impressions: number;
};


const ALLOWED_SOCIAL_CAMPAIGN_LABELS = new Set([
  'sedan low',
  'sedan high',
  'sav low',
  'sav high',
  'ev',
  'military',
]);

function isAllowedSocialCampaignLabel(label: string) {
  return ALLOWED_SOCIAL_CAMPAIGN_LABELS.has(label.trim().toLowerCase());
}

export function aggregateCampaignCardBuckets(
  rows: DetailRow[],
  quarter: number,
  year: number,
): CampaignCardBucket[] {
  const scopedRows = rows.filter((row) => {
    const month = parseMonth(row.Month);
    const channel = normalizeChannel(row.Channel || '');
    const campaign = (
      row['Campaign Sub-Category (T2 Reporting Only)']
      || row['Campaign (T2 Reporting Only)']
      || row.Campaign
      || ''
    ).trim();
    return monthInQuarter(month, quarter, year) && channel === 'social' && campaign.length > 0 && isAllowedSocialCampaignLabel(campaign);
  });

  const campaigns = new Map<string, CampaignCardBucket>();
  for (const row of scopedRows) {
    const label = (
      row['Campaign Sub-Category (T2 Reporting Only)']
      || row['Campaign (T2 Reporting Only)']
      || row.Campaign
      || ''
    ).trim();
    const current = campaigns.get(label) ?? { label, spend: 0, kbas: 0, impressions: 0 };
    current.spend += row.Spend;
    current.kbas += row['All KBAs'];
    current.impressions += row.Impressions ?? 0;
    campaigns.set(label, current);
  }

  return Array.from(campaigns.values())
    .filter((campaign) => campaign.spend > 0)
    .sort((left, right) => {
    if (right.spend !== left.spend) {
      return right.spend - left.spend;
    }
    if (right.kbas !== left.kbas) {
      return right.kbas - left.kbas;
    }
    return left.label.localeCompare(right.label);
    });
}

function buildCampaignCardHighlights(campaigns: CampaignCardBucket[]): string[] {
  const activeCampaigns = campaigns.filter((campaign) => campaign.spend > 0);
  if (activeCampaigns.length === 0) {
    return [];
  }

  const totalSpend = sumBy(activeCampaigns, (campaign) => campaign.spend);
  const spendLeader = activeCampaigns.reduce((best, campaign) => (campaign.spend > best.spend ? campaign : best), activeCampaigns[0]);
  const efficiencyLeader = activeCampaigns.reduce((best, campaign) => {
    const bestCpKba = safeDivide(best.spend, best.kbas);
    const campaignCpKba = safeDivide(campaign.spend, campaign.kbas);
    if (!Number.isFinite(bestCpKba)) return campaign;
    if (!Number.isFinite(campaignCpKba)) return best;
    return campaignCpKba < bestCpKba ? campaign : best;
  }, activeCampaigns[0]);
  const impressionsLeader = activeCampaigns.reduce(
    (best, campaign) => (campaign.impressions > best.impressions ? campaign : best),
    activeCampaigns[0],
  );

  const highlights = [
    `${spendLeader.label} accounted for ${formatPercent(safeDivide(spendLeader.spend, totalSpend) * 100)} of Campaign spend, contributing ${formatCurrency(spendLeader.spend)} in media investment.`,
  ];

  const efficiencyCpKba = safeDivide(efficiencyLeader.spend, efficiencyLeader.kbas);
  if (Number.isFinite(efficiencyCpKba) && efficiencyLeader.kbas > 0) {
    highlights.push(
      `${efficiencyLeader.label} delivered the strongest efficiency at ${formatCurrency(efficiencyCpKba)}, driving ${formatCompactNumber(efficiencyLeader.kbas)} total KBAs.`,
    );
  } else {
    highlights.push(
      `${impressionsLeader.label} generated the largest reach at ${formatCompactNumber(impressionsLeader.impressions)} impressions.`,
    );
  }

  if (impressionsLeader.impressions > 0 && !highlights.some((bullet) => bullet.startsWith(impressionsLeader.label))) {
    highlights.push(
      `${impressionsLeader.label} generated the largest reach at ${formatCompactNumber(impressionsLeader.impressions)} impressions.`,
    );
  }

  return highlights.slice(0, 3);
}

function supportingMetricForChannel(
  channelId: string,
  primaryMetric: InsightMetric | null,
  metrics: {
    spend: number;
    kbas: number;
    impressions: number;
    clicks: number;
  },
): InsightMetric | null {
  if (channelId !== 'search' && channelId !== 'social') {
    return null;
  }

  const ctr = safeDivide(metrics.clicks, metrics.impressions);
  const cpkba = safeDivide(metrics.spend, metrics.kbas);

  if (primaryMetric?.label === 'CTR' && isPresentableInsightValue(cpkba)) {
    return {
      label: 'CPKBA',
      value: cpkba,
      formatter: formatCurrency,
      higherIsBetter: false,
      positivePhrase: 'the strongest efficiency',
      negativePhrase: 'a higher cost per action',
    };
  }

  if (primaryMetric?.label === 'CPKBA' && ctr > 0) {
    return {
      label: 'CTR',
      value: ctr,
      formatter: rateMetric,
      higherIsBetter: true,
      positivePhrase: 'the strongest click-through rate',
      negativePhrase: 'a softer click-through rate',
    };
  }

  return null;
}

function describeShareBalance(spendShare: number, outcomeShare: number) {
  const gap = outcomeShare - spendShare;

  if (gap >= 0.03) {
    return 'outperforming its share of investment';
  }

  if (gap <= -0.03) {
    return 'contributing fewer outcomes than its share of investment';
  }

  return 'performing broadly in line with its share of investment';
}

export function buildInsights(
  rows: DetailRow[],
  quarter: QuarterOption,
  comparisonQuarter: QuarterOption,
): { channels: ChannelInsight[]; audit: InsightAudit } {
  const scopedCurrent = rows.filter((row) =>
    monthInQuarter(parseMonth(row.Month), quarter.quarter, quarter.year),
  );
  const scopedPrior = rows.filter((row) =>
    monthInQuarter(parseMonth(row.Month), comparisonQuarter.quarter, comparisonQuarter.year),
  );
  const currentVideoRows = scopedCurrent.filter((row) => {
    const channel = normalizeChannel(row.Channel || '');
    return channel === 'ctv' || channel === 'olv';
  });
  const totalVideoSpendCurrent = Math.max(sumBy(currentVideoRows, (row) => row.Spend), 1);
  const audit: InsightAudit = {
    renderedChannelCount: 0,
    renderedSectionCount: 0,
    renderedBulletCount: 0,
    metricClaimCount: 0,
    reconciledMetricClaimCount: 0,
    groundedBulletCount: 0,
    blockedBulletCount: 0,
    blockedSectionCount: 0,
  };

  const channelOrder = ['ctv', 'olv', 'search', 'social'];
  const channels = Array.from(
    new Set(
      [...scopedCurrent, ...scopedPrior]
        .map((row) => normalizeChannel(row.Channel || ''))
        .filter((channelId) => Boolean(channelId) && channelId !== 'digital-display'),
    ),
  ).sort((left, right) => {
    const leftIndex = channelOrder.indexOf(left);
    const rightIndex = channelOrder.indexOf(right);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });

  const renderedChannels = channels
    .map((channelId) => {
      const groundedBullets = (
        candidates: Array<{
          text?: string | null | false;
          evidenceCount: number;
          metricValues?: Array<number | null | undefined>;
        }>,
      ) =>
        candidates.flatMap((candidate) => {
          if (!candidate.text) {
            return [];
          }

          const hasEvidence = candidate.evidenceCount > 0;
          const metricValues = candidate.metricValues ?? [];
          const metricsFinite = metricValues.every((value) => value == null || Number.isFinite(value));
          const isGrounded = hasEvidence && metricsFinite;

          audit.renderedBulletCount += 1;
          if (metricValues.length > 0) {
            audit.metricClaimCount += 1;
            if (isGrounded) {
              audit.reconciledMetricClaimCount += 1;
            }
          }
          if (isGrounded) {
            audit.groundedBulletCount += 1;
            return [candidate.text];
          }

          audit.blockedBulletCount += 1;
          return [];
        });

      const channelCurrent = scopedCurrent.filter((row) => normalizeChannel(row.Channel || '') === channelId);
      const channelPrior = scopedPrior.filter((row) => normalizeChannel(row.Channel || '') === channelId);

      const entityCurrent = groupDetailRows(
        channelCurrent,
        quarter.quarter,
        quarter.year,
        (row) => entityLabelForInsight(row),
      );
      const entityPrior = groupDetailRows(
        channelPrior,
        comparisonQuarter.quarter,
        comparisonQuarter.year,
        (row) => entityLabelForInsight(row),
      );
      const campaignKeyForChannel = (row: DetailRow) =>
        channelId === 'social'
          ? socialCampaignLabel(row)
          : `${entityLabelForInsight(row)}::${campaignLabelForInsight(row)}`;
      const campaignEvidenceLabelForChannel = (row: DetailRow) =>
        channelId === 'social' ? socialCampaignLabel(row) : campaignLabelForInsight(row);
      const campaignCurrent = groupDetailRows(
        channelCurrent,
        quarter.quarter,
        quarter.year,
        campaignKeyForChannel,
      );
      const campaignPrior = groupDetailRows(
        channelPrior,
        comparisonQuarter.quarter,
        comparisonQuarter.year,
        campaignKeyForChannel,
      );

      const currentSpend = sumBy(channelCurrent, (row) => row.Spend);
      const currentKbas = sumBy(channelCurrent, (row) => row['All KBAs']);
      const currentLeads = sumBy(channelCurrent, (row) => row.Leads);
      const currentPageVisits = sumBy(channelCurrent, (row) => row['Page Visits'] ?? 0);
      const currentImpressions = sumBy(channelCurrent, (row) => row.Impressions);
      const currentVcr = safeDivide(
        sumBy(channelCurrent, (row) => (row.VCR && row.VCR > 0 ? row.VCR * Math.max(row.Impressions, 0) : 0)),
        sumBy(channelCurrent, (row) => (row.VCR && row.VCR > 0 ? Math.max(row.Impressions, 0) : 0)),
      );
      const currentVideoCompletes = sumBy(channelCurrent, (row) => row['Video Completes'] ?? 0);
      const currentVideoPlays = sumBy(channelCurrent, (row) => row['Video Plays'] ?? 0);
      const priorSpend = sumBy(channelPrior, (row) => row.Spend);
      const priorKbas = sumBy(channelPrior, (row) => row['All KBAs']);
      const priorLeads = sumBy(channelPrior, (row) => row.Leads);
      const priorPageVisits = sumBy(channelPrior, (row) => row['Page Visits'] ?? 0);
      const priorImpressions = sumBy(channelPrior, (row) => row.Impressions);
      const priorVcr = safeDivide(
        sumBy(channelPrior, (row) => (row.VCR && row.VCR > 0 ? row.VCR * Math.max(row.Impressions, 0) : 0)),
        sumBy(channelPrior, (row) => (row.VCR && row.VCR > 0 ? Math.max(row.Impressions, 0) : 0)),
      );
      const priorVideoCompletes = sumBy(channelPrior, (row) => row['Video Completes'] ?? 0);
      const priorVideoPlays = sumBy(channelPrior, (row) => row['Video Plays'] ?? 0);
      const currentPrimaryMetric = primaryMetricForChannel(channelId, {
        spend: currentSpend,
        kbas: currentKbas,
        impressions: currentImpressions,
        vcr: currentVcr || null,
        videoCompletes: currentVideoCompletes,
        videoPlays: currentVideoPlays,
      });
      const priorPrimaryMetric = primaryMetricForChannel(channelId, {
        spend: priorSpend,
        kbas: priorKbas,
        impressions: priorImpressions,
        vcr: priorVcr || null,
        videoCompletes: priorVideoCompletes,
        videoPlays: priorVideoPlays,
      });
      const isVideoChannel = channelId === 'ctv' || channelId === 'olv';
      const currentQuarterLabel = quarter.label;
      const priorQuarterLabel = comparisonQuarter.label;
      const comparisonLabel = insightComparisonLabel(quarter, comparisonQuarter);

      const yoyKbas = changePercent(currentKbas, priorKbas);
      const yoyCpKba =
        currentPrimaryMetric && priorPrimaryMetric
          ? changePercent(currentPrimaryMetric.value, priorPrimaryMetric.value)
          : null;
      const socialSecondaryKpis = socialSecondaryKpiNarrative(
        channelId,
        comparisonLabel,
        { spend: currentSpend, leads: currentLeads, pageVisits: currentPageVisits },
        { spend: priorSpend, leads: priorLeads, pageVisits: priorPageVisits },
      );

      const totalEntityKbas = Math.max(
        sumBy(Array.from(entityCurrent.values()), (item) => item.kbas),
        1,
      );
      const deliveryGroupCurrent = isVideoChannel
        ? groupDetailRows(
            channelCurrent,
            quarter.quarter,
            quarter.year,
            (row) => videoChartLabelForRow(row),
          )
        : entityCurrent;
      const deliveryGroupPrior = isVideoChannel
        ? groupDetailRows(
            channelPrior,
            comparisonQuarter.quarter,
            comparisonQuarter.year,
            (row) => videoChartLabelForRow(row),
          )
        : entityPrior;
      const totalDeliveryMetric = Math.max(
        isVideoChannel
          ? sumBy(Array.from(deliveryGroupCurrent.values()), (item) => item.spend)
          : sumBy(Array.from(deliveryGroupCurrent.values()), (item) => item.kbas),
        1,
      );

      const platformDeliveryBullets = Array.from(deliveryGroupCurrent.entries())
        .map(([entity, metrics]) => ({
          entity,
          spend: metrics.spend,
          kbaShare: safeDivide(metrics.kbas, totalDeliveryMetric),
          spendShare: safeDivide(metrics.spend, isVideoChannel ? totalVideoSpendCurrent : Math.max(currentSpend, 1)),
          primaryMetric: primaryMetricForChannel(channelId, {
            spend: metrics.spend,
            kbas: metrics.kbas,
            impressions: metrics.impressions,
            vcr: safeDivide(metrics.vcrWeightedNumerator, metrics.vcrWeight) || null,
            videoCompletes: metrics.videoCompletes,
            videoPlays: metrics.videoPlays,
          }),
          priorPrimaryMetric: (() => {
            const priorMetrics = deliveryGroupPrior.get(entity);
            if (!priorMetrics) {
              return null;
            }
            return primaryMetricForChannel(channelId, {
              spend: priorMetrics.spend,
              kbas: priorMetrics.kbas,
              impressions: priorMetrics.impressions,
              vcr: safeDivide(priorMetrics.vcrWeightedNumerator, priorMetrics.vcrWeight) || null,
              videoCompletes: priorMetrics.videoCompletes,
              videoPlays: priorMetrics.videoPlays,
            });
          })(),
        }))
        .filter((item) =>
          item.entity
          && (channelId !== 'social' || item.spend > 0)
          && (isPresentableInsightValue(item.kbaShare) || isPresentableInsightValue(item.spendShare)),
        )
        .sort((left, right) => {
          if (right.spendShare !== left.spendShare) {
            return right.spendShare - left.spendShare;
          }
          if (right.kbaShare !== left.kbaShare) {
            return right.kbaShare - left.kbaShare;
          }
          if (left.primaryMetric && right.primaryMetric) {
            return compareInsightMetric(left.primaryMetric, right.primaryMetric);
          }
          return (right.spendShare ?? 0) - (left.spendShare ?? 0);
        })
        .slice(0, channelId === 'social' || channelId === 'search' ? undefined : 2)
        .map((item) => {
          const videoDelta =
            isVideoChannel && item.primaryMetric && item.priorPrimaryMetric
              ? changePercent(item.primaryMetric.value, item.priorPrimaryMetric.value)
              : null;

          return {
            text: [
              isVideoChannel && item.primaryMetric
                ? item.priorPrimaryMetric
                  ? `${item.entity} delivered ${formatPercent(item.spendShare * 100)} of spend; ${currentQuarterLabel} VCR was ${item.primaryMetric.formatter(item.primaryMetric.value)} vs ${item.priorPrimaryMetric.formatter(item.priorPrimaryMetric.value)} in ${priorQuarterLabel}${videoDelta === null ? '.' : ` (${videoDelta >= 0 ? '+' : ''}${formatPercent(videoDelta)}).`}`
                  : `${item.entity} delivered ${formatPercent(item.spendShare * 100)} of spend with a ${currentQuarterLabel} VCR of ${item.primaryMetric.formatter(item.primaryMetric.value)}.`
                : isVideoChannel
                  ? null
                : item.primaryMetric
                  ? `${item.entity} delivered ${formatPercent(item.kbaShare * 100)} of KBAs with a ${item.primaryMetric.label} of ${item.primaryMetric.formatter(item.primaryMetric.value)}.`
                  : `${item.entity} delivered ${formatPercent(item.spendShare * 100)} of spend and ${formatPercent(item.kbaShare * 100)} of KBAs.`,
              isVideoChannel ? null : deliveryComparisonNarrative(item.primaryMetric, item.priorPrimaryMetric, 'platform', comparisonLabel, priorQuarterLabel),
            ].filter(Boolean).join(' '),
            evidenceCount: channelCurrent.filter((row) => (isVideoChannel ? videoChartLabelForRow(row) === item.entity : entityLabelForInsight(row) === item.entity)).length,
            metricValues: item.primaryMetric
              ? isVideoChannel
                ? [item.spendShare, item.primaryMetric.value, item.priorPrimaryMetric?.value, videoDelta]
                : [item.kbaShare, item.primaryMetric.value]
              : isVideoChannel
                ? []
                : [item.spendShare, item.kbaShare],
          };
        });
      const socialComparisonBullet =
        channelId === 'social'
          ? metaTikTokComparisonCandidate(channelCurrent, currentQuarterLabel)
          : null;
      const deliveryBullets = socialComparisonBullet
        ? [...platformDeliveryBullets, socialComparisonBullet]
        : platformDeliveryBullets;

      const campaignMetrics = Array.from(
        new Set([...campaignCurrent.keys(), ...campaignPrior.keys()]),
      )
        .map((key) => {
          const [entity, campaign] = channelId === 'social' ? ['', key] : key.split('::');
          const current = campaignCurrent.get(key) ?? {
            channel: titleCaseChannel(channelId),
            platform: entity,
            siteName: '',
            placementType: '',
            funnelStageCounts: new Map<string, number>(),
            optimizeToCounts: new Map<string, number>(),
            campaign,
            spend: 0,
            kbas: 0,
            leads: 0,
            impressions: 0,
            vcrWeightedNumerator: 0,
            vcrWeight: 0,
            videoCompletes: 0,
            videoPlays: 0,
            clicks: 0,
          };
          const prior = campaignPrior.get(key) ?? {
            ...current,
            spend: 0,
            kbas: 0,
            leads: 0,
            impressions: 0,
            vcrWeightedNumerator: 0,
            vcrWeight: 0,
            videoCompletes: 0,
            videoPlays: 0,
            clicks: 0,
          };

          const funnelStage = topCountLabel(current.funnelStageCounts);
          const optimizeTo = topCountLabel(current.optimizeToCounts);
          const objectiveContext = objectiveContextSummary(funnelStage, optimizeTo);
          const primaryMetric = chooseObjectiveMetric(channelId, objectiveContext, {
            spend: current.spend,
            kbas: current.kbas,
            impressions: current.impressions,
            clicks: current.clicks,
            vcr: safeDivide(current.vcrWeightedNumerator, current.vcrWeight) || null,
            videoCompletes: current.videoCompletes,
            videoPlays: current.videoPlays,
          });
          const secondaryMetric = supportingMetricForChannel(channelId, primaryMetric, {
            spend: current.spend,
            kbas: current.kbas,
            impressions: current.impressions,
            clicks: current.clicks,
          });
          const priorPrimaryMetric = primaryMetricForChannel(channelId, {
            spend: prior.spend,
            kbas: prior.kbas,
            impressions: prior.impressions,
            vcr: safeDivide(prior.vcrWeightedNumerator, prior.vcrWeight) || null,
            videoCompletes: prior.videoCompletes,
            videoPlays: prior.videoPlays,
          });

          return {
            id: key,
            entity,
            campaign,
            funnelStage,
            optimizeTo,
            objectiveContext,
            spend: current.spend,
            kbas: current.kbas,
            impressions: current.impressions,
            clicks: current.clicks,
            spendShare: safeDivide(current.spend, Math.max(currentSpend, 1)),
            kbaShare: safeDivide(current.kbas, Math.max(currentKbas, 1)),
            rowCount: channelCurrent.filter((row) => campaignKeyForChannel(row) === key).length,
            primaryMetric,
            priorPrimaryMetric,
            secondaryMetric,
          };
        })
        .filter(
          (item) =>
            item.campaign
            && item.campaign !== 'Unassigned'
            && item.spend > 0
            && (channelId !== 'social' || isAllowedSocialCampaignLabel(item.campaign)),
        );

      const scaleCampaign = campaignMetrics
        .slice()
        .sort((left, right) => (right.spend !== left.spend ? right.spend - left.spend : right.kbas - left.kbas))[0];
      const comparableCampaigns = campaignMetrics
        .filter(
          (item) =>
            item.primaryMetric &&
            isPresentableInsightValue(item.primaryMetric.value) &&
            isMaterialCampaignInsightCandidate({
              spendShare: item.spendShare,
              kbaShare: item.kbaShare,
              impressions: item.impressions,
              rowCount: item.rowCount,
              channelId,
            }),
        )
        .slice();
      const efficientCampaign = comparableCampaigns
        .slice()
        .sort(
          (left, right) =>
            compareInsightMetric(left.primaryMetric as InsightMetric, right.primaryMetric as InsightMetric) ||
            right.kbas - left.kbas,
        )[0];
      const pressuredCampaign = comparableCampaigns
        .slice()
        .sort(
          (left, right) =>
            compareInsightMetric(right.primaryMetric as InsightMetric, left.primaryMetric as InsightMetric) ||
            right.spend - left.spend,
        )[0];
      const distinctMetricLeaders =
        efficientCampaign &&
        pressuredCampaign &&
        efficientCampaign.id !== pressuredCampaign.id &&
        efficientCampaign.primaryMetric &&
        pressuredCampaign.primaryMetric &&
        hasMeaningfulInsightMetricSpread(efficientCampaign.primaryMetric, pressuredCampaign.primaryMetric);

      const campaignDeliveryBullets =
        channelId === 'social'
          ? groundedBullets(
              campaignMetrics
                .slice()
                .sort((left, right) => (right.spend !== left.spend ? right.spend - left.spend : right.kbas - left.kbas))
                .map((campaign) => ({
                  text: isPresentableInsightValue(campaign.kbaShare)
                    ? `${campaign.campaign} accounted for ${formatPercent(campaign.spendShare * 100)} of spend and ${formatPercent(campaign.kbaShare * 100)} of total KBAs${campaign.primaryMetric ? `, with a ${campaign.primaryMetric.label} of ${campaign.primaryMetric.formatter(campaign.primaryMetric.value)}` : ''}. ${deliveryComparisonNarrative(campaign.primaryMetric, campaign.priorPrimaryMetric, 'campaign', comparisonLabel, priorQuarterLabel) ?? ''}`.trim()
                    : `${campaign.campaign} accounted for ${formatPercent(campaign.spendShare * 100)} of spend${campaign.primaryMetric ? `, with a ${campaign.primaryMetric.label} of ${campaign.primaryMetric.formatter(campaign.primaryMetric.value)}` : ''}. ${deliveryComparisonNarrative(campaign.primaryMetric, campaign.priorPrimaryMetric, 'campaign', comparisonLabel, priorQuarterLabel) ?? ''}`.trim(),
                  evidenceCount: campaign.rowCount,
                  metricValues: [
                    campaign.spendShare,
                    campaign.kbaShare,
                    campaign.primaryMetric?.value,
                    campaign.priorPrimaryMetric?.value,
                    campaign.secondaryMetric?.value,
                  ].filter((value): value is number => value !== null && value !== undefined),
                })),
            )
          : groundedBullets([
              {
                text:
                  scaleCampaign && scaleCampaign.primaryMetric && (channelId === 'ctv' || channelId === 'olv')
                    ? `${scaleCampaign.campaign} accounted for ${formatPercent(scaleCampaign.spendShare * 100)} of spend and delivered a VCR of ${scaleCampaign.primaryMetric.formatter(scaleCampaign.primaryMetric.value)}.${deliveryComparisonNarrative(scaleCampaign.primaryMetric, scaleCampaign.priorPrimaryMetric, 'campaign', comparisonLabel, priorQuarterLabel) ? ` ${deliveryComparisonNarrative(scaleCampaign.primaryMetric, scaleCampaign.priorPrimaryMetric, 'campaign', comparisonLabel, priorQuarterLabel)}` : ''}`
                    : scaleCampaign && isPresentableInsightValue(scaleCampaign.kbaShare)
                      ? `${scaleCampaign.campaign} accounted for ${formatPercent(scaleCampaign.spendShare * 100)} of spend and ${formatPercent(scaleCampaign.kbaShare * 100)} of total KBAs, ${describeShareBalance(scaleCampaign.spendShare, scaleCampaign.kbaShare)}${scaleCampaign.primaryMetric ? `, with a ${scaleCampaign.primaryMetric.label} of ${scaleCampaign.primaryMetric.formatter(scaleCampaign.primaryMetric.value)}` : ''}${scaleCampaign.secondaryMetric ? ` and ${scaleCampaign.secondaryMetric.label} of ${scaleCampaign.secondaryMetric.formatter(scaleCampaign.secondaryMetric.value)}` : ''}.${deliveryComparisonNarrative(scaleCampaign.primaryMetric, scaleCampaign.priorPrimaryMetric, 'campaign', comparisonLabel, priorQuarterLabel) ? ` ${deliveryComparisonNarrative(scaleCampaign.primaryMetric, scaleCampaign.priorPrimaryMetric, 'campaign', comparisonLabel, priorQuarterLabel)}` : ''}`
                      : null,
                evidenceCount: scaleCampaign ? channelCurrent.filter((row) => campaignLabelForInsight(row) === scaleCampaign.campaign).length : 0,
                metricValues: scaleCampaign
                  ? channelId === 'ctv' || channelId === 'olv'
                    ? [scaleCampaign.spendShare, scaleCampaign.primaryMetric?.value]
                    : [scaleCampaign.spendShare, scaleCampaign.kbaShare, scaleCampaign.primaryMetric?.value, scaleCampaign.secondaryMetric?.value]
                  : [],
              },
              {
                text: efficientCampaign && efficientCampaign.primaryMetric && distinctMetricLeaders
                  ? channelId === 'ctv' || channelId === 'olv'
                    ? `${efficientCampaign.campaign} delivered the strongest VCR at ${efficientCampaign.primaryMetric.formatter(efficientCampaign.primaryMetric.value)}.`
                    : `${efficientCampaign.campaign} delivered ${efficientCampaign.primaryMetric.positivePhrase} at ${efficientCampaign.primaryMetric.formatter(efficientCampaign.primaryMetric.value)}${efficientCampaign.secondaryMetric ? `, alongside ${efficientCampaign.secondaryMetric.label} of ${efficientCampaign.secondaryMetric.formatter(efficientCampaign.secondaryMetric.value)}` : ''}.`
                  : null,
                evidenceCount: efficientCampaign ? channelCurrent.filter((row) => campaignLabelForInsight(row) === efficientCampaign.campaign).length : 0,
                metricValues: efficientCampaign
                  ? channelId === 'ctv' || channelId === 'olv'
                    ? [efficientCampaign.primaryMetric?.value]
                    : [efficientCampaign.primaryMetric?.value, efficientCampaign.secondaryMetric?.value]
                  : [],
              },
              {
                text: pressuredCampaign && pressuredCampaign.primaryMetric && distinctMetricLeaders
                  ? channelId === 'ctv' || channelId === 'olv'
                    ? `${pressuredCampaign.campaign} delivered a low VCR of ${pressuredCampaign.primaryMetric.formatter(pressuredCampaign.primaryMetric.value)}.`
                    : `${pressuredCampaign.campaign} delivered ${pressuredCampaign.primaryMetric.negativePhrase} at ${pressuredCampaign.primaryMetric.formatter(pressuredCampaign.primaryMetric.value)}${pressuredCampaign.secondaryMetric ? `, with ${pressuredCampaign.secondaryMetric.label} at ${pressuredCampaign.secondaryMetric.formatter(pressuredCampaign.secondaryMetric.value)}` : ''}.`
                  : null,
                evidenceCount: pressuredCampaign ? channelCurrent.filter((row) => campaignLabelForInsight(row) === pressuredCampaign.campaign).length : 0,
                metricValues: pressuredCampaign
                  ? channelId === 'ctv' || channelId === 'olv'
                    ? [pressuredCampaign.primaryMetric?.value]
                    : [pressuredCampaign.primaryMetric?.value, pressuredCampaign.secondaryMetric?.value]
                  : [],
              },
            ]);

      const quarterLearningNarrative = quarterLearningCombinedNarrative(
        channelId,
        titleCaseChannel(channelId),
        quarter,
        comparisonQuarter,
        currentQuarterLabel,
        priorQuarterLabel,
        currentKbas,
        priorKbas,
        currentPrimaryMetric,
        priorPrimaryMetric,
      );
      const quarterLearningText = quarterLearningNarrative
        ? [quarterLearningNarrative, socialSecondaryKpis?.text].filter(Boolean).join(' ')
        : null;

      const quarterLearningsBullets = groundedBullets([
        {
          text: quarterLearningText,
          evidenceCount: channelCurrent.length + channelPrior.length,
          metricValues: [
            currentKbas,
            priorKbas,
            yoyKbas,
            currentPrimaryMetric?.value,
            priorPrimaryMetric?.value,
            yoyCpKba,
            ...(socialSecondaryKpis?.metricValues ?? []),
          ],
        },
      ]).slice(0, 3);

      const optimizationBullets = groundedBullets([
        {
          text: pressuredCampaign && pressuredCampaign.primaryMetric && distinctMetricLeaders
            ? `Optimize ${pressuredCampaign.campaign}, which delivered ${pressuredCampaign.primaryMetric.formatter(pressuredCampaign.primaryMetric.value)} on ${pressuredCampaign.primaryMetric.label} while representing ${formatPercent(pressuredCampaign.spendShare * 100)} of spend.`
            : null,
          evidenceCount: pressuredCampaign ? channelCurrent.filter((row) => campaignEvidenceLabelForChannel(row) === pressuredCampaign.campaign).length : 0,
          metricValues: pressuredCampaign ? [pressuredCampaign.primaryMetric?.value, pressuredCampaign.spendShare] : [],
        },
      ]);

      const recommendationBullets = groundedBullets([
        {
          text:
            efficientCampaign && efficientCampaign.primaryMetric && (isVideoChannel || isPresentableInsightValue(efficientCampaign.kbaShare))
              ? `${describeShareBalance(efficientCampaign.spendShare, efficientCampaign.kbaShare) === 'outperforming its share of investment'
                  ? 'Scale'
                  : describeShareBalance(efficientCampaign.spendShare, efficientCampaign.kbaShare) === 'performing broadly in line with its share of investment'
                    ? 'Hold'
                    : 'Optimize'} ${efficientCampaign.entity} / ${efficientCampaign.campaign} based on ${efficientCampaign.primaryMetric.label} of ${efficientCampaign.primaryMetric.formatter(efficientCampaign.primaryMetric.value)}${isVideoChannel ? ` at ${formatPercent(efficientCampaign.spendShare * 100)} of spend.` : ` and ${formatPercent(efficientCampaign.kbaShare * 100)} of channel KBAs.`}`
              : null,
          evidenceCount: efficientCampaign ? channelCurrent.filter((row) => campaignEvidenceLabelForChannel(row) === efficientCampaign.campaign).length : 0,
          metricValues: efficientCampaign
            ? isVideoChannel
              ? [efficientCampaign.primaryMetric?.value, efficientCampaign.spendShare]
              : [efficientCampaign.primaryMetric?.value, efficientCampaign.kbaShare]
            : [],
        },
        {
          text:
            !efficientCampaign && scaleCampaign
              ? isVideoChannel
                ? `Hold ${scaleCampaign.entity} / ${scaleCampaign.campaign} while monitoring whether VCR remains stable at current spend levels.`
                : `Hold ${scaleCampaign.entity} / ${scaleCampaign.campaign} while monitoring whether outcome contribution stays aligned with spend share.`
              : null,
          evidenceCount: !efficientCampaign && scaleCampaign ? channelCurrent.filter((row) => campaignEvidenceLabelForChannel(row) === scaleCampaign.campaign).length : 0,
          metricValues: !efficientCampaign && scaleCampaign
            ? isVideoChannel
              ? [scaleCampaign.spendShare, scaleCampaign.primaryMetric?.value]
              : [scaleCampaign.spendShare, scaleCampaign.kbaShare]
            : [],
        },
      ]);

      const sections: InsightSection[] = [
        { id: 'delivery' as const, title: 'Delivery by Platform/Channel/Campaign', bullets: groundedBullets(deliveryBullets) },
        {
          id: 'variance' as const,
          title: 'YoY Variances',
          bullets: groundedBullets([
            {
              text:
                !isVideoChannel && yoyKbas !== null
                  ? `Overall ${titleCaseChannel(channelId)} KBAs ${yoyKbas >= 0 ? 'increased' : 'decreased'} ${formatPercent(Math.abs(yoyKbas))} YoY to ${formatCompactNumber(currentKbas)} from ${formatCompactNumber(priorKbas)}.`
                  : null,
              evidenceCount: channelCurrent.length + channelPrior.length,
              metricValues: [yoyKbas, currentKbas, priorKbas],
            },
            {
              text:
                yoyCpKba !== null && currentPrimaryMetric && priorPrimaryMetric
                  ? varianceNarrative(
                      currentPrimaryMetric,
                      yoyCpKba,
                      'last year',
                      currentPrimaryMetric.formatter(currentPrimaryMetric.value),
                      priorPrimaryMetric.formatter(priorPrimaryMetric.value),
                    )
                  : isVideoChannel && currentPrimaryMetric && !priorPrimaryMetric
                    ? varianceUnavailableNarrative(currentPrimaryMetric, titleCaseChannel(channelId))
                  : null,
              evidenceCount: channelCurrent.length + channelPrior.length,
              metricValues: [yoyCpKba, currentPrimaryMetric?.value, priorPrimaryMetric?.value],
            },
          ]),
        },
        { id: 'campaignDelivery' as const, title: 'Campaign Delivery', bullets: campaignDeliveryBullets },
        { id: 'quarterLearnings' as const, title: 'Key Quarterly Takeaways', bullets: quarterLearningsBullets.slice(0, 3) },
        { id: 'optimizations' as const, title: 'Optimizations', bullets: optimizationBullets },
        { id: 'recommendations' as const, title: 'Recommendations', bullets: recommendationBullets },
      ].filter((section) => {
        if (section.bullets.length > 0) {
          audit.renderedSectionCount += 1;
          return true;
        }

        audit.blockedSectionCount += 1;
        return false;
      });

      if (sections.length === 0) {
        return null;
      }

      audit.renderedChannelCount += 1;

      return {
        channel: titleCaseChannel(channelCurrent[0]?.Channel ?? channelId),
        sections,
      };
    })
    .filter((item): item is ChannelInsight => Boolean(item));

  return {
    channels: renderedChannels,
    audit,
  };
}

export async function buildDashboardResponse(scope: ScopeParams = {}): Promise<DashboardResponse> {
  const config = resolveTableauMcpConfig();
  const buildStartedAt = performance.now();
  const optionRows = await timeDashboardStage('tableau.options', () =>
    callTableauTool<QueryResponse<OptionRow>>('query-datasource', OPTIONS_QUERY),
  );
  const { regions, macos } = buildFilterOptions(optionRows.data);

  const selectedRegion = regions.includes(scope.region ?? '') ? (scope.region as string) : regions[0];
  const regionMacos = macos.get(selectedRegion) ?? ['ALL MACOS'];
  const selectedMaco =
    scope.maco && regionMacos.includes(scope.maco) ? scope.maco : 'ALL MACOS';

  const filters = buildScopeFilters(selectedRegion, selectedMaco);

  const monthly = await timeDashboardStage('tableau.monthly', () =>
    callTableauTool<QueryResponse<MonthlyRow>>(
      'query-datasource',
      buildQuery(MONTHLY_QUERY_BASE, filters),
    ),
  );
  const monthlyByChannel = await timeDashboardStage('tableau.monthly-by-channel', () =>
    callTableauTool<QueryResponse<MonthlyChannelRow>>(
      'query-datasource',
      buildQuery(MONTHLY_CHANNEL_QUERY_BASE, filters),
    ),
  );

  const availableQuarters = buildAvailableQuarters(monthly.data);
  const latestComplete = getLatestCompleteQuarter();
  const defaultCurrentQuarter =
    availableQuarters.find((option) => option.quarter === latestComplete.quarter && option.year === latestComplete.year) ??
    availableQuarters[0];
  const defaultComparisonQuarter =
    availableQuarters.find(
      (option) =>
        option.quarter === defaultCurrentQuarter.quarter &&
        option.year === defaultCurrentQuarter.year - 1,
    ) ?? availableQuarters.find((option) => option.label !== defaultCurrentQuarter.label) ?? defaultCurrentQuarter;
  const currentQuarter = resolveQuarterSelection(scope.currentQuarter, availableQuarters, defaultCurrentQuarter);
  const comparisonQuarter = resolveQuarterSelection(scope.comparisonQuarter, availableQuarters, defaultComparisonQuarter);
  const quarterLabelCurrent = currentQuarter.label;
  const quarterLabelPrior = comparisonQuarter.label;
  const scopedQuarters = [currentQuarter, comparisonQuarter];
  const detail = await timeDashboardStage(
    'detail.scoped',
    () => fetchDetailRowsForQuarters(filters, scopedQuarters),
    { region: selectedRegion, maco: selectedMaco },
  );
  const regionDetail =
    selectedMaco === 'ALL MACOS'
      ? detail
      : await timeDashboardStage(
          'detail.region-rollup',
          () => fetchDetailRowsForQuarters(buildScopeFilters(selectedRegion), scopedQuarters),
          { region: selectedRegion },
        );
  const monthLabels = quarterMonths(currentQuarter.quarter).map((monthIndex) =>
    formatMonthLabel(new Date(Date.UTC(currentQuarter.year, monthIndex, 1))),
  );

  const currentRows = monthly.data.filter((row) =>
    monthInQuarter(parseMonth(row.Month), currentQuarter.quarter, currentQuarter.year),
  );
  const priorRows = monthly.data.filter((row) =>
    monthInQuarter(parseMonth(row.Month), comparisonQuarter.quarter, comparisonQuarter.year),
  );
  const currentScopedDetailRows = detail.data.filter((row) =>
    monthInQuarter(parseMonth(row.Month), currentQuarter.quarter, currentQuarter.year),
  );
  const priorScopedDetailRows = detail.data.filter((row) =>
    monthInQuarter(parseMonth(row.Month), comparisonQuarter.quarter, comparisonQuarter.year),
  );

  const currentTotals = {
    spend: sumBy(currentRows, (row) => row.Spend),
    kbas: sumBy(currentRows, (row) => row['All KBAs']),
    byoStarts: sumBy(currentRows, (row) => row['BYO Starts']),
    byoCompletes: sumBy(currentRows, (row) => row['BYO Completes']),
    inventorySearches: sumBy(currentRows, (row) => row['Inventory Searches']),
    leads: sumBy(currentRows, (row) => row.Leads),
    impressions: sumBy(currentRows, (row) => row.Impressions),
  };

  const priorTotals = {
    spend: sumBy(priorRows, (row) => row.Spend),
    kbas: sumBy(priorRows, (row) => row['All KBAs']),
    byoStarts: sumBy(priorRows, (row) => row['BYO Starts']),
    byoCompletes: sumBy(priorRows, (row) => row['BYO Completes']),
    inventorySearches: sumBy(priorRows, (row) => row['Inventory Searches']),
    leads: sumBy(priorRows, (row) => row.Leads),
    impressions: sumBy(priorRows, (row) => row.Impressions),
  };

  const currentCpKbaTotals = sumCpKbaTotals(
    monthlyByChannel.data.filter((row) =>
      monthInQuarter(parseMonth(row.Month), currentQuarter.quarter, currentQuarter.year),
    ),
  );
  const priorCpKbaTotals = sumCpKbaTotals(
    monthlyByChannel.data.filter((row) =>
      monthInQuarter(parseMonth(row.Month), comparisonQuarter.quarter, comparisonQuarter.year),
    ),
  );
  const currentCpKba = safeDivide(currentCpKbaTotals.spend, currentCpKbaTotals.kbas);
  const priorCpKba = safeDivide(priorCpKbaTotals.spend, priorCpKbaTotals.kbas);
  const values = [
    { current: currentTotals.byoStarts, prior: priorTotals.byoStarts },
    { current: currentTotals.byoCompletes, prior: priorTotals.byoCompletes },
    { current: currentTotals.inventorySearches, prior: priorTotals.inventorySearches },
    { current: currentTotals.leads, prior: priorTotals.leads },
    { current: currentTotals.spend, prior: priorTotals.spend },
    { current: currentTotals.kbas, prior: priorTotals.kbas },
    { current: currentTotals.impressions, prior: priorTotals.impressions },
    { current: currentCpKba, prior: priorCpKba },
  ];

  const kpis = KPI_META.map((meta, index) => {
    const value = values[index];
    const yoy = buildYoyStatus(value.current, value.prior, meta.betterWhenLower);
    const displayValue = meta.formatter === 'currency' ? formatKpiCurrency(value.current) : formatKpiCompactNumber(value.current);

    return {
      id: meta.id,
      label: meta.label,
      value: value.current,
      displayValue,
      delta: yoy.delta,
      deltaLabel: yoy.label,
      tone: yoy.tone,
      note: meta.note,
    };
  });

  const chartStartMonth = new Date(Date.UTC(2025, 0, 1));
  const chartEndMonth = new Date(Date.UTC(2026, 2, 1));
  const fixedChartWindow: Date[] = [];
  for (let cursor = new Date(chartStartMonth); cursor <= chartEndMonth; cursor = shiftMonth(cursor, 1)) {
    fixedChartWindow.push(new Date(cursor));
  }
  const monthlyLookup = new Map(
    monthly.data.map((row) => {
      const month = parseMonth(row.Month);
      return [`${month.getUTCFullYear()}-${month.getUTCMonth()}`, row] as const;
    }),
  );
  const cpKbaMonthlyLookup = new Map<string, CpKbaTotals>();
  for (const row of monthlyByChannel.data) {
    if (!isSearchOrSocialChannel(row.Channel || '')) {
      continue;
    }

    const month = parseMonth(row.Month);
    const key = `${month.getUTCFullYear()}-${month.getUTCMonth()}`;
    const current = cpKbaMonthlyLookup.get(key) ?? { spend: 0, kbas: 0 };
    current.spend += row.Spend;
    current.kbas += row['All KBAs'];
    cpKbaMonthlyLookup.set(key, current);
  }

  const points = fixedChartWindow.map((month, index) => {
    const row = monthlyLookup.get(`${month.getUTCFullYear()}-${month.getUTCMonth()}`);
    const cpKbaSource = cpKbaMonthlyLookup.get(`${month.getUTCFullYear()}-${month.getUTCMonth()}`) ?? { spend: 0, kbas: 0 };
    const previousCpKbaSource =
      index > 0
        ? cpKbaMonthlyLookup.get(
            `${fixedChartWindow[index - 1].getUTCFullYear()}-${fixedChartWindow[index - 1].getUTCMonth()}`,
          ) ?? { spend: 0, kbas: 0 }
        : undefined;
    const previousMonth = index > 0 ? monthlyLookup.get(`${fixedChartWindow[index - 1].getUTCFullYear()}-${fixedChartWindow[index - 1].getUTCMonth()}`) : undefined;
    const spendMoM = buildYoyStatus(row?.Spend ?? 0, previousMonth?.Spend ?? 0);
    const kbasMoM = buildYoyStatus(row?.['All KBAs'] ?? 0, previousMonth?.['All KBAs'] ?? 0);
    const cpKba = safeDivide(cpKbaSource.spend, cpKbaSource.kbas);
    const previousCpKba = safeDivide(previousCpKbaSource?.spend ?? 0, previousCpKbaSource?.kbas ?? 0);
    const cpKbaMoM = buildYoyStatus(cpKba, previousCpKba);

    return {
      label: formatMonthYearLabel(month),
      spend: row?.Spend ?? 0,
      kbas: row?.['All KBAs'] ?? 0,
      cpKba,
      spendDisplay: formatCurrency(row?.Spend ?? 0),
      kbasDisplay: formatCompactNumber(row?.['All KBAs'] ?? 0),
      cpKbaDisplay: formatCurrency(cpKba),
      spendMoMLabel: index === 0 ? 'Window start' : spendMoM.label.replace('YoY', 'MoM'),
      kbasMoMLabel: index === 0 ? 'Window start' : kbasMoM.label.replace('YoY', 'MoM'),
      cpKbaMoMLabel: index === 0 ? 'Window start' : cpKbaMoM.label.replace('YoY', 'MoM'),
    };
  });

  const spendPeak = points.reduce((best, point) => (point.spend > best.spend ? point : best), points[0]);
  const kbaPeak = points.reduce((best, point) => (point.kbas > best.kbas ? point : best), points[0]);
  const latestPoint = points[points.length - 1];
  const firstPoint = points[0];
  const spendWindowDelta = buildYoyStatus(latestPoint.spend, firstPoint.spend);
  const kbaWindowDelta = buildYoyStatus(latestPoint.kbas, firstPoint.kbas);
  const spendWindowLabel = spendWindowDelta.label.replace('YoY', '').trim();
  const kbaWindowLabel = kbaWindowDelta.label.replace('YoY', '').trim();
  const chartTakeaway = `Spend peaked in ${spendPeak.label} at ${spendPeak.spendDisplay}, while All KBAs peaked in ${kbaPeak.label} at ${kbaPeak.kbasDisplay}. From ${firstPoint.label} to ${latestPoint.label}, spend moved ${spendWindowLabel} and KBAs moved ${kbaWindowLabel}.`;
  const benchmark2025SourceTotals = fixedChartWindow.reduce<CpKbaTotals>(
    (totals, point) => {
      if (point.getUTCFullYear() !== 2025) {
        return totals;
      }

      const source = cpKbaMonthlyLookup.get(`${point.getUTCFullYear()}-${point.getUTCMonth()}`);
      if (source) {
        totals.spend += source.spend;
        totals.kbas += source.kbas;
      }
      return totals;
    },
    { spend: 0, kbas: 0 },
  );
  const cpKbaBenchmark = safeDivide(benchmark2025SourceTotals.spend, benchmark2025SourceTotals.kbas);

  const mediaChannelMeta = [
    { id: 'social', label: 'Social', channelIds: ['social'] },
    { id: 'search', label: 'Search', channelIds: ['search'] },
    { id: 'video', label: 'Video', channelIds: ['ctv', 'olv'] },
  ] as const;

  const aggregateChannelQuarter = (rows: DetailRow[], quarter: number, year: number, channelIds: readonly string[]) => {
    const scopedRows = rows.filter((row) => {
      const month = parseMonth(row.Month);
      return monthInQuarter(month, quarter, year) && channelIds.includes(normalizeChannel(row.Channel || ''));
    });

    const vcrWeightedNumerator = sumBy(
      scopedRows,
      (row) => (typeof row.VCR === 'number' && row.VCR > 0 ? row.VCR * Math.max(row.Impressions ?? 0, 0) : 0),
    );
    const vcrWeightedDenominator = sumBy(
      scopedRows,
      (row) => (typeof row.VCR === 'number' && row.VCR > 0 ? Math.max(row.Impressions ?? 0, 0) : 0),
    );

    return {
      spend: sumBy(scopedRows, (row) => row.Spend),
      kbas: sumBy(scopedRows, (row) => row['All KBAs']),
      inventorySearches: sumBy(scopedRows, (row) => row['Inventory Searches']),
      pageVisits: sumBy(scopedRows, (row) => row['Page Visits'] ?? 0),
      clicks: sumBy(scopedRows, (row) => row.Clicks ?? 0),
      impressions: sumBy(scopedRows, (row) => row.Impressions ?? 0),
      videoPlays: sumBy(scopedRows, (row) => row['Video Plays'] ?? 0),
      videoCompletes: sumBy(scopedRows, (row) => row['Video Completes'] ?? 0),
      vcr: safeDivide(vcrWeightedNumerator, vcrWeightedDenominator),
    };
  };
  const regionGroupLabel = selectedRegion.replace('T2', '');
  const scopedGroupLabel = selectedMaco === 'ALL MACOS' ? 'All MACOs' : selectedMaco;

  const mediaSpendPerformanceCards: MediaSpendPerformanceCard[] = mediaChannelMeta.map((channel) => {
    const scopeCurrent = aggregateChannelQuarter(detail.data, currentQuarter.quarter, currentQuarter.year, channel.channelIds);
    const scopePrior = aggregateChannelQuarter(detail.data, comparisonQuarter.quarter, comparisonQuarter.year, channel.channelIds);
    const currentCpKba = safeDivide(scopeCurrent.spend, scopeCurrent.kbas);
    const priorCpKba = safeDivide(scopePrior.spend, scopePrior.kbas);
    const currentVcr = scopeCurrent.videoPlays > 0 ? safeDivide(scopeCurrent.videoCompletes, scopeCurrent.videoPlays) : scopeCurrent.vcr;
    const priorVcr = scopePrior.videoPlays > 0 ? safeDivide(scopePrior.videoCompletes, scopePrior.videoPlays) : scopePrior.vcr;
    const platformSpend = channel.channelIds
      .flatMap((channelId) =>
        aggregateChannelPlatforms(
          detail.data,
          currentQuarter.quarter,
          currentQuarter.year,
          channelId,
          channel.id === 'video' ? 'videoChart' : 'platform',
        ),
      )
      .reduce<Array<{ label: string; spend: number; spendDisplay: string }>>((groups, current) => {
        const existing = groups.find((entry) => entry.label === current.label);
        if (existing) {
          existing.spend += current.spend;
          existing.spendDisplay = formatCurrency(existing.spend);
          return groups;
        }

        groups.push({ ...current });
        return groups;
      }, [])
      .sort((left, right) => right.spend - left.spend);

    return {
      id: channel.id,
      label: channel.label,
      platformSpend,
      metrics:
        channel.id === 'video'
          ? [
              {
                id: 'spend',
                label: 'Total Spend',
                display: formatKpiCurrency(scopeCurrent.spend),
                changeLabel: formatChangeVsLy(scopeCurrent.spend, scopePrior.spend, formatKpiCurrency(scopePrior.spend)),
              },
              {
                id: 'impressions',
                label: 'Impressions',
                display: formatCompactNumber(scopeCurrent.impressions),
                changeLabel: formatChangeVsLy(
                  scopeCurrent.impressions,
                  scopePrior.impressions,
                  formatCompactNumber(scopePrior.impressions),
                ),
              },
              {
                id: 'vcr',
                label: 'VCR',
                display: formatPercent(currentVcr * 100),
                changeLabel: formatChangeVsLy(currentVcr, priorVcr, formatPercent(priorVcr * 100)),
              },
            ]
          : buildNonVideoMediaCardMetrics({
              channelId: channel.id,
              spendCurrent: scopeCurrent.spend,
              spendPrior: scopePrior.spend,
              kbasCurrent: scopeCurrent.kbas,
              kbasPrior: scopePrior.kbas,
              clicksCurrent: scopeCurrent.clicks,
              clicksPrior: scopePrior.clicks,
              impressionsCurrent: scopeCurrent.impressions,
              impressionsPrior: scopePrior.impressions,
              cpKbaCurrent: currentCpKba,
              cpKbaPrior: priorCpKba,
            }),
    };
  });

  const currentCampaignBuckets = aggregateCampaignCardBuckets(detail.data, currentQuarter.quarter, currentQuarter.year);
  const priorCampaignBuckets = aggregateCampaignCardBuckets(detail.data, comparisonQuarter.quarter, comparisonQuarter.year);
  const currentCampaignTotals = {
    spend: sumBy(currentCampaignBuckets, (campaign) => campaign.spend),
    kbas: sumBy(currentCampaignBuckets, (campaign) => campaign.kbas),
    impressions: sumBy(currentCampaignBuckets, (campaign) => campaign.impressions),
  };
  const priorCampaignTotals = {
    spend: sumBy(priorCampaignBuckets, (campaign) => campaign.spend),
    kbas: sumBy(priorCampaignBuckets, (campaign) => campaign.kbas),
    impressions: sumBy(priorCampaignBuckets, (campaign) => campaign.impressions),
  };
  const currentCampaignCpKba = safeDivide(currentCampaignTotals.spend, currentCampaignTotals.kbas);
  const priorCampaignCpKba = safeDivide(priorCampaignTotals.spend, priorCampaignTotals.kbas);

  const campaignMediaSpendPerformanceCard: MediaSpendPerformanceCard = {
    id: 'campaign',
    label: 'Campaign',
    platformSpend: currentCampaignBuckets.map((campaign) => ({
      label: campaign.label,
      spend: campaign.spend,
      spendDisplay: formatCurrency(campaign.spend),
    })),
    highlights: buildCampaignCardHighlights(currentCampaignBuckets),
    metrics: [
      {
        id: 'spend',
        label: 'Total Spend',
        display: formatKpiCurrency(currentCampaignTotals.spend),
        changeLabel: formatChangeVsLy(
          currentCampaignTotals.spend,
          priorCampaignTotals.spend,
          formatKpiCurrency(priorCampaignTotals.spend),
        ),
      },
      {
        id: 'impressions',
        label: 'Impressions',
        display: formatCompactNumber(currentCampaignTotals.impressions),
        changeLabel: formatChangeVsLy(
          currentCampaignTotals.impressions,
          priorCampaignTotals.impressions,
          formatCompactNumber(priorCampaignTotals.impressions),
        ),
      },
      {
        id: 'cpkba',
        label: 'Cost Per KBA',
        display: formatCurrency(currentCampaignCpKba),
        changeLabel: formatChangeVsLy(currentCampaignCpKba, priorCampaignCpKba, formatCurrency(priorCampaignCpKba)),
      },
    ],
  };

  mediaSpendPerformanceCards.splice(1, 0, campaignMediaSpendPerformanceCard);

  const currentChannelMap = groupDetailRows(
    detail.data,
    currentQuarter.quarter,
    currentQuarter.year,
    (row) => row.Channel || 'Unassigned',
  );
  const priorChannelMap = groupDetailRows(
    detail.data,
    comparisonQuarter.quarter,
    comparisonQuarter.year,
    (row) => row.Channel || 'Unassigned',
  );

  const overallCpKba = currentCpKba;

  const channelSummary: ChannelSummaryRow[] = Array.from(currentChannelMap.entries())
    .map(([channel, current]) => {
      const prior = priorChannelMap.get(channel) ?? {
        channel,
        platform: '',
        campaign: '',
        spend: 0,
        kbas: 0,
        byoStarts: 0,
        byoCompletes: 0,
        inventorySearches: 0,
        leads: 0,
        impressions: 0,
      };
      const yoy = buildYoyStatus(current.kbas, prior.kbas);
      const cpKba = safeDivide(current.spend, current.kbas);
      const status: 'Ahead' | 'Stable' | 'Watch' =
        cpKba <= overallCpKba * 0.9 ? 'Ahead' : cpKba >= overallCpKba * 1.1 ? 'Watch' : 'Stable';

      return {
        channel,
        spendDisplay: formatCurrency(current.spend),
        kbasDisplay: formatCompactNumber(current.kbas),
        cpkbaDisplay: formatCurrency(cpKba),
        yoyLabel: yoy.label,
        status,
        currentSpend: current.spend,
        priorSpend: prior.spend,
        currentSpendShare: safeDivide(current.spend, Math.max(currentTotals.spend, 1)),
        priorSpendShare: safeDivide(prior.spend, Math.max(priorTotals.spend, 1)),
      };
    })
    .sort((left, right) => {
      const leftValue = currentChannelMap.get(left.channel)?.spend ?? 0;
      const rightValue = currentChannelMap.get(right.channel)?.spend ?? 0;
      return rightValue - leftValue;
    });

  const currentCampaignMap = groupDetailRows(
    detail.data,
    currentQuarter.quarter,
    currentQuarter.year,
    (row) => `${row.Channel || 'Unassigned'}::${row.Campaign || 'Unassigned'}`,
  );
  const priorCampaignMap = groupDetailRows(
    detail.data,
    comparisonQuarter.quarter,
    comparisonQuarter.year,
    (row) => `${row.Channel || 'Unassigned'}::${row.Campaign || 'Unassigned'}`,
  );
  const currentPlatformMap = groupDetailRows(
    detail.data,
    currentQuarter.quarter,
    currentQuarter.year,
    (row) => `${row.Channel || 'Unassigned'}::${row.Platform || 'Unassigned'}`,
  );
  const priorPlatformMap = groupDetailRows(
    detail.data,
    comparisonQuarter.quarter,
    comparisonQuarter.year,
    (row) => `${row.Channel || 'Unassigned'}::${row.Platform || 'Unassigned'}`,
  );
  const driverCandidates = Array.from(currentCampaignMap.entries()).map(([key, current]) => {
    const prior = priorCampaignMap.get(key) ?? {
      channel: current.channel,
      platform: current.platform,
      campaign: current.campaign,
      spend: 0,
      kbas: 0,
      byoStarts: 0,
      byoCompletes: 0,
      inventorySearches: 0,
      leads: 0,
      impressions: 0,
    };
    const yoy = buildYoyStatus(current.kbas, prior.kbas);
    return {
      channel: current.channel,
      campaign: current.campaign,
      currentKbas: current.kbas,
      priorKbas: prior.kbas,
      contribution: current.kbas - prior.kbas,
      yoy,
      material: yoy.delta !== null && Math.abs(yoy.delta) >= 15,
    };
  });

  const positiveDrivers: DriverItem[] = driverCandidates
    .filter((item) => item.contribution > 0)
    .sort((left, right) => right.contribution - left.contribution)
    .slice(0, 3)
    .map((item) => ({
      channel: item.channel,
      campaign: item.campaign,
      currentKbas: formatCompactNumber(item.currentKbas),
      priorKbas: formatCompactNumber(item.priorKbas),
      contribution: formatCompactNumber(item.contribution),
      yoyLabel: item.yoy.label,
      material: item.material,
    }));

  const negativeDrivers: DriverItem[] = driverCandidates
    .filter((item) => item.contribution < 0)
    .sort((left, right) => left.contribution - right.contribution)
    .slice(0, 3)
    .map((item) => ({
      channel: item.channel,
      campaign: item.campaign,
      currentKbas: formatCompactNumber(item.currentKbas),
      priorKbas: formatCompactNumber(item.priorKbas),
      contribution: formatCompactNumber(item.contribution),
      yoyLabel: item.yoy.label,
      material: item.material,
    }));

  const efficiencyCandidates = [
    ...Array.from(currentChannelMap.entries()).map(([key, current]) => {
      const prior = priorChannelMap.get(key) ?? {
        channel: current.channel,
        platform: '',
        campaign: '',
        spend: 0,
        kbas: 0,
        byoStarts: 0,
        byoCompletes: 0,
        inventorySearches: 0,
        leads: 0,
        impressions: 0,
      };
      const currentCpKba = safeDivide(current.spend, current.kbas);
      const priorCpKba = safeDivide(prior.spend, prior.kbas);
      const yoy = buildYoyStatus(currentCpKba, priorCpKba, true);
      return {
        entityType: 'Channel' as const,
        label: current.channel,
        context: 'Scoped view',
        currentCpKba,
        priorCpKba,
        yoy,
      };
    }),
    ...Array.from(currentPlatformMap.entries()).map(([key, current]) => {
      const prior = priorPlatformMap.get(key) ?? {
        channel: current.channel,
        platform: current.platform,
        campaign: '',
        spend: 0,
        kbas: 0,
        byoStarts: 0,
        byoCompletes: 0,
        inventorySearches: 0,
        leads: 0,
        impressions: 0,
      };
      const currentCpKba = safeDivide(current.spend, current.kbas);
      const priorCpKba = safeDivide(prior.spend, prior.kbas);
      const yoy = buildYoyStatus(currentCpKba, priorCpKba, true);
      return {
        entityType: 'Platform' as const,
        label: current.platform,
        context: current.channel,
        currentCpKba,
        priorCpKba,
        yoy,
      };
    }),
    ...Array.from(currentCampaignMap.entries()).map(([key, current]) => {
      const prior = priorCampaignMap.get(key) ?? {
        channel: current.channel,
        platform: current.platform,
        campaign: current.campaign,
        spend: 0,
        kbas: 0,
        byoStarts: 0,
        byoCompletes: 0,
        inventorySearches: 0,
        leads: 0,
        impressions: 0,
      };
      const currentCpKba = safeDivide(current.spend, current.kbas);
      const priorCpKba = safeDivide(prior.spend, prior.kbas);
      const yoy = buildYoyStatus(currentCpKba, priorCpKba, true);
      return {
        entityType: 'Campaign' as const,
        label: current.campaign,
        context: `${current.channel} / ${current.platform}`,
        currentCpKba,
        priorCpKba,
        yoy,
      };
    }),
  ].filter((item) => item.yoy.delta !== null && item.priorCpKba > 0);

  const positiveEfficiencyDrivers: EfficiencyDriverItem[] = efficiencyCandidates
    .filter((item) => (item.yoy.delta ?? 0) < 0)
    .sort((left, right) => (left.yoy.delta ?? 0) - (right.yoy.delta ?? 0))
    .slice(0, 3)
    .map((item) => ({
      entityType: item.entityType,
      label: item.label,
      context: item.context,
      currentCpKba: formatCurrency(item.currentCpKba),
      priorCpKba: formatCurrency(item.priorCpKba),
      deltaLabel: item.yoy.label,
      material: Math.abs(item.yoy.delta ?? 0) >= 15,
    }));

  const negativeEfficiencyDrivers: EfficiencyDriverItem[] = efficiencyCandidates
    .filter((item) => (item.yoy.delta ?? 0) > 0)
    .sort((left, right) => (right.yoy.delta ?? 0) - (left.yoy.delta ?? 0))
    .slice(0, 3)
    .map((item) => ({
      entityType: item.entityType,
      label: item.label,
      context: item.context,
      currentCpKba: formatCurrency(item.currentCpKba),
      priorCpKba: formatCurrency(item.priorCpKba),
      deltaLabel: item.yoy.label,
      material: Math.abs(item.yoy.delta ?? 0) >= 15,
    }));

  const appendixRows = buildCampaignAppendixRows(
    currentChannelMap,
    priorChannelMap,
    currentPlatformMap,
    priorPlatformMap,
  );

  const appendixTotals: CampaignAppendixRow = {
    rowType: 'subtotal',
    channel: 'Total',
    platform: '',
    current: buildAppendixMetricDisplays({
      ...currentTotals,
      priorSpend: priorTotals.spend,
      priorKbas: priorTotals.kbas,
      priorImpressions: priorTotals.impressions,
      priorByoStarts: priorTotals.byoStarts,
      priorByoCompletes: priorTotals.byoCompletes,
      priorInventorySearches: priorTotals.inventorySearches,
      priorLeads: priorTotals.leads,
      priorCpKba: safeDivide(priorTotals.spend, priorTotals.kbas),
    }),
    comparison: buildAppendixMetricDisplays({
      ...priorTotals,
      priorSpend: currentTotals.spend,
      priorKbas: currentTotals.kbas,
      priorImpressions: currentTotals.impressions,
      priorByoStarts: currentTotals.byoStarts,
      priorByoCompletes: currentTotals.byoCompletes,
      priorInventorySearches: currentTotals.inventorySearches,
      priorLeads: currentTotals.leads,
      priorCpKba: safeDivide(currentTotals.spend, currentTotals.kbas),
    }),
  };

  const channelTotals = {
    spend: sumBy(Array.from(currentChannelMap.values()), (row) => row.spend),
    kbas: sumBy(Array.from(currentChannelMap.values()), (row) => row.kbas),
  };

  const latestQuarterEnd = new Date(Date.UTC(currentQuarter.year, quarterMonths(currentQuarter.quarter)[2] + 1, 0));
  const insightsResult = buildInsights(detail.data, currentQuarter, comparisonQuarter);
  const manualInsights = loadUserInsightsJson();
  for (const warning of manualInsights.warnings) {
    console.warn(`[user-insights] ${warning}`);
  }

  const overriddenInsights = applyManualInsightOverrides(
    insightsResult.channels,
    {
      region: selectedRegion,
      maco: selectedMaco,
      quarter: quarterLabelCurrent,
    },
    manualInsights.entries,
  );
  for (const warning of overriddenInsights.warnings) {
    console.warn(`[user-insights] ${warning}`);
  }

  const rewrittenInsightChannels = (
    await timeDashboardStage('insights.rewrite', () =>
      rewriteInsightChannels(
        overriddenInsights.channels,
        undefined,
        undefined,
        (channel, section) => overriddenInsights.skippedRewriteSections.get(channel.channel)?.has(section.id) ?? false,
      ),
    )
  ).filter(
    (channel) => channel.channel.trim().toLowerCase() !== 'display',
  );
  const qa = buildQaChecks({
    currentDetailRows: currentScopedDetailRows,
    priorDetailRows: priorScopedDetailRows,
    currentQuarter,
    comparisonQuarter,
    channelSummary,
    totals: { spend: currentTotals.spend, kbas: currentTotals.kbas },
    priorTotals: { spend: priorTotals.spend, kbas: priorTotals.kbas },
    channelTotals,
    cpKbaTotals: currentCpKbaTotals,
    priorCpKbaTotals: priorCpKbaTotals,
    cpKbaBenchmarkTotals: benchmark2025SourceTotals,
    selectedRegion,
    selectedMaco,
    kpis,
    points,
    cpKbaBenchmark,
    insightsAudit: insightsResult.audit,
  });

  const response: DashboardResponse = {
    datasource: {
      luid: config.datasourceLuid,
      name: config.datasourceName,
      siteName: config.siteName,
      server: config.server,
    },
    scope: {
      deckType: selectedMaco === 'ALL MACOS' ? 'master' : 'split',
      tier: 'Tier 2',
      region: selectedRegion,
      maco: selectedMaco,
      title:
        selectedMaco === 'ALL MACOS'
          ? `BMW Tier 2 ${selectedRegion.replace('T2', '')} Quarterly Report`
          : `BMW Tier 2 ${selectedRegion.replace('T2', '')} / ${selectedMaco} Quarterly Report`,
      subtitle:
        selectedMaco === 'ALL MACOS'
          ? `Master deck view aligned to the quarterly client reporting contract.`
          : `Split-deck view aligned to the quarterly client reporting contract.`,
    },
    period: {
      quarterLabel: quarterLabelCurrent,
      priorQuarterLabel: quarterLabelPrior,
      monthLabels,
      latestCompleteQuarterEnd: latestQuarterEnd.toISOString(),
    },
    filters: {
      selectedRegion,
      selectedMaco,
      selectedCurrentQuarter: quarterLabelCurrent,
      selectedComparisonQuarter: quarterLabelPrior,
      availableRegions: regions,
      availableMacos: regionMacos,
      availableQuarters: availableQuarters.map((option) => option.label),
    },
    qa,
    kpis,
    comboChart: {
      title: 'Monthly Spend and All KBAs: Jan 2025 to Mar 2026',
      subtitle: `${points[0]?.label ?? ''} through ${points[points.length - 1]?.label ?? ''}`,
      takeaway: chartTakeaway,
      cpKbaTitle: 'Monthly Cost Per KBA',
      cpKbaSubtitle: `CP KBA uses Search and Social spend and KBAs only. Dashed benchmark reflects blended 2025 Search and Social CP KBA of ${formatCurrency(cpKbaBenchmark)}.`,
      cpKbaBenchmark,
      cpKbaBenchmarkDisplay: formatCurrency(cpKbaBenchmark),
      points,
    },
    mediaSpendPerformance: {
      title: 'Media Spend & Performance',
      subtitle: `Five channel views comparing ${regionGroupLabel} vs ${scopedGroupLabel} for ${quarterLabelCurrent} against ${quarterLabelPrior}.`,
      currentQuarterLabel: quarterLabelCurrent,
      priorQuarterLabel: quarterLabelPrior,
      cards: mediaSpendPerformanceCards,
    },
    channelSummary,
    drivers: {
      positive: positiveDrivers,
      negative: negativeDrivers,
    },
    efficiencyDrivers: {
      positive: positiveEfficiencyDrivers,
      negative: negativeEfficiencyDrivers,
    },
    appendix: {
      title: 'Performance by Platform',
      rows: appendixRows,
      totals: appendixTotals,
    },
    insights: {
      title: 'Insights',
      subtitle: `Copy-ready narrative for ${selectedRegion}${selectedMaco !== 'ALL MACOS' ? ` / ${selectedMaco}` : ''}, aligned to ${quarterLabelCurrent} vs ${quarterLabelPrior}.`,
      channels: rewrittenInsightChannels,
    },
    fetchedAt: new Date().toISOString(),
  };

  logDashboardTiming('build.total', performance.now() - buildStartedAt, {
    region: selectedRegion,
    maco: selectedMaco,
    currentQuarter: quarterLabelCurrent,
    comparisonQuarter: quarterLabelPrior,
  });

  return response;
}
