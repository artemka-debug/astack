# astack

Agent skills for [Claude Code](https://claude.com/claude-code) (and any agent that
reads `SKILL.md` skills).

## Demo

Draw on your running app, Claude makes the change.

**Desktop**

[![sketch-proxy on the desktop](docs/media/sketch-proxy-desktop.gif)](docs/media/sketch-proxy-desktop.mp4)

▶ [Watch in 1080p (60s)](docs/media/sketch-proxy-desktop.mp4)

**iPad + Apple Pencil, over Tailscale**

[![sketch-proxy from an iPad](docs/media/sketch-proxy-ipad.gif)](docs/media/sketch-proxy-ipad.mp4)

▶ [Watch in 1080p (75s)](docs/media/sketch-proxy-ipad.mp4)

## Skills

| Skill | What it does |
|-------|--------------|
| [sketch-proxy](plugins/sketch-proxy/skills/sketch-proxy/SKILL.md) | Draw on your running web app (mouse, or iPad + Apple Pencil over Tailscale) and Claude makes the change |

## Install

In Claude Code:

```
/plugin marketplace add artemka-debug/astack
/plugin install sketch-proxy@astack
```

Or copy the skill folder into your skills directory:

```bash
git clone https://github.com/artemka-debug/astack
cp -r astack/plugins/sketch-proxy/skills/sketch-proxy ~/.claude/skills/
```

Needs Node.js 20.11+. The first run installs Playwright and Chromium for screenshots.

---

## sketch-proxy

Put a proxy in front of your dev server and every page gets a drawing layer. Circle
things, cross them out, draw arrows, add a note, then press **Keep working**. Claude
gets an annotated screenshot plus the DOM elements under each mark, makes the change,
and reports back in a toast on the page. Hot reload does the rest.

### On an iPad with Apple Pencil, over Tailscale

The app keeps running on your laptop and the iPad becomes the canvas:

1. Install [Tailscale](https://tailscale.com) on the laptop and the iPad and sign in to
   the same tailnet.
2. Ask Claude: *"open the app on my iPad over tailscale, I'll sketch"*. It runs

   ```bash
   sketch serve --target http://localhost:3000 --host tailscale
   ```

   which listens only on `127.0.0.1` and your Tailscale address, and prints
   `http://<your-laptop>.<tailnet>.ts.net:8217`.
3. Open that URL in Safari on the iPad. The Pencil draws, a finger scrolls, and the
   palm is ignored. Write the note by hand and Scribble turns it into text.

On the same Wi-Fi you can skip Tailscale: use the `lan` URL that `sketch serve` prints.

### How it works

```
iPad / browser ──▶ sketch proxy :8217 ──▶ your dev server :3000
                     │  injects the overlay, rewrites Host/Origin (HMR works)
                     ▼
                  .sketch/<id>/  feedback.json · annotated.png · status.json
                     ▲
     sketch wait ────┘  (background command: wakes the agent on each sketch)
     sketch done <id> "message"  →  toast on the page
```

- **`sketch serve`** proxies any local dev server (Next.js, Vite, Rails, anything that
  serves HTML) and injects the overlay into every page.
- On submit, Playwright re-renders the page at the device's viewport, scroll and theme,
  then draws the strokes on it. The result is `annotated.png`.
- **`sketch wait`** runs in the background and exits on the next sketch, which wakes
  Claude. It prints the note, the image paths, and the element under each mark.
- **`sketch done`** sends the toast back to the page: first what Claude understood,
  then what changed.

Sketches are stored in `.sketch/` in your project. The folder ignores itself in git.
See [SKILL.md](plugins/sketch-proxy/skills/sketch-proxy/SKILL.md) for all options.

### Security

By default the proxy binds `0.0.0.0`, so anyone on your network can reach your dev
app while it runs. Use `--host tailscale` (tailnet only) or `--host 127.0.0.1`
(this machine only) on networks you don't trust.

## Demo videos

The videos are recorded from a scripted stage with a fake dashboard, the real proxy
and the real overlay. The GIFs at the top are 2x-speed previews of the MP4s. See
[demo/](demo/README.md) to re-record them.

## License

MIT
