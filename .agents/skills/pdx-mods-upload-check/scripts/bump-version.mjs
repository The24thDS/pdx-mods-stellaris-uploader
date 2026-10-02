#!/usr/bin/env node
/**
 * Print the next mod version to upload: the highest of (latest published
 * version, local descriptor version), with the patch component bumped.
 *
 * PDX Mods rejects a version number that already exists, so a repeated run
 * must never reuse one — which rules out hardcoding a version anywhere.
 * The API is the source of truth because the local descriptor can drift (a
 * reset checkout, or a version published from elsewhere); the descriptor is
 * the fallback so the loop still works offline.
 *
 * Usage (from the repo root, inside the Playwright container):
 *   NEXT=$(docker run --rm -i -v "$PWD:/app" -w /app "$PW" \
 *     node .agents/skills/pdx-mods-upload-check/scripts/bump-version.mjs)
 *
 * Env:
 *   MOD_ID      mod to inspect (default 72663)
 *   AUTH_FILE   storage state (default <cwd>/.auth/user.json)
 *   MOD_FOLDER  mod directory (default <cwd>/test-mod)
 *
 * Prints the new version on stdout. Warnings go to stderr so the caller can
 * use stdout directly.
 */
import fs from 'node:fs';
import path from 'node:path';

const MOD_ID = process.env.MOD_ID || '72663';
const AUTH_FILE = path.resolve(process.env.AUTH_FILE || '.auth/user.json');
const MOD_FOLDER = path.resolve(process.env.MOD_FOLDER || 'test-mod');
const DESCRIPTOR = path.join(MOD_FOLDER, 'descriptor.mod');

const warn = (...a) => console.error(...a);

/** "3.14.159" -> [3, 14, 159]. Tolerates and ignores a prerelease suffix. */
const parse = (v) =>
	String(v)
		.trim()
		.split('-')[0]
		.split('.')
		.map((n) => Number.parseInt(n, 10) || 0);

/** Highest of two dotted versions, compared numerically per component. */
const max = (a, b) => {
	const pa = parse(a);
	const pb = parse(b);
	for (let i = 0; i < 3; i++) {
		if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0) ? a : b;
	}
	return a;
};

const bumpPatch = (v) => {
	const p = parse(v);
	return `${p[0] ?? 0}.${p[1] ?? 0}.${(p[2] ?? 0) + 1}`;
};

// ---------------------------------------------------------------- local
let local = null;
try {
	const descriptor = fs.readFileSync(DESCRIPTOR, 'utf8');
	local = descriptor.match(/^version="?([0-9][^"\n]*)"?/m)?.[1] ?? null;
} catch {
	/* handled below */
}
if (!local) {
	console.error(`No version= line found in ${DESCRIPTOR}`);
	process.exit(1);
}
warn(`local descriptor: ${local}`);

// -------------------------------------------------------------- remote
let remote = null;
if (fs.existsSync(AUTH_FILE)) {
	try {
		const { request } = await import('playwright');
		const ctx = await request.newContext({ storageState: AUTH_FILE });
		const res = await ctx.get(`https://api.paradox-interactive.com/mods/versions?modId=${MOD_ID}`);
		const body = await res.json();
		remote = body?.modVersions?.at(-1)?.userVersion ?? null;
	} catch (e) {
		warn(`could not read published versions (${e.message.split('\n')[0]}) — using the local descriptor`);
	}
} else {
	warn(`no ${AUTH_FILE} — using the local descriptor; run \`yarn auth\` first to be safe`);
}
if (remote) warn(`latest published:  ${remote}`);

const next = bumpPatch(max(local, remote ?? local));
console.log(next);
