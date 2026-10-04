import { parseArgs } from 'node:util';

const { positionals, values } = parseArgs({
	allowPositionals: true,
	options: {
		target: { type: 'string', default: process.env.SKETCH_TARGET ?? 'http://localhost:3000' },
		port: { type: 'string', default: process.env.SKETCH_PORT ?? '8217' },
		host: { type: 'string', default: process.env.SKETCH_HOST ?? '0.0.0.0' },
		peek: { type: 'boolean', default: false },
		working: { type: 'boolean', default: false },
		help: { type: 'boolean', short: 'h', default: false },
	},
});

const USAGE = `Usage:
  sketch serve [--target http://localhost:3000] [--port 8217] [--host 0.0.0.0 | tailscale | <ip,...>]
  sketch wait [--peek]
  sketch done <id> "<message>" [--working]`;

const [command, ...rest] = positionals;

if (values.help || !command) {
	console.log(USAGE);
} else if (command === 'serve') {
	const { serve } = await import('./server.mjs');
	await serve({ target: values.target, port: Number(values.port), host: values.host });
} else if (command === 'wait') {
	const { wait } = await import('./wait.mjs');
	await wait({ peek: values.peek });
} else if (command === 'done') {
	const { done } = await import('./wait.mjs');
	await done(rest[0], rest[1], { working: values.working });
} else {
	console.error(USAGE);
	process.exit(1);
}
