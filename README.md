# Circuit Bot Arena

Minimal Robocode-style Canvas prototype.

## Run

```bash
npm install
npm run dev
```

## Play

- BUILD: place Wheel / Gun / Radar / Armor / Battery blocks around the fixed Core.
- WIRE: connect Sensor, Logic, and Action nodes in one global schematic.
- FIGHT: watch bots scan, lock, orbit, dodge, use cover, fire bullets, damage blocks, and break Cores.
- SHARE: export a `CBA1:` bot code or import a rival code as the opponent.

No server, no external image assets, no user-written code.

The default schematic uses Radar Sweep, Aim At Enemy, Gun Aligned, Fire,
Orbit, Wall Ahead, and Bullet Incoming signals so wiring changes are visible in
combat.
