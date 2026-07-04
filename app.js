(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const INK = "#111";
  const PAPER = "#f8f8f8";
  const PALE = "#ddd";
  const GRID_W = 11;
  const GRID_H = 7;
  const CORE_X = 5;
  const CORE_Y = 3;
  const MAX_PARTS = 8;
  const MAX_FIGHT = 15;
  const DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  const MIRROR_ROT = [0, 3, 2, 1];

  const PARTS = {
    core: { hp: 24, mass: 5 },
    leg: { hp: 7, mass: 1.1, drive: 230 },
    wheel: { hp: 5, mass: 0.75, drive: 310 },
    spike: { hp: 6, mass: 1.2 },
    shield: { hp: 17, mass: 2.8 },
    hammer: { hp: 9, mass: 2.1 },
    weight: { hp: 18, mass: 4.4 },
    wing: { hp: 5, mass: 0.45, lift: 24 },
    spring: { hp: 6, mass: 0.9 },
    bomb: { hp: 4, mass: 1.35 },
    jaw: { hp: 8, mass: 1.4 },
  };

  const TRAY = ["leg", "wheel", "spike", "shield", "hammer", "weight", "bomb"];
  const LS = {
    build: "eggcore.toy.build",
    defense: "eggcore.toy.defense",
    logs: "eggcore.toy.logs",
  };

  const state = {
    w: 390,
    h: 760,
    dpr: 1,
    mode: "garage",
    selectedType: "leg",
    selectedRot: 2,
    selectedPartId: null,
    hoverCell: null,
    pointer: null,
    build: loadBuild() || defaultBuild(),
    enemies: [],
    enemyIndex: 0,
    battle: null,
    hits: [],
    toast: "",
    toastT: 0,
    logs: loadLogs(),
  };
  state.enemies = makeEnemies();

  function uid() {
    return Math.random().toString(36).slice(2, 9);
  }

  function placed(type, x, y, rotation = 1) {
    return { id: uid(), type, x, y, rotation, hp: PARTS[type].hp };
  }

  function core() {
    return placed("core", CORE_X, CORE_Y, 0);
  }

  function defaultBuild() {
    return normalizeBuild({
      name: "Egg",
      parts: [
        core(),
        placed("spike", CORE_X + 1, CORE_Y, 1),
        placed("shield", CORE_X, CORE_Y - 1, 0),
        placed("leg", CORE_X, CORE_Y + 1, 2),
        placed("leg", CORE_X + 1, CORE_Y + 1, 2),
      ],
    });
  }

  function normalizeBuild(build) {
    const seen = new Set();
    const parts = [];
    for (const raw of build.parts || []) {
      if (!PARTS[raw.type] || (raw.type !== "core" && !TRAY.includes(raw.type))) continue;
      const x = clamp(Math.round(raw.x), 0, GRID_W - 1);
      const y = clamp(Math.round(raw.y), 0, GRID_H - 1);
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parts.push({
        id: raw.id || uid(),
        type: raw.type,
        x,
        y,
        rotation: clamp(Math.round(raw.rotation || 0), 0, 3),
        hp: PARTS[raw.type].hp,
      });
    }
    let c = parts.find((p) => p.type === "core");
    if (!c) {
      c = core();
      parts.unshift(c);
    }
    c.x = CORE_X;
    c.y = CORE_Y;
    c.rotation = 0;
    c.hp = PARTS.core.hp;
    return {
      name: build.name || "Egg",
      parts: pruneDisconnected(parts).slice(0, MAX_PARTS + 1),
    };
  }

  function makeEnemies() {
    const enemies = [
      normalizeBuild({
        name: "Spike Rush",
        parts: [
          core(),
          placed("spike", 6, 3, 1),
          placed("spike", 7, 3, 1),
          placed("leg", 5, 4, 2),
          placed("leg", 6, 4, 2),
          placed("weight", 4, 3, 3),
        ],
      }),
      normalizeBuild({
        name: "Turtle",
        parts: [
          core(),
          placed("shield", 6, 3, 1),
          placed("hammer", 6, 2, 1),
          placed("weight", 5, 4, 2),
          placed("leg", 4, 4, 2),
        ],
      }),
      normalizeBuild({
        name: "Bomber",
        parts: [
          core(),
          placed("bomb", 6, 3, 1),
          placed("weight", 4, 3, 3),
          placed("leg", 4, 4, 2),
          placed("leg", 5, 4, 2),
        ],
      }),
      normalizeBuild({
        name: "Heavy Push",
        parts: [
          core(),
          placed("shield", 6, 3, 1),
          placed("weight", 4, 3, 3),
          placed("weight", 4, 4, 2),
          placed("weight", 5, 4, 2),
          placed("wheel", 6, 4, 2),
        ],
      }),
      normalizeBuild({
        name: "Hammer Head",
        parts: [
          core(),
          placed("shield", 6, 3, 1),
          placed("hammer", 6, 2, 1),
          placed("leg", 5, 4, 2),
          placed("leg", 6, 4, 2),
          placed("weight", 4, 3, 3),
        ],
      }),
    ];
    return enemies;
  }

  function partCount(build = state.build) {
    return build.parts.filter((p) => p.type !== "core").length;
  }

  function getAt(parts, x, y) {
    return parts.find((p) => p.x === x && p.y === y) || null;
  }

  function hasNeighbor(parts, x, y) {
    return DIRS.some((d) => getAt(parts, x + d.x, y + d.y));
  }

  function canPlace(x, y) {
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
    if (getAt(state.build.parts, x, y)) return false;
    if (partCount() >= MAX_PARTS) return false;
    return hasNeighbor(state.build.parts, x, y);
  }

  function placePart(x, y) {
    if (!canPlace(x, y)) {
      blip("...");
      return;
    }
    const p = placed(state.selectedType, x, y, state.selectedRot);
    state.build.parts.push(p);
    state.selectedPartId = p.id;
    state.hoverCell = null;
    saveBuild();
    blip("");
  }

  function deleteSelected() {
    if (!state.selectedPartId) return;
    const target = state.build.parts.find((p) => p.id === state.selectedPartId);
    if (!target || target.type === "core") return;
    state.build.parts = pruneDisconnected(state.build.parts.filter((p) => p.id !== state.selectedPartId));
    state.selectedPartId = null;
    saveBuild();
  }

  function rotateSelected() {
    const target = state.build.parts.find((p) => p.id === state.selectedPartId);
    if (target && target.type !== "core") {
      target.rotation = (target.rotation + 1) % 4;
      state.selectedRot = target.rotation;
      saveBuild();
    } else {
      state.selectedRot = (state.selectedRot + 1) % 4;
    }
  }

  function pruneDisconnected(parts) {
    const map = new Map(parts.map((p) => [`${p.x},${p.y}`, p]));
    const root = `${CORE_X},${CORE_Y}`;
    if (!map.has(root)) return [core()];
    const keep = new Set([root]);
    const open = [{ x: CORE_X, y: CORE_Y }];
    while (open.length) {
      const c = open.pop();
      for (const d of DIRS) {
        const nx = c.x + d.x;
        const ny = c.y + d.y;
        const key = `${nx},${ny}`;
        if (!map.has(key) || keep.has(key)) continue;
        keep.add(key);
        open.push({ x: nx, y: ny });
      }
    }
    return parts.filter((p) => keep.has(`${p.x},${p.y}`));
  }

  function randomBuild() {
    const parts = [core()];
    let guard = 0;
    while (parts.length < MAX_PARTS + 1 && guard < 180) {
      guard += 1;
      const anchor = parts[Math.floor(Math.random() * parts.length)];
      const d = DIRS[Math.floor(Math.random() * DIRS.length)];
      const x = anchor.x + d.x;
      const y = anchor.y + d.y;
      if (x < 1 || x > GRID_W - 2 || y < 1 || y > GRID_H - 2 || getAt(parts, x, y)) continue;
      const type = TRAY[Math.floor(Math.random() * TRAY.length)];
      parts.push(placed(type, x, y, Math.floor(Math.random() * 4)));
    }
    state.build = normalizeBuild({ name: "Egg", parts });
    state.selectedPartId = null;
    saveBuild();
  }

  function saveBuild() {
    try {
      localStorage.setItem(LS.build, JSON.stringify(state.build));
    } catch {}
  }

  function loadBuild() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS.build) || "null");
      return raw ? normalizeBuild(raw) : null;
    } catch {
      return null;
    }
  }

  function saveDefense() {
    try {
      localStorage.setItem(LS.defense, JSON.stringify(state.build));
      state.enemies = makeEnemies();
      blip("DEF");
    } catch {}
  }

  function loadDefense() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS.defense) || "null");
      return raw ? normalizeBuild(raw) : null;
    } catch {
      return null;
    }
  }

  function loadLogs() {
    try {
      return JSON.parse(localStorage.getItem(LS.logs) || "[]").slice(0, 10);
    } catch {
      return [];
    }
  }

  function pushLog(result) {
    const b = state.battle;
    const row = {
      result,
      enemy: b.enemyName,
      hp: Math.round(coreHp(b.player)),
      foe: Math.round(coreHp(b.enemy)),
      t: Date.now(),
    };
    state.logs.unshift(row);
    state.logs = state.logs.slice(0, 10);
    try {
      localStorage.setItem(LS.logs, JSON.stringify(state.logs));
    } catch {}
  }

  function blip(text) {
    state.toast = text;
    state.toastT = text ? 0.8 : 0;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.w = Math.max(320, Math.min(390, Math.round(rect.width || window.innerWidth)));
    state.h = Math.max(560, Math.round(rect.height || window.innerHeight));
    state.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(state.w * state.dpr);
    canvas.height = Math.round(state.h * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rectHit(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function addHit(kind, x, y, w, h, data = {}) {
    state.hits.push({ kind, x, y, w, h, ...data });
  }

  function hitAt(x, y, kind = "") {
    return state.hits.slice().reverse().find((h) => (!kind || h.kind === kind) && rectHit(h, x, y));
  }

  function pointerPos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * state.w,
      y: ((event.clientY - rect.top) / rect.height) * state.h,
    };
  }

  function onPointerMove(event) {
    event.preventDefault();
    const p = pointerPos(event);
    state.pointer = p;
    const socket = state.mode === "garage" ? hitAt(p.x, p.y, "socket") : null;
    state.hoverCell = socket ? { x: socket.gx, y: socket.gy } : null;
  }

  function onPointerDown(event) {
    event.preventDefault();
    const p = pointerPos(event);
    state.pointer = p;
    const hit = hitAt(p.x, p.y);
    if (hit) {
      handleHit(hit);
      return;
    }
  }

  function handleHit(hit) {
    if (hit.kind === "tray") {
      state.selectedType = hit.type;
      state.selectedRot = defaultRotation(hit.type);
      state.selectedPartId = null;
    } else if (hit.kind === "socket") {
      state.hoverCell = { x: hit.gx, y: hit.gy };
      placePart(hit.gx, hit.gy);
    } else if (hit.kind === "part") {
      const existing = state.build.parts.find((p) => p.id === hit.id);
      if (existing) {
        state.selectedPartId = existing.id;
        if (existing.type !== "core") state.selectedType = existing.type;
        state.selectedRot = existing.rotation;
      }
    } else if (hit.kind === "rotate") {
      rotateSelected();
    } else if (hit.kind === "delete") {
      deleteSelected();
    } else if (hit.kind === "random") {
      randomBuild();
    } else if (hit.kind === "fight") {
      startFight(false);
    } else if (hit.kind === "save") {
      saveBuild();
      blip("SAVE");
    } else if (hit.kind === "def") {
      saveDefense();
    } else if (hit.kind === "retry") {
      startFight(true);
    } else if (hit.kind === "garage") {
      state.mode = "garage";
      state.battle = null;
    } else if (hit.kind === "next") {
      state.enemyIndex = (state.enemyIndex + 1) % state.enemies.length;
      startFight(false);
    }
  }

  function defaultRotation(type) {
    if (type === "leg" || type === "wheel" || type === "weight") return 2;
    if (type === "wing") return 0;
    return 1;
  }

  function layoutGarage() {
    const w = Math.min(state.w, Math.round(window.innerWidth || state.w));
    const h = Math.min(state.h, Math.round(window.innerHeight || state.h));
    const pad = Math.max(14, Math.floor(w * 0.04));
    const trayGap = 8;
    const traySize = Math.floor(Math.min(64, (w - pad * 2 - trayGap * 3) / 4));
    const trayH = traySize * 2 + trayGap;
    const actionH = Math.max(46, Math.min(54, traySize * 0.82));
    const trayY = h - pad - trayH;
    const actionY = trayY - 12 - actionH;
    const botTop = 62;
    const botBottom = actionY - 18;
    const botH = Math.max(250, botBottom - botTop);
    const e = buildExtents(state.build.parts);
    const cellsW = Math.max(3.2, e.maxX - e.minX + 1.15);
    const cellsH = Math.max(3.4, e.maxY - e.minY + 1.25);
    const gap = Math.floor(Math.min(70, Math.max(48, Math.min((w - pad * 2 - 22) / cellsW, (botH - 24) / cellsH))));
    const bot = botLayout(state.build, w / 2, botTop + botH * 0.48, gap);
    return {
      pad,
      trayGap,
      traySize,
      trayY,
      trayH,
      actionY,
      actionH,
      botTop,
      botBottom,
      gap,
      partSize: Math.round(gap * 0.96),
      bot,
    };
  }

  function cellFromPoint(x, y) {
    const hit = hitAt(x, y, "socket");
    return hit ? { x: hit.gx, y: hit.gy } : null;
  }

  function buildExtents(parts) {
    const live = parts.length ? parts : [core()];
    return {
      minX: Math.min(...live.map((p) => p.x)),
      maxX: Math.max(...live.map((p) => p.x)),
      minY: Math.min(...live.map((p) => p.y)),
      maxY: Math.max(...live.map((p) => p.y)),
    };
  }

  function botLayout(build, centerX, centerY, gap) {
    const e = buildExtents(build.parts);
    const minX = (e.minX - CORE_X) * gap;
    const maxX = (e.maxX - CORE_X) * gap;
    const minY = (e.minY - CORE_Y) * gap;
    const maxY = (e.maxY - CORE_Y) * gap;
    const ox = Math.round(centerX - (minX + maxX) / 2);
    const oy = Math.round(centerY - (minY + maxY) / 2);
    return { ox, oy, gap };
  }

  function garagePoint(l, gx, gy) {
    return {
      x: l.bot.ox + (gx - CORE_X) * l.gap,
      y: l.bot.oy + (gy - CORE_Y) * l.gap,
    };
  }

  function startFight(replay) {
    const enemy = state.enemies[state.enemyIndex];
    state.mode = "fight";
    const cell = clamp(Math.floor(state.w / 7.8), 46, 54);
    state.battle = {
      t: 0,
      intro: replay ? 0.35 : 0.9,
      result: "",
      pending: "",
      pendingT: 0,
      record: !replay,
      cell,
      shake: 0,
      flash: 0,
      particles: [],
      player: makeBattleBot(state.build, 1, -cell * 2.1, cell),
      enemy: makeBattleBot(enemy, -1, state.w + cell * 2.1, cell),
      enemyName: enemy.name,
    };
  }

  function makeBattleBot(build, facing, x, cell) {
    const parts = build.parts.map((p) => ({
      ...p,
      hp: PARTS[p.type].hp,
      maxHp: PARTS[p.type].hp,
      alive: true,
      cool: Math.random() * 0.25,
      swing: 0,
      bite: 0,
      flash: 0,
    }));
    const bot = {
      facing,
      x,
      y: state.h * 0.58,
      vx: 0,
      vy: 0,
      angle: 0,
      av: 0,
      mass: 1,
      bottom: cell * 0.5,
      top: -cell * 0.5,
      groundOffset: facing === 1 ? -10 : 10,
      parts,
      coreFlash: 0,
      dead: false,
    };
    recalcBot(bot, cell);
    bot.y = fightGround() + bot.groundOffset - bot.bottom;
    return bot;
  }

  function fightGround() {
    return Math.round(state.h * 0.72);
  }

  function recalcBot(bot, cell) {
    const alive = bot.parts.filter((p) => p.alive);
    bot.mass = Math.max(1, alive.reduce((sum, p) => sum + PARTS[p.type].mass, 0));
    bot.bottom = alive.length ? Math.max(...alive.map((p) => (p.y - CORE_Y) * cell + cell * 0.48)) : cell * 0.5;
    bot.top = alive.length ? Math.min(...alive.map((p) => (p.y - CORE_Y) * cell - cell * 0.48)) : -cell * 0.5;
    const c = alive.find((p) => p.type === "core");
    bot.dead = !c || c.hp <= 0;
  }

  function coreHp(bot) {
    const c = bot.parts.find((p) => p.type === "core");
    return c && c.alive ? Math.max(0, c.hp) : 0;
  }

  function updateBattle(dt) {
    const b = state.battle;
    if (!b) return;
    updateParticles(b, dt);
    b.shake = Math.max(0, b.shake - dt * 22);
    b.flash = Math.max(0, b.flash - dt);
    if (b.result) return;
    if (b.pending) {
      b.pendingT -= dt;
      if (b.pendingT <= 0) {
        b.result = b.pending;
        b.pending = "";
        if (b.record) pushLog(b.result);
      }
      return;
    }

    const simDt = dt;
    b.t += simDt;
    b.intro = Math.max(0, b.intro - simDt);
    updateBot(b.player, b.enemy, simDt, b);
    updateBot(b.enemy, b.player, simDt, b);
    collideBots(b.player, b.enemy, simDt, b);
    separateBots(b.player, b.enemy, b);
    attackBot(b.player, b.enemy, simDt, b);
    attackBot(b.enemy, b.player, simDt, b);
    crashPressure(b.player, b.enemy, simDt, b);
    crashPressure(b.enemy, b.player, simDt, b);
    recalcBot(b.player, b.cell);
    recalcBot(b.enemy, b.cell);

    if (coreHp(b.player) <= 0 && coreHp(b.enemy) <= 0) endFight("DRAW");
    else if (coreHp(b.enemy) <= 0) endFight("WIN");
    else if (coreHp(b.player) <= 0) endFight("LOSE");
    else if (b.t >= MAX_FIGHT) {
      const p = coreHp(b.player);
      const e = coreHp(b.enemy);
      const result = p === e ? (liveMass(b.player) >= liveMass(b.enemy) ? "WIN" : "LOSE") : p > e ? "WIN" : "LOSE";
      breakDecisionCore(result, b);
      endFight(result);
    }
  }

  function breakDecisionCore(result, battle) {
    const bot = result === "WIN" ? battle.enemy : result === "LOSE" ? battle.player : null;
    if (!bot) return;
    const c = bot.parts.find((p) => p.type === "core" && p.alive);
    if (c) damagePart(bot, c, c.hp + 1, bot.x, bot.y, battle, "finish");
  }

  function endFight(result) {
    const b = state.battle;
    if (!b || b.result) return;
    b.result = result;
    b.pending = "";
    if (b.record) pushLog(b.result);
    b.shake = 14;
    b.flash = 0.12;
    burst(state.w / 2, state.h * 0.42, 34, b, 1.8);
  }

  function updateBot(bot, foe, dt, b) {
    let drive = 0;
    let lift = 0;
    let wheel = 0;
    for (const p of bot.parts) {
      if (!p.alive) continue;
      p.cool = Math.max(0, p.cool - dt);
      p.swing = Math.max(0, p.swing - dt);
      p.bite = Math.max(0, p.bite - dt);
      p.flash = Math.max(0, p.flash - dt);
      if ((p.type === "leg" || p.type === "wheel") && p.y >= CORE_Y) {
        drive += PARTS[p.type].drive;
        if (p.type === "wheel") wheel += 1;
      }
      if (p.type === "wing") lift += PARTS.wing.lift;
    }
    const introPush = b.intro > 0 ? 1.85 : 1;
    bot.vx += (bot.facing * drive * introPush * dt) / Math.max(1, bot.mass * 0.38);
    bot.vx *= Math.pow(0.9, dt * 8);
    const cap = 210 + wheel * 26;
    bot.vx = clamp(bot.vx, -cap, cap);

    bot.vy += (105 - lift / Math.max(1, bot.mass * 0.22)) * dt;
    bot.x += bot.vx * dt;
    bot.y += bot.vy * dt;
    const ground = fightGround() + bot.groundOffset;
    if (bot.y + bot.bottom > ground) {
      bot.y = ground - bot.bottom;
      bot.vy *= -0.08;
    }

    const com = centerOfMass(bot);
    bot.av += (com.x * bot.facing * 0.0018 - bot.angle * 1.3) * dt;
    bot.av *= Math.pow(0.78, dt * 8);
    bot.angle = clamp(bot.angle + bot.av, -0.32, 0.32);
    bot.coreFlash = Math.max(0, bot.coreFlash - dt);
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
    const ap = worldParts(a, battle.cell);
    const bp = worldParts(b, battle.cell);
    for (const pa of ap) {
      for (const pb of bp) {
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const min = battle.cell * 0.98;
        if (d > min) continue;
        const nx = dx / d;
        const ny = dy / d;
        const spring = pa.part.type === "spring" || pb.part.type === "spring";
        const push = (min - d) * (spring ? 44 : 25);
        a.vx -= (nx * push * dt * b.mass) / (a.mass + b.mass);
        b.vx += (nx * push * dt * a.mass) / (a.mass + b.mass);
        a.vy -= ny * push * dt * 0.3;
        b.vy += ny * push * dt * 0.3;
        if (spring) {
          battle.shake = Math.max(battle.shake, 7);
          shock((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, battle);
        }
        if (Math.abs(a.vx - b.vx) > 70) battle.shake = Math.max(battle.shake, 4);
        const scrape = (spring ? 1.2 : 0.28) * dt;
        damagePart(a, pa.part, scrape, pb.x, pb.y, battle);
        damagePart(b, pb.part, scrape, pa.x, pa.y, battle);
      }
    }
  }

  function separateBots(a, b, battle) {
    const dx = b.x - a.x;
    const desired = battle.cell * 2.25;
    const adx = Math.abs(dx) || 0.001;
    if (adx >= desired) return;
    const dir = dx >= 0 ? 1 : -1;
    const push = (desired - adx) * 0.54;
    a.x -= dir * push * (b.mass / (a.mass + b.mass));
    b.x += dir * push * (a.mass / (a.mass + b.mass));
    a.vx *= 0.34;
    b.vx *= 0.34;
    battle.shake = Math.max(battle.shake, 3 + (desired - adx) * 0.04);
    if (Math.random() < 0.18) spark((a.x + b.x) / 2, (a.y + b.y) / 2 - battle.cell * 0.2, battle, 2);
  }

  function attackBot(attacker, defender, dt, battle) {
    for (const p of attacker.parts) {
      if (!p.alive) continue;
      const pos = partWorld(attacker, p, battle.cell);
      const dir = partDirection(attacker, p);
      if (p.type === "spike") {
        const hx = pos.x + dir.x * battle.cell * 0.74;
        const hy = pos.y + dir.y * battle.cell * 0.74;
        if (hitNearest(defender, hx, hy, battle.cell * 0.58, 8.0 * dt, battle, "spike")) {
          spark(hx, hy, battle, 3);
        }
      } else if (p.type === "hammer" && p.cool <= 0) {
        const hx = pos.x + dir.x * battle.cell * 1.05;
        const hy = pos.y + dir.y * battle.cell * 1.05;
        p.swing = 0.32;
        if (hitNearest(defender, hx, hy, battle.cell * 0.92, 4.8, battle, "hammer")) {
          defender.vx += dir.x * 42;
          defender.vy += dir.y * 14;
          battle.shake = Math.max(battle.shake, 7);
          shock(hx, hy, battle);
        }
        p.cool = 0.82;
      } else if (p.type === "jaw" && p.cool <= 0) {
        const hx = pos.x + dir.x * battle.cell * 0.86;
        const hy = pos.y + dir.y * battle.cell * 0.86;
        if (hitNearest(defender, hx, hy, battle.cell * 0.76, 3.6, battle, "jaw")) {
          defender.vx += dir.x * 26;
          p.bite = 0.18;
          spark(hx, hy, battle, 5);
        }
        p.cool = 0.5;
      }
    }
  }

  function crashPressure(attacker, defender, dt, battle) {
    const dx = Math.abs(attacker.x - defender.x);
    const reach = battle.cell * 3.25;
    if (dx > reach) return;
    const power = botPower(attacker);
    const squeeze = 1 - dx / reach;
    const amount = (0.82 + power * 0.014) * squeeze * dt;
    const target = nearestLivePart(defender, attacker.x, attacker.y, battle.cell);
    if (!target) return;
    damagePart(defender, target.part, amount, attacker.x, attacker.y, battle, "crash");
    if (Math.random() < squeeze * 0.35) spark(target.x, target.y, battle, 2);
  }

  function botPower(bot) {
    let power = Math.abs(bot.vx) * 0.35 + bot.mass * 0.18;
    for (const p of bot.parts) {
      if (!p.alive) continue;
      if (p.type === "spike") power += 28;
      else if (p.type === "hammer") power += 22;
      else if (p.type === "jaw") power += 18;
      else if (p.type === "weight") power += 10;
      else if (p.type === "wheel") power += 8;
      else if (p.type === "leg") power += 6;
    }
    return power;
  }

  function liveMass(bot) {
    return bot.parts.reduce((sum, p) => (p.alive ? sum + PARTS[p.type].mass : sum), 0);
  }

  function nearestLivePart(bot, x, y, cell) {
    let best = null;
    let bestD = Infinity;
    for (const p of bot.parts) {
      if (!p.alive) continue;
      const w = partWorld(bot, p, cell);
      const d = Math.hypot(w.x - x, w.y - y) + (p.type === "core" ? cell * 0.55 : 0);
      if (d < bestD) {
        best = { part: p, x: w.x, y: w.y };
        bestD = d;
      }
    }
    return best;
  }

  function hitNearest(bot, x, y, radius, amount, battle, tag) {
    let best = null;
    let bestD = Infinity;
    for (const p of bot.parts) {
      if (!p.alive) continue;
      const w = partWorld(bot, p, battle.cell);
      const d = Math.hypot(w.x - x, w.y - y);
      if (d < radius && d < bestD) {
        best = { part: p, x: w.x, y: w.y };
        bestD = d;
      }
    }
    if (!best) return false;
    damagePart(bot, best.part, amount, x, y, battle, tag);
    return true;
  }

  function damagePart(bot, part, amount, sx, sy, battle, tag = "") {
    if (!part.alive || amount <= 0) return;
    const w = partWorld(bot, part, battle.cell);
    let dmg = amount;
    if (part.type === "shield") {
      const face = partDirection(bot, part);
      const incoming = norm({ x: sx - w.x, y: sy - w.y });
      if (face.x * incoming.x + face.y * incoming.y > 0.05) {
        dmg *= 0.32;
        if (tag) shieldClang(w.x, w.y, battle);
      }
    }
    if (part.type === "weight") dmg *= 0.7;
    part.hp -= dmg;
    part.flash = 0.12;
    if (part.type === "core") {
      bot.coreFlash = 0.25;
      battle.flash = 0.08;
    }
    if (part.hp <= 0) breakPart(bot, part, battle);
  }

  function breakPart(bot, part, battle) {
    if (!part.alive) return;
    part.alive = false;
    const w = partWorld(bot, part, battle.cell);
    burst(w.x, w.y, part.type === "core" ? 26 : 12, battle, part.type === "core" ? 1.6 : 1);
    if (part.type === "bomb") explode(w.x, w.y, battle);
    removeOrphans(bot, battle);
  }

  function removeOrphans(bot, battle) {
    const live = bot.parts.filter((p) => p.alive);
    const map = new Map(live.map((p) => [`${p.x},${p.y}`, p]));
    const root = `${CORE_X},${CORE_Y}`;
    if (!map.has(root)) {
      for (const p of live) {
        p.alive = false;
        const w = partWorld(bot, p, battle.cell);
        burst(w.x, w.y, 8, battle, 0.9);
      }
      return;
    }
    const keep = new Set([root]);
    const open = [{ x: CORE_X, y: CORE_Y }];
    while (open.length) {
      const c = open.pop();
      for (const d of DIRS) {
        const nx = c.x + d.x;
        const ny = c.y + d.y;
        const key = `${nx},${ny}`;
        if (!map.has(key) || keep.has(key)) continue;
        keep.add(key);
        open.push({ x: nx, y: ny });
      }
    }
    for (const p of live) {
      if (keep.has(`${p.x},${p.y}`)) continue;
      p.alive = false;
      const w = partWorld(bot, p, battle.cell);
      burst(w.x, w.y, 7, battle, 0.8);
    }
  }

  function explode(x, y, battle) {
    battle.shake = Math.max(battle.shake, 18);
    battle.flash = 0.16;
    battle.particles.push({ kind: "boom", x, y, r: 8, life: 0.42, max: 0.42 });
    for (const bot of [battle.player, battle.enemy]) {
      for (const p of bot.parts) {
        if (!p.alive) continue;
        const w = partWorld(bot, p, battle.cell);
        const d = Math.hypot(w.x - x, w.y - y);
        if (d < battle.cell * 2.5) {
          damagePart(bot, p, 7.2 * (1 - d / (battle.cell * 2.5)) + 1.2, x, y, battle, "bomb");
        }
      }
    }
  }

  function worldParts(bot, cell) {
    return bot.parts.filter((p) => p.alive).map((p) => ({ part: p, ...partWorld(bot, p, cell) }));
  }

  function partWorld(bot, p, cell) {
    const lx = (p.x - CORE_X) * cell * bot.facing;
    const ly = (p.y - CORE_Y) * cell;
    const c = Math.cos(bot.angle);
    const s = Math.sin(bot.angle);
    return { x: bot.x + lx * c - ly * s, y: bot.y + lx * s + ly * c };
  }

  function partDirection(bot, p) {
    const rot = bot.facing === 1 ? p.rotation : MIRROR_ROT[p.rotation];
    const d = DIRS[rot];
    const c = Math.cos(bot.angle);
    const s = Math.sin(bot.angle);
    return norm({ x: d.x * c - d.y * s, y: d.x * s + d.y * c });
  }

  function norm(v) {
    const l = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / l, y: v.y / l };
  }

  function burst(x, y, count, battle, scale = 1) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = (30 + Math.random() * 90) * scale;
      battle.particles.push({
        kind: "dot",
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        life: 0.28 + Math.random() * 0.42,
      });
    }
  }

  function spark(x, y, battle, count) {
    for (let i = 0; i < count; i += 1) {
      battle.particles.push({
        kind: "spark",
        x,
        y,
        vx: (Math.random() - 0.5) * 130,
        vy: (Math.random() - 0.65) * 120,
        life: 0.16 + Math.random() * 0.15,
      });
    }
  }

  function shock(x, y, battle) {
    battle.particles.push({ kind: "shock", x, y, r: 4, life: 0.22, max: 0.22 });
  }

  function shieldClang(x, y, battle) {
    battle.particles.push({ kind: "clang", x, y, r: 5, life: 0.2, max: 0.2 });
  }

  function updateParticles(battle, dt) {
    for (const p of battle.particles) {
      p.life -= dt;
      if (p.kind === "dot" || p.kind === "spark") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 150 * dt;
      } else {
        p.r += (p.kind === "boom" ? 190 : 115) * dt;
      }
    }
    battle.particles = battle.particles.filter((p) => p.life > 0);
  }

  function draw() {
    state.hits = [];
    ctx.clearRect(0, 0, state.w, state.h);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, state.w, state.h);
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    if (state.mode === "fight" && state.battle) drawFight();
    else drawGarage();
    if (state.toastT > 0 && state.toast) {
      ctx.fillStyle = INK;
      text(state.toast, state.w / 2, 28, 16, "center");
    }
  }

  function drawGarage() {
    const l = layoutGarage();
    canvas.dataset.cell = String(l.gap);
    canvas.dataset.screen = `${state.w}x${state.h}`;
    canvas.dataset.inner = `${window.innerWidth}x${window.innerHeight}`;
    canvas.dataset.mode = state.mode;
    canvas.dataset.parts = String(partCount());
    text("GARAGE", l.pad, 18, 20, "left");
    drawPartDots(state.w - l.pad - 86, 22);
    drawGarageBot(l);
    drawGarageSockets(l);
    drawActionBar(l);
    drawTray(l);
  }

  function drawPartDots(x, y) {
    for (let i = 0; i < MAX_PARTS; i += 1) {
      ctx.fillStyle = i < partCount() ? INK : PALE;
      ctx.fillRect(x + i * 10, y, 6, 6);
    }
  }

  function socketCells() {
    const cells = [];
    const seen = new Set();
    for (const p of state.build.parts) {
      for (const d of DIRS) {
        const gx = p.x + d.x;
        const gy = p.y + d.y;
        const key = `${gx},${gy}`;
        if (seen.has(key) || !canPlace(gx, gy)) continue;
        seen.add(key);
        cells.push({ x: gx, y: gy });
      }
    }
    return cells;
  }

  function drawGarageSockets(l) {
    ctx.save();
    const cells = socketCells();
    for (const c of cells) {
      const p = garagePoint(l, c.x, c.y);
      const hover = state.hoverCell && state.hoverCell.x === c.x && state.hoverCell.y === c.y;
      const r = hover ? 13 : 10;
      ctx.strokeStyle = INK;
      ctx.fillStyle = hover ? INK : PAPER;
      ctx.lineWidth = hover ? 4 : 3;
      ctx.setLineDash(hover ? [] : [2, 5]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      if (hover) {
        ctx.save();
        ctx.globalAlpha = 0.34;
        const near = nearestGarageNeighbor(c.x, c.y);
        if (near) {
          const n = garagePoint(l, near.x, near.y);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 9;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        drawPart(state.selectedType, p.x, p.y, l.partSize * 1.05, state.selectedRot, { mode: "garage" });
        ctx.restore();
      }
      addHit("socket", p.x - 22, p.y - 22, 44, 44, { gx: c.x, gy: c.y });
    }
    ctx.restore();
  }

  function drawGarageBot(l) {
    drawGarageConnections(l);
    for (const p of state.build.parts) {
      const g = garagePoint(l, p.x, p.y);
      const selected = p.id === state.selectedPartId;
      if (selected) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(g.x - l.gap * 0.47, g.y - l.gap * 0.47, l.gap * 0.94, l.gap * 0.94);
        ctx.setLineDash([]);
      }
      drawPart(p.type, g.x, g.y, p.type === "core" ? l.gap * 1.32 : l.partSize, p.rotation, {
        mode: "garage",
        flash: 0,
      });
      addHit("part", g.x - l.gap * 0.48, g.y - l.gap * 0.48, l.gap * 0.96, l.gap * 0.96, { id: p.id });
    }
  }

  function nearestGarageNeighbor(gx, gy) {
    for (const d of DIRS) {
      const p = getAt(state.build.parts, gx + d.x, gy + d.y);
      if (p) return p;
    }
    return null;
  }

  function drawGarageConnections(l) {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(8, Math.round(l.gap * 0.15));
    ctx.lineCap = "square";
    for (const p of state.build.parts) {
      for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
        const q = getAt(state.build.parts, p.x + d.x, p.y + d.y);
        if (!q) continue;
        const a = garagePoint(l, p.x, p.y);
        const b = garagePoint(l, q.x, q.y);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = PAPER;
        ctx.fillRect((a.x + b.x) / 2 - 4, (a.y + b.y) / 2 - 4, 8, 8);
      }
    }
    ctx.restore();
  }

  function drawActionBar(l) {
    const gap = 8;
    const count = 4;
    const bw = Math.floor((state.w - l.pad * 2 - gap * (count - 1)) / count);
    const y = l.actionY;
    const actions = ["rotate", "delete", "random", "fight"];
    for (let i = 0; i < actions.length; i += 1) {
      const x = l.pad + i * (bw + gap);
      drawPanelButton(x, y, bw, l.actionH, actions[i]);
      addHit(actions[i], x, y, bw, l.actionH);
    }
  }

  function drawPanelButton(x, y, w, h, kind) {
    ctx.fillStyle = kind === "fight" ? INK : PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    const label = kind === "rotate" ? "ROTATE" : kind === "delete" ? "DELETE" : kind === "random" ? "RANDOM" : "FIGHT";
    text(label, x + w / 2, y + h / 2 + 1, kind === "random" ? 13 : 14, "center", kind === "fight" ? PAPER : INK);
  }

  function drawTray(l) {
    for (let i = 0; i < TRAY.length; i += 1) {
      const type = TRAY[i];
      const row = i < 4 ? 0 : 1;
      const col = i < 4 ? i : i - 4;
      const cols = row === 0 ? 4 : 3;
      const rowW = cols * l.traySize + (cols - 1) * l.trayGap;
      const x = Math.round((state.w - rowW) / 2 + col * (l.traySize + l.trayGap));
      const y = l.trayY + row * (l.traySize + l.trayGap);
      const active = state.selectedType === type && !state.selectedPartId;
      ctx.fillStyle = active ? INK : PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.fillRect(x, y, l.traySize, l.traySize);
      ctx.strokeRect(x, y, l.traySize, l.traySize);
      drawPart(type, x + l.traySize / 2, y + l.traySize / 2, l.traySize * 0.78, defaultRotation(type), {
        inverse: active,
        mode: "tray",
      });
      addHit("tray", x, y, l.traySize, l.traySize, { type });
    }
  }

  function drawTinyButton(label, x, y, w, h, kind) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(label, x + w / 2, y + h / 2 + 1, 11, "center");
    addHit(kind, x, y, w, h);
  }

  function drawFight() {
    const b = state.battle;
    const sx = b.shake ? (Math.random() - 0.5) * b.shake : 0;
    const sy = b.shake ? (Math.random() - 0.5) * b.shake * 0.5 : 0;
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    text("FIGHT", 18, 18, 20, "left");
    drawFightHp(18, 50, coreHp(b.player), false);
    drawFightHp(state.w - 106, 50, coreHp(b.enemy), true);
    drawEnemyMark(b.enemyName);
    drawGround();
    drawBot(b.player, b.cell, b);
    drawBot(b.enemy, b.cell, b);
    drawParticles(b);
    ctx.restore();
    if (b.flash > 0) {
      ctx.globalAlpha = b.flash * 2.8;
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, state.w, state.h);
      ctx.globalAlpha = 1;
    }
    if (b.pending && !b.result) {
      text(b.pending, state.w / 2, state.h * 0.24, 42, "center");
    }
    if (b.result) drawResult(b.result);
  }

  function drawFightHp(x, y, hp, reverse) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, 88, 12);
    const w = clamp(hp / PARTS.core.hp, 0, 1) * 82;
    ctx.fillStyle = INK;
    if (reverse) ctx.fillRect(x + 85 - w, y + 3, w, 6);
    else ctx.fillRect(x + 3, y + 3, w, 6);
  }

  function drawEnemyMark(name) {
    const x = state.w / 2;
    const y = 56;
    for (let i = 0; i < Math.min(5, state.enemyIndex + 1); i += 1) {
      ctx.fillStyle = INK;
      ctx.fillRect(x - 18 + i * 9, y, 5, 5);
    }
    if (name === "DEF") text("DEF", x, y + 10, 10, "center");
  }

  function drawGround() {
    const g = fightGround();
    ctx.fillStyle = INK;
    ctx.fillRect(0, g + 4, state.w, 5);
    for (let x = 0; x < state.w; x += 34) ctx.fillRect(x, g + 18 + ((x / 34) % 2) * 3, 16, 3);
  }

  function drawBot(bot, cell, battle) {
    const parts = bot.parts.filter((p) => p.alive).sort((a, b) => a.y - b.y);
    drawBattleConnections(bot, cell);
    for (const p of parts) {
      const w = partWorld(bot, p, cell);
      const rot = bot.facing === 1 ? p.rotation : MIRROR_ROT[p.rotation];
      const extra = (p.swing ? Math.sin((p.swing / 0.32) * Math.PI) * bot.facing * 0.82 : 0) +
        (p.bite ? Math.sin((p.bite / 0.18) * Math.PI) * bot.facing * 0.24 : 0);
      if (p.type === "hammer" && p.swing) drawHammerTrail(w.x, w.y, cell, rot, bot.facing, p.swing);
      drawPart(p.type, w.x, w.y, cell * (p.type === "core" ? 1.22 : 1.04), rot, {
        bodyAngle: bot.angle + extra,
        flash: p.flash || (p.type === "core" ? bot.coreFlash : 0),
        time: battle.t,
        mode: "fight",
        hpRatio: p.maxHp ? p.hp / p.maxHp : 1,
      });
    }
  }

  function drawBattleConnections(bot, cell) {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(6, cell * 0.13);
    for (const p of bot.parts) {
      if (!p.alive) continue;
      for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
        const q = bot.parts.find((part) => part.alive && part.x === p.x + d.x && part.y === p.y + d.y);
        if (!q) continue;
        const a = partWorld(bot, p, cell);
        const b = partWorld(bot, q, cell);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = PAPER;
        ctx.fillRect((a.x + b.x) / 2 - 3, (a.y + b.y) / 2 - 3, 6, 6);
      }
    }
    ctx.restore();
  }

  function drawHammerTrail(x, y, cell, rot, facing, swing) {
    const progress = 1 - swing / 0.32;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((rot - 1) * Math.PI) / 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(cell * 0.1 * facing, 0, cell * 0.68, -0.8 + progress * 0.45, 0.55 + progress * 0.45);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawParticles(battle) {
    for (const p of battle.particles) {
      if (p.kind === "dot") {
        ctx.fillStyle = INK;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 4, 4);
      } else if (p.kind === "spark") {
        ctx.fillStyle = INK;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 6, 3);
      } else if (p.kind === "shock" || p.kind === "clang") {
        ctx.strokeStyle = INK;
        ctx.lineWidth = p.kind === "clang" ? 5 : 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        if (p.kind === "clang") {
          ctx.beginPath();
          ctx.moveTo(p.x - p.r - 6, p.y - 7);
          ctx.lineTo(p.x - p.r - 18, p.y - 16);
          ctx.moveTo(p.x + p.r + 6, p.y + 7);
          ctx.lineTo(p.x + p.r + 18, p.y + 16);
          ctx.stroke();
        }
      } else if (p.kind === "boom") {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 6;
        jaggedCircle(p.x, p.y, p.r, 12);
        ctx.stroke();
        ctx.lineWidth = 2;
        jaggedCircle(p.x, p.y, p.r * 0.58, 8);
        ctx.stroke();
      }
    }
  }

  function drawResult(result) {
    const vw = Math.min(state.w, Math.round(canvas.getBoundingClientRect().width || state.w), Math.round(window.innerWidth || state.w));
    const vh = Math.min(state.h, Math.round(canvas.getBoundingClientRect().height || state.h), Math.round(window.innerHeight || state.h));
    const y = vh * 0.23;
    text(result, vw / 2, y, 52, "center");
    const bw = Math.min(84, (vw - 56) / 3);
    const gap = 8;
    const x0 = (vw - bw * 3 - gap * 2) / 2;
    const by = Math.min(vh - 92, y + 68);
    const buttons = [
      ["RETRY", "retry"],
      ["GARAGE", "garage"],
      ["NEXT", "next"],
    ];
    for (let i = 0; i < buttons.length; i += 1) {
      const x = x0 + i * (bw + gap);
      ctx.fillStyle = i === 1 ? INK : PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.fillRect(x, by, bw, 50);
      ctx.strokeRect(x, by, bw, 50);
      text(buttons[i][0], x + bw / 2, by + 26, 14, "center", i === 1 ? PAPER : INK);
      addHit(buttons[i][1], x, by, bw, 50);
    }
  }

  function drawPart(type, x, y, size, rotation = 0, opt = {}) {
    const ink = opt.inverse ? PAPER : INK;
    const paper = opt.inverse ? INK : PAPER;
    const flash = opt.flash || 0;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate((type === "core" ? 0 : ((rotation - 1) * Math.PI) / 2) + (opt.bodyAngle || 0));
    ctx.strokeStyle = flash ? PAPER : ink;
    ctx.fillStyle = paper;
    ctx.lineWidth = Math.max(3, Math.round(size / (opt.mode === "tray" ? 9 : 8)));
    if (type === "core") drawCore(size, ink, paper, flash, opt.hpRatio ?? 1);
    else if (type === "leg") drawLeg(size, ink);
    else if (type === "wheel") drawWheel(size, ink, paper);
    else if (type === "spike") drawSpike(size, ink, paper);
    else if (type === "shield") drawShield(size, ink, paper);
    else if (type === "hammer") drawHammer(size, ink);
    else if (type === "weight") drawWeight(size, ink);
    else if (type === "wing") drawWing(size, ink);
    else if (type === "spring") drawSpring(size, ink);
    else if (type === "bomb") drawBomb(size, ink, paper);
    else if (type === "jaw") drawJaw(size, ink, paper);
    ctx.restore();
  }

  function drawCore(s, ink, paper, flash, hpRatio = 1) {
    ctx.fillStyle = flash ? ink : paper;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.04, s * 0.38, s * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = flash ? paper : ink;
    ctx.lineWidth = Math.max(2, s / 13);
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, -s * 0.24);
    ctx.lineTo(s * 0.06, -s * 0.1);
    ctx.lineTo(-s * 0.02, s * 0.04);
    ctx.lineTo(s * 0.12, s * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, s * 0.08);
    ctx.lineTo(-s * 0.02, s * 0.15);
    ctx.lineTo(-s * 0.12, s * 0.29);
    ctx.stroke();
    if (hpRatio < 0.7) {
      ctx.beginPath();
      ctx.moveTo(s * 0.14, -s * 0.23);
      ctx.lineTo(s * 0.03, -s * 0.02);
      ctx.lineTo(s * 0.19, s * 0.08);
      ctx.stroke();
    }
    if (hpRatio < 0.35) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, -s * 0.12);
      ctx.lineTo(-s * 0.02, -s * 0.04);
      ctx.lineTo(-s * 0.2, s * 0.08);
      ctx.stroke();
    }
    ctx.fillStyle = flash ? paper : ink;
    ctx.fillRect(-s * 0.07, -s * 0.03, s * 0.14, s * 0.14);
  }

  function drawLeg(s, ink) {
    ctx.fillStyle = ink;
    ctx.fillRect(-s * 0.34, -s * 0.24, s * 0.5, s * 0.14);
    ctx.fillRect(-s * 0.34, s * 0.1, s * 0.5, s * 0.14);
    ctx.fillRect(s * 0.02, -s * 0.34, s * 0.16, s * 0.28);
    ctx.fillRect(s * 0.02, s * 0.06, s * 0.16, s * 0.28);
    ctx.fillRect(s * 0.1, -s * 0.4, s * 0.34, s * 0.12);
    ctx.fillRect(s * 0.1, s * 0.28, s * 0.34, s * 0.12);
    ctx.fillRect(s * 0.36, -s * 0.3, s * 0.12, s * 0.08);
    ctx.fillRect(s * 0.36, s * 0.22, s * 0.12, s * 0.08);
  }

  function drawWheel(s, ink, paper) {
    ctx.fillStyle = paper;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.43, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.21, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ink;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      ctx.fillRect(Math.cos(a) * s * 0.31 - 2, Math.sin(a) * s * 0.31 - 2, 4, 4);
    }
  }

  function drawSpike(s, ink, paper) {
    ctx.fillStyle = paper;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(s * 0.58, 0);
    ctx.lineTo(-s * 0.26, -s * 0.38);
    ctx.lineTo(-s * 0.12, -s * 0.08);
    ctx.lineTo(-s * 0.34, s * 0.06);
    ctx.lineTo(-s * 0.16, s * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.fillRect(-s * 0.28, -s * 0.09, s * 0.33, s * 0.18);
  }

  function drawShield(s, ink, paper) {
    ctx.fillStyle = paper;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(s * 0.38, -s * 0.44);
    ctx.lineTo(-s * 0.3, -s * 0.32);
    ctx.lineTo(-s * 0.3, s * 0.32);
    ctx.lineTo(s * 0.38, s * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.fillRect(s * 0.3, -s * 0.42, s * 0.12, s * 0.84);
    ctx.fillRect(-s * 0.08, -s * 0.25, s * 0.09, s * 0.5);
  }

  function drawHammer(s, ink) {
    ctx.fillStyle = ink;
    ctx.fillRect(-s * 0.4, -s * 0.05, s * 0.58, s * 0.1);
    ctx.fillRect(s * 0.08, -s * 0.38, s * 0.2, s * 0.76);
    ctx.beginPath();
    ctx.arc(s * 0.28, -s * 0.36, s * 0.1, 0, Math.PI * 2);
    ctx.arc(s * 0.28, s * 0.36, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWeight(s, ink) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(-s * 0.44, s * 0.26);
    ctx.lineTo(-s * 0.3, -s * 0.34);
    ctx.lineTo(s * 0.24, -s * 0.42);
    ctx.lineTo(s * 0.44, s * 0.14);
    ctx.lineTo(s * 0.12, s * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.fillRect(-s * 0.11, -s * 0.18, s * 0.12, s * 0.09);
  }

  function drawWing(s, ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(2, s / 12);
    ctx.beginPath();
    ctx.moveTo(-s * 0.38, s * 0.28);
    ctx.quadraticCurveTo(-s * 0.02, -s * 0.44, s * 0.42, -s * 0.12);
    ctx.quadraticCurveTo(s * 0.08, s * 0.12, -s * 0.38, s * 0.28);
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.16 + i * s * 0.13, s * 0.12 - i * s * 0.06);
      ctx.lineTo(s * 0.18 + i * s * 0.06, -s * 0.1 - i * s * 0.02);
      ctx.stroke();
    }
  }

  function drawSpring(s, ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(3, s / 9);
    ctx.beginPath();
    ctx.moveTo(-s * 0.38, -s * 0.2);
    ctx.lineTo(-s * 0.22, s * 0.24);
    ctx.lineTo(-s * 0.06, -s * 0.24);
    ctx.lineTo(s * 0.1, s * 0.24);
    ctx.lineTo(s * 0.26, -s * 0.24);
    ctx.lineTo(s * 0.4, s * 0.18);
    ctx.stroke();
  }

  function drawBomb(s, ink, paper) {
    ctx.fillStyle = paper;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.03, s * 0.36, s * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.3);
    ctx.lineTo(s * 0.09, -s * 0.12);
    ctx.lineTo(-s * 0.05, s * 0.02);
    ctx.lineTo(s * 0.15, s * 0.2);
    ctx.moveTo(-s * 0.18, s * 0.08);
    ctx.lineTo(0, s * 0.18);
    ctx.lineTo(-s * 0.09, s * 0.32);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.fillRect(s * 0.08, -s * 0.42, s * 0.08, s * 0.13);
    ctx.fillRect(s * 0.16, -s * 0.48, s * 0.15, s * 0.06);
  }

  function drawJaw(s, ink, paper) {
    ctx.strokeStyle = ink;
    ctx.fillStyle = paper;
    ctx.lineWidth = Math.max(2, s / 9);
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, -s * 0.22);
    ctx.lineTo(s * 0.4, -s * 0.08);
    ctx.lineTo(-s * 0.26, s * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, s * 0.13);
    ctx.lineTo(s * 0.42, s * 0.25);
    ctx.lineTo(-s * 0.25, s * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ink;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.03 + i * s * 0.12, -s * 0.06);
      ctx.lineTo(s * 0.03 + i * s * 0.12, s * 0.04);
      ctx.lineTo(-s * 0.06 + i * s * 0.12, s * 0.02);
      ctx.fill();
    }
  }

  function jaggedCircle(x, y, r, n) {
    ctx.beginPath();
    for (let i = 0; i <= n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (i % 2 ? 0.74 : 1);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }

  function text(value, x, y, size, align = "left", color = INK) {
    ctx.fillStyle = color;
    ctx.font = `900 ${size}px "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(value, Math.round(x), Math.round(y));
  }

  function frame(now) {
    if (!frame.last) frame.last = now;
    const dt = Math.min(0.04, (now - frame.last) / 1000);
    frame.last = now;
    if (state.toastT > 0) state.toastT -= dt;
    if (state.mode === "fight") updateBattle(dt);
    draw();
    window.EggCoreDebug = {
      mode: state.mode,
      parts: partCount(),
      enemy: state.enemies[state.enemyIndex]?.name,
      result: state.battle?.result || state.battle?.pending || "",
      hp: state.battle ? [coreHp(state.battle.player), coreHp(state.battle.enemy)] : null,
      hits: state.hits.length,
    };
    canvas.dataset.mode = state.mode;
    canvas.dataset.result = state.battle?.result || state.battle?.pending || "";
    canvas.dataset.hp = state.battle ? `${Math.round(coreHp(state.battle.player))},${Math.round(coreHp(state.battle.enemy))}` : "";
    canvas.dataset.fight = state.battle
      ? `${state.battle.t.toFixed(1)},${Math.round(state.battle.player.x)},${Math.round(state.battle.enemy.x)},${state.battle.player.parts.filter((p) => p.alive).length},${state.battle.enemy.parts.filter((p) => p.alive).length}`
      : "";
    canvas.dataset.hits = String(state.hits.length);
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") rotateSelected();
    if (event.key === "Backspace" || event.key === "Delete") deleteSelected();
  });

  resize();
  saveBuild();
  requestAnimationFrame(frame);
})();
