// Shared harness for the demo recordings: starts the fake dev server and the real sketch proxy,
// opens the stage in a recorded Chromium, and exposes helpers to drive both.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DIR = import.meta.dirname;
const SCRIPTS = path.join(DIR, '..', 'plugins', 'sketch-proxy', 'skills', 'sketch-proxy', 'scripts');
const { chromium } = await import(path.join(SCRIPTS, 'node_modules', 'playwright', 'index.mjs'));

export const OUT = path.join(DIR, 'out');
export const W = 1920;
export const H = 1080;
const APP_PORT = 3917;
const PROXY_PORT = 8317;
export const PROXY = `http://127.0.0.1:${PROXY_PORT}/`;
const INBOX = path.join(OUT, 'inbox');
const STATE = path.join(OUT, 'state.json');
const env = { ...process.env, SKETCH_INBOX: INBOX, STATE };

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const sketch = (...args) => execFileSync('node', [path.join(SCRIPTS, 'cli.mjs'), ...args], { env, encoding: 'utf8' });
export const state = s => fs.writeFileSync(STATE, JSON.stringify(s));

export async function start(name) {
	fs.mkdirSync(OUT, { recursive: true });
	fs.rmSync(INBOX, { recursive: true, force: true });
	fs.rmSync(path.join(OUT, 'video'), { recursive: true, force: true });
	state({});
	const children = [
		spawn('node', [path.join(DIR, 'app', 'server.mjs')], { env: { ...env, PORT: String(APP_PORT) }, stdio: 'ignore' }),
		spawn('node', [path.join(SCRIPTS, 'cli.mjs'), 'serve', '--target', `http://localhost:${APP_PORT}`, '--port', String(PROXY_PORT), '--host', '127.0.0.1'], { env, stdio: 'ignore' }),
	];
	await sleep(1500);

	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: { width: W, height: H },
		deviceScaleFactor: 1,
		recordVideo: { dir: path.join(OUT, 'video'), size: { width: W, height: H } },
	});
	// Inside the app iframe, report pointer positions to the stage so it can draw the cursor.
	await context.addInitScript(() => {
		if (window.top === window) return;
		const post = (e, down) => parent.postMessage({ kind: 'cursor', x: e.clientX, y: e.clientY, down }, '*');
		addEventListener('pointermove', e => post(e), true);
		addEventListener('pointerdown', e => post(e, true), true);
		addEventListener('pointerup', e => post(e, false), true);
	});
	const page = await context.newPage();
	await page.goto(`file://${path.join(DIR, 'stage.html')}`);
	const demo = (fn, ...args) => page.evaluate(([fn, args]) => window.demo[fn](...args), [fn, args]);

	const stroke = async (points, steps = 1) => {
		await page.mouse.move(...points[0], { steps: 8 });
		await page.mouse.down();
		for (const p of points.slice(1)) await page.mouse.move(...p, { steps });
		await page.mouse.up();
		await sleep(120);
	};
	const click = async locator => {
		const b = await locator.boundingBox();
		await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 14 });
		await sleep(120);
		await page.mouse.down();
		await sleep(60);
		await page.mouse.up();
	};
	// Measure boxes before moving the camera: the ring lives inside the zoomed stage.
	const box = locator => locator.boundingBox();
	const ring = b => demo('ring', b.x, b.y, b.width, b.height);
	const waitPending = async () => {
		for (let i = 0; i < 80 && sketch('wait', '--peek').trim() === 'no pending sketches'; i++) await sleep(300);
		return sketch('wait');
	};
	const annotated = id => `data:image/png;base64,${fs.readFileSync(path.join(INBOX, id, 'annotated.png')).toString('base64')}`;

	const finish = async () => {
		const video = page.video();
		await context.close();
		await browser.close();
		for (const c of children) c.kill('SIGKILL');
		const mp4 = path.join(DIR, '..', 'docs', 'media', `${name}.mp4`);
		execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', await video.path(), '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
		console.log(mp4);
		process.exit(0);
	};

	return { page, demo, stroke, click, box, ring, waitPending, annotated, finish };
}

export const ellipse = (cx, cy, rx, ry, n = 48) => {
	const pts = [];
	for (let i = 0; i <= n + 4; i++) {
		const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
		pts.push([cx + rx * Math.cos(a) + Math.sin(i / 4) * 2.5, cy + ry * Math.sin(a)]);
	}
	return pts;
};

export const arrow = (tail, tip, bend = 28) => {
	const arc = [];
	for (let i = 0; i <= 22; i++) {
		const t = i / 22;
		arc.push([tail[0] + (tip[0] - tail[0]) * t, tail[1] + (tip[1] - tail[1]) * t - Math.sin(t * Math.PI) * bend]);
	}
	return arc;
};

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// The real `sketch wait` output, shortened the way Claude Code collapses long tool output.
export const summarize = out => {
	const lines = out.trim().split('\n');
	return [`<span class="hl">${esc(lines[0])}</span>`, esc(lines[1]), `<span class="k">… +${lines.length - 2} lines (ctrl+r to expand)</span>`];
};
