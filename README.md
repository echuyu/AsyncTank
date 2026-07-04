# Circuit Bot Arena

Minimal Robocode-style bot builder prototype.

## Run

```bash
npm install
npm run dev
```

## Play

- BUILD: assemble Wheel / Gun / Radar / Armor / Battery cards around the fixed Core.
- BRAIN: edit rule cards such as `WHEN Enemy Seen + Gun Aligned DO Fire`.
- TEST: watch bots scan, lock, orbit, dodge, use cover, fire bullets, damage blocks, and break Cores.
- SHARE: export a `CBA2:` bot code or import a rival code as the opponent.

No server, no external image assets, no user-written code.

The default Brain uses Radar Sweep, Aim At Enemy, Gun Aligned, Fire, Orbit,
Wall Ahead, and Bullet Incoming rules so behavior changes are visible in combat.
