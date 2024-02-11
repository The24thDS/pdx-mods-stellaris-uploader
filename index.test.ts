import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import invariant from 'tiny-invariant';
import { test, expect } from '@playwright/test';

import { getGameVersionFromDescriptor, getModVersionFromDescriptor } from './utils';

invariant(process.env.EMAIL, 'You must provide an EMAIL');
invariant(process.env.PASSWORD, 'You must provide a PASSWORD');

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
	// Step 1. Login
	console.info('Step 1. Login');
	await page.goto('https://login.paradoxplaza.com/login?service=https%3A%2F%2Fmods.paradoxplaza.com%2Fvalidate%3Fredirect%3D%252F');
	await page.getByPlaceholder('Email address').fill(process.env.EMAIL!);
	await page.getByPlaceholder('Password').fill(process.env.PASSWORD!);
	await page.keyboard.press('Tab');
	await page.getByRole('button', { name: 'Login' }).click();
	await page.getByRole('button', { name: 'Decline' }).click();
	await expect(page.getByText(/validating your login/i)).toHaveCount(0);

	// Step 2. Open mod form
	console.info('Step 2. Open mod form');
	await page.goto(`https://mods.paradoxplaza.com/mods/${MOD_ID}/Any`);
	await page.getByRole('link', { name: 'Edit / New version' }).click();
	await expect(page.locator('[class*=editMod] [class*=__loader]')).not.toHaveClass(/__active/);
	// I think there's a default routing to the Name tab than can happen so wait for it to hoppefully happen
	await page.waitForTimeout(500);

	// Step 3. Fill version tab
	console.info('Step 3. Fill version tab');
	await page.getByRole('tab', { name: 'version' }).click();
	await page.locator('input[name="userModVersion"]').fill(MOD_VERSION);
	await page.locator('input[name="version"]').fill(GAME_VERSION);

	// Step 4. Upload zip file
	console.info('Step 4. Upload zip file');
	await page.getByRole('tab', { name: 'files' }).click();
	const fileChooserPromise = page.waitForEvent('filechooser');
	await page.getByLabel('files').locator('div[role="button"]').click();
	const fileChooser = await fileChooserPromise;
	await fileChooser.setFiles(MOD_ARCHIVE_PATH);
	await expect(page.getByLabel('files').locator('[class*=__loader]')).not.toHaveClass(/__active/, { timeout: UPLOAD_TIMEOUT });

	// Step 5. Publish new version
	console.info('Step 5. Publish new version');
	await page.getByRole('tab', { name: 'preview' }).click();
	await page
		.getByRole('button', { name: /publish mod/i })
		.first()
		.click();
	await page.getByRole('textbox').fill(RELEASE_NOTES);
	await page.getByRole('button', { name: 'Submit to changelog' }).click();
	await page.waitForURL(/.*\/uploaded\?.*/);
	console.info('Mod uploaded!');
});
