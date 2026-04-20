import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import invariant from 'tiny-invariant';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
	invariant(process.env.USERNAME, 'You must provide a USERNAME');
	invariant(process.env.EMAIL, 'You must provide an EMAIL');
	invariant(process.env.PASSWORD, 'You must provide a PASSWORD');

	await page.goto('https://mods.paradoxplaza.com/');
	await page.getByRole('button', { name: 'Decline' }).click();
	await page.getByText('Log in').click();
	await page.getByRole('button', { name: 'LOG IN' }).click();
	await page.waitForURL(/.*login\.paradoxinteractive\.com.*/);
	await page.getByRole('button', { name: 'OK' }).click();
	await page.getByLabel('Email address').fill(process.env.EMAIL);
	await page.getByLabel('Password').fill(process.env.PASSWORD);
	await page.getByRole('button', { name: 'LOGIN' }).click();
	await page.waitForURL(/.*mods\.paradoxplaza\.com.*/);
	await page.waitForTimeout(2000);
	await expect(page.getByRole('heading', { name: 'Logging in...' })).toHaveCount(0);

	await page.context().storageState({ path: AUTH_FILE });
});
