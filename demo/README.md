# Demo recordings

Scripts that render the videos in `docs/media/`. Each one starts a fake dashboard
(`app/`, which hot-reloads when a flag in `out/state.json` flips), runs the real
`sketch serve` in front of it, and drives a scripted stage (`stage.html`) in a
recorded Chromium. The stage has a mock Claude Code terminal and either a browser
window or an iPad. Sketches go through the real overlay, inbox and
`sketch wait` / `sketch done`, so the annotated screenshots in the videos are real.

```bash
npm install --prefix plugins/sketch-feedback/skills/sketch-feedback/scripts
npx --prefix plugins/sketch-feedback/skills/sketch-feedback/scripts playwright install chromium
node demo/record-desktop.mjs   # docs/media/sketch-feedback-desktop.mp4
node demo/record-ipad.mjs      # docs/media/sketch-feedback-ipad.mp4
```

Needs `ffmpeg` on the PATH. Ports 3917 (app) and 8317 (proxy) must be free.
