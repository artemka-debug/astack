---
name: sketch-feedback
description: >-
  Iterate on a local web app by drawing on it: proxy the dev server, open it in a
  browser, on an iPad or phone (same Wi-Fi or over Tailscale), mark up the page with
  Apple Pencil, mouse or finger, and send each sketch (marks, note, annotated
  screenshot, the DOM elements under each mark) to the agent, which applies the
  change and reports back on the page. Use when the user wants to review UI by
  sketching on it, says "let me draw on it", "open it on my iPad", or asks to keep
  iterating from their marks.
---

# Sketch feedback

`scripts/sketch serve` puts a proxy in front of any local dev server and adds a
drawing overlay to every HTML page. Each sketch lands in an inbox; `sketch wait`
hands the next one to the agent and `sketch done` shows the result as a toast on
the page.

All commands below run `scripts/sketch` from this skill's directory. Run them from
the project root: the inbox is `.sketch/` in the current directory (it ignores
itself in git).

## Start

```bash
pnpm dev                                          # the app, e.g. on :3000
<skill-dir>/scripts/sketch serve --target http://localhost:3000
```

The proxy prints the URLs it can be reached on:

```
sketch → http://localhost:3000/
  local     http://localhost:8217
  lan       http://192.168.1.23:8217
  tailscale http://100.101.12.34:8217
  tailscale http://my-laptop.tail1234.ts.net:8217
inbox /path/to/project/.sketch
```

Give the user the URL that fits their device:

- **Same machine**: `localhost`.
- **iPad or phone on the same Wi-Fi**: the `lan` address.
- **iPad or phone anywhere, via Tailscale**: the `tailscale` name or address. Both
  devices must be signed in to the same tailnet. `--host tailscale` binds only to
  `127.0.0.1` and the Tailscale address, so the app is not exposed on the local
  network (use it on shared Wi-Fi).

By default the proxy binds `0.0.0.0`, which makes the dev app reachable by everyone
on that network while it runs. `--host 127.0.0.1` keeps it on this machine.

The first run installs Playwright and Chromium into `scripts/node_modules`;
screenshots need them, drawing and notes do not.

## Drawing on the page

- Tap ✏️ (bottom right) to open the toolbar.
- Pencil, pen or mouse draws; a finger scrolls. Palm touches and iPadOS Scribble are
  ignored on the drawing layer.
- Red and blue pens, a yellow highlighter, undo and clear.
- The note field takes typed text or Scribble handwriting.
- **Keep working** asks for an incremental change; **Regenerate** asks to rethink the
  marked part.
- A toast tracks the sketch: sent → working → done, with the agent's message.
  Code changes reach the page through the app's own hot reload.

## Agent loop

Run the waiter as a background command; it exits on the next sketch, which wakes
the agent:

```bash
<skill-dir>/scripts/sketch wait          # blocks, claims the oldest pending sketch, prints it
<skill-dir>/scripts/sketch wait --peek   # list pending sketches without claiming
```

Output:

```
SKETCH 20260102T113912-5c56 (keep-working) on /orders?range=7d
note: status should be coloured pills
dir: /path/to/project/.sketch/20260102T113912-5c56
image: …/annotated.png
image: …/page.png
mark 0 #ef4444: {"path":"table > tbody > tr > td","text":"Shipped","heading":"Recent orders"}
```

For each sketch:

1. Read `annotated.png` (the page re-rendered at the device's viewport with the marks
   on it) and the `mark` lines (DOM path, text and nearest heading under each stroke).
   `feedback.json` holds raw strokes, viewport, scroll and theme.
2. `sketch done <id> "Reading as: …" --working` to tell the user what you understood.
3. Make the change and check that it renders.
4. `sketch done <id> "<what changed>"`.
5. Start `sketch wait` again in the background.

When there is no note, state the interpretation in the toast and the reply; crossed-out
text usually means remove, an arrow means move, a drawn box with options means a
control.

## Options

| Flag / env | Default | Purpose |
|------------|---------|---------|
| `--target` / `SKETCH_TARGET` | `http://localhost:3000` | Dev server to proxy |
| `--port` / `SKETCH_PORT` | `8217` | Proxy port |
| `--host` / `SKETCH_HOST` | `0.0.0.0` | Bind address: `0.0.0.0`, `tailscale`, or a comma-separated list of IPs |
| `SKETCH_INBOX` | `./.sketch` | Where sketches are stored |

The proxy rewrites `Host`, `Origin` and `Referer` to the target, including the HMR
websocket, so Next.js dev servers work from another device without
`allowedDevOrigins`. The page screenshot sets `localStorage.theme` and the colour
scheme to match the device, which covers `next-themes` and similar setups.
