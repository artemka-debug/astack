import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { INBOX, ensureInbox, writeStatus } from './inbox.mjs';

const DIR = import.meta.dirname;
const PREFIX = '/__sketch';
const INJECT = `<script src="${PREFIX}/overlay.js" defer></script>`;

const json = (res, status, body) => {
	res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
	res.end(JSON.stringify(body));
};

const readBody = async req => {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	return Buffer.concat(chunks).toString('utf8');
};

const PHYSICAL = /^(en|eth|wlan|wlp|enp|eno|wl)/;

// Tailscale hands out addresses from the CGNAT range 100.64.0.0/10.
const isTailnet = address => {
	const [a, b] = address.split('.').map(Number);
	return a === 100 && b >= 64 && b < 128;
};

const ipv4 = () =>
	Object.entries(os.networkInterfaces()).flatMap(([name, list]) =>
		(list ?? []).filter(a => a.family === 'IPv4' && !a.internal).map(a => ({ name, address: a.address }))
	);

const lanAddresses = () => {
	const all = ipv4().filter(a => !isTailnet(a.address));
	const physical = all.filter(a => PHYSICAL.test(a.name));
	return (physical.length ? physical : all).map(a => a.address);
};

const tailnetAddresses = () => ipv4().filter(a => isTailnet(a.address)).map(a => a.address);

const TAILSCALE_CLI = ['tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale'];

// MagicDNS name of this machine, e.g. my-laptop.tail1234.ts.net, when the Tailscale CLI is around.
const tailnetName = async () => {
	for (const cli of TAILSCALE_CLI) {
		const out = await new Promise(resolve =>
			execFile(cli, ['status', '--json'], { timeout: 2000 }, (error, stdout) => resolve(error ? null : stdout))
		);
		const name = out && JSON.parse(out).Self?.DNSName?.replace(/\.$/, '');
		if (name) return name;
	}
	return null;
};

const resolveHosts = host => {
	if (host !== 'tailscale') return host.split(',');
	const tailnet = tailnetAddresses();
	if (!tailnet.length) throw new Error('--host tailscale: no Tailscale address found, is Tailscale up?');
	return ['127.0.0.1', ...tailnet];
};

const strokeSvg = (strokes, width, height) => {
	const paths = strokes
		.map(s => {
			const d = s.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
			const opacity = s.tool === 'highlighter' ? 0.35 : 1;
			return `<path d="${d}" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${opacity}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
		})
		.join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="position:absolute;left:0;top:0;pointer-events:none;z-index:2147483647">${paths}</svg>`;
};

export async function serve({ target, port, host }) {
	const TARGET = new URL(target);
	const targetPort = Number(TARGET.port || (TARGET.protocol === 'https:' ? 443 : 80));
	const local = ['localhost', '127.0.0.1', '::1'].includes(TARGET.hostname);
	// Next.js dev rejects HMR and server actions from origins other than localhost unless allowedDevOrigins lists them.
	const upstreamHost = local ? `localhost:${targetPort}` : TARGET.host;
	const upstreamOrigin = `${TARGET.protocol}//${upstreamHost}`;

	await ensureInbox();

	let browserPromise;
	const browser = async () => {
		const { chromium } = await import('playwright');
		return (browserPromise ??= chromium.launch().then(b => b.on('disconnected', () => (browserPromise = undefined))));
	};

	const render = async (id, fb) => {
		const context = await (await browser()).newContext({
			viewport: { width: fb.viewport.width, height: fb.viewport.height },
			deviceScaleFactor: Math.min(fb.viewport.dpr ?? 2, 2),
			colorScheme: fb.theme === 'dark' ? 'dark' : 'light',
		});
		try {
			if (fb.theme) await context.addInitScript(theme => localStorage.setItem('theme', theme), fb.theme);
			const page = await context.newPage();
			await page.goto(new URL(fb.path, TARGET).href, { waitUntil: 'load', timeout: 60_000 });
			await page.waitForTimeout(1500);
			const doc = await page.evaluate(() => ({
				width: document.documentElement.scrollWidth,
				height: document.documentElement.scrollHeight,
			}));
			await page.screenshot({
				path: path.join(INBOX, id, 'page.png'),
				clip: { x: fb.scroll.x, y: fb.scroll.y, width: fb.viewport.width, height: fb.viewport.height },
				fullPage: true,
			});
			if (fb.strokes.length === 0) return;
			const width = Math.max(doc.width, fb.doc.width);
			const height = Math.max(doc.height, fb.doc.height);
			await page.evaluate(svg => document.body.insertAdjacentHTML('beforeend', svg), strokeSvg(fb.strokes, width, height));
			const xs = [fb.scroll.x, fb.scroll.x + fb.viewport.width];
			const ys = [fb.scroll.y, fb.scroll.y + fb.viewport.height];
			for (const s of fb.strokes) for (const [x, y] of s.points) xs.push(x - 24, x + 24), ys.push(y - 24, y + 24);
			const x = Math.max(0, Math.min(...xs));
			const y = Math.max(0, Math.min(...ys));
			await page.screenshot({
				path: path.join(INBOX, id, 'annotated.png'),
				clip: { x, y, width: Math.min(width, Math.max(...xs)) - x, height: Math.min(height, Math.max(...ys)) - y },
				fullPage: true,
			});
		} finally {
			await context.close();
		}
	};

	const submit = async (req, res) => {
		const fb = JSON.parse(await readBody(req));
		const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
		const id = `${stamp}-${randomBytes(2).toString('hex')}`;
		await fs.mkdir(path.join(INBOX, id));
		const feedback = { id, createdAt: new Date().toISOString(), target: TARGET.href, ...fb };
		await fs.writeFile(path.join(INBOX, id, 'feedback.json'), JSON.stringify(feedback, null, 2));
		await writeStatus(id, { state: 'rendering' });
		json(res, 202, { id });
		try {
			await render(id, feedback);
			await writeStatus(id, { state: 'pending' });
		} catch (error) {
			console.error(`render ${id} failed`, error);
			await writeStatus(id, { state: 'pending', renderError: String(error) });
		}
	};

	const sketchRoute = async (req, res, url) => {
		const rest = url.pathname.slice(PREFIX.length);
		if (rest === '/overlay.js') {
			res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
			res.end(await fs.readFile(path.join(DIR, 'overlay.js')));
			return;
		}
		if (rest === '/submit' && req.method === 'POST') return submit(req, res);
		const status = rest.match(/^\/status\/([\w-]+)$/);
		if (status) {
			const file = path.join(INBOX, status[1], 'status.json');
			const body = await fs.readFile(file, 'utf8').catch(() => null);
			return body ? json(res, 200, JSON.parse(body)) : json(res, 404, { state: 'missing' });
		}
		json(res, 404, { error: 'not found' });
	};

	const upstreamHeaders = headers => {
		const out = { ...headers, host: upstreamHost, 'accept-encoding': 'identity' };
		if (out.origin) out.origin = upstreamOrigin;
		if (out.referer) out.referer = out.referer.replace(/^https?:\/\/[^/]+/, upstreamOrigin);
		return out;
	};

	const proxy = (req, res, url) => {
		const upstream = http.request(
			{
				host: TARGET.hostname,
				port: targetPort,
				method: req.method,
				path: url.pathname + url.search,
				headers: upstreamHeaders(req.headers),
			},
			up => {
				const headers = { ...up.headers };
				for (const origin of [TARGET.origin, upstreamOrigin]) {
					if (headers.location?.startsWith(origin)) headers.location = headers.location.slice(origin.length) || '/';
				}
				if (!headers['content-type']?.includes('text/html')) {
					res.writeHead(up.statusCode, headers);
					up.pipe(res);
					return;
				}
				delete headers['content-length'];
				res.writeHead(up.statusCode, headers);
				let pending = '';
				let injected = false;
				up.on('data', chunk => {
					if (injected) return res.write(chunk);
					pending += chunk.toString('utf8');
					const match = pending.match(/<head[^>]*>/i);
					if (!match) return;
					const at = match.index + match[0].length;
					res.write(pending.slice(0, at) + INJECT + pending.slice(at));
					injected = true;
					pending = '';
				});
				up.on('end', () => res.end(pending));
			}
		);
		upstream.on('error', error => {
			if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
			res.end(`sketch: ${TARGET.href} unreachable (${error.code ?? error.message})`);
		});
		req.pipe(upstream);
	};

	const onRequest = (req, res) => {
		const url = new URL(req.url, 'http://sketch');
		if (!url.pathname.startsWith(PREFIX)) return proxy(req, res, url);
		sketchRoute(req, res, url).catch(error => {
			console.error(error);
			if (!res.headersSent) json(res, 500, { error: String(error) });
		});
	};

	const onUpgrade = (req, socket, head) => {
		const upstream = net.connect(targetPort, TARGET.hostname, () => {
			const headers = upstreamHeaders(req.headers);
			delete headers['accept-encoding'];
			const lines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
			upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${lines.join('\r\n')}\r\n\r\n`);
			if (head.length) upstream.write(head);
			upstream.pipe(socket).pipe(upstream);
		});
		const close = () => (socket.destroy(), upstream.destroy());
		upstream.on('error', close);
		socket.on('error', close);
	};

	const hosts = resolveHosts(host);
	for (const address of hosts) {
		const server = http.createServer(onRequest).on('upgrade', onUpgrade);
		await new Promise((resolve, reject) => server.once('error', reject).listen(port, address, resolve));
	}

	const all = hosts.includes('0.0.0.0');
	const urls = [
		...(all ? [['local', 'localhost'], ...lanAddresses().map(a => ['lan', a])] : []),
		...hosts
			.filter(h => h !== '0.0.0.0')
			.map(h => [isTailnet(h) ? 'tailscale' : /^(127\.|localhost$|::1$)/.test(h) ? 'local' : 'lan', h]),
	];
	const tailnet = all ? tailnetAddresses() : hosts.filter(isTailnet);
	if (all) urls.push(...tailnet.map(a => ['tailscale', a]));
	const name = tailnet.length ? await tailnetName() : null;
	if (name) urls.push(['tailscale', name]);

	console.log(`sketch → ${TARGET.href}`);
	for (const [kind, address] of urls) console.log(`  ${kind.padEnd(10)}http://${address}:${port}`);
	console.log(`inbox ${INBOX}`);
}
