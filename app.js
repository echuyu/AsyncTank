(function () {
  "use strict";

  const W = 480;
  const H = 320;
  const GRID_W = 11;
  const GRID_H = 7;
  const CORE_X = 5;
  const CORE_Y = 3;
  const MAX_PARTS = 10;
  const CELL = 16;
  const HALF = CELL * 0.5;
  const GROUND = 252;
  const MAX_TIME = 20;
  const DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  const MIRROR_ROT = [0, 3, 2, 1];

  const PARTS = {
    core: { icon: "0", hp: 20, mass: 4, kind: "core" },
    leg: { icon: "L", hp: 6, mass: 1, kind: "move", power: 95 },
    wheel: { icon: "O", hp: 5, mass: 0.8, kind: "move", power: 125 },
    spike: { icon: "^", hp: 5, mass: 1, kind: "hit" },
    shield: { icon: "]", hp: 14, mass: 2.4, kind: "guard" },
    hammer: { icon: "T", hp: 8, mass: 1.8, kind: "hit" },
    weight: { icon: "#", hp: 16, mass: 4, kind: "mass" },
    wing: { icon: "}", hp: 4, mass: 0.45, kind: "lift" },
    spring: { icon: "S", hp: 5, mass: 0.7, kind: "push" },
    bomb: { icon: "*", hp: 3, mass: 1.2, kind: "boom" },
    jaw: { icon: ">", hp: 7, mass: 1.3, kind: "hit" },
  };
  const TRAY = ["leg", "wheel", "spike", "shield", "hammer", "weight", "wing", "spring", "bomb", "jaw"];

  const LS = {
    player: "eggcore.player",
    defense: "eggcore.defense",
    logs: "eggcore.logs",
  };

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const el = {
    modeBadge: document.querySelector("#modeBadge"),
    tray: document.querySelector("#tray"),
    buildTab: document.querySelector("#buildTab"),
    battleTab: document.querySelector("#battleTab"),
    rotateBtn: document.querySelector("#rotateBtn"),
    eraseBtn: document.querySelector("#eraseBtn"),
    randomBtn: document.querySelector("#randomBtn"),
    saveBtn: document.querySelector("#saveBtn"),
    defenseBtn: document.querySelector("#defenseBtn"),
    testBtn: document.querySelector("#testBtn"),
    enemySelect: document.querySelector("#enemySelect"),
    replayBtn: document.querySelector("#replayBtn"),
    backBuildBtn: document.querySelector("#backBuildBtn"),
    nextBtn: document.querySelector("#nextBtn"),
    battleRow: document.querySelector(".battle-row"),
    status: document.querySelector("#status"),
    logList: document.querySelector("#logList"),
  };

  const state = {
    view: "build",
    selectedType: "leg",
    rotation: 1,
    selectedCell: { x: CORE_X + 1, y: CORE_Y },
    build: loadBuild() || defaultBuild(),
    enemies: makeEnemies(),
    enemyIndex: 0,
    logs: loadLogs(),
    battle: null,
    message: "PARTS 0/10",
    lastBattleSeed: 1,
  };

  function id() {
    return Math.random().toString(36).slice(2, 8);
  }

  function part(type, x, y, rotation) {
    return {
      id: id(),
      type,
      x,
      y,
      rotation: rotation ?? (type === "leg" || type === "wheel" ? 2 : 1),
      hp: PARTS[type].hp,
    };
  }

  function corePart() {
    return part("core", CORE_X, CORE_Y, 0);
  }

  function buildFromParts(name, parts) {
    return { name, parts: normalizeParts(parts) };
  }

  function defaultBuild() {
    return buildFromParts("Egg Bot", [
      corePart(),
      part("spike", CORE_X + 1, CORE_Y, 1),
      part("leg", CORE_X, CORE_Y + 1, 2),
      part("leg", CORE_X + 1, CORE_Y + 1, 2),
      part("shield", CORE_X, CORE_Y - 1, 0),
    ]);
  }

  function normalizeParts(parts) {
    const seen = new Set();
    const clean = [];
    for (const p of parts || []) {
      if (!PARTS[p.type]) continue;
      if (p.x < 0 || p.x >= GRID_W || p.y < 0 || p.y >= GRID_H) continue;
      const key = `${p.x},${p.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      clean.push({
        id: p.id || id(),
        type: p.type,
        x: p.x,
        y: p.y,
        rotation: clampInt(p.rotation, 0, 3),
        hp: Math.min(PARTS[p.type].hp, p.hp || PARTS[p.type].hp),
      });
    }
    if (!clean.some((p) => p.type === "core")) clean.unshift(corePart());
    const core = clean.find((p) => p.type === "core");
    core.x = CORE_X;
    core.y = CORE_Y;
    core.rotation = 0;
    core.hp = PARTS.core.hp;
    return pruneDisconnected(clean).slice(0, MAX_PARTS + 1);
  }

  function clampInt(value, min, max) {
    const n = Number.isFinite(value) ? Math.round(value) : min;
    return Math.max(min, Math.min(max, n));
  }

  function partCount(build) {
    return build.parts.filter((p) => p.type !== "core").length;
  }

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  function getPartAt(parts, x, y) {
    return parts.find((p) => p.x === x && p.y === y) || null;
  }

  function hasNeighbor(parts, x, y) {
    return DIRS.some((d) => getPartAt(parts, x + d.x, y + d.y));
  }

  function canPlace(x, y) {
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
    if (getPartAt(state.build.parts, x, y)) return false;
    if (partCount(state.build) >= MAX_PARTS) return false;
    return hasNeighbor(state.build.parts, x, y);
  }

  function placeSelected(x, y) {
    if (!canPlace(x, y)) return bump("NO LINK");
    state.build.parts.push(part(state.selectedType, x, y, state.rotation));
    state.selectedCell = { x, y };
    saveBuild();
    bump(`PARTS ${partCount(state.build)}/${MAX_PARTS}`);
  }

  function deleteCell(x, y) {
    const target = getPartAt(state.build.parts, x, y);
    if (!target || target.type === "core") return;
    state.build.parts = pruneDisconnected(state.build.parts.filter((p) => p !== target));
    saveBuild();
    bump(`PARTS ${partCount(state.build)}/${MAX_PARTS}`);
  }

  function pruneDisconnected(parts) {
    const map = new Map(parts.map((p) => [cellKey(p.x, p.y), p]));
    const keep = new Set([cellKey(CORE_X, CORE_Y)]);
    const open = [{ x: CORE_X, y: CORE_Y }];
    while (open.length) {
      const c = open.pop();
      for (const d of DIRS) {
        const nx = c.x + d.x;
        const ny = c.y + d.y;
        const key = cellKey(nx, ny);
        if (keep.has(key) || !map.has(key)) continue;
        keep.add(key);
        open.push({ x: nx, y: ny });
      }
    }
    return parts.filter((p) => keep.has(cellKey(p.x, p.y)));
  }

  function saveBuild() {
    localStorage.setItem(LS.player, JSON.stringify(state.build));
  }

  function loadBuild() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS.player) || "null");
      return raw ? buildFromParts(raw.name || "Egg Bot", raw.parts || []) : null;
    } catch {
      return null;
    }
  }

  function saveDefense() {
    localStorage.setItem(LS.defense, JSON.stringify(state.build));
    refreshEnemies();
    bump("DEF SAVED");
  }

  function loadDefense() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS.defense) || "null");
      return raw ? buildFromParts("My Defense", raw.parts || []) : null;
    } catch {
      return null;
    }
  }

  function loadLogs() {
    try {
      return JSON.parse(localStorage.getItem(LS.logs) || "[]").slice(0, 8);
    } catch {
      return [];
    }
  }

  function pushLog(log) {
    state.logs.unshift(log);
    state.logs = state.logs.slice(0, 8);
    localStorage.setItem(LS.logs, JSON.stringify(state.logs));
    renderLogs();
  }

  function makeEnemies() {
    const enemies = [
      buildFromParts("Spike Rush", [
        corePart(),
        part("spike", 6, 3, 1),
        part("leg", 5, 4, 2),
        part("leg", 6, 4, 2),
        part("weight", 4, 3, 3),
      ]),
      buildFromParts("Turtle", [
        corePart(),
        part("shield", 6, 3, 1),
        part("hammer", 5, 2, 1),
        part("weight", 5, 4, 2),
        part("leg", 4, 4, 2),
        part("shield", 6, 4, 1),
      ]),
      buildFromParts("Flyer", [
        corePart(),
        part("wing", 5, 2, 0),
        part("wing", 4, 2, 3),
        part("jaw", 6, 3, 1),
        part("leg", 5, 4, 2),
      ]),
      buildFromParts("Bomber", [
        corePart(),
        part("bomb", 6, 3, 1),
        part("shield", 5, 2, 0),
        part("leg", 4, 4, 2),
        part("shield", 6, 4, 1),
      ]),
      buildFromParts("Heavy Push", [
        corePart(),
        part("shield", 6, 3, 1),
        part("wheel", 5, 4, 2),
        part("wheel", 6, 4, 2),
        part("weight", 4, 3, 3),
        part("weight", 4, 4, 2),
      ]),
    ];
    const defense = loadDefense();
    return defense ? enemies.concat(defense) : enemies;
  }

  function refreshEnemies() {
    state.enemies = makeEnemies();
    state.enemyIndex = Math.min(state.enemyIndex, state.enemies.length - 1);
    renderEnemyOptions();
  }

  function randomBuild() {
    let parts = [corePart()];
    const bag = ["leg", "wheel", "spike", "shield", "hammer", "weight", "wing", "spring", "bomb", "jaw"];
    let tries = 0;
    while (parts.length < 8 && tries < 120) {
      tries += 1;
      const anchor = parts[Math.floor(Math.random() * parts.length)];
      const d = DIRS[Math.floor(Math.random() * DIRS.length)];
      const x = anchor.x + d.x;
      const y = anchor.y + d.y;
      if (x < 1 || x > GRID_W - 2 || y < 1 || y > GRID_H - 2) continue;
      if (getPartAt(parts, x, y)) continue;
      const type = bag[Math.floor(Math.random() * bag.length)];
      parts.push(part(type, x, y, Math.floor(Math.random() * 4)));
    }
    state.build = buildFromParts("Random Egg", parts);
    saveBuild();
    bump("RANDOM");
  }

  function renderTray() {
    el.tray.innerHTML = "";
    for (const type of TRAY) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "part-button";
      button.dataset.type = type;
      button.textContent = PARTS[type].icon;
      button.title = type.toUpperCase();
      button.addEventListener("click", () => {
        state.selectedType = type;
        renderUi();
      });
      el.tray.append(button);
    }
  }

  function renderEnemyOptions() {
    el.enemySelect.innerHTML = "";
    state.enemies.forEach((enemy, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = enemy.name;
      el.enemySelect.append(option);
    });
    el.enemySelect.value = String(state.enemyIndex);
  }

  function renderLogs() {
    el.logList.innerHTML = "";
    for (const log of state.logs.slice(0, 5)) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${log.result}</span><span>${log.enemy}</span><span>${log.hp}:${log.enemyHp}</span>`;
      el.logList.append(li);
    }
  }

  function renderUi() {
    el.modeBadge.textContent = state.view === "battle" ? "BATTLE" : "BUILD";
    el.buildTab.classList.toggle("active", state.view === "build");
    el.battleTab.classList.toggle("active", state.view === "battle");
    el.battleRow.classList.toggle("show", !!(state.battle && state.battle.result));
    el.status.textContent = state.message || `PARTS ${partCount(state.build)}/${MAX_PARTS}`;
    el.enemySelect.value = String(state.enemyIndex);
    document.querySelectorAll(".part-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.type === state.selectedType);
    });
  }

  function bump(message) {
    state.message = message;
    renderUi();
  }

  function startBattle(recordLog, replay) {
    const seed = replay ? state.lastBattleSeed : Date.now();
    state.lastBattleSeed = seed;
    const enemy = state.enemies[state.enemyIndex];
    state.battle = {
      seed,
      recordLog,
      t: 0,
      result: "",
      resultClock: 0,
      shake: 0,
      flash: 0,
      particles: [],
      player: makeBattleBot(state.build, 1, 122),
      enemy: makeBattleBot(enemy, -1, W - 122),
      enemyName: enemy.name,
    };
    state.view = "battle";
    bump("FIGHT");
  }

  function makeBattleBot(build, facing, x) {
    const runtime = build.parts.map((p) => ({
      ...p,
      hp: PARTS[p.type].hp,
      maxHp: PARTS[p.type].hp,
      alive: true,
      cool: 0,
      swing: 0,
      flash: 0,
    }));
    const bot = {
      name: build.name,
      facing,
      x,
      y: GROUND,
      vx: 0,
      vy: 0,
      angle: 0,
      av: 0,
      parts: runtime,
      mass: 1,
      dead: false,
      coreFlash: 0,
    };
    recalcBot(bot);
    bot.y = GROUND - bot.bottom;
    return bot;
  }

  function recalcBot(bot) {
    const alive = bot.parts.filter((p) => p.alive);
    bot.mass = Math.max(1, alive.reduce((sum, p) => sum + PARTS[p.type].mass, 0));
    bot.bottom = Math.max(...alive.map((p) => (p.y - CORE_Y) * CELL + HALF), HALF);
    bot.top = Math.min(...alive.map((p) => (p.y - CORE_Y) * CELL - HALF), -HALF);
    const core = alive.find((p) => p.type === "core");
    bot.dead = !core || core.hp <= 0;
  }

  function coreHp(bot) {
    const core = bot.parts.find((p) => p.type === "core");
    return core && core.alive ? Math.max(0, core.hp) : 0;
  }

  function updateBattle(dt) {
    const b = state.battle;
    if (!b) return;
    updateParticles(b, dt);
    if (b.result) {
      b.resultClock += dt;
      b.shake = Math.max(0, b.shake - dt * 24);
      return;
    }

    b.t += dt;
    updateBot(b.player, b.enemy, dt, b);
    updateBot(b.enemy, b.player, dt, b);
    collideBots(b.player, b.enemy, dt, b);
    attackBot(b.player, b.enemy, dt, b);
    attackBot(b.enemy, b.player, dt, b);
    recalcBot(b.player);
    recalcBot(b.enemy);

    if (coreHp(b.enemy) <= 0 && coreHp(b.player) <= 0) finishBattle("DRAW");
    else if (coreHp(b.enemy) <= 0 || b.enemy.x > W + 24) finishBattle("WIN");
    else if (coreHp(b.player) <= 0 || b.player.x < -24) finishBattle("LOSE");
    else if (b.t >= MAX_TIME) {
      const playerHp = coreHp(b.player);
      const enemyHp = coreHp(b.enemy);
      finishBattle(playerHp === enemyHp ? "DRAW" : playerHp > enemyHp ? "WIN" : "LOSE");
    }
  }

  function finishBattle(result) {
    const b = state.battle;
    if (!b || b.result) return;
    b.result = result;
    b.resultClock = 0;
    b.shake = 8;
    spawnBurst(W / 2, H / 2, 26, b);
    bump(result);
    if (b.recordLog) {
      pushLog({
        result,
        enemy: b.enemyName,
        hp: Math.round(coreHp(b.player)),
        enemyHp: Math.round(coreHp(b.enemy)),
        seed: b.seed,
        at: new Date().toISOString(),
      });
    }
  }

  function updateBot(bot, foe, dt, battle) {
    const alive = bot.parts.filter((p) => p.alive);
    let drive = 0;
    let lift = 0;
    let wheel = 0;
    for (const p of alive) {
      const def = PARTS[p.type];
      p.cool = Math.max(0, p.cool - dt);
      p.swing = Math.max(0, p.swing - dt);
      p.flash = Math.max(0, p.flash - dt);
      if ((p.type === "leg" || p.type === "wheel") && p.y >= CORE_Y) {
        drive += def.power;
        if (p.type === "wheel") wheel += 1;
      }
      if (p.type === "wing") lift += 18;
    }
    recalcBot(bot);
    bot.vx += (bot.facing * drive * dt) / bot.mass;
    bot.vx *= Math.pow(0.92, dt * 8);
    const cap = 42 + wheel * 8;
    bot.vx = Math.max(-cap, Math.min(cap, bot.vx));

    bot.vy += (74 - lift / bot.mass) * dt;
    bot.x += bot.vx * dt;
    bot.y += bot.vy * dt;
    if (bot.y + bot.bottom > GROUND) {
      bot.y = GROUND - bot.bottom;
      bot.vy = Math.min(0, bot.vy) * -0.05;
    }
    if (bot.y + bot.top < 38) {
      bot.y = 38 - bot.top;
      bot.vy = Math.max(0, bot.vy);
    }

    const com = centerOfMass(bot);
    bot.av += (com.x * bot.facing * 0.0009 - bot.angle * 0.9) * dt;
    bot.av *= Math.pow(0.82, dt * 8);
    bot.angle += bot.av;
    bot.angle = Math.max(-0.34, Math.min(0.34, bot.angle));
    bot.coreFlash = Math.max(0, bot.coreFlash - dt);
    battle.shake = Math.max(0, battle.shake - dt * 12);
    foe.x += 0;
  }

  function centerOfMass(bot) {
    let sx = 0;
    let sy = 0;
    let sm = 0;
    for (const p of bot.parts) {
      if (!p.alive) continue;
      const m = PARTS[p.type].mass;
      sx += (p.x - CORE_X) * m;
      sy += (p.y - CORE_Y) * m;
      sm += m;
    }
    return { x: sx / Math.max(1, sm), y: sy / Math.max(1, sm) };
  }

  function collideBots(a, b, dt, battle) {
    const ap = worldParts(a);
    const bp = worldParts(b);
    for (const pa of ap) {
      for (const pb of bp) {
        const dx = pb.wx - pa.wx;
        const dy = pb.wy - pa.wy;
        const dist = Math.hypot(dx, dy) || 0.001;
        const min = CELL * 0.88;
        if (dist >= min) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = min - dist;
        const spring = pa.p.type === "spring" || pb.p.type === "spring";
        const impulse = (overlap * (spring ? 24 : 11) * dt) / (a.mass + b.mass);
        a.vx -= nx * impulse * b.mass;
        b.vx += nx * impulse * a.mass;
        a.vy -= ny * impulse * b.mass * 0.25;
        b.vy += ny * impulse * a.mass * 0.25;
        if (spring) battle.shake = Math.max(battle.shake, 3);
        const hit = (spring ? 1.6 : 0.35) * dt;
        damagePart(a, pa.p, hit, pb.wx, pb.wy, battle);
        damagePart(b, pb.p, hit, pa.wx, pa.wy, battle);
      }
    }
  }

  function attackBot(attacker, defender, dt, battle) {
    for (const p of attacker.parts) {
      if (!p.alive) continue;
      const wp = partWorld(attacker, p);
      const dir = partDirection(attacker, p);
      if (p.type === "spike") {
        const x = wp.wx + dir.x * CELL * 0.55;
        const y = wp.wy + dir.y * CELL * 0.55;
        hitNearest(defender, x, y, CELL * 0.62, 7.5 * dt, battle);
      } else if (p.type === "jaw" && p.cool <= 0) {
        const x = wp.wx + dir.x * CELL * 0.9;
        const y = wp.wy + dir.y * CELL * 0.9;
        if (hitNearest(defender, x, y, CELL * 0.72, 2.8, battle)) {
          defender.vx += dir.x * 14;
          p.swing = 0.15;
          p.cool = 0.48;
        }
      } else if (p.type === "hammer" && p.cool <= 0) {
        const x = wp.wx + dir.x * CELL * 1.0;
        const y = wp.wy + dir.y * CELL * 1.0;
        if (hitNearest(defender, x, y, CELL * 0.82, 3.6, battle)) {
          defender.vx += dir.x * 20;
          defender.vy += dir.y * 10;
          battle.shake = Math.max(battle.shake, 2);
          p.swing = 0.25;
        }
        p.cool = 0.86;
      }
    }
  }

  function hitNearest(bot, x, y, radius, amount, battle) {
    let best = null;
    let bestD = Infinity;
    for (const p of bot.parts) {
      if (!p.alive) continue;
      const w = partWorld(bot, p);
      const d = Math.hypot(w.wx - x, w.wy - y);
      if (d < radius && d < bestD) {
        best = { p, w };
        bestD = d;
      }
    }
    if (!best) return false;
    damagePart(bot, best.p, amount, x, y, battle);
    return true;
  }

  function damagePart(bot, p, amount, sx, sy, battle) {
    if (!p.alive || amount <= 0) return;
    const wp = partWorld(bot, p);
    let final = amount;
    if (p.type === "shield") {
      const dir = partDirection(bot, p);
      const incoming = normalize({ x: sx - wp.wx, y: sy - wp.wy });
      if (dir.x * incoming.x + dir.y * incoming.y > 0.2) final *= 0.38;
    }
    if (p.type === "weight") final *= 0.72;
    p.hp -= final;
    p.flash = 0.08;
    if (p.type === "core") {
      bot.coreFlash = 0.16;
      battle.flash = 0.08;
    }
    if (p.hp <= 0) breakPart(bot, p, battle);
  }

  function breakPart(bot, p, battle) {
    if (!p.alive) return;
    p.alive = false;
    const w = partWorld(bot, p);
    spawnBurst(w.wx, w.wy, p.type === "core" ? 18 : 8, battle);
    if (p.type === "bomb") explode(w.wx, w.wy, battle);
    removeOrphans(bot, battle);
  }

  function removeOrphans(bot, battle) {
    const alive = bot.parts.filter((p) => p.alive);
    const map = new Map(alive.map((p) => [cellKey(p.x, p.y), p]));
    if (!map.has(cellKey(CORE_X, CORE_Y))) return;
    const keep = new Set([cellKey(CORE_X, CORE_Y)]);
    const open = [{ x: CORE_X, y: CORE_Y }];
    while (open.length) {
      const c = open.pop();
      for (const d of DIRS) {
        const nx = c.x + d.x;
        const ny = c.y + d.y;
        const key = cellKey(nx, ny);
        if (keep.has(key) || !map.has(key)) continue;
        keep.add(key);
        open.push({ x: nx, y: ny });
      }
    }
    for (const p of alive) {
      if (keep.has(cellKey(p.x, p.y))) continue;
      p.alive = false;
      const w = partWorld(bot, p);
      spawnBurst(w.wx, w.wy, 5, battle);
    }
  }

  function explode(x, y, battle) {
    battle.shake = Math.max(battle.shake, 10);
    battle.particles.push({ kind: "ring", x, y, r: 4, life: 0.28, max: 0.28 });
    for (const bot of [battle.player, battle.enemy]) {
      for (const p of bot.parts) {
        if (!p.alive) continue;
        const w = partWorld(bot, p);
        const d = Math.hypot(w.wx - x, w.wy - y);
        if (d < CELL * 2.2) damagePart(bot, p, Math.max(0.8, 5.5 * (1 - d / (CELL * 2.2))), x, y, battle);
      }
    }
  }

  function spawnBurst(x, y, count, battle) {
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const s = 18 + Math.random() * 42;
      battle.particles.push({
        kind: "dot",
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 18,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
      });
    }
  }

  function updateParticles(battle, dt) {
    for (const p of battle.particles) {
      p.life -= dt;
      if (p.kind === "dot") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 90 * dt;
      } else {
        p.r += 96 * dt;
      }
    }
    battle.particles = battle.particles.filter((p) => p.life > 0);
  }

  function worldParts(bot) {
    return bot.parts.filter((p) => p.alive).map((p) => ({ p, ...partWorld(bot, p) }));
  }

  function partWorld(bot, p) {
    const lx = (p.x - CORE_X) * CELL * bot.facing;
    const ly = (p.y - CORE_Y) * CELL;
    const c = Math.cos(bot.angle);
    const s = Math.sin(bot.angle);
    return {
      wx: bot.x + lx * c - ly * s,
      wy: bot.y + lx * s + ly * c,
    };
  }

  function partDirection(bot, p) {
    const rot = bot.facing === 1 ? p.rotation : MIRROR_ROT[p.rotation];
    const d = DIRS[rot];
    const c = Math.cos(bot.angle);
    const s = Math.sin(bot.angle);
    return normalize({ x: d.x * c - d.y * s, y: d.x * s + d.y * c });
  }

  function normalize(v) {
    const l = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / l, y: v.y / l };
  }

  function draw() {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(0, 0, W, H);
    if (state.view === "battle" && state.battle) drawBattle();
    else drawBuild();
    ctx.restore();
  }

  function drawBuild() {
    const cell = buildCellSize();
    const gx = Math.floor((W - GRID_W * cell) / 2);
    const gy = 62;
    ctx.fillStyle = "#171717";
    drawText("BUILD", 16, 20, 16);
    drawText(`${partCount(state.build)}/${MAX_PARTS}`, W - 72, 20, 16);
    drawRotArrow(W - 38, 42, state.rotation, 10);

    for (let y = 0; y < GRID_H; y += 1) {
      for (let x = 0; x < GRID_W; x += 1) {
        const px = gx + x * cell;
        const py = gy + y * cell;
        ctx.strokeStyle = "#171717";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, cell, cell);
        if (canPlace(x, y)) {
          ctx.fillStyle = "#dedede";
          ctx.fillRect(px + 11, py + 11, 3, 3);
        }
      }
    }

    for (const p of state.build.parts) {
      const x = gx + p.x * cell + cell / 2;
      const y = gy + p.y * cell + cell / 2;
      drawPart(p.type, x, y, 19, p.rotation, 0, p.type === "core" ? 1 : 0);
    }

    if (state.selectedCell) {
      const sx = gx + state.selectedCell.x * cell;
      const sy = gy + state.selectedCell.y * cell;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#171717";
      ctx.strokeRect(sx + 3, sy + 3, cell - 6, cell - 6);
    }

    const ghost = state.selectedCell && !getPartAt(state.build.parts, state.selectedCell.x, state.selectedCell.y);
    if (ghost) {
      const x = gx + state.selectedCell.x * cell + cell / 2;
      const y = gy + state.selectedCell.y * cell + cell / 2;
      ctx.globalAlpha = canPlace(state.selectedCell.x, state.selectedCell.y) ? 0.55 : 0.22;
      drawPart(state.selectedType, x, y, 18, state.rotation, 0, 0);
      ctx.globalAlpha = 1;
    }

    drawText(PARTS[state.selectedType].icon, 18, H - 42, 28);
    drawText(state.selectedType.toUpperCase(), 52, H - 34, 12);
    drawText("R", W - 44, H - 34, 14);
  }

  function drawBattle() {
    const b = state.battle;
    const shake = b.shake > 0 ? (Math.random() - 0.5) * b.shake : 0;
    ctx.save();
    ctx.translate(Math.round(shake), Math.round(-shake * 0.45));
    ctx.fillStyle = "#171717";
    ctx.fillRect(0, GROUND + 1, W, 4);
    for (let x = 0; x < W; x += 28) {
      ctx.fillRect(x, GROUND + 12 + ((x / 28) % 2) * 2, 12, 3);
    }
    drawHp(18, 16, coreHp(b.player), 20, false);
    drawHp(W - 138, 16, coreHp(b.enemy), 20, true);
    drawText(String(Math.max(0, MAX_TIME - b.t).toFixed(1)), W / 2 - 18, 28, 14);
    drawBattleBot(b.player);
    drawBattleBot(b.enemy);
    drawParticles(b);
    ctx.restore();

    if (b.result) {
      ctx.fillStyle = "#171717";
      drawText(b.result, W / 2 - b.result.length * 18, H / 2 - 16, 36);
    }
  }

  function drawHp(x, y, hp, max, reverse) {
    ctx.strokeStyle = "#171717";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 120, 11);
    const w = Math.max(0, Math.min(1, hp / max)) * 116;
    ctx.fillStyle = "#171717";
    if (reverse) ctx.fillRect(x + 118 - w, y + 2, w, 7);
    else ctx.fillRect(x + 2, y + 2, w, 7);
  }

  function drawBattleBot(bot) {
    const list = bot.parts.filter((p) => p.alive).sort((a, b) => a.y - b.y);
    for (const p of list) {
      const w = partWorld(bot, p);
      const rot = bot.facing === 1 ? p.rotation : MIRROR_ROT[p.rotation];
      const flash = p.flash || (p.type === "core" ? bot.coreFlash : 0);
      drawPart(p.type, w.wx, w.wy, CELL * 0.9, rot, bot.angle + (p.swing || 0) * bot.facing * 8, flash);
      if (p.hp < p.maxHp && p.type !== "core") {
        ctx.fillStyle = "#171717";
        ctx.fillRect(w.wx - 7, w.wy + 10, Math.max(1, (p.hp / p.maxHp) * 14), 2);
      }
    }
  }

  function drawParticles(battle) {
    ctx.fillStyle = "#171717";
    ctx.strokeStyle = "#171717";
    for (const p of battle.particles) {
      if (p.kind === "dot") ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
      else {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawPart(type, x, y, size, rotation, angle, flash) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate((rotation * Math.PI) / 2 + angle);
    const s = size;
    ctx.lineWidth = Math.max(2, Math.floor(s / 8));
    ctx.strokeStyle = "#171717";
    ctx.fillStyle = flash ? "#171717" : "#f8f8f8";
    if (type === "core") {
      ctx.beginPath();
      ctx.ellipse(0, 1, s * 0.34, s * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = flash ? "#f8f8f8" : "#171717";
      ctx.fillRect(-2, -s * 0.18, 4, 4);
    } else if (type === "leg") {
      ctx.fillStyle = "#171717";
      ctx.fillRect(-3, -7, 6, 12);
      ctx.fillRect(-4, 4, 13, 4);
      ctx.fillRect(3, 8, 5, 3);
    } else if (type === "wheel") {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#171717";
      ctx.fillRect(-2, -s * 0.38, 4, s * 0.76);
      ctx.fillRect(-s * 0.38, -2, s * 0.76, 4);
    } else if (type === "spike") {
      ctx.beginPath();
      ctx.moveTo(s * 0.45, 0);
      ctx.lineTo(-s * 0.28, -s * 0.32);
      ctx.lineTo(-s * 0.2, s * 0.32);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "#171717";
      ctx.fillRect(-s * 0.1, -2, s * 0.18, 4);
    } else if (type === "shield") {
      ctx.fillStyle = flash ? "#171717" : "#f8f8f8";
      ctx.fillRect(-s * 0.34, -s * 0.38, s * 0.6, s * 0.76);
      ctx.strokeRect(-s * 0.34, -s * 0.38, s * 0.6, s * 0.76);
      ctx.fillStyle = "#171717";
      ctx.fillRect(s * 0.2, -s * 0.38, 3, s * 0.76);
    } else if (type === "hammer") {
      ctx.fillStyle = "#171717";
      ctx.fillRect(-s * 0.34, -2, s * 0.62, 4);
      ctx.fillRect(s * 0.18, -s * 0.28, s * 0.26, s * 0.56);
    } else if (type === "weight") {
      ctx.fillStyle = "#171717";
      ctx.beginPath();
      ctx.moveTo(-s * 0.36, s * 0.24);
      ctx.lineTo(-s * 0.22, -s * 0.32);
      ctx.lineTo(s * 0.28, -s * 0.34);
      ctx.lineTo(s * 0.4, s * 0.2);
      ctx.closePath();
      ctx.fill();
    } else if (type === "wing") {
      ctx.beginPath();
      ctx.moveTo(-s * 0.36, s * 0.25);
      ctx.quadraticCurveTo(s * 0.1, -s * 0.45, s * 0.42, -s * 0.14);
      ctx.quadraticCurveTo(s * 0.18, s * 0.18, -s * 0.36, s * 0.25);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, s * 0.12);
      ctx.lineTo(s * 0.18, -s * 0.16);
      ctx.moveTo(s * 0.05, s * 0.08);
      ctx.lineTo(s * 0.3, -s * 0.08);
      ctx.stroke();
    } else if (type === "spring") {
      ctx.beginPath();
      ctx.moveTo(-s * 0.34, -s * 0.2);
      ctx.lineTo(-s * 0.18, s * 0.22);
      ctx.lineTo(0, -s * 0.22);
      ctx.lineTo(s * 0.18, s * 0.22);
      ctx.lineTo(s * 0.34, -s * 0.2);
      ctx.stroke();
    } else if (type === "bomb") {
      ctx.beginPath();
      ctx.ellipse(0, 1, s * 0.34, s * 0.43, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, -s * 0.3);
      ctx.lineTo(s * 0.08, -s * 0.12);
      ctx.lineTo(-s * 0.02, s * 0.04);
      ctx.lineTo(s * 0.14, s * 0.22);
      ctx.stroke();
    } else if (type === "jaw") {
      ctx.beginPath();
      ctx.moveTo(-s * 0.36, -s * 0.28);
      ctx.lineTo(s * 0.38, -s * 0.1);
      ctx.lineTo(-s * 0.36, s * 0.02);
      ctx.moveTo(-s * 0.36, s * 0.1);
      ctx.lineTo(s * 0.38, s * 0.24);
      ctx.lineTo(-s * 0.36, s * 0.34);
      ctx.stroke();
      ctx.fillStyle = "#171717";
      for (let i = 0; i < 3; i += 1) ctx.fillRect(s * (0.03 + i * 0.12), -2, 3, 6);
    }
    ctx.restore();
  }

  function drawRotArrow(x, y, rot, len) {
    const d = DIRS[rot];
    ctx.strokeStyle = "#171717";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - d.x * len, y - d.y * len);
    ctx.lineTo(x + d.x * len, y + d.y * len);
    ctx.stroke();
    ctx.fillStyle = "#171717";
    ctx.fillRect(x + d.x * len - 3, y + d.y * len - 3, 6, 6);
  }

  function drawText(text, x, y, size) {
    ctx.save();
    ctx.font = `${size}px "Courier New", monospace`;
    ctx.textBaseline = "top";
    ctx.fillStyle = "#171717";
    ctx.fillText(text, Math.round(x), Math.round(y));
    ctx.restore();
  }

  function canvasCellFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;
    const cell = buildCellSize();
    const gx = Math.floor((W - GRID_W * cell) / 2);
    const gy = 62;
    return {
      x: Math.floor((x - gx) / cell),
      y: Math.floor((y - gy) / cell),
    };
  }

  function buildCellSize() {
    return window.innerWidth <= 520 ? 17 : 25;
  }

  function bindEvents() {
    canvas.addEventListener("click", (event) => {
      if (state.view !== "build") return;
      const c = canvasCellFromEvent(event);
      if (c.x < 0 || c.y < 0 || c.x >= GRID_W || c.y >= GRID_H) return;
      state.selectedCell = c;
      const existing = getPartAt(state.build.parts, c.x, c.y);
      if (!existing) placeSelected(c.x, c.y);
      else bump(existing.type.toUpperCase());
      renderUi();
    });

    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (state.view !== "build") return;
      const c = canvasCellFromEvent(event);
      deleteCell(c.x, c.y);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "r") rotateSelected();
      if (event.key === "Backspace" || event.key === "Delete") {
        if (state.selectedCell) deleteCell(state.selectedCell.x, state.selectedCell.y);
      }
    });

    el.rotateBtn.addEventListener("click", rotateSelected);
    el.eraseBtn.addEventListener("click", () => state.selectedCell && deleteCell(state.selectedCell.x, state.selectedCell.y));
    el.randomBtn.addEventListener("click", randomBuild);
    el.saveBtn.addEventListener("click", () => {
      saveBuild();
      bump("SAVED");
    });
    el.defenseBtn.addEventListener("click", saveDefense);
    el.testBtn.addEventListener("click", () => startBattle(true, false));
    el.battleTab.addEventListener("click", () => startBattle(true, false));
    el.buildTab.addEventListener("click", () => {
      state.view = "build";
      bump(`PARTS ${partCount(state.build)}/${MAX_PARTS}`);
    });
    el.replayBtn.addEventListener("click", () => startBattle(false, true));
    el.backBuildBtn.addEventListener("click", () => {
      state.view = "build";
      bump(`PARTS ${partCount(state.build)}/${MAX_PARTS}`);
    });
    el.nextBtn.addEventListener("click", () => {
      state.enemyIndex = (state.enemyIndex + 1) % state.enemies.length;
      renderEnemyOptions();
      startBattle(true, false);
    });
    el.enemySelect.addEventListener("change", () => {
      state.enemyIndex = Number(el.enemySelect.value) || 0;
      bump(state.enemies[state.enemyIndex].name.toUpperCase());
    });
  }

  function rotateSelected() {
    if (state.view !== "build") return;
    const selectedPart = state.selectedCell && getPartAt(state.build.parts, state.selectedCell.x, state.selectedCell.y);
    if (selectedPart && selectedPart.type !== "core") {
      selectedPart.rotation = (selectedPart.rotation + 1) % 4;
      saveBuild();
      bump("ROT");
    } else {
      state.rotation = (state.rotation + 1) % 4;
      bump("ROT");
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.04, (now - last) / 1000 || 0);
    last = now;
    if (state.view === "battle") updateBattle(dt);
    draw();
    window.EggCoreDebug = {
      view: state.view,
      parts: partCount(state.build),
      enemy: state.enemies[state.enemyIndex].name,
      result: state.battle && state.battle.result,
      core: state.battle && [coreHp(state.battle.player), coreHp(state.battle.enemy)],
    };
    requestAnimationFrame(frame);
  }

  renderTray();
  refreshEnemies();
  renderLogs();
  bindEvents();
  bump(`PARTS ${partCount(state.build)}/${MAX_PARTS}`);
  requestAnimationFrame(frame);
})();
