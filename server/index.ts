import 'dotenv/config';
import express from 'express';
import { buildDashboardResponse } from './dashboardService';
import { getUserInsightsVersion } from './userInsights';

const app = express();
const port = Number(process.env.PORT || 8787);
const DASHBOARD_TIMING_ENABLED = process.env.DASHBOARD_TIMING === 'true';

let cache:
  | {
      key: string;
      expiresAt: number;
      payload: Awaited<ReturnType<typeof buildDashboardResponse>>;
    }
  | undefined;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/dashboard/bmw', async (req, res) => {
  const requestStartedAt = performance.now();
  try {
    const region =
      typeof req.query.region === 'string' && req.query.region.length > 0
        ? req.query.region
        : undefined;
    const maco =
      typeof req.query.maco === 'string' && req.query.maco.length > 0
        ? req.query.maco
        : undefined;
    const currentQuarter =
      typeof req.query.currentQuarter === 'string' && req.query.currentQuarter.length > 0
        ? req.query.currentQuarter
        : undefined;
    const comparisonQuarter =
      typeof req.query.comparisonQuarter === 'string' && req.query.comparisonQuarter.length > 0
        ? req.query.comparisonQuarter
        : undefined;
    const userInsightsVersion = getUserInsightsVersion();
    const cacheKey = `${region ?? 'default'}::${maco ?? 'default'}::${currentQuarter ?? 'default'}::${comparisonQuarter ?? 'default'}::${userInsightsVersion}`;

    if (cache && Date.now() < cache.expiresAt && cache.key === cacheKey) {
      if (DASHBOARD_TIMING_ENABLED) {
        console.log(`[dashboard-timing] route.total ${(performance.now() - requestStartedAt).toFixed(1)}ms {"cache":"hit"}`);
      }
      res.json(cache.payload);
      return;
    }

    const payload = await buildDashboardResponse({ region, maco, currentQuarter, comparisonQuarter });
    cache = {
      key: cacheKey,
      payload,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    if (DASHBOARD_TIMING_ENABLED) {
      console.log(`[dashboard-timing] route.total ${(performance.now() - requestStartedAt).toFixed(1)}ms {"cache":"miss"}`);
    }
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown Tableau bridge error',
    });
  }
});

app.listen(port, () => {
  console.log(`BMW Tableau bridge listening on http://localhost:${port}`);
});
