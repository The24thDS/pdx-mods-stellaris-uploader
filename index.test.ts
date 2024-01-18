import 'dotenv/config';
import { test, expect } from '@playwright/test';
import path from 'path';

const MOD_ID = '72663';
const MOD_VERSION = '1.0.3';
const GAME_VERSION = '3.10.1';
const UPLOAD_TIMEOUT = 60_000 * 20;
const RELEASE_NOTES = 'fix bug 3';

test('test', async ({ page }) => {
	// Step 1. Login
	await page.goto(
		'https://login.paradoxplaza.com/login?service=https%3A%2F%2Fmods.paradoxplaza.com%2Fvalidate%3Fredirect%3D%252F'
	);
	await page.getByPlaceholder('Email address').fill(process.env.EMAIL!);
	await page.getByPlaceholder('Password').fill(process.env.PASSWORD!);
	await page.keyboard.press('Tab');
	await page.getByRole('button', { name: 'Login' }).click();
	await page.getByRole('button', { name: 'Decline' }).click();
	await expect(page.getByText(/validating your login/i)).toHaveCount(0);

	// Step 2. Open mod form
	await page.goto(`https://mods.paradoxplaza.com/mods/${MOD_ID}/Any`);
	await page.getByRole('link', { name: 'Edit / New version' }).click();
	await expect(
		page.locator('[class*=editMod] [class*=__loader]')
	).not.toHaveClass(/__active/);
	// I think there's a default routing to the Name tab than can happen so wait for it to hoppefully happen
	await page.waitForTimeout(500);

	// Step 3. Fill version tab
	await page.getByRole('tab', { name: 'version' }).click();
	await page.locator('input[name="userModVersion"]').fill(MOD_VERSION);
	await page.locator('input[name="version"]').fill(GAME_VERSION);

	// Step 4. Upload zip file
	await page.getByRole('tab', { name: 'files' }).click();
	const fileChooserPromise = page.waitForEvent('filechooser');
	await page.getByLabel('files').locator('div[role="button"]').click();
	const fileChooser = await fileChooserPromise;
	await fileChooser.setFiles(path.join(__dirname, 'Archive.zip'));
	await expect(
		page.getByLabel('files').locator('[class*=__loader]')
	).not.toHaveClass(/__active/, { timeout: UPLOAD_TIMEOUT });

	// Step 5. Publish new version
	await page.getByRole('tab', { name: 'preview' }).click();
	await page
		.getByRole('button', { name: /publish mod/i })
		.first()
		.click();
	await page.getByRole('textbox').fill(RELEASE_NOTES);
	await page.getByRole('button', { name: 'Submit to changelog' }).click();
	await expect(
		page.getByText(/your mod is currently being published/i)
	).toHaveCount(1);
});
