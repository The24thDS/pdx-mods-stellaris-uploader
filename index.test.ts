import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import invariant from 'tiny-invariant';
import { test, expect } from '@playwright/test';

import { findModTile, getGameVersionFromDescriptor, getModVersionFromDescriptor } from './utils';

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
	if (!username) {
		console.info('Not logged in. Run setup before running the test. Exiting...');
		return;
	} else {
		console.info('Logged in');
	}
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

	// Step 2. Fill version tab
	console.time('S2');
	console.info('Step 2. Fill version tab');
	await page.getByRole('tab', { name: 'version' }).click();
	await page.locator('input[name="userModVersion"]').fill(MOD_VERSION);
	await page.locator('input[name="version"]').fill(GAME_VERSION);
	console.timeEnd('S2');

	// Step 3. Upload zip file
	console.time('S3');
	console.info('Step 3. Upload zip file');
	await page.getByRole('tab', { name: 'files' }).click();
	const fileChooserPromise = page.waitForEvent('filechooser');
	await page.getByLabel('files').locator('div[role="button"]').click();
	const fileChooser = await fileChooserPromise;
	await fileChooser.setFiles(MOD_ARCHIVE_PATH);
	await expect(page.getByLabel('files').locator('[class*=__loader]')).not.toHaveClass(/__active/, { timeout: UPLOAD_TIMEOUT });
	console.timeEnd('S3');

	// Step 4. Publish new version
	console.time('S4');
	console.info('Step 4. Publish new version');
	await page.getByRole('tab', { name: 'preview' }).click();
	await page
		.getByRole('button', { name: /publish mod/i })
		.first()
		.click();
	await page.getByRole('textbox').fill(RELEASE_NOTES);
	await page.waitForTimeout(500);
	await page.getByRole('button', { name: 'Submit to changelog' }).click();
	await page.waitForURL(/.*\/uploaded\?.*/, { timeout: 60_000 });
	await expect(page.locator('[class*=Mods-List-Uploaded-styles__itemWrapper]')).not.toHaveCount(0, { timeout: 60_000 });
	await expect(await findModTile(page, MOD_ID)).toHaveText(/Mod pending publication/i);
	console.timeEnd('S4');
	console.info('Mod uploaded!');
	console.timeEnd('Total time');
});
