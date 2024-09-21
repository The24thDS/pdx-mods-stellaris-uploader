import { Page } from '@playwright/test';
import type { PathLike } from 'fs';
import fs from 'fs';

/**
 * Accepts a path to a mod descriptor and returns the value of the `version` keyword found in that file.
 */
export const getModVersionFromDescriptor = (path: PathLike) => {
	const data = fs.readFileSync(path, 'utf8');
	const versionLine = data.split('\n').find((line) => line.startsWith('version='));
	if (!versionLine) throw new Error('Version not found in descriptor');
	const version = versionLine.split('=')[1].replace(/"/g, '');
	return version;
};

/**
 * Accepts a path to a mod descriptor and returns the value of the `supported_version` keyword found in that file.
 */
export const getGameVersionFromDescriptor = (path: PathLike) => {
	const data = fs.readFileSync(path, 'utf8');
	const versionLine = data.split('\n').find((line) => line.startsWith('supported_version='));
	if (!versionLine) throw new Error('Game version not found in descriptor');
	const version = versionLine.split('=')[1].replace(/"/g, '');
	return version;
};

/**
 * Finds a mod tile on the page by its mod ID.
 *
 * @param page - The Playwright Page object representing the browser page.
 * @param modId - The ID of the mod to find.
 * @returns A Promise that resolves to the mod tile element if found.
 * @throws An error if the mod tile is not found.
 */
export const findModTile = async (page: Page, modId: string) => {
	for (const tile of await page.locator('[class*=Mods-Card-styles__root]').all()) {
		const link = tile.getByRole('link');
		const href = await link.getAttribute('href');
		if (href?.includes(modId)) {
			return tile;
		}
	}
	throw new Error('Mod tile not found');
};
