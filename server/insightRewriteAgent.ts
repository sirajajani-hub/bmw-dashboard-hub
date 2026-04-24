import { Agent, run } from '@openai/agents';
import { z } from 'zod';

import type { ChannelInsight, InsightSection } from './dashboardService';

const DEFAULT_MODEL = 'gpt-5-nano';
const CAUSAL_TERMS = ['because', 'due to', 'driven by', 'caused by', 'as a result of', 'owing to'];

const rewriteOutputSchema = z.object({
  sentence: z.string(),
  usedTerms: z.array(z.string()).optional(),
  rejected: z.boolean().optional(),
  rejectionReason: z.string().optional(),
});

export type InsightRewriteSpec = {
  section: InsightSection['id'];
  channel: string;
  deterministicDraft: string;
  requiredTerms: string[];
  forbiddenTerms: string[];
  approvedNumbers: string[];
  approvedFacts: string[];
  maxSentences: number;
};

type InsightRewriteResponse = z.infer<typeof rewriteOutputSchema>;

type InsightRewriteConfig = {
  model: string;
  loggingEnabled: boolean;
};

type InsightRewriter = (spec: InsightRewriteSpec, config: InsightRewriteConfig) => Promise<string>;

let rewriteAgent: Agent<unknown, typeof rewriteOutputSchema> | null = null;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractApprovedNumbers(text: string) {
  return Array.from(
    new Set(text.match(/\$?\d+(?:,\d{3})*(?:\.\d+)?%?/g) ?? []),
  );
}

function countSentences(text: string) {
  const matches = text.match(/[!?](?:\s|$)|\.(?:\s|$)/g);
  return matches?.length ?? 1;
}

function sentenceContaining(text: string, pattern: RegExp) {
  return (
    text
      .split(/(?<=[.!?])\s+/)
      .find((sentence) => pattern.test(sentence)) ?? ''
  );
}

export function buildVarianceRewriteSpec(channel: string, bullet: string): InsightRewriteSpec {
  return buildInsightRewriteSpec(channel, 'variance', bullet);
}

export function buildInsightRewriteSpec(
  channel: string,
  section: InsightSection['id'],
  bullet: string,
): InsightRewriteSpec {
  const metricLabels = ['VCR', 'CPKBA', 'CTR'].filter((label) => bullet.includes(label));
  const kbaSentence = sentenceContaining(bullet, /\bKBA\b|\bKBAs\b/);
  const leadRateSentence = sentenceContaining(bullet, /\bLead rate\b/i);
  const requiredTerms = (() => {
    if (/remained stable/i.test(bullet)) {
      return ['stable'];
    }
    if (/efficiency increased/i.test(bullet)) {
      return ['efficiency increased'];
    }
    if (/efficiency decreased/i.test(bullet)) {
      return ['efficiency decreased'];
    }
    if (/improved by/i.test(bullet)) {
      return ['improved'];
    }
    if (/decreased by/i.test(bullet)) {
      return ['decreased'];
    }
    if (/increased by/i.test(bullet)) {
      return ['increased'];
    }
    if (/ increased /i.test(bullet)) {
      return ['increased'];
    }
    if (/ declined /i.test(bullet)) {
      return ['declined'];
    }
    return [];
  })();

  if (/\bKBA\b|\bKBAs\b/.test(bullet)) {
    requiredTerms.unshift('KBAs');
  }

  if (/\bKBAs\b.*\bincreased\b/i.test(kbaSentence)) {
    requiredTerms.push('KBAs increased');
  }
  if (/\bKBAs\b.*\bdecreased\b/i.test(kbaSentence)) {
    requiredTerms.push('KBAs decreased');
  }
  if (/\bKBAs\b.*\bdeclined\b/i.test(kbaSentence)) {
    requiredTerms.push('KBAs declined');
  }
  if (/\bKBAs\b.*\bremained stable\b/i.test(kbaSentence)) {
    requiredTerms.push('KBAs remained stable');
  }

  for (const metricLabel of metricLabels.reverse()) {
    requiredTerms.unshift(metricLabel);
  }

  if (/\bCPL\b/.test(bullet)) {
    requiredTerms.unshift('CPL');
  }
  if (leadRateSentence) {
    requiredTerms.unshift('Lead rate');
  }
  if (/\bLead rate\b.*\bimproved\b/i.test(leadRateSentence)) {
    requiredTerms.push('Lead rate improved');
  }
  if (/\bLead rate\b.*\bdecreased\b/i.test(leadRateSentence)) {
    requiredTerms.push('Lead rate decreased');
  }

  const recommendationVerb = /^(Scale|Hold|Optimize)\b/.exec(bullet)?.[1];
  if (section === 'recommendations' && recommendationVerb) {
    requiredTerms.unshift(recommendationVerb);
  }

  const forbiddenTerms = ['worsened', ...CAUSAL_TERMS];
  if (metricLabels.includes('CPKBA')) {
    if (!/\bLead rate\b.*\bimproved\b/i.test(leadRateSentence)) {
      forbiddenTerms.push('improved');
    }
    forbiddenTerms.push('declined');
  }
  if (metricLabels.includes('VCR') || /Connected TV|Online Video/i.test(channel)) {
    forbiddenTerms.push('KBA', 'KBAs', 'CPKBA', 'CP KBA');
  }

  return {
    section,
    channel,
    deterministicDraft: bullet,
    requiredTerms,
    forbiddenTerms,
    approvedNumbers: extractApprovedNumbers(bullet),
    approvedFacts: [
      `Use only the facts already present in this deterministic draft: ${bullet}`,
      'Do not introduce new metrics, entities, percentages, or business claims.',
      'Vehicle labels such as UKL, Core5, and GKL are campaign or vehicle identifiers and should be preserved exactly.',
      'Funnel stage and optimization target are context fields and should not be added to the final bullet unless already present in the deterministic draft.',
    ],
    maxSentences: 1,
  };
}

export function validateInsightRewrite(spec: InsightRewriteSpec, candidate: string) {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return { valid: false, reason: 'empty sentence' } as const;
  }

  if (countSentences(trimmed) > spec.maxSentences) {
    return { valid: false, reason: 'too many sentences' } as const;
  }

  const lower = trimmed.toLowerCase();
  for (const term of spec.forbiddenTerms) {
    if (lower.includes(term.toLowerCase())) {
      return { valid: false, reason: `forbidden term: ${term}` } as const;
    }
  }

  for (const term of spec.requiredTerms) {
    if (!lower.includes(term.toLowerCase())) {
      return { valid: false, reason: `missing required term: ${term}` } as const;
    }
  }

  const candidateNumbers = extractApprovedNumbers(trimmed);
  if (!candidateNumbers.every((value) => spec.approvedNumbers.includes(value))) {
    return { valid: false, reason: 'introduced unapproved number' } as const;
  }

  if (!spec.deterministicDraft.includes('(') && trimmed.includes('(')) {
    return { valid: false, reason: 'introduced unapproved parenthetical context' } as const;
  }

  return { valid: true } as const;
}

function resolveInsightRewriteConfig(requireApiKey = true): InsightRewriteConfig {
  if (requireApiKey && !process.env.OPENAI_API_KEY) {
    throw new Error('Insight rewrite is mandatory but OPENAI_API_KEY is missing.');
  }

  return {
    model: process.env.OPENAI_INSIGHT_REWRITE_MODEL || DEFAULT_MODEL,
    loggingEnabled: process.env.OPENAI_INSIGHT_REWRITE_LOGGING !== 'false',
  };
}

function logRewrite(config: InsightRewriteConfig, message: string, data?: Record<string, unknown>) {
  if (!config.loggingEnabled) {
    return;
  }

  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[insight-rewrite] ${message}${suffix}`);
}

function getRewriteAgent(model: string) {
  if (rewriteAgent) {
    return rewriteAgent;
  }

  rewriteAgent = new Agent({
    name: 'Insight Rewrite Agent',
    model,
    instructions:
      [
        'You rewrite exactly one dashboard insight sentence into concise client-ready, deck-ready business language.',
        'The deterministic draft is factually correct and is the source of truth.',
        'Your job is to improve phrasing, not change the meaning.',
        'Requirements:',
        '- preserve metric labels exactly',
        '- preserve all numbers exactly',
        '- preserve comparison basis exactly',
        '- use one sentence only',
        '- keep the tone executive, restrained, and operational',
        '- avoid filler, hype, and causal explanations',
        '- avoid changing what happened; only improve wording',
        '- preserve vehicle or campaign identifiers such as UKL, Core5, and GKL exactly as provided',
        '- do not append funnel stage or optimization-target context unless the deterministic draft already includes it',
        '- when a label reads like "Campaign / Publisher or Placement", you may rewrite it into natural phrasing such as "Campaign running on Publisher or Placement" if the facts stay unchanged',
        'Prefer polished rewrites such as:',
        '- "VCR remained stable YoY at 84.0% vs 83.4%."',
        '- "CPKBA efficiency increased by 12.0% YoY to $45.10 from $51.25."',
        '- "Connected TV / OTT delivered a current-year VCR of 99.9%; Connected TV / OTT did not run in the comparison period."',
        'Always return JSON only.',
      ].join('\n'),
    outputType: rewriteOutputSchema,
  });

  return rewriteAgent;
}

async function rewriteWithAgent(spec: InsightRewriteSpec, config: InsightRewriteConfig) {
  const agent = getRewriteAgent(config.model);
  const result = await run(
    agent,
    JSON.stringify(
      {
        task: 'Rewrite one dashboard insight sentence.',
        spec,
      },
      null,
      2,
    ),
  );

  const output: InsightRewriteResponse | undefined = result.finalOutput;
  if (!output || output.rejected) {
    logRewrite(config, 'agent-rejected', {
      channel: spec.channel,
      section: spec.section,
      reason: output?.rejectionReason ?? 'empty output',
    });
    throw new Error(
      `Mandatory insight rewrite was rejected for ${spec.channel}/${spec.section}: ${output?.rejectionReason ?? 'empty output'}`,
    );
  }

  const validation = validateInsightRewrite(spec, output.sentence);
  if (!validation.valid) {
    logRewrite(config, 'validation-error', {
      channel: spec.channel,
      section: spec.section,
      reason: validation.reason,
      original: spec.deterministicDraft,
      candidate: output.sentence,
    });
    throw new Error(
      `Mandatory insight rewrite failed validation for ${spec.channel}/${spec.section}: ${validation.reason}`,
    );
  }

  const rewritten = output.sentence.trim();
  logRewrite(config, rewritten === spec.deterministicDraft ? 'rewrite-noop' : 'rewrite-applied', {
    channel: spec.channel,
    section: spec.section,
    original: spec.deterministicDraft,
    rewritten,
  });
  return rewritten;
}

export async function rewriteInsightChannels(
  channels: ChannelInsight[],
  rewriter: InsightRewriter = rewriteWithAgent,
  configOverride?: Partial<InsightRewriteConfig>,
  shouldSkipSection?: (channel: ChannelInsight, section: InsightSection) => boolean,
) {
  const config = {
    ...resolveInsightRewriteConfig(rewriter === rewriteWithAgent),
    ...configOverride,
  };

  const rewrittenChannels = await Promise.all(
    channels.map(async (channel) => {
      const sections = await Promise.all(
        channel.sections.map(async (section) => {
          if (shouldSkipSection?.(channel, section)) {
            return section;
          }

          const bullets = await Promise.all(
            section.bullets.map(async (bullet) => {
              const spec = buildInsightRewriteSpec(channel.channel, section.id, bullet);
              try {
                return await rewriter(spec, config);
              } catch (error) {
                logRewrite(config, 'rewrite-error', {
                  channel: channel.channel,
                  section: section.id,
                  error: error instanceof Error ? error.message : 'unknown error',
                });
                throw error;
              }
            }),
          );

          return {
            ...section,
            bullets,
          };
        }),
      );

      return {
        ...channel,
        sections,
      };
    }),
  );

  return rewrittenChannels;
}
