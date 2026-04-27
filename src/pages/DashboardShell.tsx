import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Database,
  RefreshCw,
} from 'lucide-react';
import { BmwLogo } from '../components/BmwLogo';
import { useAppStore } from '../store';

type QaCheck = {
  id: string;
  label: string;
  status: 'PASS' | 'WARN';
  detail: string;
};

type MetricCard = {
  id: string;
  label: string;
  displayValue: string;
  deltaLabel: string;
  tone: 'positive' | 'negative' | 'neutral';
  note: string;
};

type ChartPoint = {
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

type ChannelSummaryRow = {
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

type InsightSection = {
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

type ChannelInsight = {
  channel: string;
  sections: InsightSection[];
};

type DashboardPayload = {
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
  insights?: {
    title: string;
    subtitle: string;
    channels: ChannelInsight[];
  };
  fetchedAt: string;
};

const KPI_SEQUENCE = [
  'byo-starts',
  'byo-completes',
  'inventory-searches',
  'leads',
  'spend',
  'all-kbas',
  'impressions',
  'cp-kba',
] as const;

const KPI_LABELS: Record<string, string> = {
  'byo-starts': 'BYO STARTS',
  'byo-completes': 'BYO COMPLETES',
  'inventory-searches': 'INVENTORY SEARCHES',
  leads: 'LEAD SUBMISSIONS',
  spend: 'TOTAL\nSPEND',
  'all-kbas': 'TOTAL KEY\nBUYING ACTIONS',
  impressions: 'TOTAL\nIMPRESSIONS',
  'cp-kba': 'COST PER KBA',
};

function normalizeInsightChannelLabel(label: string) {
  const normalized = label.trim().toLowerCase();

  if (normalized === 'ctv') return 'connected tv / ott';
  if (normalized === 'olv') return 'online video';
  if (normalized === 'video') return 'video';

  return normalized;
}

function formatFetchedAtLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(parsed);
}

function collectHighlightBullets(channel?: ChannelInsight, limit = 2) {
  if (!channel) return [];

  const priority = ['delivery', 'campaignDelivery', 'quarterLearnings', 'recommendations', 'optimizations', 'variance'] as const;
  const bullets: string[] = [];

  for (const sectionId of priority) {
    const section = channel.sections.find((entry) => entry.id === sectionId);
    if (!section) continue;

    for (const bullet of section.bullets) {
      bullets.push(bullet);
      if (bullets.length >= limit) {
        return bullets;
      }
    }
  }

  return bullets.slice(0, limit);
}

function AppendixMetricPair({
  current,
  comparison,
  currentLabel,
  comparisonLabel,
  deltaLabel,
}: {
  current: string;
  comparison: string;
  currentLabel: string;
  comparisonLabel: string;
  deltaLabel: string;
}) {
  return (
    <div className="space-y-1 text-right tabular-nums">
      <div className="flex items-baseline justify-end gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#99A1AF]">{currentLabel}</span>
        <span className="text-[13px] leading-4 whitespace-nowrap">{current}</span>
      </div>
      <div className="flex items-baseline justify-end gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#99A1AF]">{comparisonLabel}</span>
        <span className="text-[13px] leading-4 whitespace-nowrap text-[#62748E]">{comparison}</span>
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#99A1AF]">{deltaLabel}</div>
    </div>
  );
}

function collectQuarterLearningBullets(channel?: ChannelInsight, limit = 5) {
  if (!channel) return [];

  const quarterLearnings = channel.sections.find((section) => section.id === 'quarterLearnings');
  if (quarterLearnings?.bullets.length) {
    return quarterLearnings.bullets.slice(0, limit);
  }

  return collectHighlightBullets(channel, limit);
}

function collectSectionBullets(
  channels: ChannelInsight[] | undefined,
  channelLabel: string,
  sectionId: InsightSection['id'],
) {
  if (!channels?.length) return [];

  const matchedChannel = channels.find(
    (channel) => normalizeInsightChannelLabel(channel.channel) === normalizeInsightChannelLabel(channelLabel),
  );

  return matchedChannel?.sections.find((section) => section.id === sectionId)?.bullets ?? [];
}

function collectCombinedSectionBullets(
  channels: ChannelInsight[] | undefined,
  channelLabel: string,
  sectionIds: InsightSection['id'][],
) {
  const seen = new Set<string>();
  const bullets: string[] = [];

  for (const sectionId of sectionIds) {
    for (const bullet of collectSectionBullets(channels, channelLabel, sectionId)) {
      if (seen.has(bullet)) continue;
      seen.add(bullet);
      bullets.push(bullet);
    }
  }

  return bullets;
}

function collectCardHighlights(channels: ChannelInsight[] | undefined, cardLabel: string, limit = 5) {
  if (!channels?.length) return [];

  if (normalizeInsightChannelLabel(cardLabel) === 'video') {
    const videoChannels = channels.filter((channel) => {
      const normalized = normalizeInsightChannelLabel(channel.channel);
      return normalized === 'connected tv / ott' || normalized === 'online video';
    });

    const videoDeliveryBullets = videoChannels.flatMap((channel) => collectSectionBullets(videoChannels, channel.channel, 'delivery'));
    if (videoDeliveryBullets.length > 0) {
      return Array.from(new Set(videoDeliveryBullets)).slice(0, limit);
    }

    return videoChannels.flatMap((channel) => collectSectionBullets(videoChannels, channel.channel, 'variance')).slice(0, limit);
  }

  const matchedChannel = channels.find(
    (channel) => normalizeInsightChannelLabel(channel.channel) === normalizeInsightChannelLabel(cardLabel),
  );

  return collectHighlightBullets(matchedChannel, limit);
}

function formatSpendShareClause(
  channelLabel: string,
  channelSummary: ChannelSummaryRow[] | undefined,
  comparisonQuarterLabel: string,
) {
  if (!channelSummary?.length) return null;

  const normalizedTarget = normalizeInsightChannelLabel(channelLabel);
  const matched = channelSummary.find(
    (entry) => normalizeInsightChannelLabel(entry.channel) === normalizedTarget,
  );
  if (!matched) return null;

  const currentShare = matched.currentSpendShare * 100;
  const spendDeltaPercent =
    matched.priorSpend > 0
      ? ((matched.currentSpend - matched.priorSpend) / matched.priorSpend) * 100
      : null;
  const absoluteDelta = spendDeltaPercent === null ? null : Math.abs(spendDeltaPercent);
  const movement =
    absoluteDelta === null
      ? `vs ${comparisonQuarterLabel}`
      : absoluteDelta < 0.05
      ? `flat vs ${comparisonQuarterLabel}`
      : `with spend ${spendDeltaPercent > 0 ? 'up' : 'down'} ${Math.round(absoluteDelta)}% vs ${comparisonQuarterLabel}`;

  return `This represented ${currentShare.toFixed(1)}% of total spend, ${movement}.`;
}

function collectQuarterlyLearningSummary(
  channels: ChannelInsight[] | undefined,
  channelSummary: ChannelSummaryRow[] | undefined,
  comparisonQuarterLabel: string,
  minItems = 3,
  maxItems = 5,
) {
  if (!channels?.length) return [];

  const prioritized = channels
    .map((channel) => ({
      channel: channel.channel,
      bullets: collectQuarterLearningBullets(channel, maxItems),
      currentSpend:
        channelSummary?.find(
          (entry) => normalizeInsightChannelLabel(entry.channel) === normalizeInsightChannelLabel(channel.channel),
        )?.currentSpend ?? 0,
    }))
    .filter((entry) => entry.bullets.length > 0);
  prioritized.sort((left, right) => right.currentSpend - left.currentSpend);

  const summary: Array<{ channel: string; bullet: string }> = [];

  for (const entry of prioritized) {
    if (summary.length >= maxItems) break;
    const spendShareClause = formatSpendShareClause(entry.channel, channelSummary, comparisonQuarterLabel);
    summary.push({
      channel: entry.channel,
      bullet: spendShareClause ? `${entry.bullets[0]} ${spendShareClause}` : entry.bullets[0],
    });
  }

  if (summary.length < minItems) {
    for (const entry of prioritized) {
      for (const bullet of entry.bullets.slice(1)) {
        if (summary.length >= maxItems) break;
        summary.push({ channel: entry.channel, bullet });
      }
      if (summary.length >= maxItems) break;
    }
  }

  return summary.slice(0, Math.max(minItems, Math.min(maxItems, summary.length)));
}

function ComboChart({
  title,
  subtitle,
  takeaway,
  currentQuarterLabel,
  priorQuarterLabel,
  cpKbaTitle,
  cpKbaSubtitle,
  cpKbaBenchmark,
  cpKbaBenchmarkDisplay,
  points,
}: {
  title: string;
  subtitle: string;
  takeaway: string;
  currentQuarterLabel: string;
  priorQuarterLabel: string;
  cpKbaTitle: string;
  cpKbaSubtitle: string;
  cpKbaBenchmark: number;
  cpKbaBenchmarkDisplay: string;
  points: ChartPoint[];
}) {
  const compactMomLabel = (label: string) => {
    if (label === 'Window start') return 'Start';
    return label.replace(/\s*MoM$/u, '');
  };
  const monthMap: Record<string, string> = {
    Jan: 'January',
    Feb: 'February',
    Mar: 'March',
    Apr: 'April',
    May: 'May',
    Jun: 'June',
    Jul: 'July',
    Aug: 'August',
    Sep: 'September',
    Oct: 'October',
    Nov: 'November',
    Dec: 'December',
  };
  const monthIndexMap: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };
  const expandMonthLabel = (label: string) => {
    const [month, year] = label.split(' ');

    return `${monthMap[month] ?? month}, 20${year}`;
  };
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
  const formatCompactNumber = (value: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const formatWholeNumber = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const quarterMonthsForLabel = (label: string) => {
    const match = /^Q([1-4])\s+(\d{4})$/.exec(label);
    if (!match) return null;

    const quarter = Number(match[1]);
    const year = Number(match[2]);
    const startMonth = (quarter - 1) * 3;
    return { year, months: [startMonth, startMonth + 1, startMonth + 2] };
  };
  const aggregateQuarter = (label: string) => {
    const target = quarterMonthsForLabel(label);
    if (!target) return null;

    const quarterPoints = points.filter((point) => {
      const [monthLabel, yearLabel] = point.label.split(' ');
      const monthIndex = monthIndexMap[monthLabel];
      const year = Number(`20${yearLabel}`);
      return Number.isFinite(monthIndex) && year === target.year && target.months.includes(monthIndex);
    });

    if (!quarterPoints.length) return null;

    const spend = quarterPoints.reduce((total, point) => total + point.spend, 0);
    const kbas = quarterPoints.reduce((total, point) => total + point.kbas, 0);
    const cpKba = kbas === 0 ? 0 : spend / kbas;
    return { spend, kbas, cpKba };
  };
  const percentChange = (current: number, prior: number) => {
    if (prior === 0) return null;
    return ((current - prior) / prior) * 100;
  };
  const changeToneClass = (label: string) =>
    label.startsWith('-') ? 'text-[#D72D2D]' : label.startsWith('+') || label === 'New vs LY' ? 'text-[#1E8E3E]' : 'text-gray-500';
  const displayTitle = 'Monthly Spend and KBA Trends';
  const dynamicSubtitle = `${expandMonthLabel(points[0].label)} through ${expandMonthLabel(points[points.length - 1].label)}`;

  const kbaTextPositions = points.map((point, index, all) => {
    const previous = index > 0 ? all[index - 1].kbas : null;
    const next = index < all.length - 1 ? all[index + 1].kbas : null;

    if (previous !== null && next !== null) {
      const isPeak = point.kbas >= previous && point.kbas >= next;
      const isValley = point.kbas <= previous && point.kbas <= next;

      if (isPeak) return 'top center';
      if (isValley) return 'bottom center';
    }

    return index % 2 === 0 ? 'top center' : 'bottom center';
  });
  const cpKbaTextPositions = points.map((point, index) =>
    index % 2 === 0 ? 'top center' : 'bottom center',
  );
  const quarterSeparatorShapes = Array.from(
    { length: Math.floor((points.length - 1) / 3) },
    (_, index) => ({
      type: 'line' as const,
      xref: 'paper' as const,
      yref: 'paper' as const,
      x0: ((index + 1) * 3) / points.length,
      x1: ((index + 1) * 3) / points.length,
      y0: 0,
      y1: 1,
      line: {
        color: '#D1D5DB',
        width: 1,
        dash: 'dot' as const,
      },
      layer: 'below' as const,
    }),
  );
  const quarterAnnotations = Array.from(
    { length: Math.ceil(points.length / 3) },
    (_, index) => {
      const quarterStart = index * 3;
      const quarterPoint = points[quarterStart];
      const year = quarterPoint.label.endsWith('25') ? '2025' : '2026';
      const quarter = `Q${(quarterStart / 3) % 4 + 1}`;

      return {
        xref: 'paper' as const,
        yref: 'paper' as const,
        x: (quarterStart + 1.5) / points.length,
        y: 1.03,
        text: `${quarter} ${year}`,
        showarrow: false,
        font: { color: '#9CA3AF', size: 11 },
      };
    },
  );
  const cpKbaPeakPoint = points.reduce((peak, point) => (point.cpKba > peak.cpKba ? point : peak), points[0]);
  const cpKbaLowPoint = points.reduce((low, point) => (point.cpKba < low.cpKba ? point : low), points[0]);
  const cpKbaStartPoint = points[0];
  const cpKbaEndPoint = points[points.length - 1];
  const cpKbaDynamicSubtitle = `${expandMonthLabel(cpKbaStartPoint.label)} through ${expandMonthLabel(cpKbaEndPoint.label)}`;
  const currentQuarterTotals = aggregateQuarter(currentQuarterLabel);
  const priorQuarterTotals = aggregateQuarter(priorQuarterLabel);
  const spendChange = currentQuarterTotals && priorQuarterTotals ? percentChange(currentQuarterTotals.spend, priorQuarterTotals.spend) : null;
  const kbaChange = currentQuarterTotals && priorQuarterTotals ? percentChange(currentQuarterTotals.kbas, priorQuarterTotals.kbas) : null;
  const cpKbaChange = currentQuarterTotals && priorQuarterTotals ? percentChange(currentQuarterTotals.cpKba, priorQuarterTotals.cpKba) : null;
  const quarterTakeaway =
    currentQuarterTotals && priorQuarterTotals && spendChange !== null && kbaChange !== null
      ? `${currentQuarterLabel} spend ${spendChange >= 0 ? 'increased' : 'decreased'} ${formatPercent(Math.abs(spendChange))} versus ${priorQuarterLabel} to ${formatCurrency(currentQuarterTotals.spend)} from ${formatCurrency(priorQuarterTotals.spend)}, while All KBAs ${kbaChange >= 0 ? 'increased' : 'decreased'} ${formatPercent(Math.abs(kbaChange))} to ${formatWholeNumber(currentQuarterTotals.kbas)} from ${formatWholeNumber(priorQuarterTotals.kbas)}.`
      : takeaway;
  const cpKbaTakeaway =
    currentQuarterTotals && priorQuarterTotals && cpKbaChange !== null
      ? `${currentQuarterLabel} CPKBA efficiency ${cpKbaChange >= 0 ? 'decreased' : 'increased'} ${formatPercent(Math.abs(cpKbaChange))} versus ${priorQuarterLabel} to ${formatCurrency(currentQuarterTotals.cpKba)} from ${formatCurrency(priorQuarterTotals.cpKba)}.`
      : `CP KBA peaked in ${cpKbaPeakPoint.label} at ${cpKbaPeakPoint.cpKbaDisplay} and was lowest in ${cpKbaLowPoint.label} at ${cpKbaLowPoint.cpKbaDisplay}. From ${cpKbaStartPoint.label} to ${cpKbaEndPoint.label}, CP KBA finished at ${cpKbaEndPoint.cpKbaDisplay} against the ${cpKbaBenchmarkDisplay} benchmark.`;

  return (
    <>
      <section className="min-h-[777px] overflow-hidden rounded-[9px] border border-black/8 bg-white">
        <div className="flex min-h-[96px] flex-wrap items-end justify-between gap-4 px-[42px] pb-0 pt-[24px]">
          <div className="pt-[8px]">
            <h3 className="text-[24px] leading-[32px] tracking-[-0.025em] text-black">
              {displayTitle}
            </h3>
            <p className="mt-2 text-[14px] leading-6 text-[#6A7282]">
              {dynamicSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-4 self-end pb-1 text-[12px] font-medium text-[#6A7282]">
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 bg-[#D6D3D1]" />Spend ($)</span>
            <span className="inline-flex items-center gap-2"><span className="h-[2px] w-5 bg-black" />All KBAs</span>
          </div>
        </div>

        <div className="mt-[24px] h-[83px] border-t border-black/8 px-[42px] pb-px pt-[17px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#99A1AF]">Key takeaway</p>
          <p className="mt-2 text-[14px] leading-6 text-[#4A5565]">
            {quarterTakeaway}
          </p>
        </div>

        <div className="mt-[19px] h-[554px] border-y border-black/8 bg-white px-[17px] pb-px pt-[17px]">
          <Plot
            data={[
              {
                type: 'bar',
                name: 'Spend ($)',
                x: points.map((point) => point.label),
                y: points.map((point) => point.spend),
                marker: {
                  color: '#D6D3D1',
                  line: { color: '#D6D3D1', width: 1 },
                },
                hovertemplate: '<b>%{x}</b><br>Spend: %{customdata}<extra></extra>',
                customdata: points.map((point) => point.spendDisplay),
                width: 0.34,
                yaxis: 'y',
              },
              {
                type: 'scatter',
                mode: 'lines+markers',
                name: 'All KBAs',
                x: points.map((point) => point.label),
                y: points.map((point) => point.kbas),
                yaxis: 'y2',
                line: { color: '#111111', width: 3, shape: 'spline', smoothing: 1.2 },
                marker: {
                  color: '#FFFFFF',
                  line: { color: '#111111', width: 2.5 },
                  size: 10,
                },
                hovertemplate:
                  '<b>%{x}</b><br>All KBAs: %{customdata}<br>KBA MoM: %{meta}<extra></extra>',
                customdata: points.map((point) => point.kbasDisplay),
                meta: points.map((point) => point.kbasMoMLabel),
              },
            ]}
            layout={{
              autosize: true,
              height: 520,
              paper_bgcolor: '#FFFFFF',
              plot_bgcolor: '#FFFFFF',
              margin: { l: 52, r: 52, t: 44, b: 46 },
              hovermode: 'x unified',
              hoverlabel: {
                bgcolor: '#111111',
                bordercolor: '#111111',
                font: { color: '#FFFFFF', size: 12 },
              },
              showlegend: false,
              bargap: 0.62,
              shapes: quarterSeparatorShapes,
              annotations: quarterAnnotations,
              xaxis: {
                type: 'category',
                tickfont: { color: '#6B7280', size: 11 },
                showgrid: false,
                gridcolor: 'rgba(0,0,0,0.08)',
                zeroline: false,
                automargin: true,
                tickangle: 0,
                fixedrange: true,
              },
              yaxis: {
                title: { text: 'Spend ($)', font: { color: '#6B7280', size: 12 } },
                tickfont: { color: '#6B7280', size: 11 },
                showgrid: false,
                zeroline: false,
                tickformat: '$~s',
                rangemode: 'tozero',
                fixedrange: true,
              },
              yaxis2: {
                title: { text: 'All KBAs', font: { color: '#6B7280', size: 12 } },
                tickfont: { color: '#6B7280', size: 11 },
                overlaying: 'y',
                side: 'right',
                showgrid: false,
                tickformat: '~s',
                rangemode: 'tozero',
                fixedrange: true,
              },
            }}
            config={{
              responsive: true,
              displayModeBar: false,
              scrollZoom: false,
            }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        </div>

      </section>

      <section className="mt-5 min-h-[741px] overflow-hidden rounded-[9px] border border-black/8 bg-white">
        <div className="flex min-h-[96px] flex-wrap items-end justify-between gap-4 px-[42px] pb-0 pt-[24px]">
          <div className="pt-[8px]">
            <h3 className="text-[24px] leading-[32px] tracking-[-0.025em] text-black">Monthly Cost Per KBA Trends</h3>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[#6A7282]">{cpKbaDynamicSubtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3 self-end pb-1 text-[12px] font-medium text-[#6A7282]">
            <span className="inline-flex items-center gap-2"><span className="h-[2px] w-5 bg-black" />CP KBA</span>
            <span className="inline-flex items-center gap-2"><span className="h-[3px] w-5 border-t-2 border-dashed border-[#9CA3AF]" />2025 benchmark ({cpKbaBenchmarkDisplay})</span>
          </div>
        </div>

        <div className="mt-[24px] h-[83px] border-t border-black/8 px-[42px] pb-px pt-[17px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#99A1AF]">Key takeaway</p>
          <p className="mt-2 text-[14px] leading-6 text-[#4A5565]">
            {cpKbaTakeaway}
          </p>
        </div>

        <div className="mt-[19px] h-[518px] border-t border-black/8 bg-white px-[17px] pb-px pt-[17px]">
          <Plot
            data={[
              {
                type: 'scatter',
                mode: 'lines+markers',
                name: 'CP KBA',
                x: points.map((point) => point.label),
                y: points.map((point) => point.cpKba),
                line: { color: '#111827', width: 3, shape: 'spline', smoothing: 1.2 },
                marker: {
                  color: '#FFFFFF',
                  line: { color: '#111827', width: 3 },
                  size: 10,
                },
                hovertemplate: '<b>%{x}</b><br>CP KBA: %{text}<extra></extra>',
                text: points.map((point) => point.cpKbaDisplay),
              },
              {
                type: 'scatter',
                mode: 'lines',
                name: '2025 benchmark',
                x: points.map((point) => point.label),
                y: points.map(() => cpKbaBenchmark),
                line: { color: '#9CA3AF', width: 2, dash: 'dash' },
                hovertemplate: '<b>%{x}</b><br>2025 benchmark: %{y:$,.2f}<extra></extra>',
              },
            ]}
            layout={{
              autosize: true,
              height: 484,
              paper_bgcolor: '#FFFFFF',
              plot_bgcolor: '#FFFFFF',
              margin: { l: 52, r: 28, t: 44, b: 48 },
              hovermode: 'x unified',
              hoverlabel: {
                bgcolor: '#111111',
                bordercolor: '#111111',
                font: { color: '#FFFFFF', size: 12 },
              },
              showlegend: false,
              shapes: quarterSeparatorShapes,
              annotations: quarterAnnotations,
              xaxis: {
                type: 'category',
                tickfont: { color: '#6B7280', size: 11 },
                showgrid: false,
                gridcolor: 'rgba(0,0,0,0.08)',
                zeroline: false,
                automargin: true,
                fixedrange: true,
              },
              yaxis: {
                title: { text: 'CP KBA', font: { color: '#6B7280', size: 12 } },
                tickfont: { color: '#6B7280', size: 11 },
                tickformat: '$,.0f',
                showgrid: false,
                zeroline: false,
                rangemode: 'tozero',
                fixedrange: true,
              },
            }}
            config={{
              responsive: true,
              displayModeBar: false,
              scrollZoom: false,
            }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        </div>

      </section>
    </>
  );
}

function KpiBand({ items, tone }: { items: MetricCard[]; tone: 'light' | 'blue' }) {
  return (
    <div className={tone === 'blue' ? 'border-t border-black bg-white' : 'bg-white'}>
      <div className="grid gap-y-0 md:grid-cols-2 xl:grid-cols-4">
        {items.map((kpi) => (
          <article
            key={kpi.id}
            className="flex min-h-[320px] flex-col items-center border-b border-black/8 px-10 py-10 text-center md:border-b-0 md:border-r md:border-r-black/6 md:last:border-r-0"
          >
            <p className="mt-[35px] max-w-[168px] whitespace-pre-line text-[16.8px] leading-[1.05] uppercase tracking-[0.02em] text-black">
              {KPI_LABELS[kpi.id] ?? kpi.label}
            </p>
            <p className="mt-[26px] text-[64px] leading-none font-normal tracking-[-0.05em] text-black xl:text-[71.2px]">
              {kpi.displayValue}
            </p>
            <p className="mt-[18px] text-[16.8px] leading-none font-normal text-black">
              {kpi.deltaLabel}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function QaStatusCard({ check }: { check: QaCheck }) {
  return (
    <div className="border border-black/10 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold tracking-tight text-black">{check.label}</p>
          <p className="mt-2 text-sm leading-6 text-gray-500">{check.detail}</p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
            check.status === 'PASS'
              ? 'border border-black/10 bg-[#F3F2EE] text-black'
              : 'border border-[#B34A20]/20 bg-[#FFF5F1] text-[#B34A20]'
          }`}
        >
          {check.status === 'PASS' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {check.status}
        </span>
      </div>
    </div>
  );
}

function MediaSpendPerformanceCardView({
  card,
  currentQuarterLabel,
  highlights,
  secondaryCard,
  secondaryCardTitle,
  secondaryHighlights,
}: {
  card: MediaSpendPerformanceCard;
  currentQuarterLabel: string;
  highlights: string[];
  secondaryCard?: MediaSpendPerformanceCard;
  secondaryCardTitle?: string;
  secondaryHighlights?: string[];
}) {
  const formatChartSpendLabel = (value: number) => {
    const absoluteValue = Math.abs(value);

    if (absoluteValue >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }

    if (absoluteValue >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    }

    return `$${value.toFixed(2)}`;
  };

  const toneClass = (metricLabel: string, changeLabel: string) => {
    const lowerIsBetter = metricLabel.toLowerCase() === 'cost per kba';

    if (changeLabel === 'No activity') {
      return 'text-gray-500';
    }

    if (changeLabel === 'New vs LY') {
      return 'text-[#1E8E3E]';
    }

    if (changeLabel.startsWith('-')) {
      return lowerIsBetter ? 'text-[#1E8E3E]' : 'text-[#D72D2D]';
    }

    if (changeLabel.startsWith('+')) {
      return lowerIsBetter ? 'text-[#D72D2D]' : 'text-[#1E8E3E]';
    }

    return 'text-gray-500';
  };
  const renderedHighlights = card.highlights?.length ? card.highlights : highlights;

  const renderCardSection = (
    sectionCard: MediaSpendPerformanceCard,
    sectionHighlights: string[],
    options?: {
      titleOverride?: string;
      bordered?: boolean;
      takeawaysTitle?: string;
      inlineTakeaways?: boolean;
    },
  ) => {
    const sectionChartPlatformSpend = sectionCard.platformSpend.some((group) => group.spend > 0)
      ? sectionCard.id === 'campaign'
        ? sectionCard.platformSpend
        : sectionCard.platformSpend.filter((group) => group.spend !== 0)
      : sectionCard.platformSpend;
    const sectionChartSpendLabels = sectionChartPlatformSpend.map((group) => formatChartSpendLabel(group.spend));
    const sectionRenderedHighlights = sectionHighlights.length
      ? sectionHighlights
      : sectionCard.highlights?.length
        ? sectionCard.highlights
        : [];
    const sectionMetricColumns = [sectionCard.metrics.slice(0, 2), sectionCard.metrics.slice(2, 4)];

    return (
      <div className={options?.bordered ? 'border-t border-black/8' : ''}>
        <div className="border-b border-black/8 px-[48px] pb-7 pt-8">
          <h3 className="text-[24px] tracking-[-0.025em] text-black">{options?.titleOverride ?? sectionCard.label}</h3>
          <p className="mt-2 text-[14px] leading-6 text-[#6A7282]">
            Media Spend and Performance for {currentQuarterLabel}
          </p>
        </div>

        <div className="grid gap-0 border-b border-black/8 lg:min-h-[430px] lg:grid-cols-[689px_minmax(0,1fr)]">
          <div className="border-r border-black/8 px-[32px] py-[24px]">
            <Plot
              data={[
                {
                  type: 'bar',
                  name: currentQuarterLabel,
                  x: sectionChartPlatformSpend.map((group) => group.label),
                  y: sectionChartPlatformSpend.map((group) => group.spend),
                  marker: { color: '#111111' },
                  text: sectionChartSpendLabels,
                  textposition: 'outside',
                  textfont: { color: '#111111', size: 11 },
                  customdata: sectionChartSpendLabels,
                  hovertemplate: '<b>%{x}</b><br>%{fullData.name}: %{customdata}<extra></extra>',
                },
              ]}
              layout={{
                autosize: true,
                height: 360,
                paper_bgcolor: '#FFFFFF',
                plot_bgcolor: '#FFFFFF',
                margin: { l: 70, r: 10, t: 34, b: 86 },
                bargap: 0.42,
                showlegend: false,
                xaxis: {
                  tickfont: { color: '#4B5563', size: 12 },
                  showgrid: false,
                  zeroline: false,
                  categoryorder: 'array',
                  categoryarray: sectionChartPlatformSpend.map((group) => group.label),
                  fixedrange: true,
                },
                yaxis: {
                  title: { text: 'Media Cost', font: { color: '#6B7280', size: 12 } },
                  tickfont: { color: '#6B7280', size: 11 },
                  tickformat: '$~s',
                  showgrid: false,
                  zeroline: false,
                  rangemode: 'tozero',
                  fixedrange: true,
                },
                hoverlabel: {
                  bgcolor: '#111111',
                  bordercolor: '#111111',
                  font: { color: '#FFFFFF', size: 12 },
                },
              }}
              config={{
                responsive: true,
                displayModeBar: false,
                scrollZoom: false,
              }}
              useResizeHandler
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {options?.inlineTakeaways ? (
            <div className="px-[48px] py-[36px]">
              <div className="border-b border-black/8 pb-4">
                <h4 className="text-[18px] uppercase tracking-[0.16em] text-black">{options.takeawaysTitle ?? 'Key Channel Takeaways'}</h4>
              </div>
              <ul className="mt-6 space-y-4">
                {sectionRenderedHighlights.map((bullet) => (
                  <li key={`${sectionCard.id}-${bullet}`} className="flex gap-3 text-[14px] leading-7 text-[#364153]">
                    <span className="mt-[0.8rem] h-1.5 w-1.5 shrink-0 rounded-full bg-black" />
                    {renderInsightBullet(bullet, {
                      toneMode: 'neutral',
                    })}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-[87px] px-[96px] py-[36px]">
              {sectionMetricColumns.map((column, columnIndex) => (
                <div key={`${sectionCard.id}-column-${columnIndex}`} className="flex min-h-[330px] flex-col justify-center gap-8">
                  {column.map((metric) => (
                    <div key={metric.id}>
                      <p className="text-[16.8px] font-light leading-[25.2px] text-black">{metric.label}</p>
                      <p className="mt-[6px] text-[44px] leading-[51.2px] font-light tracking-[-0.046em] text-black">
                        {metric.display}
                      </p>
                      <p className={`mt-[8px] text-[16px] leading-6 ${toneClass(metric.label, metric.changeLabel)}`}>{metric.changeLabel}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {!options?.inlineTakeaways ? (
          <div className="min-h-[180px] px-[48px] pb-8 pt-6">
            <div className="border-b border-black/8 pb-4">
              <h4 className="text-[18px] uppercase tracking-[0.16em] text-black">{options?.takeawaysTitle ?? 'Key Channel Takeaways'}</h4>
            </div>
            <ul className="mt-6 space-y-4">
              {sectionRenderedHighlights.map((bullet) => (
                <li key={`${sectionCard.id}-${bullet}`} className="flex gap-3 text-[14px] leading-7 text-[#364153]">
                  <span className="mt-[0.8rem] h-1.5 w-1.5 shrink-0 rounded-full bg-black" />
                  {renderInsightBullet(bullet, {
                    toneMode: 'neutral',
                  })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <article className="overflow-hidden rounded-[9px] border border-black/8 bg-white shadow-[0px_7px_30px_0px_rgba(0,0,0,0.08)]">
      {renderCardSection(card, renderedHighlights)}
      {secondaryCard
        ? renderCardSection(secondaryCard, secondaryHighlights ?? [], {
            titleOverride: secondaryCardTitle,
            bordered: true,
            takeawaysTitle: 'Key Campaign Takeaways',
            inlineTakeaways: true,
          })
        : null}
    </article>
  );
}

function insightMetricTone(text: string) {
  const normalized = text.toLowerCase();

  if (normalized.includes('cpkba') || normalized.includes('cost per kba')) {
    if (
      (normalized.startsWith('scale ') || normalized.includes(' scale ')) &&
      (normalized.includes('based on cpkba') || normalized.includes('cpkba of'))
    ) {
      return 'positive';
    }

    if (
      (normalized.startsWith('optimize ') || normalized.includes(' optimize ')) &&
      (normalized.includes('on cpkba') || normalized.includes('cpkba of') || normalized.includes('based on cpkba'))
    ) {
      return 'negative';
    }

    if (
      normalized.includes('efficiency increased') ||
      normalized.includes('strongest efficiency') ||
      normalized.includes('most efficient')
    ) {
      return 'positive';
    }

    if (
      normalized.includes('efficiency decreased') ||
      normalized.includes('higher cost per action') ||
      normalized.includes('efficiency reduced')
    ) {
      return 'negative';
    }

    return 'neutral';
  }

  if (
    normalized.includes('highest vcr') ||
    normalized.includes('highest ctr') ||
    normalized.includes('highest completion rate')
  ) {
    return 'positive';
  }

  if (
    normalized.includes('vcr') ||
    normalized.includes('completion rate') ||
    normalized.includes('ctr') ||
    normalized.includes('click-through rate')
  ) {
    if (
      normalized.includes('improved') ||
      normalized.includes('increased') ||
      normalized.includes('strongest') ||
      normalized.includes('highest')
    ) {
      return 'positive';
    }

    if (
      normalized.includes('decreased') ||
      normalized.includes('low vcr') ||
      normalized.includes('lower completion rate') ||
      normalized.includes('softer click-through rate')
    ) {
      return 'negative';
    }

    return 'neutral';
  }

  const hasPositiveKeyword =
    normalized.includes('lowest') ||
    normalized.includes('improved') ||
    normalized.includes('strongest') ||
    normalized.includes('most efficient') ||
    normalized.includes('increased') ||
    normalized.includes('room to scale');
  const hasNegativeKeyword =
    normalized.includes('worsened') ||
    normalized.includes('decreased') ||
    normalized.includes('pressure') ||
    normalized.includes('drag') ||
    normalized.includes('needs closer pacing control') ||
    normalized.includes('higher cost per action') ||
    normalized.includes('efficiency reduced') ||
    normalized.includes('low vcr') ||
    normalized.includes('lower completion rate') ||
    normalized.includes('softer click-through rate');

  if (hasPositiveKeyword && hasNegativeKeyword) {
    return 'neutral';
  }

  if (
    hasPositiveKeyword
  ) {
    return 'positive';
  }

  if (
    hasNegativeKeyword
  ) {
    return 'negative';
  }

  return 'neutral';
}

function insightClauseForValue(bullet: string, index: number) {
  const sentenceBoundary = Math.max(bullet.lastIndexOf('.', index), bullet.lastIndexOf(';', index));
  const lowerBullet = bullet.toLowerCase();
  const whileBoundary = lowerBullet.lastIndexOf(' while ', index);
  const butBoundary = lowerBullet.lastIndexOf(' but ', index);
  const clauseStart = Math.max(sentenceBoundary, whileBoundary, butBoundary);
  const nextSentenceBoundary = bullet.indexOf('.', index);
  const nextSemicolonBoundary = bullet.indexOf(';', index);
  const clauseEndCandidates = [nextSentenceBoundary, nextSemicolonBoundary].filter((value) => value >= 0);
  const clauseEnd = clauseEndCandidates.length ? Math.min(...clauseEndCandidates) : bullet.length;
  return bullet.slice(clauseStart >= 0 ? clauseStart + 1 : 0, clauseEnd).trim();
}

function renderInsightBullet(bullet: string, options?: { toneMode?: 'semantic' | 'neutral' }) {
  const metricPattern = /(\$[\d.,]+(?:[KM])?|\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?[KM]\b)/g;
  const parts: Array<{ type: 'text' | 'metric'; value: string; tone?: 'positive' | 'negative' | 'neutral' }> = [];
  let lastIndex = 0;
  const toneMode = options?.toneMode ?? 'semantic';

  for (const match of bullet.matchAll(metricPattern)) {
    const start = match.index ?? 0;
    const value = match[0];

    if (start > lastIndex) {
      parts.push({ type: 'text', value: bullet.slice(lastIndex, start) });
    }

    parts.push({
      type: 'metric',
      value,
      tone: insightMetricTone(insightClauseForValue(bullet, start)),
    });
    lastIndex = start + value.length;
  }

  if (lastIndex < bullet.length) {
    parts.push({ type: 'text', value: bullet.slice(lastIndex) });
  }

  return (
    <span className="leading-7 text-gray-700">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={`${part.value}-${index}`}>{part.value}</span>;
        }

        const metricClass =
          toneMode === 'neutral'
            ? 'font-bold text-black'
            : part.tone === 'positive'
            ? 'font-bold text-[#1F8A4D]'
            : part.tone === 'negative'
              ? 'font-bold text-[#B42318]'
              : 'font-bold text-black';

        return (
          <span key={`${part.value}-${index}`} className={metricClass}>
            {part.value}
          </span>
        );
      })}
    </span>
  );
}

function insightSectionAccent(sectionId: InsightSection['id']) {
  if (sectionId === 'optimizations') {
    return 'border-l-[#B42318] bg-[#FFF6F4]';
  }

  if (sectionId === 'recommendations' || sectionId === 'quarterLearnings') {
    return 'border-l-[#1F8A4D] bg-[#F3FBF6]';
  }

  return 'border-l-black bg-[#F7F6F2]';
}

function InsightsPanel({
  title,
  subtitle,
  channels,
}: {
  title: string;
  subtitle: string;
  channels: ChannelInsight[];
}) {
  return (
    <section className="border border-black/8 bg-white p-6">
      <div className="mb-8 border-b border-black/8 pb-6">
        <h2 className="text-3xl font-bold tracking-tight text-black">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">{subtitle}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {channels.map((channel) => (
          <article key={channel.channel} className="border border-black/8 bg-white p-6">
            <div className="mb-6 border-b border-black/8 pb-4">
              <div>
                <h3 className="text-2xl font-bold tracking-tight text-black">{channel.channel}</h3>
              </div>
            </div>

            <div className="space-y-4">
              {channel.sections.map((section) => (
                <div
                  key={`${channel.channel}-${section.id}`}
                  className={`border border-black/8 border-l-[3px] p-4 ${insightSectionAccent(section.id)}`}
                >
                  <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-500">{section.title}</h4>
                  <ul className="mt-4 space-y-3">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3 text-sm">
                        <span
                          className={`mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full ${
                            insightMetricTone(bullet) === 'positive'
                              ? 'bg-[#1F8A4D]'
                              : insightMetricTone(bullet) === 'negative'
                                ? 'bg-[#B42318]'
                                : 'bg-black'
                          }`}
                        />
                        {renderInsightBullet(bullet)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function DashboardShell() {
  const navigate = useNavigate();
  const { brand, country, setCountry } = useAppStore();
  const [selectedRegion, setSelectedRegion] = useState('T2EAST');
  const [selectedMaco, setSelectedMaco] = useState('ALL MACOS');
  const [selectedCurrentQuarter, setSelectedCurrentQuarter] = useState('');
  const [selectedComparisonQuarter, setSelectedComparisonQuarter] = useState('');
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const effectiveCurrentQuarter = selectedCurrentQuarter || payload?.filters.selectedCurrentQuarter || '';
  const effectiveComparisonQuarter = selectedComparisonQuarter || payload?.filters.selectedComparisonQuarter || '';

  useEffect(() => {
    if (!country) {
      setCountry('USA');
    }
  }, [country, setCountry]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        setIsLoading(true);
        setError(null);
        setPayload(null);

        const params = new URLSearchParams({
          region: selectedRegion,
          maco: selectedMaco,
        });
        if (selectedCurrentQuarter) {
          params.set('currentQuarter', selectedCurrentQuarter);
        }
        if (selectedComparisonQuarter) {
          params.set('comparisonQuarter', selectedComparisonQuarter);
        }

        const response = await fetch(`/api/dashboard/bmw?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Dashboard API failed with ${response.status}`);
        }

        const data = (await response.json()) as DashboardPayload;
        setPayload(data);

        if (!data.filters.availableMacos.includes(selectedMaco)) {
          setSelectedMaco('ALL MACOS');
        }
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setPayload(null);
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown dashboard error');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [selectedRegion, selectedMaco, selectedCurrentQuarter, selectedComparisonQuarter]);

  const availableMacos = payload?.filters.availableMacos ?? ['ALL MACOS'];
  const availableQuarters = payload?.filters.availableQuarters ?? [];
  const warnCount = payload?.qa.filter((check) => check.status === 'WARN').length ?? 0;
  const groundingCheckIds = new Set([
    'insight-evidence',
    'claim-reconciliation',
    'derived-value-audit',
    'empty-evidence-blocking',
  ]);
  const groundingChecks = payload?.qa.filter((check) => groundingCheckIds.has(check.id)) ?? [];
  const groundingWarnCount = groundingChecks.filter((check) => check.status === 'WARN').length;
  const orderedKpis = payload
    ? KPI_SEQUENCE.map((id) => payload.kpis.find((kpi) => kpi.id === id)).filter((kpi): kpi is MetricCard => Boolean(kpi))
    : [];
  const topBandKpis = orderedKpis.slice(0, 4);
  const bottomBandKpis = orderedKpis.slice(4, 8);
  const quarterlyLearningSummary = payload
    ? collectQuarterlyLearningSummary(
        payload.insights?.channels,
        payload.channelSummary,
        payload.period.priorQuarterLabel,
      )
    : [];

  return (
    <div className="bmw-deck min-h-screen bg-[#F3F2EE] text-[#1a1a1a] selection:bg-black selection:text-white">
      <header className="px-8 py-8">
        <div className="mx-auto flex max-w-[1451px] items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboards')}
              className="flex h-10 w-10 items-center justify-center border border-black/10 bg-white transition-colors hover:bg-black hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <BmwLogo className="h-8 w-8" />
              <div>
                <div className="text-xl font-bold tracking-tighter">BMW Group</div>
                <div className="text-xs uppercase tracking-[0.22em] text-gray-400">Quarterly Deck View</div>
                {payload ? (
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#99A1AF]">
                    Tableau last queried: <span className="text-[#62748E]">{formatFetchedAtLabel(payload.fetchedAt)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="border border-black/10 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            {brand ?? 'BMW'} / {country ?? 'USA'}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1524px] flex-col gap-8 px-[18px] pb-16 pt-2">
        {payload ? (
          <>
            <section className="overflow-hidden rounded-[9px] border border-black/8 bg-white shadow-[0px_4px_30px_1px_rgba(0,0,0,0.09)]">
              <div className="min-h-[262px] px-[37px] pb-px pt-[37px]">
                <div className="max-w-[797px]">
                  <div className="flex flex-wrap items-center gap-[16px]">
                    <span className="inline-flex h-[26px] items-center border border-black bg-black px-[14px] text-[11px] uppercase tracking-[0.2em] text-white">
                      {payload.period.quarterLabel}
                    </span>
                    <span className="inline-flex h-[26px] items-center border border-black/60 bg-white px-[14px] text-[11px] uppercase tracking-[0.2em] text-black">
                      {selectedRegion.replace(/^T2/i, '')}: {selectedMaco}
                    </span>
                  </div>

                  <div className="mt-[16px] border-t border-black/8 pt-[36px]">
                    <div className="flex items-center gap-[16px]">
                      <BmwLogo className="h-[64px] w-[64px] shrink-0" />
                      <h1 className="text-[44px] leading-[1] tracking-[-0.045em] text-black sm:text-[52px] xl:whitespace-nowrap xl:text-[60px]">
                        Quarterly Media Performance Report
                      </h1>
                    </div>
                  </div>

                  <p className="mt-[18px] max-w-[736px] text-[16px] leading-7 text-[#62748E]">
                    Quarterly Performance summary for <span className="text-[#314158]">{selectedMaco}</span>, comparing{' '}
                    <span className="text-[#314158]">{payload.period.quarterLabel}</span> against{' '}
                    <span className="text-[#314158]">{payload.period.priorQuarterLabel}</span>.
                  </p>

                </div>
              </div>
            </section>

            {payload.insights && payload.insights.channels.length > 0 ? (
              <section className="overflow-hidden rounded-[9px] border border-black/8 bg-white shadow-[0px_4px_30px_1px_rgba(0,0,0,0.09)]">
                <div className="min-h-[196px] px-[37px] py-10">
                  <div className="border-b border-black/8 pb-5">
                    <h2 className="text-[20px] uppercase tracking-[0.18em] text-black">Key Quarterly Takeaways</h2>
                  </div>

                  <ul className="mt-6 space-y-4">
                    {quarterlyLearningSummary.map((item) => (
                      <li key={`${item.channel}-${item.bullet}`} className="flex gap-3 text-[15px] leading-8 text-[#62748E]">
                        <span className="mt-[0.85rem] h-1.5 w-1.5 shrink-0 rounded-full bg-black" />
                        <span>
                          <span className="text-[#314158]">{item.channel}:</span>{' '}
                          {renderInsightBullet(item.bullet, { toneMode: 'neutral' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-[9px] border border-black/8 bg-white">
              <div className="flex h-[51px] items-center justify-between border-b border-black/8 px-[38px] text-[12px] uppercase tracking-[0.18em] text-[#6A7282]">
                <div className="pt-[2px] text-left">
                  Key Performance Indicators
                </div>
                <div className="pt-[2px] text-right">
                  {payload.period.quarterLabel} VS {payload.period.priorQuarterLabel}
                </div>
              </div>
              <KpiBand items={topBandKpis} tone="light" />
              <KpiBand items={bottomBandKpis} tone="blue" />
            </section>

            <ComboChart
              title={payload.comboChart.title}
              subtitle={payload.comboChart.subtitle}
              takeaway={payload.comboChart.takeaway}
              currentQuarterLabel={payload.period.quarterLabel}
              priorQuarterLabel={payload.period.priorQuarterLabel}
              cpKbaTitle={payload.comboChart.cpKbaTitle}
              cpKbaSubtitle={payload.comboChart.cpKbaSubtitle}
              cpKbaBenchmark={payload.comboChart.cpKbaBenchmark}
              cpKbaBenchmarkDisplay={payload.comboChart.cpKbaBenchmarkDisplay}
              points={payload.comboChart.points}
            />

            <section className="grid gap-8">
              <div className="grid gap-8">
                {(() => {
                  const campaignCard = payload.mediaSpendPerformance.cards.find((card) => card.id === 'campaign');
                  const renderedCards = payload.mediaSpendPerformance.cards.filter((card) => card.id !== 'campaign');

                  return renderedCards.map((card) => {
                    const socialChannelHighlights =
                      card.id === 'social'
                        ? collectSectionBullets(payload.insights?.channels, card.label, 'delivery')
                        : card.id === 'search'
                          ? collectCombinedSectionBullets(payload.insights?.channels, card.label, ['delivery', 'campaignDelivery'])
                        : collectCardHighlights(payload.insights?.channels, card.label);
                    const socialCampaignHighlights =
                      card.id === 'social' && campaignCard
                        ? collectSectionBullets(payload.insights?.channels, card.label, 'campaignDelivery')
                        : undefined;

                    return (
                      <div key={card.id}>
                        <MediaSpendPerformanceCardView
                          card={card}
                          currentQuarterLabel={payload.mediaSpendPerformance.currentQuarterLabel}
                          highlights={socialChannelHighlights}
                          secondaryCard={card.id === 'social' ? campaignCard : undefined}
                          secondaryCardTitle={card.id === 'social' && campaignCard ? 'Social Campaigns' : undefined}
                          secondaryHighlights={socialCampaignHighlights}
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            </section>

            <section className="border border-black/8 bg-white p-6">
              <div className="mb-6 flex flex-col gap-3 border-b border-black/10 pb-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Appendix Channel Tables</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-black">{payload.appendix.title}</h2>
                </div>
              </div>

              <div className="overflow-hidden">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr className="border-b border-black/10 text-[11px] uppercase tracking-[0.18em] text-gray-400">
                      <th className="px-2 py-3 font-semibold"></th>
                      <th className="px-2 py-3 font-semibold"></th>
                      <th className="px-2 py-3 font-semibold text-center text-[#62748E]">Spend</th>
                      <th className="px-2 py-3 font-semibold text-center text-[#62748E]">KBAs</th>
                      <th className="px-2 py-3 font-semibold text-center text-[#62748E]">CP KBA</th>
                      <th className="px-2 py-3 font-semibold text-center text-[#62748E]">Impressions</th>
                      <th className="px-2 py-3 font-semibold text-center text-[#62748E]">BYO Starts</th>
                      <th className="px-2 py-3 font-semibold text-center text-[#62748E]">BYO Completes</th>
                      <th className="px-2 py-3 font-semibold text-center text-[#62748E]">Inventory Searches</th>
                      <th className="px-2 py-3 font-semibold text-center text-[#62748E]">Leads</th>
                    </tr>
                    <tr className="border-b border-black/10 text-xs uppercase tracking-[0.18em] text-gray-400">
                      <th className="w-[8%] px-2 py-3 font-semibold">Channel</th>
                      <th className="w-[14%] px-2 py-3 font-semibold">Platform</th>
                      <th className="px-2 py-3 font-semibold text-center">Current / Compare</th>
                      <th className="px-2 py-3 font-semibold text-center">Current / Compare</th>
                      <th className="px-2 py-3 font-semibold text-center">Current / Compare</th>
                      <th className="px-2 py-3 font-semibold text-center">Current / Compare</th>
                      <th className="px-2 py-3 font-semibold text-center">Current / Compare</th>
                      <th className="px-2 py-3 font-semibold text-center">Current / Compare</th>
                      <th className="px-2 py-3 font-semibold text-center">Current / Compare</th>
                      <th className="px-2 py-3 font-semibold text-center">Current / Compare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.appendix.rows.map((row) => (
                      <tr
                        key={`${row.rowType}-${row.channel}-${row.platform}`}
                        className={`border-b border-black/5 last:border-b-0 ${
                          row.rowType === 'subtotal' ? 'bg-[#F7F6F2]' : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <td className={`px-2 py-3 text-sm text-black align-top ${row.rowType === 'subtotal' ? 'font-bold' : 'font-semibold'}`}>{row.channel}</td>
                        <td className={`px-2 py-3 text-sm text-black align-top ${row.rowType === 'subtotal' ? 'font-semibold' : ''}`}>{row.platform}</td>
                        <td className={`px-2 py-3 text-sm text-black align-top ${row.rowType === 'subtotal' ? 'font-semibold' : ''}`}><AppendixMetricPair current={row.current.spendDisplay} comparison={row.comparison.spendDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={row.current.spendDeltaLabel} /></td>
                        <td className={`px-2 py-3 text-sm text-black align-top ${row.rowType === 'subtotal' ? 'font-semibold' : ''}`}><AppendixMetricPair current={row.current.kbasDisplay} comparison={row.comparison.kbasDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={row.current.kbasDeltaLabel} /></td>
                        <td className={`px-2 py-3 text-sm text-black align-top ${row.rowType === 'subtotal' ? 'font-semibold' : ''}`}><AppendixMetricPair current={row.current.cpkbaDisplay} comparison={row.comparison.cpkbaDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={row.current.cpkbaDeltaLabel} /></td>
                        <td className={`px-2 py-3 text-sm text-black align-top ${row.rowType === 'subtotal' ? 'font-semibold' : ''}`}><AppendixMetricPair current={row.current.impressionsDisplay} comparison={row.comparison.impressionsDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={row.current.impressionsDeltaLabel} /></td>
                        <td className={`px-2 py-3 text-sm text-black align-top ${row.rowType === 'subtotal' ? 'font-semibold' : ''}`}><AppendixMetricPair current={row.current.byoStartsDisplay} comparison={row.comparison.byoStartsDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={row.current.byoStartsDeltaLabel} /></td>
                        <td className={`px-2 py-3 text-sm text-black align-top ${row.rowType === 'subtotal' ? 'font-semibold' : ''}`}><AppendixMetricPair current={row.current.byoCompletesDisplay} comparison={row.comparison.byoCompletesDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={row.current.byoCompletesDeltaLabel} /></td>
                        <td className={`px-2 py-3 text-sm text-black align-top ${row.rowType === 'subtotal' ? 'font-semibold' : ''}`}><AppendixMetricPair current={row.current.inventorySearchesDisplay} comparison={row.comparison.inventorySearchesDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={row.current.inventorySearchesDeltaLabel} /></td>
                        <td className={`px-2 py-3 text-sm text-black align-top ${row.rowType === 'subtotal' ? 'font-semibold' : ''}`}><AppendixMetricPair current={row.current.leadsDisplay} comparison={row.comparison.leadsDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={row.current.leadsDeltaLabel} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-black/12 bg-[#F7F6F2] text-sm">
                      <td className="px-2 py-3 font-bold text-black align-top">{payload.appendix.totals.channel}</td>
                      <td className="px-2 py-3 font-semibold text-black align-top">{payload.appendix.totals.platform}</td>
                      <td className="px-2 py-3 font-semibold text-black align-top"><AppendixMetricPair current={payload.appendix.totals.current.spendDisplay} comparison={payload.appendix.totals.comparison.spendDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={payload.appendix.totals.current.spendDeltaLabel} /></td>
                      <td className="px-2 py-3 font-semibold text-black align-top"><AppendixMetricPair current={payload.appendix.totals.current.kbasDisplay} comparison={payload.appendix.totals.comparison.kbasDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={payload.appendix.totals.current.kbasDeltaLabel} /></td>
                      <td className="px-2 py-3 font-semibold text-black align-top"><AppendixMetricPair current={payload.appendix.totals.current.cpkbaDisplay} comparison={payload.appendix.totals.comparison.cpkbaDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={payload.appendix.totals.current.cpkbaDeltaLabel} /></td>
                      <td className="px-2 py-3 font-semibold text-black align-top"><AppendixMetricPair current={payload.appendix.totals.current.impressionsDisplay} comparison={payload.appendix.totals.comparison.impressionsDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={payload.appendix.totals.current.impressionsDeltaLabel} /></td>
                      <td className="px-2 py-3 font-semibold text-black align-top"><AppendixMetricPair current={payload.appendix.totals.current.byoStartsDisplay} comparison={payload.appendix.totals.comparison.byoStartsDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={payload.appendix.totals.current.byoStartsDeltaLabel} /></td>
                      <td className="px-2 py-3 font-semibold text-black align-top"><AppendixMetricPair current={payload.appendix.totals.current.byoCompletesDisplay} comparison={payload.appendix.totals.comparison.byoCompletesDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={payload.appendix.totals.current.byoCompletesDeltaLabel} /></td>
                      <td className="px-2 py-3 font-semibold text-black align-top"><AppendixMetricPair current={payload.appendix.totals.current.inventorySearchesDisplay} comparison={payload.appendix.totals.comparison.inventorySearchesDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={payload.appendix.totals.current.inventorySearchesDeltaLabel} /></td>
                      <td className="px-2 py-3 font-semibold text-black align-top"><AppendixMetricPair current={payload.appendix.totals.current.leadsDisplay} comparison={payload.appendix.totals.comparison.leadsDisplay} currentLabel={payload.period.quarterLabel} comparisonLabel={payload.period.priorQuarterLabel} deltaLabel={payload.appendix.totals.current.leadsDeltaLabel} /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className="border border-black/8 bg-white px-8 py-10">
              <div className="grid gap-8 lg:grid-cols-[1.35fr_0.85fr]">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 border border-black/10 bg-[#F7F6F2] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
                    <BarChart3 className="h-4 w-4" />
                    Client deck quarterly report
                  </div>
                  <h1 className="max-w-4xl text-5xl font-bold tracking-[-0.04em] text-black md:text-7xl">
                    {payload?.scope.title ?? 'Loading quarterly scope...'}
                  </h1>
                  <p className="mt-4 max-w-3xl text-base leading-7 text-gray-500 md:text-lg">
                    {payload?.scope.subtitle ?? 'Preparing strict Tier 2 quarterly view from Tableau...'}
                  </p>

                  <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Region</span>
                      <div className="relative">
                        <select
                          value={selectedRegion}
                          onChange={(event) => {
                            setSelectedRegion(event.target.value);
                            setSelectedMaco('ALL MACOS');
                          }}
                          className="w-full appearance-none border border-black/12 bg-[#F7F6F2] px-4 py-3 pr-10 text-sm font-semibold text-black outline-none"
                        >
                          {(payload?.filters.availableRegions ?? ['T2EAST']).map((region) => (
                            <option key={region} value={region} className="text-black">
                              {region}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">MACO</span>
                      <div className="relative">
                        <select
                          value={selectedMaco}
                          onChange={(event) => setSelectedMaco(event.target.value)}
                          className="w-full appearance-none border border-black/12 bg-[#F7F6F2] px-4 py-3 pr-10 text-sm font-semibold text-black outline-none"
                        >
                          {availableMacos.map((maco) => (
                            <option key={maco} value={maco} className="text-black">
                              {maco}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Current Quarter</span>
                      <div className="relative">
                        <select
                          value={effectiveCurrentQuarter}
                          onChange={(event) => setSelectedCurrentQuarter(event.target.value)}
                          className="w-full appearance-none border border-black/12 bg-[#F7F6F2] px-4 py-3 pr-10 text-sm font-semibold text-black outline-none"
                        >
                          {availableQuarters.map((quarter) => (
                            <option key={quarter} value={quarter} className="text-black">
                              {quarter}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Comparison Quarter</span>
                      <div className="relative">
                        <select
                          value={effectiveComparisonQuarter}
                          onChange={(event) => setSelectedComparisonQuarter(event.target.value)}
                          className="w-full appearance-none border border-black/12 bg-[#F7F6F2] px-4 py-3 pr-10 text-sm font-semibold text-black outline-none"
                        >
                          {availableQuarters
                            .filter((quarter) => quarter !== effectiveCurrentQuarter)
                            .map((quarter) => (
                              <option key={quarter} value={quarter} className="text-black">
                                {quarter}
                              </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 self-end">
                  <div className="border border-black/8 bg-[#F7F6F2] p-5">
                    <div className="flex items-center gap-3 text-sm font-semibold text-black">
                      <Database className="h-4 w-4" />
                      Reporting scope
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-500">
                      {payload
                        ? `${payload.period.quarterLabel} vs ${payload.period.priorQuarterLabel}`
                        : 'Loading quarter window...'}
                      <br />
                      Strict exact filter:
                      {' '}
                      <span className="font-semibold text-black">Tier = Tier 2</span>
                      {', '}
                      <span className="font-semibold text-black">CPO Categorization = New Car</span>
                    </p>
                  </div>

                  <div className="border border-black/8 bg-[#F7F6F2] p-5">
                    <div className="flex items-center gap-3 text-sm font-semibold text-black">
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                      QA posture
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-500">
                      {payload ? `${payload.qa.length - warnCount} pass / ${warnCount} warning` : 'Waiting for QA checks...'}
                      <br />
                      {payload?.datasource.name ?? 'Connecting to Tableau MCP bridge...'}
                    </p>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="mt-6 inline-flex items-start gap-3 border border-[#E44B18]/30 bg-[#FFF5F1] px-4 py-3 text-sm text-[#A44A23]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
            </section>

            <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
              {groundingChecks.length > 0 ? (
                <div className="xl:col-span-4">
                  <div className="border border-black bg-white p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 border border-black/10 bg-[#F7F6F2] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-gray-500">
                          Grounding Guardrails
                        </div>
                        <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-black">
                          Anti-hallucination checks are enforced before narrative insight render
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-gray-500">
                          Evidence coverage, metric reconciliation, derived-value validation, and unsupported-claim blocking are audited on each dashboard refresh.
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="border border-black/8 bg-[#F7F6F2] px-4 py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Grounding Status</p>
                          <p className="mt-2 text-3xl font-bold tracking-[-0.04em] text-black">
                            {groundingChecks.length - groundingWarnCount}/{groundingChecks.length}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">checks passing</p>
                        </div>
                        <div className="border border-black/8 bg-[#F7F6F2] px-4 py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Warnings</p>
                          <p className="mt-2 text-3xl font-bold tracking-[-0.04em] text-black">
                            {groundingWarnCount}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">items need review</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {payload.qa.map((check) => (
                <div key={check.id}>
                  <QaStatusCard check={check} />
                </div>
              ))}
            </section>
          </>
        ) : null}

        {!payload && isLoading ? (
          <section className="border border-black/8 bg-white p-10 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-black" />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
              Building quarterly deck view
            </p>
          </section>
        ) : null}

        {!payload && error && !isLoading ? (
          <section className="border border-[#E44B18]/30 bg-[#FFF5F1] p-10 text-center text-[#A44A23]">
            <AlertCircle className="mx-auto h-6 w-6" />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em]">
              Dashboard fetch failed
            </p>
            <p className="mt-3 text-sm leading-6">
              {error}
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
