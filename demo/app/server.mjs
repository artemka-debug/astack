// Fake "dev server" for the demo videos: renders the dashboard from state.json and live-reloads
// the page whenever the recording script flips a flag (standing in for the agent's code edits).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const DIR = import.meta.dirname;
const STATE = process.env.STATE ?? path.join(DIR, '..', 'out', 'state.json');
const PORT = Number(process.env.PORT ?? 3917);

const ORDERS = [
	['#3021', 'Maya Chen', 'Oct 3', 182.4, 'Shipped'],
	['#3020', 'Liam Novak', 'Oct 3', 64.0, 'Processing'],
	['#3019', 'Ava Romero', 'Oct 2', 239.99, 'Delivered'],
	['#3018', 'Noah Becker', 'Oct 2', 18.5, 'Refunded'],
	['#3017', 'Zoe Laurent', 'Oct 1', 97.2, 'Delivered'],
	['#3016', 'Omar Haddad', 'Oct 1', 145.0, 'Shipped'],
	['#3015', 'Ines Silva', 'Sep 30', 52.75, 'Processing'],
];
const WEEKS = [21.4, 23.1, 22.0, 25.6, 24.2, 27.9, 26.1, 29.3, 31.8, 30.2, 34.6, 33.1];
const KPIS = [
	['Revenue', '$48,210', '+8.2%', true],
	['Orders', '1,284', '+3.1%', true],
	['Conversion', '3.4%', '−0.4%', false],
	['Avg. order', '$37.55', '+5.0%', true],
];
const TONE = { Shipped: 'blue', Processing: 'amber', Delivered: 'green', Refunded: 'red' };

const read = () => {
	try {
		return JSON.parse(fs.readFileSync(STATE, 'utf8'));
	} catch {
		return {};
	}
};

const lineChart = () => {
	const max = 36;
	const x = i => 24 + i * 56;
	const y = v => 200 - (v / max) * 180;
	const pts = WEEKS.map((v, i) => `${x(i)},${y(v).toFixed(1)}`);
	return `<svg viewBox="0 0 664 220" class="chart">
		${[0, 1, 2, 3].map(i => `<line x1="0" x2="664" y1="${20 + i * 60}" y2="${20 + i * 60}" class="grid"/>`).join('')}
		<polygon points="${x(0)},200 ${pts.join(' ')} ${x(11)},200" class="area"/>
		<polyline points="${pts.join(' ')}" class="line"/>
		${WEEKS.map((v, i) => `<circle cx="${x(i)}" cy="${y(v).toFixed(1)}" r="3.5" class="dot"/>`).join('')}
	</svg>`;
};

const barChart = () => {
	const max = 36;
	const best = WEEKS.indexOf(Math.max(...WEEKS));
	return `<svg viewBox="0 0 664 220" class="chart">
		${[0, 1, 2, 3].map(i => `<line x1="0" x2="664" y1="${20 + i * 60}" y2="${20 + i * 60}" class="grid"/>`).join('')}
		${WEEKS.map((v, i) => {
			const h = (v / max) * 180;
			const label = i === best ? `<text x="${8 + i * 56 + 20}" y="${200 - h - 10}" class="best">$${v}k</text>` : '';
			return `<rect x="${8 + i * 56}" y="${(200 - h).toFixed(1)}" width="40" height="${h.toFixed(1)}" rx="6" class="${i === best ? 'bar top' : 'bar'}"/>${label}`;
		}).join('')}
	</svg>`;
};

const page = () => {
	const s = read();
	const kpis = KPIS.map(
		([label, value, delta, up]) =>
			`<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div>${
				s.trend ? `<div class="delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${delta} <span>vs last week</span></div>` : ''
			}</div>`
	).join('');
	const status = st => (s.pills ? `<span class="pill ${TONE[st]}">${st}</span>` : st);
	const rows = ORDERS.map(
		([id, who, date, amount, st]) =>
			`<tr><td class="mono">${id}</td><td>${who}</td><td class="muted">${date}</td><td class="num">$${amount.toFixed(2)}</td><td>${status(st)}</td></tr>`
	).join('');
	const toolbar = s.search
		? `<div class="toolbar"><div class="search">⌕ <span>Search orders…</span></div>${['All', 'Processing', 'Shipped', 'Delivered', 'Refunded']
				.map((c, i) => `<span class="chip${i ? '' : ' on'}">${c}</span>`)
				.join('')}</div>`
		: '';
	const exportBtn = s.noExport ? '' : '<button class="ghost">Export CSV</button>';
	return fs
		.readFileSync(path.join(DIR, 'index.html'), 'utf8')
		.replace('<!--KPIS-->', kpis)
		.replace('<!--CHART-->', s.bars ? barChart() : lineChart())
		.replace('<!--CHART_TITLE-->', s.bars ? 'Revenue per week' : 'Revenue, last 12 weeks')
		.replace('<!--TOOLBAR-->', toolbar)
		.replace('<!--EXPORT-->', exportBtn)
		.replace('<!--ROWS-->', rows);
};

const watchers = new Set();
fs.mkdirSync(path.dirname(STATE), { recursive: true });
if (!fs.existsSync(STATE)) fs.writeFileSync(STATE, '{}');
fs.watchFile(STATE, { interval: 100 }, () => {
	for (const w of watchers) w.write(`data: reload\n\n`);
});

http
	.createServer((req, res) => {
		if (req.url === '/__reload') {
			res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
			res.write(':\n\n');
			watchers.add(res);
			req.on('close', () => watchers.delete(res));
			return;
		}
		res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
		res.end(page());
	})
	.listen(PORT, () => console.log(`demo app http://localhost:${PORT}`));
