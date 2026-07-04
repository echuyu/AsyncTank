(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");

  const INK = "#111";
  const PAPER = "#f8f8f8";
  const PALE = "#ddd";
  const GRID = 7;
  const CORE = 3;
  const MAX_BLOCKS = 13;
  const MAX_LOGIC = 12;
  const MAX_WIRES = 40;
  const TICK = 1 / 30;
  const MAX_FIGHT = 60;
  const PREFIX = "CBA1:";
  const DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  const BLOCKS = {
    core: { hp: 42, label: "CORE", mass: 4, energy: 50, regen: 5 },
    wheel: { hp: 14, label: "WHEEL", mass: 1, energy: 0, regen: 0 },
    gun: { hp: 22, label: "GUN", mass: 1.5, energy: 0, regen: 0 },
    radar: { hp: 12, label: "RADAR", mass: 1, energy: 0, regen: 0 },
    armor: { hp: 30, label: "ARMOR", mass: 3, energy: 0, regen: 0 },
    battery: { hp: 16, label: "BATT", mass: 1.4, energy: 34, regen: 5 },
  };
  const PALETTE = ["wheel", "gun", "radar", "armor", "battery"];

  const SENSORS = [
    ["always", "Always"],
    ["enemySeen", "Enemy Seen"],
    ["enemyNear", "Enemy Near"],
    ["enemyLeft", "Enemy Left"],
    ["enemyRight", "Enemy Right"],
    ["gunReady", "Gun Ready"],
    ["hitWall", "Hit Wall"],
    ["hitByBullet", "Hit Bullet"],
    ["lowHp", "Low HP"],
    ["lowEnergy", "Low Energy"],
  ];
  const LOGIC_TYPES = {
    and: { label: "AND", inputs: 2 },
    or: { label: "OR", inputs: 2 },
    not: { label: "NOT", inputs: 1 },
    timer: { label: "TIMER", inputs: 0 },
    random: { label: "RND", inputs: 0 },
  };
  const ACTIONS = [
    ["radarSweep", "Radar Sweep"],
    ["aimAtEnemy", "Aim Enemy"],
    ["fire", "Fire"],
    ["moveForward", "Forward"],
    ["moveBackward", "Back"],
    ["turnLeft", "Turn L"],
    ["turnRight", "Turn R"],
  ];

  const LS = {
    design: "circuit-bot-arena.mvp.design",
    opponent: "circuit-bot-arena.mvp.opponent",
    enemyIndex: "circuit-bot-arena.mvp.enemyIndex",
  };

  const state = {
    w: 390,
    h: 760,
    dpr: 1,
    mode: "build",
    design: null,
    opponent: null,
    enemies: [],
    enemyIndex: 0,
    selectedBlockType: "wheel",
    selectedBlockId: null,
    wireFrom: null,
    selectedLogicId: null,
    hits: [],
    battle: null,
    fightOpponent: null,
    toast: "",
    toastT: 0,
    importText: "",
    exportText: "",
    lastSignals: {},
  };

  const shareLayer = makeShareLayer();
  state.enemies = makeEnemies();
  state.design = loadDesign() || defaultDesign();
  state.opponent = loadOpponent() || state.enemies[0];
  state.enemyIndex = Number(localStorage.getItem(LS.enemyIndex) || 0) || 0;
  state.enemyIndex = clamp(Math.round(state.enemyIndex), 0, state.enemies.length - 1);
  state.fightOpponent = state.enemies[state.enemyIndex];
  state.exportText = exportCode(state.design);

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function block(type, x, y, rot = 0, id = uid("b")) {
    return { id, type, x, y, rot };
  }

  function logic(type, x = 1, y = 1, id = uid("n")) {
    return { id, type, x, y, params: {} };
  }

  function defaultSchematic() {
    const fireAnd = logic("and", 1, 1, "n_fire_and");
    return {
      logicNodes: [fireAnd],
      wires: [
        wire("sensor.always", "action.radarSweep"),
        wire("sensor.always", "action.moveForward"),
        wire("sensor.enemySeen", "action.aimAtEnemy"),
        wire("sensor.enemySeen", "n_fire_and.in0"),
        wire("sensor.gunReady", "n_fire_and.in1"),
        wire("n_fire_and.out", "action.fire"),
        wire("sensor.enemyLeft", "action.turnLeft"),
        wire("sensor.enemyRight", "action.turnRight"),
        wire("sensor.enemyNear", "action.moveBackward"),
        wire("sensor.hitWall", "action.turnRight"),
      ],
    };
  }

  function wire(from, to) {
    return { from, to };
  }

  function defaultDesign() {
    return normalizeDesign({
      version: 1,
      name: "My Bot",
      blocks: [
        block("core", CORE, CORE, 0, "core"),
        block("gun", CORE, CORE - 1, 1),
        block("armor", CORE + 1, CORE, 1),
        block("radar", CORE - 1, CORE, 3),
        block("wheel", CORE - 1, CORE + 1, 0),
        block("wheel", CORE + 1, CORE + 1, 0),
        block("battery", CORE, CORE + 1, 0),
      ],
      schematic: defaultSchematic(),
    });
  }

  function normalizeDesign(raw) {
    const blocks = [];
    const seen = new Set();
    for (const b of raw?.blocks || []) {
      if (!BLOCKS[b.type]) continue;
      const x = clamp(Math.round(b.x), 0, GRID - 1);
      const y = clamp(Math.round(b.y), 0, GRID - 1);
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push(block(b.type, x, y, clamp(Math.round(b.rot || 0), 0, 3), String(b.id || uid("b")).slice(0, 24)));
    }
    let core = blocks.find((b) => b.type === "core");
    if (!core) {
      core = block("core", CORE, CORE, 0, "core");
      blocks.unshift(core);
    }
    core.type = "core";
    core.x = CORE;
    core.y = CORE;
    core.rot = 0;
    core.id = "core";

    const connected = pruneDisconnected(blocks).slice(0, MAX_BLOCKS);
    const schematic = normalizeSchematic(raw?.schematic || defaultSchematic());
    return {
      version: 1,
      name: String(raw?.name || "Bot").slice(0, 24),
      blocks: connected,
      schematic,
    };
  }

  function normalizeSchematic(raw) {
    const logicNodes = [];
    const logicIds = new Set();
    for (const n of raw?.logicNodes || []) {
      if (!LOGIC_TYPES[n.type] || logicNodes.length >= MAX_LOGIC) continue;
      const id = String(n.id || uid("n")).replace(/[^\w-]/g, "").slice(0, 24) || uid("n");
      if (logicIds.has(id)) continue;
      logicIds.add(id);
      logicNodes.push({ id, type: n.type, x: clamp(Number(n.x) || 1, 0, 2), y: clamp(Number(n.y) || logicNodes.length, 0, 20), params: {} });
    }
    const wires = [];
    for (const w of raw?.wires || []) {
      if (wires.length >= MAX_WIRES) break;
      const from = String(w.from || "");
      const to = String(w.to || "");
      if (!isOutputEndpoint(from, logicIds) || !isInputEndpoint(to, logicIds)) continue;
      if (!canConnectEndpoints(from, to, logicNodes)) continue;
      if (wires.some((x) => x.from === from && x.to === to)) continue;
      wires.push({ from, to });
    }
    return { logicNodes, wires };
  }

  function isOutputEndpoint(ep, logicIds) {
    if (ep.startsWith("sensor.")) return SENSORS.some(([id]) => ep === `sensor.${id}`);
    const [id, port] = ep.split(".");
    return logicIds.has(id) && port === "out";
  }

  function isInputEndpoint(ep, logicIds) {
    if (ep.startsWith("action.")) return ACTIONS.some(([id]) => ep === `action.${id}`);
    const [id, input] = ep.split(".");
    if (!logicIds.has(id) || !/^in\d+$/.test(input || "")) return false;
    return true;
  }

  function endpointColumn(ep) {
    if (ep.startsWith("sensor.")) return 0;
    if (ep.startsWith("action.")) return 2;
    return 1;
  }

  function canConnectEndpoints(from, to, logicNodes) {
    if (from.startsWith("sensor.")) return to.startsWith("action.") || isLogicEndpoint(to);
    if (!isLogicEndpoint(from)) return false;
    if (to.startsWith("action.")) return true;
    if (!isLogicEndpoint(to)) return false;
    const fromId = from.split(".")[0];
    const toId = to.split(".")[0];
    if (fromId === toId) return false;
    const fromIndex = logicNodes.findIndex((n) => n.id === fromId);
    const toIndex = logicNodes.findIndex((n) => n.id === toId);
    return fromIndex >= 0 && toIndex >= 0 && fromIndex < toIndex;
  }

  function isLogicEndpoint(ep) {
    return !ep.startsWith("sensor.") && !ep.startsWith("action.");
  }

  function pruneDisconnected(blocks) {
    const map = new Map(blocks.map((b) => [`${b.x},${b.y}`, b]));
    if (!map.has(`${CORE},${CORE}`)) return [block("core", CORE, CORE, 0, "core")];
    const keep = new Set([`${CORE},${CORE}`]);
    const open = [{ x: CORE, y: CORE }];
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
    return blocks.filter((b) => keep.has(`${b.x},${b.y}`));
  }

  function canPlace(x, y) {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return false;
    if (state.design.blocks.some((b) => b.x === x && b.y === y)) return false;
    if (state.design.blocks.length >= MAX_BLOCKS) return false;
    return DIRS.some((d) => state.design.blocks.some((b) => b.x === x + d.x && b.y === y + d.y));
  }

  function saveDesign() {
    state.design = normalizeDesign(state.design);
    state.exportText = exportCode(state.design);
    try {
      localStorage.setItem(LS.design, JSON.stringify(state.design));
    } catch {}
  }

  function loadDesign() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS.design) || "null");
      return raw ? normalizeDesign(raw) : null;
    } catch {
      return null;
    }
  }

  function saveOpponent(design) {
    state.opponent = normalizeDesign(design);
    try {
      localStorage.setItem(LS.opponent, JSON.stringify(state.opponent));
    } catch {}
  }

  function loadOpponent() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS.opponent) || "null");
      return raw ? normalizeDesign(raw) : null;
    } catch {
      return null;
    }
  }

  function makeEnemies() {
    const d = defaultSchematic();
    const hunter = normalizeDesign({
      version: 1,
      name: "Basic Hunter",
      blocks: [
        block("core", 3, 3, 0, "core"), block("gun", 3, 2, 1), block("armor", 4, 3, 1),
        block("radar", 2, 3, 3), block("wheel", 2, 4), block("wheel", 4, 4), block("battery", 3, 4),
      ],
      schematic: d,
    });
    const ram = normalizeDesign({
      version: 1,
      name: "Ram Shooter",
      blocks: [
        block("core", 3, 3, 0, "core"), block("armor", 4, 3, 1), block("armor", 5, 3, 1),
        block("gun", 3, 2, 1), block("radar", 2, 3), block("wheel", 3, 4), block("wheel", 2, 4), block("wheel", 4, 4),
      ],
      schematic: {
        logicNodes: [logic("and", 1, 1, "ram_fire")],
        wires: [
          wire("sensor.always", "action.radarSweep"), wire("sensor.always", "action.moveForward"),
          wire("sensor.enemySeen", "action.aimAtEnemy"), wire("sensor.enemySeen", "ram_fire.in0"),
          wire("sensor.gunReady", "ram_fire.in1"), wire("ram_fire.out", "action.fire"),
          wire("sensor.enemyLeft", "action.turnLeft"), wire("sensor.enemyRight", "action.turnRight"),
          wire("sensor.hitWall", "action.turnRight"),
        ],
      },
    });
    const sniper = normalizeDesign({
      version: 1,
      name: "Sniper",
      blocks: [
        block("core", 3, 3, 0, "core"), block("radar", 3, 2), block("gun", 4, 3, 1),
        block("gun", 4, 2, 1), block("battery", 2, 3), block("battery", 3, 4), block("armor", 2, 4),
      ],
      schematic: {
        logicNodes: [logic("and", 1, 1, "s_fire"), logic("timer", 1, 2, "s_tick")],
        wires: [
          wire("sensor.always", "action.radarSweep"), wire("sensor.enemySeen", "action.aimAtEnemy"),
          wire("sensor.enemySeen", "s_fire.in0"), wire("sensor.gunReady", "s_fire.in1"), wire("s_fire.out", "action.fire"),
          wire("sensor.enemyNear", "action.moveBackward"), wire("s_tick.out", "action.turnRight"),
        ],
      },
    });
    const wallRunner = normalizeDesign({
      version: 1,
      name: "Wall Runner",
      blocks: [
        block("core", 3, 3, 0, "core"), block("radar", 3, 2), block("gun", 4, 3, 1),
        block("wheel", 3, 4), block("wheel", 4, 4), block("armor", 4, 2, 1), block("battery", 2, 3),
      ],
      schematic: d,
    });
    const coward = normalizeDesign({
      version: 1,
      name: "Coward",
      blocks: [
        block("core", 3, 3, 0, "core"), block("radar", 3, 2), block("gun", 2, 3, 3),
        block("battery", 3, 4), block("battery", 4, 3), block("wheel", 2, 4), block("wheel", 4, 4), block("armor", 3, 1),
      ],
      schematic: {
        logicNodes: [logic("and", 1, 1, "c_fire"), logic("or", 1, 2, "c_escape")],
        wires: [
          wire("sensor.always", "action.radarSweep"), wire("sensor.enemySeen", "action.aimAtEnemy"),
          wire("sensor.enemySeen", "c_fire.in0"), wire("sensor.gunReady", "c_fire.in1"), wire("c_fire.out", "action.fire"),
          wire("sensor.enemyNear", "c_escape.in0"), wire("sensor.lowHp", "c_escape.in1"), wire("c_escape.out", "action.moveBackward"),
          wire("sensor.enemyLeft", "action.turnRight"), wire("sensor.enemyRight", "action.turnLeft"), wire("sensor.hitWall", "action.turnRight"),
        ],
      },
    });
    return [hunter, ram, sniper, wallRunner, coward];
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.w = Math.max(320, Math.round(rect.width || 390));
    state.h = Math.max(560, Math.round(rect.height || 760));
    state.dpr = Math.max(1, Math.min(2, Math.round(window.devicePixelRatio || 1)));
    canvas.width = state.w * state.dpr;
    canvas.height = state.h * state.dpr;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    positionShareLayer();
  }

  window.addEventListener("resize", resize);
  resize();

  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (state.w / rect.width);
    const y = (event.clientY - rect.top) * (state.h / rect.height);
    handlePointer(x, y);
    event.preventDefault();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" || event.key === "Delete") {
      if (state.mode === "build") deleteSelectedBlock();
      if (state.mode === "wire") deleteSelectedLogic();
      event.preventDefault();
    } else if (event.key.toLowerCase() === "r" && state.mode === "build") {
      rotateSelectedBlock();
    }
  });

  function handlePointer(x, y) {
    const hit = [...state.hits].reverse().find((h) => x >= h.x && y >= h.y && x <= h.x + h.w && y <= h.y + h.h);
    if (!hit) return;
    if (hit.kind === "tab") {
      setMode(hit.mode);
    } else if (state.mode === "build") {
      handleBuildHit(hit);
    } else if (state.mode === "wire") {
      handleWireHit(hit);
    } else if (state.mode === "fight") {
      handleFightHit(hit);
    } else if (state.mode === "share") {
      handleShareHit(hit);
    }
  }

  function handleBuildHit(hit) {
    if (hit.kind === "palette") {
      state.selectedBlockType = hit.type;
      state.selectedBlockId = null;
    } else if (hit.kind === "cell") {
      const found = state.design.blocks.find((b) => b.x === hit.gx && b.y === hit.gy);
      if (found) {
        state.selectedBlockId = found.id;
        state.selectedBlockType = found.type === "core" ? state.selectedBlockType : found.type;
      } else if (canPlace(hit.gx, hit.gy)) {
        state.design.blocks.push(block(state.selectedBlockType, hit.gx, hit.gy, defaultRot(state.selectedBlockType)));
        state.selectedBlockId = state.design.blocks[state.design.blocks.length - 1].id;
        saveDesign();
      } else {
        toast("CONNECT");
      }
    } else if (hit.kind === "delete") deleteSelectedBlock();
    else if (hit.kind === "rotate") rotateSelectedBlock();
    else if (hit.kind === "random") randomDesign();
    else if (hit.kind === "wire") setMode("wire");
    else if (hit.kind === "fight") startFight(state.fightOpponent || state.enemies[state.enemyIndex]);
  }

  function handleWireHit(hit) {
    if (hit.kind === "portOut") {
      state.wireFrom = hit.endpoint;
    } else if (hit.kind === "portIn") {
      if (state.wireFrom) addWire(state.wireFrom, hit.endpoint);
    } else if (hit.kind === "wireLine") {
      state.design.schematic.wires.splice(hit.index, 1);
      state.wireFrom = null;
      saveDesign();
    } else if (hit.kind === "logic") {
      state.selectedLogicId = hit.id;
    } else if (hit.kind === "addLogic") {
      addLogic(hit.type);
    } else if (hit.kind === "deleteLogic") deleteSelectedLogic();
    else if (hit.kind === "fight") startFight(state.fightOpponent || state.enemies[state.enemyIndex]);
  }

  function handleFightHit(hit) {
    if (hit.kind === "restart") startFight(state.fightOpponent || state.enemies[state.enemyIndex]);
    else if (hit.kind === "nextEnemy") {
      state.enemyIndex = (state.enemyIndex + 1) % state.enemies.length;
      localStorage.setItem(LS.enemyIndex, String(state.enemyIndex));
      state.fightOpponent = state.enemies[state.enemyIndex];
      startFight(state.fightOpponent);
    } else if (hit.kind === "build") setMode("build");
    else if (hit.kind === "share") setMode("share");
  }

  function handleShareHit(hit) {
    if (hit.kind === "fightImported" && state.opponent) {
      state.fightOpponent = state.opponent;
      startFight(state.fightOpponent);
    }
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === "fight" && !state.battle) startFight(state.fightOpponent || state.enemies[state.enemyIndex]);
    if (mode === "share") state.exportText = exportCode(state.design);
    syncShareLayer();
  }

  function defaultRot(type) {
    if (type === "gun") return 1;
    if (type === "radar") return 0;
    if (type === "armor") return 1;
    return 0;
  }

  function deleteSelectedBlock() {
    const id = state.selectedBlockId;
    const b = state.design.blocks.find((x) => x.id === id);
    if (!b || b.type === "core") return;
    state.design.blocks = pruneDisconnected(state.design.blocks.filter((x) => x.id !== id));
    state.selectedBlockId = null;
    saveDesign();
  }

  function rotateSelectedBlock() {
    const b = state.design.blocks.find((x) => x.id === state.selectedBlockId);
    if (b && b.type !== "core") {
      b.rot = (b.rot + 1) % 4;
      saveDesign();
    }
  }

  function randomDesign() {
    const blocks = [block("core", CORE, CORE, 0, "core")];
    let guard = 0;
    while (blocks.length < MAX_BLOCKS && guard < 200) {
      guard += 1;
      const a = blocks[Math.floor(rand01(guard) * blocks.length)];
      const d = DIRS[Math.floor(rand01(guard * 7) * 4)];
      const x = a.x + d.x;
      const y = a.y + d.y;
      if (x < 0 || y < 0 || x >= GRID || y >= GRID || blocks.some((b) => b.x === x && b.y === y)) continue;
      const type = PALETTE[Math.floor(rand01(guard * 13) * PALETTE.length)];
      blocks.push(block(type, x, y, defaultRot(type)));
    }
    state.design = normalizeDesign({ version: 1, name: "Random Bot", blocks, schematic: defaultSchematic() });
    state.selectedBlockId = null;
    saveDesign();
  }

  function addLogic(type) {
    if (state.design.schematic.logicNodes.length >= MAX_LOGIC) {
      toast("MAX");
      return;
    }
    const n = logic(type, 1, state.design.schematic.logicNodes.length + 1);
    state.design.schematic.logicNodes.push(n);
    state.selectedLogicId = n.id;
    saveDesign();
  }

  function deleteSelectedLogic() {
    const id = state.selectedLogicId;
    if (!id) return;
    state.design.schematic.logicNodes = state.design.schematic.logicNodes.filter((n) => n.id !== id);
    state.design.schematic.wires = state.design.schematic.wires.filter((w) => !w.from.startsWith(`${id}.`) && !w.to.startsWith(`${id}.`));
    state.selectedLogicId = null;
    state.wireFrom = null;
    saveDesign();
  }

  function addWire(from, to) {
    const nodes = state.design.schematic.logicNodes;
    const logicIds = new Set(nodes.map((n) => n.id));
    if (!isOutputEndpoint(from, logicIds) || !isInputEndpoint(to, logicIds)) {
      state.wireFrom = null;
      return;
    }
    if (!canConnectEndpoints(from, to, nodes)) {
      toast("LEFT > RIGHT");
      state.wireFrom = null;
      return;
    }
    const wires = state.design.schematic.wires;
    const existing = wires.findIndex((w) => w.from === from && w.to === to);
    if (existing >= 0) wires.splice(existing, 1);
    else if (wires.length < MAX_WIRES) wires.push({ from, to });
    state.wireFrom = null;
    saveDesign();
  }

  function startFight(opponent) {
    state.fightOpponent = normalizeDesign(opponent || state.enemies[state.enemyIndex]);
    const arena = fightArena();
    const seed = hashString(JSON.stringify(state.design) + JSON.stringify(state.fightOpponent));
    state.battle = {
      t: 0,
      acc: 0,
      seed,
      rng: mulberry32(seed),
      result: "",
      reason: "",
      arena,
      bullets: [],
      particles: [],
      player: makeBattleBot(state.design, "P", arena.x + arena.w * 0.23, arena.y + arena.h * 0.5, 0, seed ^ 0x1234),
      enemy: makeBattleBot(state.fightOpponent, "E", arena.x + arena.w * 0.77, arena.y + arena.h * 0.5, Math.PI, seed ^ 0xabcd),
    };
    state.mode = "fight";
    syncShareLayer();
  }

  function makeBattleBot(design, side, x, y, angle, seed) {
    const blocks = design.blocks.map((b) => ({
      ...b,
      hp: BLOCKS[b.type].hp,
      maxHp: BLOCKS[b.type].hp,
      alive: true,
      flash: 0,
      localX: b.x - CORE,
      localY: b.y - CORE,
    }));
    const bot = {
      id: side,
      side,
      design,
      blocks,
      x,
      y,
      bodyAngle: angle,
      turretAngle: angle,
      radarAngle: angle,
      radarDir: 1,
      energy: 0,
      maxEnergy: 1,
      regen: 1,
      gunCooldown: 0,
      hitWallT: 0,
      hitBulletT: 0,
      lastSeenT: 0,
      lastSeenAngle: angle,
      lastSeenDist: 9999,
      sensors: {},
      actions: {},
      logicMemory: {},
      rand: mulberry32(seed),
      defeated: false,
    };
    recalcBotStats(bot);
    bot.energy = bot.maxEnergy;
    return bot;
  }

  function recalcBotStats(bot) {
    const live = (type) => bot.blocks.filter((b) => b.alive && b.type === type).length;
    bot.stats = {
      wheels: live("wheel"),
      guns: live("gun"),
      radars: live("radar"),
      batteries: live("battery"),
      armor: live("armor"),
    };
    bot.maxEnergy = BLOCKS.core.energy + bot.stats.batteries * BLOCKS.battery.energy;
    bot.regen = BLOCKS.core.regen + bot.stats.batteries * BLOCKS.battery.regen;
    bot.speed = 26 + bot.stats.wheels * 31;
    bot.turn = 1.0 + bot.stats.wheels * 0.32;
    bot.radarRange = bot.stats.radars ? 210 + bot.stats.radars * 45 : 0;
    bot.radarFov = bot.stats.radars ? 0.48 + bot.stats.radars * 0.07 : 0;
    bot.gunCooldownMax = Math.max(0.34, 0.82 - bot.stats.guns * 0.08);
  }

  function updateFight(dt) {
    const b = state.battle;
    if (!b) return;
    updateParticles(b, dt);
    if (b.result) return;
    b.acc += Math.min(dt, 0.08);
    let loops = 0;
    while (b.acc >= TICK && loops < 4) {
      stepBattle(b, TICK);
      b.acc -= TICK;
      loops += 1;
    }
  }

  function stepBattle(b, dt) {
    b.t += dt;
    updateBotSignals(b.player, b.enemy, b, dt);
    updateBotSignals(b.enemy, b.player, b, dt);
    evaluateSchematic(b.player, b, dt);
    evaluateSchematic(b.enemy, b, dt);
    applyActions(b.player, b, dt);
    applyActions(b.enemy, b, dt);
    updateBullets(b, dt);
    for (const bot of [b.player, b.enemy]) {
      bot.energy = clamp(bot.energy + bot.regen * dt, 0, bot.maxEnergy);
      bot.gunCooldown = Math.max(0, bot.gunCooldown - dt);
      bot.hitWallT = Math.max(0, bot.hitWallT - dt);
      bot.hitBulletT = Math.max(0, bot.hitBulletT - dt);
      bot.lastSeenT = Math.max(0, bot.lastSeenT - dt);
      for (const bl of bot.blocks) bl.flash = Math.max(0, bl.flash - dt * 5);
      recalcBotStats(bot);
    }
    const pc = coreHp(b.player);
    const ec = coreHp(b.enemy);
    if (pc <= 0 && ec <= 0) finishFight("DRAW", "CORES");
    else if (ec <= 0) finishFight("WIN", "CORE");
    else if (pc <= 0) finishFight("LOSE", "CORE");
    else if (b.t >= MAX_FIGHT) {
      const pm = totalHp(b.player);
      const em = totalHp(b.enemy);
      finishFight(pm >= em ? "WIN" : "LOSE", "TIME");
    }
  }

  function updateBotSignals(bot, foe, battle) {
    const core = bot.blocks.find((x) => x.type === "core" && x.alive);
    const foeCore = foe.blocks.find((x) => x.type === "core" && x.alive);
    const dist = foeCore ? Math.hypot(foe.x - bot.x, foe.y - bot.y) : 9999;
    let seen = false;
    if (bot.stats?.radars > 0 && foeCore) {
      const target = nearestLiveBlockWorld(bot, foe, battle);
      const a = Math.atan2(target.y - bot.y, target.x - bot.x);
      const d = Math.hypot(target.x - bot.x, target.y - bot.y);
      seen = d < bot.radarRange && Math.abs(angleDiff(a, bot.radarAngle)) < bot.radarFov;
      if (seen) {
        bot.lastSeenAngle = a;
        bot.lastSeenDist = d;
        bot.lastSeenT = 1.35;
      }
    }
    const seenOrMemory = seen || bot.lastSeenT > 0;
    const side = angleDiff(bot.lastSeenAngle, bot.bodyAngle);
    const hp = totalHp(bot);
    const maxHp = bot.blocks.reduce((sum, bl) => sum + bl.maxHp, 0);
    bot.sensors = {
      always: true,
      enemySeen: seen,
      enemyNear: seen && dist < 150,
      enemyLeft: seenOrMemory && side < -0.12,
      enemyRight: seenOrMemory && side > 0.12,
      gunReady: bot.stats.guns > 0 && bot.gunCooldown <= 0 && bot.energy >= fireCost(bot),
      hitWall: bot.hitWallT > 0,
      hitByBullet: bot.hitBulletT > 0,
      lowHp: coreHp(bot) < BLOCKS.core.hp * 0.45 || hp < maxHp * 0.45,
      lowEnergy: bot.energy < bot.maxEnergy * 0.28,
    };
  }

  function evaluateSchematic(bot, battle, dt) {
    const s = bot.design.schematic;
    const values = {};
    for (const [id] of SENSORS) values[`sensor.${id}`] = !!bot.sensors[id];
    const inputValue = (endpoint) => s.wires.some((w) => w.to === endpoint && values[w.from]);
    for (const node of s.logicNodes) {
      const key = node.id;
      const info = LOGIC_TYPES[node.type];
      let value = false;
      if (node.type === "and") {
        value = inputValue(`${key}.in0`) && inputValue(`${key}.in1`);
      } else if (node.type === "or") {
        value = inputValue(`${key}.in0`) || inputValue(`${key}.in1`);
      } else if (node.type === "not") {
        value = !inputValue(`${key}.in0`);
      } else if (node.type === "timer") {
        const period = 1.05;
        value = (battle.t % period) < 0.18;
      } else if (node.type === "random") {
        const mem = bot.logicMemory[key] || { next: 0, value: false };
        if (battle.t >= mem.next) {
          mem.value = bot.rand() < 0.38;
          mem.next = battle.t + 0.45;
          bot.logicMemory[key] = mem;
        }
        value = mem.value;
      }
      if (!info.inputs && (node.type === "timer" || node.type === "random")) value = !!value;
      values[`${key}.out`] = value;
    }
    bot.actions = {};
    for (const [id] of ACTIONS) bot.actions[id] = inputValue(`action.${id}`);
    if (bot.side === "P") state.lastSignals = values;
  }

  function applyActions(bot, battle, dt) {
    const a = bot.actions;
    const move = (a.moveForward ? 1 : 0) - (a.moveBackward ? 1 : 0);
    const turn = (a.turnRight ? 1 : 0) - (a.turnLeft ? 1 : 0);
    bot.bodyAngle = normAngle(bot.bodyAngle + turn * bot.turn * dt);
    if (move) {
      bot.x += Math.cos(bot.bodyAngle) * bot.speed * move * dt;
      bot.y += Math.sin(bot.bodyAngle) * bot.speed * move * dt;
    }
    const ar = battle.arena;
    const margin = botRadius(bot, battle);
    const ox = bot.x;
    const oy = bot.y;
    bot.x = clamp(bot.x, ar.x + margin, ar.x + ar.w - margin);
    bot.y = clamp(bot.y, ar.y + margin, ar.y + ar.h - margin);
    if (Math.abs(bot.x - ox) > 0.01 || Math.abs(bot.y - oy) > 0.01) bot.hitWallT = 0.36;

    if (bot.stats.radars > 0) {
      if (a.radarSweep) {
        if (bot.sensors.enemySeen || bot.lastSeenT > 0) {
          bot.radarAngle = approachAngle(bot.radarAngle, bot.lastSeenAngle, 5.2 * dt);
        } else {
          bot.radarAngle = normAngle(bot.radarAngle + bot.radarDir * 2.8 * dt);
          if (Math.abs(angleDiff(bot.radarAngle, bot.bodyAngle)) > 1.35) bot.radarDir *= -1;
        }
      } else {
        bot.radarAngle = approachAngle(bot.radarAngle, bot.bodyAngle, 2 * dt);
      }
    }
    if (a.aimAtEnemy && bot.lastSeenT > 0) bot.turretAngle = approachAngle(bot.turretAngle, bot.lastSeenAngle, 5.8 * dt);
    else bot.turretAngle = approachAngle(bot.turretAngle, bot.bodyAngle, 1.2 * dt);
    const aimed = bot.lastSeenT > 0 && Math.abs(angleDiff(bot.turretAngle, bot.lastSeenAngle)) < 0.22;
    if (a.fire && bot.sensors.gunReady && aimed) fireBullet(bot, battle);
  }

  function fireBullet(bot, battle) {
    const gun = bot.blocks.find((bl) => bl.alive && bl.type === "gun");
    if (!gun) return;
    const pos = blockWorld(bot, gun, battleScale(battle));
    const speed = 360;
    const dmg = 10 + Math.max(0, bot.stats.guns - 1) * 2;
    const cost = fireCost(bot);
    bot.energy -= cost;
    bot.gunCooldown = bot.gunCooldownMax;
    battle.bullets.push({
      x: pos.x + Math.cos(bot.turretAngle) * 16,
      y: pos.y + Math.sin(bot.turretAngle) * 16,
      vx: Math.cos(bot.turretAngle) * speed,
      vy: Math.sin(bot.turretAngle) * speed,
      owner: bot.id,
      damage: dmg,
      ttl: 2.8,
    });
    spawnSpark(pos.x, pos.y, battle, 4);
  }

  function fireCost(bot) {
    return Math.max(6, 9 - Math.max(0, bot.stats.guns - 1));
  }

  function updateBullets(battle, dt) {
    const next = [];
    for (const bullet of battle.bullets) {
      bullet.ttl -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      const ar = battle.arena;
      if (bullet.ttl <= 0 || bullet.x < ar.x || bullet.y < ar.y || bullet.x > ar.x + ar.w || bullet.y > ar.y + ar.h) continue;
      const target = bullet.owner === "P" ? battle.enemy : battle.player;
      const hit = bulletHitBlock(target, bullet, battle);
      if (hit) {
        damageBlock(target, hit, bullet.damage, battle);
        spawnSpark(bullet.x, bullet.y, battle, 10);
        continue;
      }
      next.push(bullet);
    }
    battle.bullets = next;
  }

  function bulletHitBlock(bot, bullet, battle) {
    const scale = battleScale(battle);
    let best = null;
    for (const bl of bot.blocks) {
      if (!bl.alive) continue;
      const p = blockWorld(bot, bl, scale);
      const d = Math.hypot(p.x - bullet.x, p.y - bullet.y);
      const r = scale * (bl.type === "armor" ? 0.95 : 0.82) + 3;
      if (d <= r && (!best || d < best.d)) best = { bl, d };
    }
    return best?.bl || null;
  }

  function damageBlock(bot, bl, amount, battle) {
    bl.hp -= amount;
    bl.flash = 1;
    bot.hitBulletT = 0.45;
    if (bl.hp <= 0 && bl.alive) {
      bl.alive = false;
      const p = blockWorld(bot, bl, battleScale(battle));
      spawnBreak(p.x, p.y, battle, bl.type === "core" ? 24 : 12);
    }
  }

  function finishFight(result, reason) {
    const b = state.battle;
    if (!b || b.result) return;
    b.result = result;
    b.reason = reason;
    spawnBreak(state.w / 2, state.h * 0.36, b, 28);
  }

  function fightArena() {
    const top = 58;
    const bottom = Math.max(top + 320, state.h - 104);
    const pad = 14;
    return { x: pad, y: top, w: state.w - pad * 2, h: bottom - top };
  }

  function battleScale(battle) {
    return clamp(Math.floor(battle.arena.w / 27), 11, 17);
  }

  function blockWorld(bot, bl, scale) {
    const lx = bl.localX * scale;
    const ly = bl.localY * scale;
    const c = Math.cos(bot.bodyAngle);
    const s = Math.sin(bot.bodyAngle);
    return { x: bot.x + lx * c - ly * s, y: bot.y + lx * s + ly * c };
  }

  function nearestLiveBlockWorld(observer, foe, battle) {
    const scale = battleScale(battle);
    let best = null;
    for (const bl of foe.blocks) {
      if (!bl.alive) continue;
      const p = blockWorld(foe, bl, scale);
      const d = Math.hypot(p.x - observer.x, p.y - observer.y);
      if (!best || d < best.d) best = { ...p, d };
    }
    return best || { x: foe.x, y: foe.y, d: 9999 };
  }

  function botRadius(bot, battle) {
    const scale = battleScale(battle);
    let r = 24;
    for (const bl of bot.blocks) {
      if (!bl.alive) continue;
      r = Math.max(r, Math.hypot(bl.localX * scale, bl.localY * scale) + scale);
    }
    return r;
  }

  function coreHp(bot) {
    const core = bot.blocks.find((b) => b.type === "core");
    return core && core.alive ? Math.max(0, core.hp) : 0;
  }

  function totalHp(bot) {
    return bot.blocks.reduce((sum, b) => sum + (b.alive ? Math.max(0, b.hp) : 0), 0);
  }

  function spawnSpark(x, y, battle, count) {
    for (let i = 0; i < count; i += 1) {
      const a = battle.rng() * Math.PI * 2;
      battle.particles.push({ x, y, vx: Math.cos(a) * (30 + battle.rng() * 90), vy: Math.sin(a) * (30 + battle.rng() * 90), life: 0.24 + battle.rng() * 0.2, size: 2 + battle.rng() * 3 });
    }
  }

  function spawnBreak(x, y, battle, count) {
    for (let i = 0; i < count; i += 1) {
      const a = battle.rng() * Math.PI * 2;
      battle.particles.push({ x, y, vx: Math.cos(a) * (45 + battle.rng() * 130), vy: Math.sin(a) * (45 + battle.rng() * 130), life: 0.45 + battle.rng() * 0.35, size: 3 + battle.rng() * 4 });
    }
  }

  function updateParticles(battle, dt) {
    for (const p of battle.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    battle.particles = battle.particles.filter((p) => p.life > 0);
  }

  function draw() {
    state.hits = [];
    ctx.clearRect(0, 0, state.w, state.h);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, state.w, state.h);
    drawTabs();
    if (state.mode === "build") drawBuild();
    else if (state.mode === "wire") drawWire();
    else if (state.mode === "fight") drawFight();
    else drawShare();
    if (state.toastT > 0) {
      ctx.fillStyle = INK;
      ctx.fillRect(state.w / 2 - 52, 46, 104, 26);
      text(state.toast, state.w / 2, 60, 13, "center", PAPER);
    }
    canvas.dataset.mode = state.mode;
    canvas.dataset.blocks = String(state.design.blocks.length);
    canvas.dataset.logic = String(state.design.schematic.logicNodes.length);
    canvas.dataset.wires = String(state.design.schematic.wires.length);
    canvas.dataset.fight = state.battle
      ? `${state.battle.t.toFixed(1)},${state.battle.bullets.length},${Math.round(coreHp(state.battle.player))},${Math.round(coreHp(state.battle.enemy))},${state.battle.result}`
      : "";
    canvas.dataset.signals = state.battle ? JSON.stringify(state.battle.player.sensors) : "";
    canvas.dataset.debug = state.battle
      ? JSON.stringify({
          energy: Math.round(state.battle.player.energy),
          maxEnergy: Math.round(state.battle.player.maxEnergy),
          cooldown: Number(state.battle.player.gunCooldown.toFixed(2)),
          guns: state.battle.player.stats.guns,
          actions: state.battle.player.actions,
          aimDiff: Number(Math.abs(angleDiff(state.battle.player.turretAngle, state.battle.player.lastSeenAngle)).toFixed(2)),
        })
      : "";
    syncShareLayer();
  }

  function drawTabs() {
    const tabs = ["build", "wire", "fight", "share"];
    const labels = ["BUILD", "WIRE", "FIGHT", "SHARE"];
    const w = state.w / tabs.length;
    for (let i = 0; i < tabs.length; i += 1) {
      const active = state.mode === tabs[i];
      ctx.fillStyle = active ? INK : PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.fillRect(i * w, 0, w, 38);
      ctx.strokeRect(i * w, 0, w, 38);
      text(labels[i], i * w + w / 2, 20, 13, "center", active ? PAPER : INK);
      addHit("tab", i * w, 0, w, 38, { mode: tabs[i] });
    }
  }

  function drawBuild() {
    const l = buildLayout();
    text(state.design.name, 16, 54, 15, "left");
    drawBuildGrid(l);
    drawBuildPalette(l);
    drawBuildActions(l);
  }

  function buildLayout() {
    const top = 70;
    const gridSize = Math.floor(Math.min(state.w - 32, Math.max(230, state.h * 0.43)));
    const cell = Math.floor(gridSize / GRID);
    const size = cell * GRID;
    return {
      x: Math.floor((state.w - size) / 2),
      y: top,
      cell,
      size,
      paletteY: top + size + 18,
      actionY: Math.min(state.h - 62, top + size + 112),
    };
  }

  function drawBuildGrid(l) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeRect(l.x - 3, l.y - 3, l.size + 6, l.size + 6);
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const px = l.x + x * l.cell;
        const py = l.y + y * l.cell;
        const b = state.design.blocks.find((q) => q.x === x && q.y === y);
        const place = canPlace(x, y);
        ctx.strokeStyle = place ? "#999" : PALE;
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, l.cell, l.cell);
        if (place && !b) {
          ctx.fillStyle = "#eee";
          ctx.fillRect(px + l.cell / 2 - 2, py + l.cell / 2 - 2, 4, 4);
        }
        if (b) drawBlockIcon(b.type, px + l.cell / 2, py + l.cell / 2, l.cell * 0.86, b.rot, { selected: b.id === state.selectedBlockId });
        addHit("cell", px, py, l.cell, l.cell, { gx: x, gy: y });
      }
    }
  }

  function drawBuildPalette(l) {
    const s = Math.min(54, Math.floor((state.w - 24) / PALETTE.length) - 6);
    const total = PALETTE.length * s + (PALETTE.length - 1) * 6;
    let x = (state.w - total) / 2;
    for (const type of PALETTE) {
      const active = state.selectedBlockType === type && !state.selectedBlockId;
      ctx.fillStyle = active ? INK : PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.fillRect(x, l.paletteY, s, s);
      ctx.strokeRect(x, l.paletteY, s, s);
      drawBlockIcon(type, x + s / 2, l.paletteY + s / 2, s * 0.72, defaultRot(type), { inverse: active });
      addHit("palette", x, l.paletteY, s, s, { type });
      x += s + 6;
    }
  }

  function drawBuildActions(l) {
    const labels = [
      ["ROTATE", "rotate"], ["DELETE", "delete"], ["RANDOM", "random"], ["WIRE", "wire"], ["FIGHT", "fight"],
    ];
    const gap = 6;
    const w = Math.floor((state.w - 24 - gap * 4) / 5);
    let x = 12;
    for (const [label, kind] of labels) {
      button(label, x, l.actionY, w, 44, kind === "fight");
      addHit(kind, x, l.actionY, w, 44);
      x += w + gap;
    }
  }

  function drawWire() {
    const l = wireLayout();
    text("ONE SCHEMATIC", 16, 54, 15, "left");
    drawWireColumns(l);
    drawWireLines(l);
    drawWireNodes(l);
    drawWireTools(l);
  }

  function wireLayout() {
    const top = 78;
    const colW = Math.floor((state.w - 38) / 3);
    return {
      top,
      nodeH: 27,
      gap: 7,
      colW,
      sensorX: 12,
      logicX: 19 + colW,
      actionX: 26 + colW * 2,
    };
  }

  function drawWireColumns(l) {
    text("SENSOR", l.sensorX + l.colW / 2, 61, 10, "center");
    text("LOGIC", l.logicX + l.colW / 2, 61, 10, "center");
    text("ACTION", l.actionX + l.colW / 2, 61, 10, "center");
  }

  function nodeRect(kind, id, l) {
    if (kind === "sensor") {
      const i = SENSORS.findIndex(([x]) => x === id);
      return { x: l.sensorX, y: l.top + i * (l.nodeH + l.gap), w: l.colW, h: l.nodeH };
    }
    if (kind === "action") {
      const i = ACTIONS.findIndex(([x]) => x === id);
      return { x: l.actionX, y: l.top + i * (l.nodeH + l.gap), w: l.colW, h: l.nodeH };
    }
    const i = state.design.schematic.logicNodes.findIndex((n) => n.id === id);
    return { x: l.logicX, y: l.top + i * (l.nodeH + l.gap), w: l.colW, h: l.nodeH };
  }

  function endpointPoint(ep, l) {
    if (ep.startsWith("sensor.")) {
      const id = ep.slice(7);
      const r = nodeRect("sensor", id, l);
      return { x: r.x + r.w, y: r.y + r.h / 2 };
    }
    if (ep.startsWith("action.")) {
      const id = ep.slice(7);
      const r = nodeRect("action", id, l);
      return { x: r.x, y: r.y + r.h / 2 };
    }
    const [id, port] = ep.split(".");
    const r = nodeRect("logic", id, l);
    if (port === "out") return { x: r.x + r.w, y: r.y + r.h / 2 };
    const input = Number((port || "in0").replace("in", "")) || 0;
    const node = state.design.schematic.logicNodes.find((n) => n.id === id);
    const n = Math.max(1, LOGIC_TYPES[node?.type]?.inputs || 1);
    return { x: r.x, y: r.y + ((input + 1) * r.h) / (n + 1) };
  }

  function drawWireLines(l) {
    const wires = state.design.schematic.wires;
    for (let i = 0; i < wires.length; i += 1) {
      const a = endpointPoint(wires[i].from, l);
      const b = endpointPoint(wires[i].to, l);
      const active = signalValue(wires[i].from);
      ctx.strokeStyle = active ? INK : "#999";
      ctx.lineWidth = active ? 5 : 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const mid = (a.x + b.x) / 2;
      ctx.bezierCurveTo(mid, a.y, mid, b.y, b.x, b.y);
      ctx.stroke();
      const hx = Math.min(a.x, b.x);
      const hy = Math.min(a.y, b.y) - 6;
      addHit("wireLine", hx, hy, Math.abs(b.x - a.x), Math.abs(b.y - a.y) + 12, { index: i });
    }
    if (state.wireFrom) {
      const p = endpointPoint(state.wireFrom, l);
      ctx.fillStyle = INK;
      ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
      text("TO?", state.w / 2, state.h - 26, 14, "center");
    }
  }

  function drawWireNodes(l) {
    for (const [id, label] of SENSORS) drawNodeBox(nodeRect("sensor", id, l), label, signalValue(`sensor.${id}`), "out", `sensor.${id}`);
    for (const node of state.design.schematic.logicNodes) {
      const r = nodeRect("logic", node.id, l);
      drawNodeBox(r, LOGIC_TYPES[node.type].label, signalValue(`${node.id}.out`), "both", node.id, LOGIC_TYPES[node.type].inputs, node.id === state.selectedLogicId);
      addHit("logic", r.x, r.y, r.w, r.h, { id: node.id });
    }
    for (const [id, label] of ACTIONS) drawNodeBox(nodeRect("action", id, l), label, false, "in", `action.${id}`);
  }

  function drawNodeBox(r, label, active, ports, endpoint, inputs = 1, selected = false) {
    ctx.fillStyle = active ? INK : PAPER;
    ctx.strokeStyle = selected ? INK : "#111";
    ctx.lineWidth = selected ? 4 : 2;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    text(label, r.x + r.w / 2, r.y + r.h / 2 + 1, 9, "center", active ? PAPER : INK);
    if (ports === "out" || ports === "both") {
      port(r.x + r.w, r.y + r.h / 2, "portOut", endpoint.includes(".") ? endpoint : `${endpoint}.out`);
    }
    if (ports === "in" || ports === "both") {
      const n = Math.max(1, inputs);
      for (let i = 0; i < n; i += 1) port(r.x, r.y + ((i + 1) * r.h) / (n + 1), "portIn", ports === "in" ? endpoint : `${endpoint}.in${i}`);
    }
  }

  function port(x, y, kind, endpoint) {
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    addHit(kind, x - 11, y - 11, 22, 22, { endpoint });
  }

  function drawWireTools(l) {
    const types = ["and", "or", "not", "timer", "random"];
    const bw = Math.floor((state.w - 28) / 6);
    const y = state.h - 50;
    let x = 8;
    for (const t of types) {
      button(`+${LOGIC_TYPES[t].label}`, x, y, bw, 38, false, 10);
      addHit("addLogic", x, y, bw, 38, { type: t });
      x += bw + 4;
    }
    button("DEL", x, y, bw, 38, false, 11);
    addHit("deleteLogic", x, y, bw, 38);
    button("FIGHT", state.w - 78, 42, 66, 28, true, 11);
    addHit("fight", state.w - 78, 42, 66, 28);
  }

  function signalValue(endpoint) {
    if (endpoint.startsWith("sensor.")) return !!state.battle?.player?.sensors?.[endpoint.slice(7)];
    return !!state.lastSignals?.[endpoint];
  }

  function drawFight() {
    const b = state.battle;
    if (!b) return;
    drawArena(b);
    drawBattleBot(b.player, b);
    drawBattleBot(b.enemy, b);
    drawBullets(b);
    drawParticles(b);
    drawFightHud(b);
    drawMiniCircuit(b);
  }

  function drawArena(b) {
    const ar = b.arena = fightArena();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeRect(ar.x, ar.y, ar.w, ar.h);
    for (let x = ar.x + 18; x < ar.x + ar.w; x += 28) {
      ctx.fillStyle = PALE;
      ctx.fillRect(x, ar.y + ar.h / 2, 8, 2);
    }
  }

  function drawBattleBot(bot, battle) {
    const scale = battleScale(battle);
    if (bot.stats.radars > 0) drawRadarCone(bot, battle);
    for (const bl of bot.blocks) {
      if (!bl.alive) continue;
      const p = blockWorld(bot, bl, scale);
      const rot = bot.bodyAngle + bl.rot * Math.PI / 2;
      drawBlockTop(bl.type, p.x, p.y, scale, rot, { flash: bl.flash, side: bot.side });
    }
    drawTurret(bot, battle);
  }

  function drawRadarCone(bot, battle) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.arc(bot.x, bot.y, Math.min(bot.radarRange, battle.arena.w * 0.75), bot.radarAngle - bot.radarFov, bot.radarAngle + bot.radarFov);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTurret(bot, battle) {
    const scale = battleScale(battle);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.lineTo(bot.x + Math.cos(bot.turretAngle) * scale * 2.1, bot.y + Math.sin(bot.turretAngle) * scale * 2.1);
    ctx.stroke();
    ctx.strokeStyle = bot.sensors.enemySeen ? INK : "#999";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.lineTo(bot.x + Math.cos(bot.radarAngle) * scale * 2.5, bot.y + Math.sin(bot.radarAngle) * scale * 2.5);
    ctx.stroke();
  }

  function drawBullets(battle) {
    ctx.fillStyle = INK;
    for (const bullet of battle.bullets) ctx.fillRect(bullet.x - 3, bullet.y - 3, 6, 6);
  }

  function drawParticles(battle) {
    ctx.fillStyle = INK;
    for (const p of battle.particles) ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  function drawFightHud(b) {
    text(`${state.design.name}`, 12, 50, 10, "left");
    text(`${b.enemy.design.name}`, state.w - 12, 50, 10, "right");
    hpBar(12, 62, 116, coreHp(b.player), BLOCKS.core.hp);
    hpBar(state.w - 128, 62, 116, coreHp(b.enemy), BLOCKS.core.hp);
    energyBar(12, 78, 116, b.player.energy, b.player.maxEnergy);
    text(`${Math.floor(Math.max(0, MAX_FIGHT - b.t))}`, state.w / 2, 54, 18, "center");
    const y = state.h - 46;
    button("RESTART", 10, y, 78, 34, false, 11);
    button("NEXT", 96, y, 58, 34, false, 11);
    button("BUILD", state.w - 154, y, 68, 34, false, 11);
    button("SHARE", state.w - 78, y, 68, 34, false, 11);
    addHit("restart", 10, y, 78, 34);
    addHit("nextEnemy", 96, y, 58, 34);
    addHit("build", state.w - 154, y, 68, 34);
    addHit("share", state.w - 78, y, 68, 34);
    if (b.result) {
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.fillRect(state.w / 2 - 98, state.h * 0.36 - 48, 196, 96);
      ctx.strokeRect(state.w / 2 - 98, state.h * 0.36 - 48, 196, 96);
      text(b.result, state.w / 2, state.h * 0.36 - 10, 34, "center");
      text(b.reason, state.w / 2, state.h * 0.36 + 25, 13, "center");
    }
  }

  function hpBar(x, y, w, hp, max) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, 9);
    ctx.fillStyle = INK;
    ctx.fillRect(x + 2, y + 2, (w - 4) * clamp(hp / max, 0, 1), 5);
  }

  function energyBar(x, y, w, energy, max) {
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, 7);
    ctx.fillStyle = "#777";
    ctx.fillRect(x + 2, y + 2, (w - 4) * clamp(energy / Math.max(1, max), 0, 1), 3);
  }

  function drawMiniCircuit(b) {
    const x = 12;
    const y = state.h - 94;
    const items = [
      ["SEE", b.player.sensors.enemySeen],
      ["GUN", b.player.sensors.gunReady],
      ["AIM", b.player.actions.aimAtEnemy],
      ["FIRE", b.player.actions.fire],
      ["MOVE", b.player.actions.moveForward || b.player.actions.moveBackward],
    ];
    let px = x;
    for (const [label, on] of items) {
      ctx.fillStyle = on ? INK : PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.fillRect(px, y, 44, 20);
      ctx.strokeRect(px, y, 44, 20);
      text(label, px + 22, y + 11, 8, "center", on ? PAPER : INK);
      px += 48;
    }
  }

  function drawShare() {
    text("BOT CODE", 16, 58, 15, "left");
    text("Export current BOT. Import a rival code without network.", 16, 86, 10, "left");
    if (state.opponent) text(`OPPONENT: ${state.opponent.name}`, 16, state.h - 110, 12, "left");
    button("FIGHT IMPORTED", 16, state.h - 72, state.w - 32, 42, true, 14);
    addHit("fightImported", 16, state.h - 72, state.w - 32, 42);
  }

  function drawBlockIcon(type, x, y, size, rot = 0, opt = {}) {
    drawBlockTop(type, x, y, size, rot * Math.PI / 2, opt);
  }

  function drawBlockTop(type, x, y, s, rot = 0, opt = {}) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(rot);
    const inverse = opt.inverse;
    const flash = opt.flash > 0;
    const ink = inverse || flash ? PAPER : INK;
    const paper = inverse || flash ? INK : PAPER;
    ctx.fillStyle = paper;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(2, Math.round(s / 7));
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    if (opt.selected) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.strokeRect(-s / 2 - 4, -s / 2 - 4, s + 8, s + 8);
    }
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(2, s / 11);
    if (type === "core") {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(-s * 0.08, -s * 0.08, s * 0.16, s * 0.16);
    } else if (type === "wheel") {
      ctx.fillRect(-s * 0.45, -s * 0.32, s * 0.15, s * 0.64);
      ctx.fillRect(s * 0.3, -s * 0.32, s * 0.15, s * 0.64);
      ctx.fillRect(-s * 0.2, -s * 0.08, s * 0.4, s * 0.16);
    } else if (type === "gun") {
      ctx.fillRect(-s * 0.16, -s * 0.16, s * 0.32, s * 0.32);
      ctx.fillRect(0, -s * 0.08, s * 0.46, s * 0.16);
      ctx.fillRect(s * 0.4, -s * 0.13, s * 0.12, s * 0.26);
    } else if (type === "radar") {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.23, -0.8, 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.35, -0.8, 0.8);
      ctx.stroke();
      ctx.fillRect(-s * 0.06, -s * 0.06, s * 0.12, s * 0.12);
      ctx.fillRect(0, -s * 0.04, s * 0.35, s * 0.08);
    } else if (type === "armor") {
      ctx.lineWidth = Math.max(3, s / 5.5);
      ctx.strokeRect(-s * 0.36, -s * 0.36, s * 0.72, s * 0.72);
      ctx.lineWidth = Math.max(2, s / 13);
      ctx.beginPath();
      ctx.moveTo(s * 0.22, -s * 0.34);
      ctx.lineTo(s * 0.22, s * 0.34);
      ctx.stroke();
    } else if (type === "battery") {
      ctx.strokeRect(-s * 0.28, -s * 0.26, s * 0.48, s * 0.52);
      ctx.fillRect(s * 0.2, -s * 0.1, s * 0.12, s * 0.2);
      ctx.fillRect(-s * 0.18, -s * 0.06, s * 0.24, s * 0.12);
      ctx.fillRect(-s * 0.08, -s * 0.16, s * 0.05, s * 0.32);
    }
    ctx.restore();
  }

  function button(label, x, y, w, h, active = false, size = 12) {
    ctx.fillStyle = active ? INK : PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    text(label, x + w / 2, y + h / 2 + 1, size, "center", active ? PAPER : INK);
  }

  function addHit(kind, x, y, w, h, data = {}) {
    state.hits.push({ kind, x, y, w, h, ...data });
  }

  function text(value, x, y, size, align = "left", color = INK) {
    ctx.fillStyle = color;
    ctx.font = `900 ${size}px "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), Math.round(x), Math.round(y));
  }

  function exportCode(design) {
    const clean = normalizeDesign(design);
    const json = JSON.stringify(clean);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return PREFIX + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function importCode(code) {
    const trimmed = String(code || "").trim();
    if (!trimmed.startsWith(PREFIX)) throw new Error("BAD PREFIX");
    let b64 = trimmed.slice(PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    if (raw.version !== 1) throw new Error("BAD VERSION");
    return validateImportedDesign(raw);
  }

  function validateImportedDesign(raw) {
    if (!raw || typeof raw !== "object") throw new Error("BAD JSON");
    if (!Array.isArray(raw.blocks) || raw.blocks.length > MAX_BLOCKS) throw new Error("BAD BLOCKS");
    if (!raw.schematic || !Array.isArray(raw.schematic.logicNodes) || !Array.isArray(raw.schematic.wires)) throw new Error("BAD SCHEMATIC");
    if (raw.schematic.logicNodes.length > MAX_LOGIC || raw.schematic.wires.length > MAX_WIRES) throw new Error("TOO MANY NODES");
    return normalizeDesign(raw);
  }

  function makeShareLayer() {
    const layer = document.createElement("div");
    layer.id = "share-ui";
    layer.innerHTML = `
      <label>EXPORT</label>
      <textarea id="export-code" readonly spellcheck="false"></textarea>
      <button id="copy-code" type="button">COPY</button>
      <label>IMPORT</label>
      <textarea id="import-code" spellcheck="false" placeholder="CBA1:..."></textarea>
      <button id="import-code-btn" type="button">IMPORT AS OPPONENT</button>
      <div id="share-message"></div>
    `;
    document.body.appendChild(layer);
    layer.querySelector("#copy-code").addEventListener("click", async () => {
      const value = layer.querySelector("#export-code").value;
      try {
        await navigator.clipboard.writeText(value);
        shareMessage("COPIED");
      } catch {
        layer.querySelector("#export-code").select();
        shareMessage("SELECTED");
      }
    });
    layer.querySelector("#import-code-btn").addEventListener("click", () => {
      try {
        const design = importCode(layer.querySelector("#import-code").value);
        saveOpponent(design);
        state.fightOpponent = state.opponent;
        shareMessage("IMPORTED");
      } catch (error) {
        shareMessage("INVALID CODE");
      }
    });
    return layer;
  }

  function positionShareLayer() {
    const rect = canvas.getBoundingClientRect();
    shareLayer.style.left = `${rect.left + rect.width / 2}px`;
    shareLayer.style.top = `${rect.top + 104}px`;
    shareLayer.style.width = `${Math.min(rect.width - 30, 520)}px`;
  }

  function syncShareLayer() {
    if (state.mode !== "share") {
      shareLayer.style.display = "none";
      return;
    }
    shareLayer.style.display = "block";
    const out = shareLayer.querySelector("#export-code");
    if (document.activeElement !== out) out.value = state.exportText;
    positionShareLayer();
  }

  function shareMessage(value) {
    const el = shareLayer.querySelector("#share-message");
    el.textContent = value;
    setTimeout(() => {
      if (el.textContent === value) el.textContent = "";
    }, 1600);
  }

  function toast(value) {
    state.toast = value;
    state.toastT = 0.9;
  }

  function frame(now) {
    if (!frame.last) frame.last = now;
    const dt = Math.min(0.05, (now - frame.last) / 1000);
    frame.last = now;
    if (state.toastT > 0) state.toastT -= dt;
    if (state.mode === "fight") updateFight(dt);
    draw();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function rand01(n) {
    const x = Math.sin(n * 999.13) * 43758.5453;
    return x - Math.floor(x);
  }

  function normAngle(a) {
    while (a <= -Math.PI) a += Math.PI * 2;
    while (a > Math.PI) a -= Math.PI * 2;
    return a;
  }

  function angleDiff(a, b) {
    return normAngle(a - b);
  }

  function approachAngle(current, target, step) {
    const d = angleDiff(target, current);
    if (Math.abs(d) <= step) return target;
    return normAngle(current + Math.sign(d) * step);
  }

  function hashString(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
})();
