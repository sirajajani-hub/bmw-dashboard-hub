import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ChannelInsight } from './dashboardService';
import {
  applyManualInsightOverrides,
  getUserInsightsVersion,
  parseUserInsightsJson,
} from './userInsights';

const sampleJson = JSON.stringify([
  {
    region: 'T2EAST',
    maco: 'ALL MACOS',
    quarter: 'Q1 2026',
    channel: 'Search',
    optimizations: ['Reduce Bing spend concentration.'],
    recommendations: ['Scale Google non-brand.'],
  },
  {
    region: 'T2EAST',
    maco: 'ALL MACOS',
    quarter: 'Q1 2026',
    channel: 'Social',
    optimizations: [],
  },
]);

function makeChannels(): ChannelInsight[] {
  return [
    {
      channel: 'Search',
      sections: [
        { id: 'delivery', title: 'Delivery by Platform/Channel/Campaign', bullets: ['Generated delivery'] },
        { id: 'optimizations', title: 'Optimizations', bullets: ['Generated optimization'] },
        { id: 'recommendations', title: 'Recommendations', bullets: ['Generated recommendation'] },
      ],
    },
    {
      channel: 'Social',
      sections: [
        { id: 'delivery', title: 'Delivery by Platform/Channel/Campaign', bullets: ['Generated delivery'] },
        { id: 'recommendations', title: 'Recommendations', bullets: ['Generated recommendation'] },
      ],
    },
    {
      channel: 'Connected TV / OTT',
      sections: [
        { id: 'delivery', title: 'Delivery by Platform/Channel/Campaign', bullets: ['Generated delivery'] },
        { id: 'optimizations', title: 'Optimizations', bullets: ['Generated optimization'] },
      ],
    },
  ];
}

test('parseUserInsightsJson parses valid entries and preserves empty sections', () => {
  const result = parseUserInsightsJson(sampleJson);

  assert.equal(result.warnings.length, 0);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries[0], {
    region: 'T2EAST',
    maco: 'ALL MACOS',
    quarter: 'Q1 2026',
    channel: 'Search',
    optimizations: ['Reduce Bing spend concentration.'],
    recommendations: ['Scale Google non-brand.'],
  });
  assert.deepEqual(result.entries[1], {
    region: 'T2EAST',
    maco: 'ALL MACOS',
    quarter: 'Q1 2026',
    channel: 'Social',
    optimizations: [],
  });
});

test('parseUserInsightsJson skips malformed entries without failing the file', () => {
  const result = parseUserInsightsJson(JSON.stringify([
    {
      region: 'T2EAST',
      maco: 'ALL MACOS',
      quarter: 'Q1 2026',
      optimizations: ['Missing channel should skip this entry.'],
    },
    {
      region: 'T2EAST',
      maco: 'ALL MACOS',
      quarter: 'Q1 2026',
      channel: 'Search',
      recommendations: [123],
    },
  ]));

  assert.equal(result.entries.length, 0);
  assert.equal(result.warnings.length, 2);
});

test('applyManualInsightOverrides replaces matching sections and preserves unmatched generated sections', () => {
  const { entries } = parseUserInsightsJson(sampleJson);
  const result = applyManualInsightOverrides(
    makeChannels(),
    { region: 'T2EAST', maco: 'ALL MACOS', quarter: 'Q1 2026' },
    entries,
  );

  const search = result.channels.find((channel) => channel.channel === 'Search');
  assert.ok(search);
  assert.deepEqual(
    search.sections.find((section) => section.id === 'optimizations')?.bullets,
    ['Reduce Bing spend concentration.'],
  );
  assert.deepEqual(
    search.sections.find((section) => section.id === 'recommendations')?.bullets,
    ['Scale Google non-brand.'],
  );
  assert.deepEqual(
    search.sections.find((section) => section.id === 'delivery')?.bullets,
    ['Generated delivery'],
  );
});

test('applyManualInsightOverrides suppresses empty manual sections and can add missing matching sections', () => {
  const result = applyManualInsightOverrides(
    makeChannels(),
    { region: 'T2EAST', maco: 'ALL MACOS', quarter: 'Q1 2026' },
    [
      {
        region: 'T2EAST',
        maco: 'ALL MACOS',
        quarter: 'Q1 2026',
        channel: 'Social',
        optimizations: ['Shift budget into top-performing ad sets.'],
        recommendations: [],
      },
    ],
  );

  const social = result.channels.find((channel) => channel.channel === 'Social');
  assert.ok(social);
  assert.deepEqual(
    social.sections.map((section) => section.id),
    ['delivery', 'optimizations'],
  );
  assert.deepEqual(
    social.sections.find((section) => section.id === 'optimizations')?.bullets,
    ['Shift budget into top-performing ad sets.'],
  );
});

test('applyManualInsightOverrides leaves non-matching channels unchanged', () => {
  const result = applyManualInsightOverrides(
    makeChannels(),
    { region: 'T2SOUTH', maco: 'ALL MACOS', quarter: 'Q1 2026' },
    [
      {
        region: 'T2EAST',
        maco: 'ALL MACOS',
        quarter: 'Q1 2026',
        channel: 'Search',
        optimizations: ['Manual optimization'],
      },
    ],
  );

  assert.deepEqual(result.channels, makeChannels());
});

test('getUserInsightsVersion changes when the file mtime changes', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-insights-'));
  const filePath = path.join(tempDir, 'user-insights.json');
  fs.writeFileSync(filePath, '[]\n', 'utf8');

  const firstVersion = getUserInsightsVersion(filePath);
  const later = new Date(Date.now() + 2_000);
  fs.utimesSync(filePath, later, later);
  const secondVersion = getUserInsightsVersion(filePath);

  assert.notEqual(firstVersion, secondVersion);
});
