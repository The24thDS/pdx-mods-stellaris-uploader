import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const UPLOAD_TIMEOUT = Number(process.env.UPLOAD_TIMEOUT) || 60_000 * 20;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: '.',
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 1 : 0,
	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [['html', { open: 'never' }]],
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		// baseURL: 'http://127.0.0.1:3000',

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},
	],
	/* Add the specified upload timeout to Playwright's default test timeout */
	timeout: UPLOAD_TIMEOUT + 30_000,
});
