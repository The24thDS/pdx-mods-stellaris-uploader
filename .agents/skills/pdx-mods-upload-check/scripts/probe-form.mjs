#!/usr/bin/env node
/**
 * Probe the live Paradox Mods "new version" upload form and print its structure.
 *
 * Exists because PDX redesigns this form without notice and there is no API or
 * changelog for it: when the upload test breaks, do not guess the replacement
 * selector, read it off the page.
 *
 * Usage (from the repo root, inside the Playwright container):
 *   docker run --rm -i -v "$PWD:/app" -w /app "$PW" \
 *     node .agents/skills/pdx-mods-upload-check/scripts/probe-form.mjs
 *
 * Env:
 *   MOD_ID     mod to inspect (default 72663)
 *   AUTH_FILE  storage state (default <cwd>/.auth/user.json)
 *   HEADFUL=1  show the browser
 *
 * SAFETY: this never clicks publish. A probe that publishes submits a real
 * version and burns that version number.
 */
import path from 'node:path';
import { firefox } from 'playwright';

const MOD_ID = process.env.MOD_ID || '72663';
const AUTH_FILE = path.resolve(process.env.AUTH_FILE || '.auth/user.json');
const MOD_URL = `https://mods.paradoxplaza.com/mods/${MOD_ID}/Any`;

const out = (...a) => console.log(...a);
const headingOf = async (handle) =>
	handle
		? (
				await handle.evaluate((e) => e.innerText || '')
			)
				.split('\n')
				.map((s) => s.trim())
				.filter(Boolean)[0] || '(none)'
		: '(missing)';

const browser = await firefox.launch({ headless: !process.env.HEADFUL });
try {
	const context = await browser.newContext({ storageState: AUTH_FILE });
	const page = await context.newPage();

	out(`# probing ${MOD_URL}`);
	out(`# auth: ${AUTH_FILE}`);

	await page.goto(MOD_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
	await page.getByRole('link', { name: 'Edit / New version' }).click();
	// The form lazy-routes to a default tab; give it a beat to settle.
	await page.getByRole('tablist').waitFor({ timeout: 45_000 });
	await page.waitForTimeout(3_000);

	// ---------------------------------------------------------------- tabs
	const tabs = await page.getByRole('tab').evaluateAll((els) =>
		els.map((e) => ({
			name: (e.getAttribute('aria-label') || e.innerText || '').trim(),
			selected: e.getAttribute('aria-selected') === 'true',
		})),
	);
	out('\n## tabs (CSS renders these uppercase; Playwright matches role names case-insensitively)');
	for (const t of tabs) out(`  - ${t.name}${t.selected ? '   [selected on load]' : ''}`);

	// -------------------------------------------------------------- panels
	// Note: Playwright considers every panel "visible" (they are stacked/clipped rather
	// than display:none), so visibility is not a useful signal here — the selected tab is.
	const panelLocator = page.getByRole('tabpanel');
	const panels = [];
	for (let i = 0; i < (await panelLocator.count()); i++) {
		const p = panelLocator.nth(i);
		panels.push({
			i,
			heading: await headingOf(await p.elementHandle()),
			controls: await p.evaluate((e) =>
				[...e.querySelectorAll('input, textarea, select, button')]
					.filter((c) => c.getAttribute('name') || c.type === 'file' || c.tagName === 'TEXTAREA')
					.map((c) =>
						c.tagName === 'INPUT' || c.tagName === 'TEXTAREA'
							? `${c.tagName.toLowerCase()}${c.getAttribute('name') ? `[name=${c.getAttribute('name')}]` : ''}${c.getAttribute('accept') ? `[accept=${c.getAttribute('accept')}]` : ''}${c.multiple ? '[multiple]' : ''} = ${JSON.stringify(c.value)}`
							: `button ${JSON.stringify((c.innerText || '').trim().slice(0, 40))}${c.disabled ? ' (disabled)' : ''}`,
					)
					.filter((c) => !/button ""/.test(c)),
			),
		});
	}
	out('\n## panels (all mounted at once; only the selected tab\'s is in view)');
	for (const p of panels) {
		out(`  panel[${p.i}] "${p.heading}"`);
		for (const c of p.controls) out(`      ${c}`);
	}

	// ---------------------------------------------------- orphan controls
	// Anything not inside a tabpanel is worth knowing about too, minus the cookie banner.
	const orphans = await page.evaluate(() => {
		const noise = (el) => el.closest('[id*=onetrust], [class*=onetrust], [class*=Optanon], [id*=ot-sdk]');
		return [...document.querySelectorAll('input, textarea')]
			.filter((el) => !el.closest('[role="tabpanel"]') && !noise(el))
			.map((el) => `${el.tagName.toLowerCase()}${el.getAttribute('name') ? `[name=${el.getAttribute('name')}]` : ''}${el.type === 'file' ? `[accept=${el.accept || 'any'}]` : ''}`)
			.filter((c) => !/^\w+$/.test(c)); // skip unnamed controls (cookie banner, editor internals)
	});
	if (orphans.length) {
		out('\n## controls outside any tabpanel (excluding the cookie banner)');
		for (const o of orphans) out(`  - ${o}`);
	}

	// ------------------------------------------------------- dropzone shape
	const dropzones = await page.locator('input[type="file"]').evaluateAll((els) =>
		els.map((e) => {
			const wrap = e.closest('[class*=FileUpload]');
			return {
				accept: e.accept,
				multiple: e.multiple,
				display: e.style.display || getComputedStyle(e).display,
				wrapperText: (wrap?.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3).join(' / '),
			};
		}),
	);
	out('\n## file inputs');
	for (const d of dropzones) out(`  - accept=${d.accept || 'any'} multiple=${d.multiple} display=${d.display} :: ${d.wrapperText}`);

	// ------------------------------------------------------------- publish
	// Inspect the preview panel only. NEVER click publish.
	const preview = page.getByRole('tab', { name: 'preview' });
	if (await preview.count()) {
		await preview.click();
		await page.waitForTimeout(2_000);
		const buttons = await page.getByRole('button').evaluateAll((els) =>
			els
				.filter((e) => e.offsetParent !== null)
				.map((e) => ({ text: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50) || '(no text)', disabled: e.disabled })),
		);
		out('\n## visible buttons on the preview panel');
		for (const b of buttons) out(`  - ${JSON.stringify(b.text)}${b.disabled ? '  (DISABLED)' : ''}`);
		const candidate = buttons.find((b) => /publish/i.test(b.text));
		if (candidate) {
			out(`\n  publish button: ${JSON.stringify(candidate.text)}${candidate.disabled ? ' -- DISABLED (a required field is empty)' : ''}`);
		}
	}

	out('\n(stopped before publish — probing the form does not submit anything)');
} finally {
	await browser.close();
}
