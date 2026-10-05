// iPad walkthrough: Claude Code on the laptop, the app on an iPad over Tailscale, Apple Pencil marks.
//   node demo/record-ipad.mjs   →  docs/media/sketch-proxy-ipad.mp4
import { PROXY, arrow, ellipse, sketch, sleep, start, state, summarize } from './lib.mjs';

const { page, demo, stroke, click, box, ring, waitPending, annotated, finish } = await start('sketch-proxy-ipad');
await demo('layout', 'ipad');
const app = page.frameLocator('#iapp');
const overlay = s => app.locator(`sketch-overlay ${s}`);
const tap = async locator => {
	await demo('pointer', 'touch');
	await click(locator);
};
const pen = () => demo('pointer', 'pen');
const scrollBy = async (x, y, dy) => {
	await demo('pointer', 'touch');
	await page.mouse.move(x, y, { steps: 10 });
	for (let i = 1; i <= 12; i++) {
		await page.mouse.move(x, y - (i * dy) / 12);
		await page.mouse.wheel(0, dy / 12);
		await sleep(30);
	}
	await sleep(400);
};

// Intro
await demo(
	'card',
	`<div><h1>✏️ Sketch from your <span>iPad</span></h1><p>Your laptop runs the app. Your iPad is the canvas.</p>
	<div class="tags"><span>Apple Pencil</span><span>Scribble</span><span>Tailscale</span></div></div>`
);
await demo('welcome');
await sleep(2800);
await demo('hideCards');
await sleep(500);

// Start the session on the tailnet
await demo('caption', '1', 'Ask Claude to share the app with your iPad');
await demo('typeInput', 'open the dashboard on my iPad over tailscale, I’ll sketch with the pencil');
await sleep(250);
await demo('submitInput');
await demo('spin', 'Pondering…');
await sleep(900);
await demo('spin');
await demo('tool', 'Skill', 'sketch-proxy');
await demo('out', ['Successfully loaded skill']);
await sleep(200);
await demo('tool', 'Bash', 'sketch serve --target http://localhost:3000 --host tailscale');
await demo('out', [
	'sketch → http://localhost:3000/',
	'  local     http://127.0.0.1:8217',
	'  tailscale http://100.101.12.34:8217',
	'  tailscale http://my-macbook.tail1234.ts.net:8217',
]);
await sleep(300);
await demo('say', 'Listening on localhost and your tailnet only. On the iPad, open <b>my-macbook.tail1234.ts.net:8217</b>.');
await sleep(250);
await demo('tool', 'Bash', 'sketch wait', 'y');
await demo('out', ['Running in the background (↓ to manage)']);
await demo('spin', 'Waiting for your sketch…');
await sleep(600);

await demo('caption', '2', 'Same tailnet: the iPad reaches your laptop from anywhere');
await demo('net', true);
await sleep(4600);
await demo('net', false);
await sleep(500);

await demo('caption', '3', 'Open the tailnet URL in Safari');
await demo('iurl', 'my-macbook.tail1234.ts.net:8217', PROXY);
await overlay('.fab').waitFor();
await demo('hideBlank');
await sleep(1200);

// Round 1: Pencil on the chart, Scribble note
await demo('caption', '4', 'Finger taps and scrolls, Apple Pencil draws');
await tap(overlay('.fab'));
await sleep(500);
await pen();
const chart = await box(app.locator('#revenue .chart'));
await stroke(ellipse(chart.x + chart.width * 0.5, chart.y + chart.height * 0.5, chart.width * 0.53, chart.height * 0.62), 2);
const peak = [chart.x + chart.width * 0.82, chart.y + chart.height * 0.14];
await stroke(arrow([peak[0] + 120, peak[1] - 70], peak, 18), 2);
await stroke([[peak[0] + 22, peak[1] - 8], peak, [peak[0] + 6, peak[1] - 24]]);
await sleep(400);

await demo('caption', '5', 'Write the note by hand: Scribble turns it into text');
const note = overlay('textarea');
await tap(note);
await sleep(400);
await pen();
const field = await box(note);
const lines = ['weekly bars,', 'highlight the best'];
const inkWidth = field.width - 28;
await note.evaluate(el => (el.placeholder = ''));
const writing = demo('ink', field.x + 14, field.y + 8, lines, 2600, inkWidth);
await page.mouse.move(field.x + 16, field.y + 30, { steps: 6 });
await page.mouse.down();
for (const [row, text] of lines.entries()) {
	const n = text.length;
	for (let i = 0; i <= n; i++) {
		await page.mouse.move(field.x + 16 + (i / n) * inkWidth * 0.9, field.y + 30 + row * 34 + Math.sin(i * 1.7) * 5);
		await sleep(2400 / 2 / n);
	}
}
await page.mouse.up();
await writing;
await sleep(300);
await demo('clearInk');
await note.fill(lines.join(' '));
await sleep(900);
await tap(overlay('button.primary'));
await sleep(400);

await demo('caption', '6', 'Claude picks up the sketch on your laptop');
const out1 = await waitPending();
const id1 = out1.match(/^SKETCH (\S+)/)[1];
await demo('spin');
await sleep(400);
await demo('tool', 'Bash', 'sketch wait');
await demo('out', summarize(out1), 110);
await sleep(300);
await demo('tool', 'Read', '.sketch/…/annotated.png');
await demo('img', annotated(id1));
await sleep(1200);
await demo('say', 'Circle around the revenue chart, an arrow at the peak week. Switching to weekly bars with the best week highlighted.');
await sleep(400);
await demo('tool', 'Bash', `sketch done ${id1.slice(-4)} "Reading as: …" --working`);
sketch('done', id1, 'Reading as: weekly bars instead of the line, best week highlighted', '--working');
await demo('caption', '7', 'The iPad shows what Claude understood');
await demo('spin', 'Editing…');
await sleep(3600);
await demo('tool', 'Update', 'src/components/revenue-chart.tsx');
await demo('diff', 'src/components/revenue-chart.tsx', [
	['-', 18, '<LineChart data={weeks} />'],
	['+', 18, '<BarChart data={weeks} highlight={bestWeek} />'],
]);
state({ bars: true });
await sleep(300);
await demo('tool', 'Bash', `sketch done ${id1.slice(-4)} "Weekly bars"`);
sketch('done', id1, 'Revenue is weekly bars now, with the best week highlighted.');
await demo('spin');
await demo('caption', '8', 'Hot reload, straight to the iPad');
await sleep(3400);
await ring(await box(app.locator('#revenue')));
await sleep(2600);

// Round 2: no note, just a cross
await demo('caption', '9', 'No note needed: cross something out');
await demo('tool', 'Bash', 'sketch wait', 'y');
await demo('out', ['Running in the background (↓ to manage)']);
await demo('spin', 'Waiting for your sketch…');
await scrollBy(1500, 820, 300);
await tap(overlay('.fab'));
await sleep(400);
await pen();
const exp = await box(app.locator('#orders button.ghost'));
await stroke([[exp.x - 8, exp.y - 6], [exp.x + exp.width + 8, exp.y + exp.height + 6]], 18);
await sleep(150);
await stroke([[exp.x + exp.width + 8, exp.y - 6], [exp.x - 8, exp.y + exp.height + 6]], 18);
await sleep(1400);
await tap(overlay('button.primary'));
const out2 = await waitPending();
const id2 = out2.match(/^SKETCH (\S+)/)[1];
await demo('spin');
await demo('tool', 'Bash', 'sketch wait');
await demo('out', summarize(out2), 90);
await demo('say', 'Crossed out “Export CSV”, no note: removing the button.');
await demo('tool', 'Update', 'src/components/orders-table.tsx');
await demo('diff', 'src/components/orders-table.tsx', [['-', 9, '<Button variant="ghost">Export CSV</Button>']]);
state({ bars: true, noExport: true });
await demo('tool', 'Bash', `sketch done ${id2.slice(-4)} "Removed Export CSV"`);
sketch('done', id2, 'Removed the Export CSV button.');
await demo('spin');
await sleep(3400);
await demo('caption');
await sleep(1200);

// Outro
await demo(
	'card',
	`<div><h1>Your iPad is the <span>canvas</span>.</h1><p>Tailscale on both devices, then one command.</p>
	<code>sketch serve --target http://localhost:3000 --host tailscale</code></div>`
);
await sleep(4200);
await finish();
