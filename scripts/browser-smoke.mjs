import { chromium } from 'playwright';

const baseUrl = process.env.BMW_BROWSER_BASE_URL ?? 'http://127.0.0.1:3000';
const path = process.env.BMW_BROWSER_PATH ?? '/dashboards/shell';
const expectedText = process.env.BMW_BROWSER_EXPECT_TEXT ?? 'KEY PERFORMANCE INDICATORS';
const healthUrl = new URL('/api/health', baseUrl).toString();
const targetUrl = new URL(path, baseUrl).toString();
const timeoutMs = Number(process.env.BMW_BROWSER_TIMEOUT_MS ?? 30_000);
const headless = process.env.BMW_BROWSER_HEADLESS !== 'false';
const dashboardApiPath = '/api/dashboard/bmw';

async function assertHealth() {
  let response;

  try {
    response = await fetch(healthUrl);
  } catch (error) {
    throw new Error(
      `Browser smoke test could not reach ${healthUrl}. Start the frontend with \`npm run dev\` and the API with \`npm run server\` before running \`npm run test:browser\`. ${
        error instanceof Error ? error.message : ''
      }`.trim(),
    );
  }

  if (!response.ok) {
    throw new Error(
      `Browser smoke test expected ${healthUrl} to return 200 but received ${response.status}. Make sure the Vite proxy and API server are running.`,
    );
  }
}

async function main() {
  await assertHealth();

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  try {
    const dashboardResponsePromise = page.waitForResponse(
      (response) => response.url().includes(dashboardApiPath) && response.ok(),
      { timeout: timeoutMs },
    );

    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    if (!response || !response.ok()) {
      throw new Error(`Failed to load ${targetUrl}${response ? ` (${response.status()})` : ''}.`);
    }

    await dashboardResponsePromise;
    await page.getByText(/building quarterly deck view/i).waitFor({ state: 'hidden', timeout: timeoutMs });
    await page.getByText(expectedText, { exact: false }).first().waitFor({ state: 'visible', timeout: timeoutMs });

    const errorBanner = page.getByText(/dashboard api failed|unknown dashboard error|tableau bridge error/i);
    if (await errorBanner.count()) {
      throw new Error(`Dashboard shell rendered an API error banner: ${await errorBanner.first().innerText()}`);
    }

    if (pageErrors.length) {
      throw new Error(`Page errors detected:\n${pageErrors.join('\n')}`);
    }

    if (consoleErrors.length) {
      throw new Error(`Console errors detected:\n${consoleErrors.join('\n')}`);
    }

    console.log(`Browser smoke test passed for ${targetUrl}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
