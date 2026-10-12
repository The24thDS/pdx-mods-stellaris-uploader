import 'dotenv/config';
import invariant from 'tiny-invariant';
import { test } from '@playwright/test';
import path from 'node:path';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

test('Check login state', async ({ page }) => {
	invariant(process.env.USERNAME, 'You must provide a USERNAME');
	console.info('Step 0. Check if logged in');
	await page.goto('https://mods.paradoxplaza.com/');
	// check if the username is displayed
	await page.getByText(process.env.USERNAME, { exact: true }).waitFor({ state: 'visible' });
	console.info('Logged in');
	await page.context().storageState({ path: AUTH_FILE });
});
