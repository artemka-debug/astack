import fs from 'node:fs/promises';
import path from 'node:path';

export const INBOX = path.resolve(process.env.SKETCH_INBOX ?? '.sketch');

export const ensureInbox = async () => {
	await fs.mkdir(INBOX, { recursive: true });
	await fs.writeFile(path.join(INBOX, '.gitignore'), '*\n', { flag: 'wx' }).catch(() => {});
};

export const readStatus = async id =>
	JSON.parse(await fs.readFile(path.join(INBOX, id, 'status.json'), 'utf8').catch(() => '{}'));

export const writeStatus = (id, status) =>
	fs.writeFile(
		path.join(INBOX, id, 'status.json'),
		JSON.stringify({ ...status, updatedAt: new Date().toISOString() }, null, 2)
	);

export const ids = async () => (await fs.readdir(INBOX).catch(() => [])).filter(n => !n.startsWith('.')).sort();
