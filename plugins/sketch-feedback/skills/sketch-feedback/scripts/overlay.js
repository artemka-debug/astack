(() => {
	if (window.__sketchOverlay) return;
	window.__sketchOverlay = true;

	const PREFIX = '/__sketch';
	const LAST = 'sketch:last';
	const COLORS = [
		{ name: 'red', value: '#ef4444', tool: 'pen' },
		{ name: 'blue', value: '#3b82f6', tool: 'pen' },
		{ name: 'mark', value: '#facc15', tool: 'highlighter' },
	];

	const host = document.createElement('sketch-overlay');
	const root = host.attachShadow({ mode: 'open' });
	root.innerHTML = `
<style>
	:host { all: initial; }
	* { box-sizing: border-box; font-family: -apple-system, system-ui, sans-serif; }
	canvas { position: fixed; inset: 0; z-index: 2147483646; touch-action: none; display: none;
		-webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
	.on canvas { display: block; }
	.fab { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 52px; height: 52px;
		border-radius: 26px; border: 0; background: #111; color: #d9f99d; font-size: 24px;
		box-shadow: 0 6px 20px rgb(0 0 0 / .25); }
	.on .fab { display: none; }
	.bar { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 2147483647;
		display: none; gap: 8px; align-items: flex-end; padding: 10px; border-radius: 18px;
		background: rgb(17 17 17 / .92); color: #fafafa; box-shadow: 0 10px 30px rgb(0 0 0 / .3);
		width: min(760px, calc(100vw - 24px)); }
	.on .bar { display: flex; }
	.tools { display: flex; gap: 6px; }
	button { border: 0; border-radius: 12px; height: 44px; min-width: 44px; padding: 0 12px; font-size: 15px;
		background: #2a2a2a; color: inherit; }
	button.swatch { width: 44px; padding: 0; }
	button.swatch[aria-pressed="true"] { outline: 3px solid #fafafa; outline-offset: -3px; }
	button.primary { background: #d9f99d; color: #111; font-weight: 600; }
	textarea { flex: 1; min-width: 0; height: 44px; max-height: 160px; resize: none; border: 0;
		border-radius: 12px; padding: 11px 12px; font-size: 15px; background: #2a2a2a; color: inherit; }
	textarea:focus { height: 120px; outline: none; }
	.toast { position: fixed; left: 16px; bottom: 16px; z-index: 2147483647; max-width: min(420px, calc(100vw - 100px));
		padding: 12px 14px; border-radius: 14px; background: #111; color: #fafafa; font-size: 14px; line-height: 1.35;
		box-shadow: 0 6px 20px rgb(0 0 0 / .25); display: none; }
	.toast.show { display: block; }
	.on .toast { display: none; }
	.toast b { color: #d9f99d; }
</style>
<canvas></canvas>
<button class="fab" title="Sketch">✏️</button>
<div class="toast"></div>
<div class="bar">
	<div class="tools">
		${COLORS.map((c, i) => `<button class="swatch" data-i="${i}" aria-pressed="${i === 0}" style="background:${c.value}" title="${c.name}"></button>`).join('')}
		<button data-act="undo" title="Undo">↶</button>
		<button data-act="clear" title="Clear">✕</button>
	</div>
	<textarea placeholder="Note for Claude (optional — Scribble works here)"></textarea>
	<div class="tools">
		<button data-act="close" title="Hide toolbar, keep marks">Hide</button>
		<button data-act="send" data-intent="regenerate" title="Rethink the marked parts">Regenerate</button>
		<button class="primary" data-act="send" data-intent="keep-working">Keep working</button>
	</div>
</div>`;

	const wrap = document.createElement('div');
	while (root.childNodes.length > 1) wrap.appendChild(root.childNodes[1]);
	root.appendChild(wrap);
	const $ = s => root.querySelector(s);
	const canvas = $('canvas');
	const ctx = canvas.getContext('2d');
	const note = $('textarea');
	const toast = $('.toast');

	let strokes = [];
	let current = null;
	let color = COLORS[0];
	let penSeen = false;
	let penDown = false;
	let penUpAt = 0;
	let lastTouch = null;

	const lock = document.createElement('style');
	lock.textContent = `html.sketching, html.sketching * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }`;
	document.head.appendChild(lock);

	const isPalm = e => penDown || Date.now() - penUpAt < 600 || e.width > 40 || e.height > 40;

	const resize = () => {
		const dpr = window.devicePixelRatio || 1;
		canvas.width = innerWidth * dpr;
		canvas.height = innerHeight * dpr;
		canvas.style.width = `${innerWidth}px`;
		canvas.style.height = `${innerHeight}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		draw();
	};

	const drawStroke = s => {
		ctx.globalAlpha = s.tool === 'highlighter' ? 0.35 : 1;
		ctx.strokeStyle = s.color;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		const pts = s.points;
		for (let i = 1; i < pts.length; i++) {
			const [x0, y0] = pts[i - 1];
			const [x1, y1, p] = pts[i];
			ctx.lineWidth = s.tool === 'highlighter' ? s.width : Math.max(1.5, s.width * (0.5 + (p ?? 0.5)));
			ctx.beginPath();
			ctx.moveTo(x0 - scrollX, y0 - scrollY);
			ctx.lineTo(x1 - scrollX, y1 - scrollY);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	};

	const draw = () => {
		ctx.clearRect(0, 0, innerWidth, innerHeight);
		strokes.forEach(drawStroke);
		if (current) drawStroke(current);
	};

	const point = e => [e.clientX + scrollX, e.clientY + scrollY, e.pressure || 0.5];

	// iPadOS Scribble turns Pencil strokes into text selection and cancels them unless touch events are cancelled.
	for (const type of ['touchstart', 'touchmove', 'touchend']) {
		canvas.addEventListener(type, e => e.cancelable && e.preventDefault(), { passive: false });
	}
	canvas.addEventListener('contextmenu', e => e.preventDefault());

	canvas.addEventListener('pointerdown', e => {
		if (e.pointerType === 'pen') {
			penSeen = true;
			penDown = true;
			lastTouch = null;
		}
		if (e.pointerType === 'touch') {
			lastTouch = penSeen && isPalm(e) ? null : { id: e.pointerId, x: e.clientX, y: e.clientY };
			return;
		}
		canvas.setPointerCapture(e.pointerId);
		current = { color: color.value, tool: color.tool, width: color.tool === 'highlighter' ? 18 : 3, points: [point(e)] };
	});
	canvas.addEventListener('pointermove', e => {
		if (e.pointerType === 'touch') {
			if (!lastTouch || lastTouch.id !== e.pointerId || (penSeen && isPalm(e))) return;
			scrollBy(lastTouch.x - e.clientX, lastTouch.y - e.clientY);
			lastTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
			return;
		}
		if (!current) return;
		const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
		for (const ev of events) current.points.push(point(ev));
		draw();
	});
	const end = e => {
		if (e.pointerType === 'pen') {
			penDown = false;
			penUpAt = Date.now();
		}
		if (e.pointerType === 'touch') {
			lastTouch = null;
			return;
		}
		if (current && current.points.length > 1) strokes.push(current);
		current = null;
		draw();
	};
	canvas.addEventListener('pointerup', end);
	canvas.addEventListener('pointercancel', end);
	addEventListener('scroll', draw, { passive: true });
	addEventListener('resize', resize);

	const setOn = on => {
		wrap.classList.toggle('on', on);
		document.documentElement.classList.toggle('sketching', on);
		if (on) getSelection()?.removeAllRanges();
		if (on) resize();
	};

	const describe = el => {
		const parts = [];
		for (let n = el; n && n !== document.body && parts.length < 4; n = n.parentElement) {
			const slot = n.getAttribute('data-slot');
			const cls = [...n.classList].slice(0, 3).join('.');
			parts.unshift(n.tagName.toLowerCase() + (n.id ? `#${n.id}` : '') + (slot ? `[data-slot=${slot}]` : cls ? `.${cls}` : ''));
		}
		let heading = null;
		for (let n = el; n && !heading; n = n.parentElement) {
			const h = n.querySelector?.('h1,h2,h3,[data-slot=card-title]');
			if (h) heading = h.textContent.trim().slice(0, 80);
		}
		return { path: parts.join(' > '), text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160), heading };
	};

	const targets = () => {
		canvas.style.display = 'none';
		const out = strokes.map((s, i) => {
			const xs = s.points.map(p => p[0]);
			const ys = s.points.map(p => p[1]);
			const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
			const cx = box.x + box.width / 2 - scrollX;
			const cy = box.y + box.height / 2 - scrollY;
			const visible = cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight;
			const el = visible ? document.elementFromPoint(cx, cy) : null;
			return { stroke: i, color: s.color, tool: s.tool, box, element: el && !host.contains(el) ? describe(el) : null };
		});
		canvas.style.display = '';
		return out;
	};

	const show = html => {
		toast.innerHTML = html;
		toast.classList.add('show');
	};

	const escape = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

	const LABELS = {
		rendering: 'Sent — capturing the page…',
		pending: 'Sent — waiting for Claude to pick it up',
		picked: 'Claude is working on it…',
		done: 'Done',
	};

	let pollTimer = null;
	const poll = async id => {
		clearTimeout(pollTimer);
		try {
			const status = await (await fetch(`${PREFIX}/status/${id}`, { cache: 'no-store' })).json();
			if (status.state === 'missing') return localStorage.removeItem(LAST);
			show(`<b>${LABELS[status.state] ?? status.state}</b>${status.message ? `<br>${escape(status.message)}` : ''}`);
			if (status.state === 'done') {
				localStorage.removeItem(LAST);
				pollTimer = setTimeout(() => toast.classList.remove('show'), 12000);
				return;
			}
		} catch {}
		pollTimer = setTimeout(() => poll(id), 3000);
	};

	const send = async intent => {
		if (!strokes.length && !note.value.trim()) return show('<b>Draw or write something first</b>');
		const body = {
			intent,
			note: note.value.trim(),
			path: location.pathname + location.search + location.hash,
			title: document.title,
			theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
			viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1 },
			scroll: { x: scrollX, y: scrollY },
			doc: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
			strokes,
			targets: targets(),
			penUsed: penSeen,
			userAgent: navigator.userAgent,
		};
		const res = await fetch(`${PREFIX}/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
		const { id } = await res.json();
		localStorage.setItem(LAST, id);
		strokes = [];
		note.value = '';
		setOn(false);
		draw();
		poll(id);
	};

	root.addEventListener('click', e => {
		const btn = e.target.closest('button');
		if (!btn) return;
		if (btn.classList.contains('fab')) return setOn(true);
		if (btn.classList.contains('swatch')) {
			color = COLORS[Number(btn.dataset.i)];
			root.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
			return;
		}
		const act = btn.dataset.act;
		if (act === 'undo') strokes.pop(), draw();
		if (act === 'clear') (strokes = []), draw();
		if (act === 'close') setOn(false);
		if (act === 'send') send(btn.dataset.intent).catch(err => show(`<b>Send failed</b><br>${escape(String(err))}`));
	});

	const mount = () => {
		document.documentElement.appendChild(host);
		const last = localStorage.getItem(LAST);
		if (last) poll(last);
	};
	if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount);
	else mount();
})();
