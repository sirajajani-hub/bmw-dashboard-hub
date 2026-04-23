import fs from 'node:fs';
import path from 'node:path';

import type { ChannelInsight, InsightSection } from './dashboardService';

export const USER_INSIGHTS_JSON_PATH = path.resolve(process.cwd(), 'docs', 'user-insights.json');

export type UserInsightEntry = {
  region: string;
  maco: string;
  quarter: string;
  channel: string;
  optimizations?: string[];
  recommendations?: string[];
};

type ParseResult = {
  entries: UserInsightEntry[];
  warnings: string[];
};

type OverrideResult = {
  channels: ChannelInsight[];
  skippedRewriteSections: Map<string, Set<InsightSection['id']>>;
  warnings: string[];
};

const MANUAL_SECTION_ORDER: InsightSection['id'][] = [
  'delivery',
  'variance',
  'campaignDelivery',
  'quarterLearnings',
  'optimizations',
  'recommendations',
];

const MANUAL_SECTION_TITLES: Record<InsightSection['id'], string> = {
  delivery: 'Delivery by Platform/Channel/Campaign',
  variance: 'YoY Variances',
  campaignDelivery: 'Campaign Delivery',
  quarterLearnings: 'Key Quarterly Takeaways',
  optimizations: 'Optimizations',
  recommendations: 'Recommendations',
};

function normalizeLookupValue(value: string) {
  return value.trim().toLowerCase();
}

function buildEntryKey(scope: { region: string; maco: string; quarter: string; channel: string }) {
  return [
    normalizeLookupValue(scope.region),
    normalizeLookupValue(scope.maco),
    normalizeLookupValue(scope.quarter),
    normalizeLookupValue(scope.channel),
  ].join('::');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateUserInsightEntry(value: unknown, index: number): { entry?: UserInsightEntry; warning?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      warning: `Skipped user insight entry ${index + 1}: entry must be an object.`,
    };
  }

  const candidate = value as Record<string, unknown>;
  const requiredStringFields = ['region', 'maco', 'quarter', 'channel'] as const;

  for (const field of requiredStringFields) {
    if (typeof candidate[field] !== 'string' || candidate[field].trim().length === 0) {
      return {
        warning: `Skipped user insight entry ${index + 1}: field "${field}" must be a non-empty string.`,
      };
    }
  }

  if (
    ('optimizations' in candidate && !isStringArray(candidate.optimizations)) ||
    ('recommendations' in candidate && !isStringArray(candidate.recommendations))
  ) {
    return {
      warning: `Skipped user insight entry ${index + 1}: "optimizations" and "recommendations" must be arrays of strings when present.`,
    };
  }

  if (!('optimizations' in candidate) && !('recommendations' in candidate)) {
    return {
      warning: `Skipped user insight entry ${index + 1}: include at least one of "optimizations" or "recommendations".`,
    };
  }

  const region = candidate.region as string;
  const maco = candidate.maco as string;
  const quarter = candidate.quarter as string;
  const channel = candidate.channel as string;
  const optimizations = isStringArray(candidate.optimizations) ? candidate.optimizations : undefined;
  const recommendations = isStringArray(candidate.recommendations) ? candidate.recommendations : undefined;

  return {
    entry: {
      region: region.trim(),
      maco: maco.trim(),
      quarter: quarter.trim(),
      channel: channel.trim(),
      ...(optimizations ? { optimizations: [...optimizations] } : {}),
      ...(recommendations ? { recommendations: [...recommendations] } : {}),
    },
  };
}

export function parseUserInsightsJson(jsonText: string): ParseResult {
  let raw: unknown;

  try {
    raw = JSON.parse(jsonText);
  } catch (error) {
    return {
      entries: [],
      warnings: [
        `Failed to parse user insights JSON: ${error instanceof Error ? error.message : 'unknown error'}.`,
      ],
    };
  }

  if (!Array.isArray(raw)) {
    return {
      entries: [],
      warnings: ['Skipped user insights file: top-level JSON value must be an array.'],
    };
  }

  const entries: UserInsightEntry[] = [];
  const warnings: string[] = [];

  raw.forEach((item, index) => {
    const result = validateUserInsightEntry(item, index);
    if (result.warning) {
      warnings.push(result.warning);
      return;
    }

    entries.push(result.entry as UserInsightEntry);
  });

  return { entries, warnings };
}

export function loadUserInsightsJson(filePath = USER_INSIGHTS_JSON_PATH): ParseResult {
  if (!fs.existsSync(filePath)) {
    return {
      entries: [],
      warnings: [`User insights JSON file not found at ${filePath}; generated insights will be used.`],
    };
  }

  try {
    const jsonText = fs.readFileSync(filePath, 'utf8');
    return parseUserInsightsJson(jsonText);
  } catch (error) {
    return {
      entries: [],
      warnings: [
        `Failed to read user insights JSON from ${filePath}: ${error instanceof Error ? error.message : 'unknown error'}.`,
      ],
    };
  }
}

export function getUserInsightsVersion(filePath = USER_INSIGHTS_JSON_PATH) {
  try {
    const stats = fs.statSync(filePath);
    return `${stats.mtimeMs}`;
  } catch {
    return 'missing';
  }
}

export function applyManualInsightOverrides(
  channels: ChannelInsight[],
  scope: { region: string; maco: string; quarter: string },
  entries: UserInsightEntry[],
): OverrideResult {
  const warnings: string[] = [];
  const byKey = new Map<string, UserInsightEntry>();

  for (const entry of entries) {
    const key = buildEntryKey(entry);
    if (byKey.has(key)) {
      warnings.push(
        `Duplicate user insight entry for ${entry.region} / ${entry.maco} / ${entry.quarter} / ${entry.channel}; the last entry was used.`,
      );
    }
    byKey.set(key, entry);
  }

  const skippedRewriteSections = new Map<string, Set<InsightSection['id']>>();

  const overriddenChannels = channels.map((channel) => {
    const entry = byKey.get(
      buildEntryKey({
        region: scope.region,
        maco: scope.maco,
        quarter: scope.quarter,
        channel: channel.channel,
      }),
    );

    if (!entry) {
      return channel;
    }

    const rewrittenSections = new Set<InsightSection['id']>();
    const sectionsById = new Map(channel.sections.map((section) => [section.id, { ...section, bullets: [...section.bullets] }]));

    if (entry.optimizations !== undefined) {
      sectionsById.set('optimizations', {
        id: 'optimizations',
        title: MANUAL_SECTION_TITLES.optimizations,
        bullets: [...entry.optimizations],
      });
      rewrittenSections.add('optimizations');
    }

    if (entry.recommendations !== undefined) {
      sectionsById.set('recommendations', {
        id: 'recommendations',
        title: MANUAL_SECTION_TITLES.recommendations,
        bullets: [...entry.recommendations],
      });
      rewrittenSections.add('recommendations');
    }

    if (rewrittenSections.size > 0) {
      skippedRewriteSections.set(channel.channel, rewrittenSections);
    }

    const sections = MANUAL_SECTION_ORDER.flatMap((sectionId) => {
      const section = sectionsById.get(sectionId);
      if (!section || section.bullets.length === 0) {
        return [];
      }
      return [section];
    });

    return {
      ...channel,
      sections,
    };
  });

  return {
    channels: overriddenChannels,
    skippedRewriteSections,
    warnings,
  };
}
