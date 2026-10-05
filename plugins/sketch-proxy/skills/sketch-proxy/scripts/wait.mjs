import fs from 'node:fs/promises';
import path from 'node:path';

import { INBOX, ids, readStatus, writeStatus } from './inbox.mjs';

const pending = async () => {
	const out = [];
	for (const id of await ids()) if ((await readStatus(id)).state === 'pending') out.push(id);
	return out;
};

const describe = async id => {
	const dir = path.join(INBOX, id);
	const fb = JSON.parse(await fs.readFile(path.join(dir, 'feedback.json'), 'utf8'));
	const lines = [`SKETCH ${id} (${fb.intent}) on ${fb.path}`, `note: ${fb.note || '(none)'}`, `dir: ${dir}`];
	for (const file of ['annotated.png', 'page.png']) {
		if (await fs.stat(path.join(dir, file)).catch(() => null)) lines.push(`image: ${path.join(dir, file)}`);
	}
	for (const t of fb.targets ?? []) lines.push(`mark ${t.stroke} ${t.color}: ${JSON.stringify(t.element)}`);
	return lines.join('\n');
};

export async function wait({ peek = false } = {}) {
	for (;;) {
		const list = await pending();
		if (peek) {
			console.log(list.length ? list.join('\n') : 'no pending sketches');
			return;
		}
		if (list.length) {
			const [id] = list;
			await writeStatus(id, { state: 'picked', message: 'Reading your marks…' });
			console.log(await describe(id));
			if (list.length > 1) console.log(`(${list.length - 1} more pending)`);
			return;
		}
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
}

export async function done(id, message, { working = false } = {}) {
	if (!id) throw new Error('usage: sketch done <id> "<message>" [--working]');
	await writeStatus(id, { state: working ? 'picked' : 'done', message: message ?? '' });
}
