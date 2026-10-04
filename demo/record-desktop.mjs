// Desktop walkthrough: Claude Code on the left, the proxied app in a browser on the right.
//   node demo/record-desktop.mjs   →  docs/media/sketch-feedback-desktop.mp4
import { PROXY, arrow, ellipse, sketch, sleep, start, state, summarize } from './lib.mjs';

const { page, demo, stroke, click, box, ring, waitPending, annotated, finish } = await start('sketch-feedback-desktop');
const app = page.frameLocator('#app');
const overlay = s => app.locator(`sketch-overlay ${s}`);

// Intro
await demo(
	'card',
	`<div><h1>✏️ Sketch <span>feedback</span></h1><p>Draw on your running app. Claude makes the change.</p>
	<div class="tags"><span>Mouse</span><span>Apple Pencil</span><span>Any local dev server</span></div></div>`
);
await demo('welcome');
await sleep(2600);
await demo('hideCards');
await sleep(500);

// Kick off in Claude Code
await demo('caption', '1', 'Ask Claude to start a sketch session');
await demo('typeInput', 'let’s polish the dashboard, I’ll sketch on it');
await sleep(250);
await demo('submitInput');
await demo('spin', 'Pondering…');
await sleep(900);
await demo('spin');
await demo('tool', 'Skill', 'sketch-feedback');
await demo('out', ['Successfully loaded skill']);
await sleep(200);
await demo('tool', 'Bash', 'sketch serve --target http://localhost:3000');
await demo('out', ['sketch → http://localhost:3000/', '  local     http://localhost:8217', '  lan       http://192.168.1.23:8217']);
await sleep(300);
await demo('say', 'Open <b>http://localhost:8217</b> and draw on anything you want changed.');
await sleep(250);
await demo('tool', 'Bash', 'sketch wait', 'y');
await demo('out', ['Running in the background (↓ to manage)']);
await demo('spin', 'Waiting for your sketch…');

await demo('caption', '2', 'Open the proxied app');
await demo('url', 'localhost:8217', PROXY);
await overlay('.fab').waitFor();
await demo('hideBlank');
await page.mouse.move(1350, 600, { steps: 12 });
await sleep(1000);

// Round 1
await demo('caption', '3', 'Tap ✏️, circle it, point where it goes');
await click(overlay('.fab'));
await sleep(500);
const th = await app.locator('#orders th').nth(4).boundingBox();
const lastRow = await app.locator('#orders tbody tr').last().boundingBox();
const top = th.y - 4;
const bottom = lastRow.y + lastRow.height + 4;
await stroke(ellipse(th.x + 50, (top + bottom) / 2, 72, (bottom - top) / 2 + 12));
await click(overlay('.swatch').nth(1));
const h2 = await app.locator('#orders h2').boundingBox();
const tip = [h2.x + 260, h2.y + h2.height + 8];
await stroke(arrow([h2.x + 470, h2.y - 70], tip));
await stroke([[tip[0] + 24, tip[1] - 4], tip, [tip[0] + 8, tip[1] - 26]]);

await demo('caption', '4', 'Add a note, then “Keep working”');
const note = overlay('textarea');
await click(note);
await note.pressSequentially('Status as coloured pills. Search + status filter here', { delay: 22 });
await sleep(300);
await click(overlay('button.primary'));
await sleep(400);

await demo('caption', '5', 'Claude wakes up with your marks');
const out1 = await waitPending();
const id1 = out1.match(/^SKETCH (\S+)/)[1];
await demo('camera', 408, 560, 1.32);
await demo('spin');
await sleep(500);
await demo('tool', 'Bash', 'sketch wait');
await demo('out', summarize(out1), 110);
await sleep(300);
await demo('tool', 'Read', '.sketch/…/annotated.png');
await demo('img', annotated(id1));
await sleep(1100);
await demo('say', 'Red circle on the Status column, a blue arrow into the space above the table. Reading it as coloured status pills plus a search and status filter row.');
await sleep(500);
await demo('tool', 'Bash', `sketch done ${id1.slice(-4)} "Reading as: …" --working`);
sketch('done', id1, 'Reading as: Status → coloured pills; search + status filter above the table', '--working');
await demo('camera', 1352, 900, 1);
await demo('caption', '6', 'The page shows what Claude understood');
await demo('spin', 'Editing…');
await sleep(3000);

await demo('caption', '7', 'Claude edits the code');
await demo('camera', 408, 640, 1.32);
await sleep(400);
await demo('tool', 'Update', 'src/components/orders-table.tsx');
await demo('diff', 'src/components/orders-table.tsx', [
	[' ', 41, '<TableCell>'],
	['-', 42, '  {order.status}'],
	['+', 42, '  <StatusPill status={order.status} />'],
	[' ', 43, '</TableCell>'],
]);
await sleep(250);
await demo('tool', 'Update', 'src/components/orders-toolbar.tsx');
await demo('diff', 'src/components/orders-toolbar.tsx', [
	['+', 12, '<SearchInput placeholder="Search orders…" />'],
	['+', 13, '<StatusChips value={status} onChange={setStatus} />'],
]);
state({ pills: true, search: true });
await sleep(400);
await demo('tool', 'Bash', `sketch done ${id1.slice(-4)} "Status pills + search"`);
sketch('done', id1, 'Status is a coloured pill now; added search and status filters above the table.');
await demo('spin');
await sleep(900);
await demo('camera', 1352, 900, 1);
await sleep(3200);
const toolbarBox = await box(app.locator('.toolbar'));
const bodyBox = await box(app.locator('#orders tbody'));
await demo('camera', 1352, 760, 1.25);
await demo('caption', '8', 'Hot reload: the change is live');
await sleep(1000);
await ring(toolbarBox);
await sleep(900);
await ring(bodyBox);
await sleep(2400);
await demo('camera', 960, 540, 1);
await sleep(900);

// Round 2
await demo('caption', '9', 'Keep going with the next sketch');
await demo('tool', 'Bash', 'sketch wait', 'y');
await demo('out', ['Running in the background (↓ to manage)']);
await demo('spin', 'Waiting for your sketch…');
await click(overlay('.fab'));
await sleep(300);
const kpi = await app.locator('.kpi').first().boundingBox();
await stroke(ellipse(kpi.x + kpi.width / 2, kpi.y + kpi.height / 2, kpi.width / 2 + 6, kpi.height / 2 + 12));
await click(note);
await note.pressSequentially('trend vs last week on all of these?', { delay: 24 });
await click(overlay('button.primary'));
const out2 = await waitPending();
const id2 = out2.match(/^SKETCH (\S+)/)[1];
await demo('spin');
await demo('tool', 'Bash', 'sketch wait');
await demo('out', summarize(out2), 90);
await demo('tool', 'Update', 'src/components/kpi-card.tsx');
await demo('diff', 'src/components/kpi-card.tsx', [['+', 28, '<Delta value={kpi.vsLastWeek} />']]);
state({ pills: true, search: true, trend: true });
await demo('tool', 'Bash', `sketch done ${id2.slice(-4)} "Trend vs last week"`);
sketch('done', id2, 'Every KPI shows the change vs last week.');
await sleep(1200);
const kpisBox = await box(app.locator('.kpis'));
await demo('camera', 1352, 260, 1.4);
await demo('caption', '10', 'Seconds from sketch to shipped');
await sleep(1100);
await ring(kpisBox);
await sleep(2200);
await demo('camera', 960, 540, 1);
await demo('caption');
await sleep(900);

// Outro
await demo(
	'card',
	`<div><h1>Sketch, send, <span>ship</span>.</h1><p>Any local dev server. Any device on your network or tailnet.</p>
	<code>/plugin marketplace add adovhopolyi/astack</code></div>`
);
await sleep(3800);
await finish();
