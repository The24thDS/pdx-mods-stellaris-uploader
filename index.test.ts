import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import invariant from 'tiny-invariant';
import { test, expect } from '@playwright/test';

import { getGameVersionFromDescriptor, getModVersionFromDescriptor } from './utils';

invariant(process.env.USERNAME, 'You must provide a USERNAME');

const MOD_FOLDER_PATH = path.join(__dirname, process.env.MOD_FOLDER_PATH || 'mod');
const MOD_DESCRIPTOR_PATH = path.join(MOD_FOLDER_PATH, 'descriptor.mod');
invariant(fs.existsSync(MOD_DESCRIPTOR_PATH), `You must provide a descriptor.mod file in ${MOD_FOLDER_PATH}`);
const MOD_ARCHIVE_PATH = process.env.MOD_ARCHIVE_PATH ? path.join(__dirname, process.env.MOD_ARCHIVE_PATH) : path.join(MOD_FOLDER_PATH, 'mod.zip');
invariant(fs.existsSync(MOD_ARCHIVE_PATH), `You must provide a mod archive in ${MOD_FOLDER_PATH}`);

const MOD_ID = process.env.MOD_ID;
invariant(MOD_ID, 'You must provide a MOD_ID');

const MOD_VERSION = process.env.MOD_VERSION ?? getModVersionFromDescriptor(MOD_DESCRIPTOR_PATH);
const GAME_VERSION = process.env.GAME_VERSION ?? getGameVersionFromDescriptor(MOD_DESCRIPTOR_PATH);
const UPLOAD_TIMEOUT = Number(process.env.UPLOAD_TIMEOUT) || 60_000 * 20;
const RELEASE_NOTES = process.env.RELEASE_NOTES || 'No release notes provided.';

test('Upload mod', async ({ page }) => {
	console.time('Total time');
	// Step 0. Check if logged in
	console.time('S0');
	console.info('Step 0. Check if logged in');
	await page.goto('https://mods.paradoxplaza.com/');
	// check if the username is displayed
	const username = await page.getByText(process.env.USERNAME!).textContent();
	invariant(username, 'Not logged in. Username not found on the page.');
	console.timeEnd('S0');

	// Step 1. Open mod form
	console.time('S1');
	console.info('Step 1. Open mod form');
	await page.goto(`https://mods.paradoxplaza.com/mods/${MOD_ID}/Any`);
	await page.getByRole('link', { name: 'Edit / New version' }).click();
	await expect(page.locator('[class*=editMod] [class*=__loader]')).not.toHaveClass(/__active/);
	// I think there's a default routing to the Name tab than can happen so wait for it to hopefully happen
	await page.waitForTimeout(1500);
	console.timeEnd('S1');

	// Step 2. Fill files tab
	console.time('S2');
	console.info('Step 2. Fill files tab');
	await page.getByRole('tab', { name: 'files' }).click();
	await page.locator('input[name="userModVersion"]').fill(MOD_VERSION);
	await page.locator('input[name="version"]').fill(GAME_VERSION);
	// The changelog entry is a required field of the form, the publish button stays disabled without it.
	await page.locator('textarea[name="changelogEntry"]').fill(RELEASE_NOTES);
	console.timeEnd('S2');

	// Step 3. Upload zip file
	console.time('S3');
	console.info('Step 3. Upload zip file');
	// The dropzone's <input type=file> is hidden, so set the files directly instead of
	// going through the native file chooser dialog.
	const fileUpload = page.waitForResponse((response) => response.request().method() === 'PUT' && /amazonaws\.com/.test(response.url()), { timeout: UPLOAD_TIMEOUT });
	await page.locator('input[type="file"][accept=".zip"]').setInputFiles(MOD_ARCHIVE_PATH);
	const uploaded = await fileUpload;
	invariant(uploaded.ok(), `Uploading the mod archive failed with HTTP ${uploaded.status()}`);
	await expect(page.getByRole('button', { name: /remove file/i }).first()).toBeVisible();
	console.timeEnd('S3');

	// Step 4. Publish new version
	console.time('S4');
	console.info('Step 4. Publish new version');
	await page.getByRole('tab', { name: 'preview' }).click();
	await page
		.getByRole('button', { name: /publish new version/i })
		.first()
		.click();
	await page.waitForURL(new RegExp(`/mods/${MOD_ID}/`), { timeout: 60_000 });
	await expect(page.getByText(/pending publication/i).first()).toBeVisible({ timeout: 60_000 });
	console.timeEnd('S4');
	console.info('Mod uploaded!');
	console.timeEnd('Total time');
});
