# Circuit Bot Arena

Minimal Robocode-style bot builder prototype.

## Run

```bash
npm install
npm run dev
```

## Play

- BUILD: snap colorful Wheel / Gun / Radar / Armor / Battery parts onto the fixed Core.
- PROGRAM: pan and zoom a Simulink-style node graph, then connect ports with wires.
- TEST: watch bots scan, lock, orbit, dodge, use cover, fire bullets, damage blocks, and break Cores.
- SHARE: export a `CBA3:` bot code or import a rival code as the opponent.

No server, no external image assets, no user-written code.

The default Program wires Radar Sweep, Aim At Enemy, Gun Aligned, Fire, Orbit,
Wall Ahead, and Bullet Incoming nodes so behavior changes are visible in combat.
